# MVP Server Deployment

> Current immediate target: quick single-server deployment from this repository on DuckDNS.
>
> Use [DuckDNS Single-Server MVP Deployment](deployment-duckdns.md) for the current MVP.
>
> The future split-repository/three-server target is documented in [Three-Server Production Baseline](deployment-three-server.md).

One dedicated server. Docker Compose for all app services. nginx and certbot installed on the host OS. No Vercel.

## Traffic routing

```
Internet
  ├── :80 / :443  → nginx (host) → proxy_pass
  │                    ├── /         → 127.0.0.1:8080  (web:  nginx static build)
  │                    ├── /api/v1/  → 127.0.0.1:3000  (api:  NestJS)
  │                    └── /ws       → 127.0.0.1:4000  (signaling: WebSocket)
  ├── :3478 tcp/udp → coturn (Docker, direct)
  └── :40000-40100/udp → mediasoup RTP (Docker, direct)
```

## 1. Server prerequisites

Ubuntu 22.04 LTS or 24.04 LTS.

### 1.1 Create a deploy user

If the server only has `root` (bare metal / VPS without cloud-init), create a non-root user first.  
On cloud images (AWS, DigitalOcean, Hetzner) the `ubuntu` user already exists — skip to 1.2.

```bash
# Run as root
adduser deploy                   # set a password when prompted
usermod -aG sudo deploy
su - deploy                      # switch to the new user for all further steps
```

### 1.2 Configure git

```bash
git config --global user.name  "Deploy Bot"
git config --global user.email "deploy@example.com"
```

### 1.3 Install packages

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates curl git \
  nginx certbot python3-certbot-nginx

# Docker (official package)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker          # or log out and back in

docker --version
docker compose version
```

## 2. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 40000:40100/udp
sudo ufw enable
sudo ufw status
```

> **Note on Docker and UFW**: Docker manages its own iptables rules and can bypass UFW for ports bound on `0.0.0.0`. The app ports (3000, 4000, 5173) in the base `docker-compose.yml` are bound to `0.0.0.0`. To prevent external access to those ports either:
> - Add cloud provider security group rules (recommended — enforced at network level before the VM).
> - Or edit `/etc/docker/daemon.json`: `{"iptables": false}` and manage rules manually.
>
> The production compose overrides redis to `127.0.0.1:6379`. For web port 8080 the prod compose uses `127.0.0.1:8080:80`. Ports 3000 and 4000 rely on the cloud security group or cloud firewall to block external access.

## 3. DNS

```
conference.example.com  A  <server-public-ip>
```

Create the DNS record and wait for propagation before issuing the certificate.

## 4. Clone the repository

```bash
sudo mkdir -p /opt/conference
sudo chown "$USER":"$USER" /opt/conference
git clone git@github.com:<owner>/<repo>.git /opt/conference
cd /opt/conference
```

## 5. Create the server .env

```bash
cp .env.example .env
nano .env
```

Minimum required values:

```env
NODE_ENV=production

DOMAIN=conference.example.com
CERTBOT_EMAIL=admin@example.com

# Public URLs baked into the web bundle and used by the API for CORS / signaling join URL
WEB_PUBLIC_URL=https://conference.example.com
VITE_API_BASE_URL=https://conference.example.com/api/v1
VITE_SIGNALING_URL=wss://conference.example.com/ws
SIGNALING_PUBLIC_URL=wss://conference.example.com/ws
WS_ALLOWED_ORIGINS=https://conference.example.com

MEDIA_NODE_ID=local
REDIS_URL=redis://redis:6379

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<server-public-ip>
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100

TURN_URL=turn:conference.example.com:3478
TURN_USERNAME=<turn-username>
TURN_PASSWORD=<strong-turn-password>
TURN_REALM=conference.example.com

# Generate with: openssl rand -hex 32
JOIN_TOKEN_SECRET=<strong-random-secret>
```

## 6. Configure nginx

```bash
export DOMAIN=conference.example.com

envsubst '$DOMAIN' < /opt/conference/nginx/conference.conf \
  | sudo tee /etc/nginx/sites-available/conference

sudo ln -s /etc/nginx/sites-available/conference /etc/nginx/sites-enabled/

# Disable the default site if present
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

## 7. Issue TLS certificate

```bash
sudo certbot --nginx -d conference.example.com
```

certbot edits the nginx site config to add the HTTPS server block and SSL certificate paths, then reloads nginx. After this, the site serves HTTPS and redirects HTTP.

Renewal is automatic via the certbot systemd timer (`certbot.timer`).

## 8. First Docker Compose start

```bash
cd /opt/conference
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps
```

Allow 30–60 seconds for health checks to pass. Verify:

```bash
curl https://conference.example.com/api/v1/health
curl https://conference.example.com
```

## 9. GitHub Actions CD

### 9.1 Generate the deploy SSH key (local machine)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/conference_deploy -N ""

# Copy public key to the server
ssh-copy-id -i ~/.ssh/conference_deploy.pub deploy@<server-ip>

# Print the private key — you will paste it into GitHub
cat ~/.ssh/conference_deploy
```

### 9.2 Create the repository environment

1. Open the repository on GitHub.
2. **Settings → Environments → New environment**.
3. Name: `mvp-production`.
4. Enable **Required reviewers** and add yourself (gates every deploy behind manual approval).
5. Click **Save protection rules**.

### 9.3 Add repository secrets

**Settings → Secrets and variables → Actions → New repository secret** — create all four:

| Secret | Value |
|--------|-------|
| `MVP_DEPLOY_HOST` | Server public IP or hostname |
| `MVP_DEPLOY_USER` | SSH user (`deploy` or `ubuntu`) |
| `MVP_DEPLOY_PATH` | `/opt/conference` |
| `MVP_DEPLOY_SSH_KEY` | Full contents of `~/.ssh/conference_deploy` (private key) |

### 9.4 Enable GitHub Actions

**Settings → Actions → General → Allow all actions** (or restrict to your org).  
Ensure **Workflow permissions** → **Read and write permissions** is selected so the workflow can read secrets from the environment.

### 9.5 Protect the main branch (optional but recommended)

**Settings → Branches → Add branch protection rule**:
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass: select the service/deploy verification job
- ✅ Do not allow bypassing the above settings

### 9.6 Trigger a deploy

**Actions → CI → Run workflow → branch: `main` → Run workflow.**

The `deploy` job only runs when triggered manually (`workflow_dispatch`) on `main` and after `verify` passes. It SSHes to the server and runs:

```bash
cd /opt/conference
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

If `mvp-production` has required reviewers, GitHub will pause the deploy job and send an email asking for approval before the SSH step executes.

## Post-deploy checks

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 signaling

curl https://conference.example.com/api/v1/health
curl https://conference.example.com
```

Media connectivity:

- `MEDIASOUP_ANNOUNCED_IP` is the public server IP.
- `40000-40100/udp` open in both UFW and cloud security group.
- `3478/tcp` and `3478/udp` open for TURN.
- `SIGNALING_PUBLIC_URL` uses `wss://`.
- Browser opens the app over HTTPS (required for camera/mic permissions).

## Rollback

```bash
cd /opt/conference
git log --oneline -5
git checkout <previous-commit-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Return to main:

```bash
git checkout main && git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
