# Старт деплоя MVP на сервер

## Что уже известно

```text
Сервер: 45.151.102.212
Домен: commmmet.duckdns.org
ОС: Ubuntu 24.04
CPU/RAM: 2 dedicated cores / 4 GB RAM
Репозиторий: git@github.com:vyacheslavshtyrlin/conference.git
Путь деплоя: /opt/conference
Пользователь деплоя: deploy
GitHub environment: mvp-production
```

Для этого сервера стартовое значение `MEDIASOUP_NUM_WORKERS=1`. Второе ядро оставляем под nginx, API, web container, Redis, coturn, Docker и системные процессы. Если тесты покажут запас по CPU, можно проверить `2`, но начинать безопаснее с `1`.

## 0. Создать пользователя deploy

Эту часть выполнить первой. Команда `ssh-copy-id ... deploy@45.151.102.212` ниже сработает только после создания пользователя `deploy`.

Зайти на сервер под `root` или другим административным пользователем:

```sh
ssh root@45.151.102.212
```

Создать пользователя деплоя:

```sh
adduser deploy
usermod -aG sudo deploy
```

После этого можно выйти с сервера:

```sh
exit
```

## Что нужно сделать на GitHub

В репозитории `vyacheslavshtyrlin/conference`:

1. Открыть `Settings -> Environments`.
2. Создать environment `mvp-production`.
3. Включить required reviewer, чтобы деплой запускался только после ручного подтверждения.
4. Открыть `Settings -> Secrets and variables -> Actions`.
5. Добавить repository secrets:

```text
MVP_DEPLOY_HOST=45.151.102.212
MVP_DEPLOY_USER=deploy
MVP_DEPLOY_PATH=/opt/conference
MVP_DEPLOY_SSH_KEY=<private key для GitHub Actions -> server>
```

`MVP_DEPLOY_SSH_KEY` - это приватный ключ, которым GitHub Actions будет заходить на сервер по SSH. Его нельзя коммитить в git и нельзя класть в `.env`.

## SSH-ключи

Нужно два разных SSH-доступа.

### 1. GitHub Actions -> server

Этот ключ нужен, чтобы workflow мог зайти на сервер и выполнить `git pull` + `docker compose up`.

На локальной машине:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/conference_actions_to_server -N ""
```

Публичный ключ добавить на сервер в пользователя `deploy`:

```sh
ssh-copy-id -i ~/.ssh/conference_actions_to_server.pub deploy@45.151.102.212
```

Приватный ключ положить в GitHub secret `MVP_DEPLOY_SSH_KEY`:

```sh
cat ~/.ssh/conference_actions_to_server
```

### 2. Server -> GitHub repository

Этот ключ нужен самому серверу, чтобы команда `git pull --ff-only` могла читать приватный GitHub-репозиторий.

На сервере под пользователем `deploy`:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/conference_server_to_github -N ""
cat ~/.ssh/conference_server_to_github.pub
```

Публичный ключ добавить в GitHub:

```text
Repository -> Settings -> Deploy keys -> Add deploy key
Title: mvp-server-45.151.102.212
Key: <public key из conference_server_to_github.pub>
Allow write access: off
```

На сервере добавить SSH config:

```sh
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/conference_server_to_github
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
ssh -T git@github.com
```

Ожидаемый результат: GitHub отвечает, что аутентификация успешна, но shell access не предоставляется.

## Первичная настройка сервера

На этом этапе пользователь `deploy` уже создан.

Зайти на сервер под `deploy`:

```sh
ssh deploy@45.151.102.212
```

Если вы уже на сервере под `root` после шага 0, можно переключиться без нового SSH-подключения:

```sh
su - deploy
```

Установить зависимости:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

После добавления в группу `docker` нужно перелогиниться под `deploy`.

Создать swap на 2 GB:

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Открыть порты:

```sh
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 40000:40100/udp
sudo ufw enable
sudo ufw status
```

Важно: если у провайдера есть cloud firewall/security group, эти же порты нужно открыть там.

## Клонирование репозитория на сервер

Под пользователем `deploy`:

```sh
sudo mkdir -p /opt/conference
sudo chown deploy:deploy /opt/conference
git clone git@github.com:vyacheslavshtyrlin/conference.git /opt/conference
cd /opt/conference
```

## DuckDNS

DuckDNS subdomain уже создан:

```text
commmmet.duckdns.org -> 45.151.102.212
```

Проверка:

```sh
nslookup commmmet.duckdns.org
```

Должен вернуться `45.151.102.212`.

## Server `.env`

На сервере:

```sh
cd /opt/conference
cp .env.example .env
nano .env
```

Минимальные production-значения:

```env
NODE_ENV=production

DOMAIN=commmmet.duckdns.org
CERTBOT_EMAIL=<email>

WEB_PUBLIC_URL=https://commmmet.duckdns.org
MEDIA_NODE_ID=local
SIGNALING_PUBLIC_URL=wss://commmmet.duckdns.org/ws

VITE_API_BASE_URL=https://commmmet.duckdns.org/api/v1
VITE_SIGNALING_URL=wss://commmmet.duckdns.org/ws

REDIS_URL=redis://redis:6379

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=45.151.102.212
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100
MEDIASOUP_NUM_WORKERS=1

TURN_URL=turn:commmmet.duckdns.org:3478
TURN_USERNAME=<turn-user>
TURN_PASSWORD=<strong-turn-password>
TURN_REALM=commmmet.duckdns.org

JOIN_TOKEN_SECRET=<openssl-rand-hex-32>

WS_ALLOWED_ORIGINS=https://commmmet.duckdns.org
WS_HEARTBEAT_INTERVAL_MS=30000
WS_MAX_PAYLOAD_BYTES=65536
WS_SEND_BACKPRESSURE_BYTES=262144
WS_RATE_LIMIT_WINDOW_MS=10000
WS_RATE_LIMIT_MAX_MESSAGES=60
```

Сгенерировать `JOIN_TOKEN_SECRET`:

```sh
openssl rand -hex 32
```

## Nginx и TLS

```sh
cd /opt/conference
export DOMAIN=commmmet.duckdns.org

envsubst '$DOMAIN' < /opt/conference/nginx/conference.conf \
  | sudo tee /etc/nginx/sites-available/conference

sudo ln -sf /etc/nginx/sites-available/conference /etc/nginx/sites-enabled/conference
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d commmmet.duckdns.org
```

## Первый ручной запуск

```sh
cd /opt/conference
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose ps
```

Проверка:

```sh
curl https://commmmet.duckdns.org
curl https://commmmet.duckdns.org/api/v1/health
curl http://127.0.0.1:4000/ready
```

## Первый деплой через GitHub Actions

После ручного запуска и настройки secrets:

1. Открыть `Actions -> CI`.
2. Нажать `Run workflow`.
3. Выбрать branch `main`.
4. Запустить workflow.
5. Подтвердить environment `mvp-production`, если включен required reviewer.

Workflow выполнит:

```sh
cd /opt/conference
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
```

## Smoke test после деплоя

1. Открыть `https://commmmet.duckdns.org`.
2. Создать комнату.
3. Проверить, что creator попал на pre-join, а не сразу в live room.
4. Нажать Join.
5. Открыть публичную ссылку во втором браузере или на телефоне.
6. Войти гостем.
7. Проверить WSS-подключение, audio/video и desktop screen share.

Если WebSocket работает, но media не идет, первым делом проверить:

```sh
docker compose logs --tail=200 signaling
sudo ufw status
```

И убедиться, что `MEDIASOUP_ANNOUNCED_IP=45.151.102.212`, а UDP `40000-40100` открыт у провайдера.
