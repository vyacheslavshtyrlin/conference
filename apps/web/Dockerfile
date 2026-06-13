FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache python3 py3-pip make g++ linux-headers
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/signaling/package.json ./apps/signaling/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @conference/contracts --filter @conference/config --filter @conference/logger run build

FROM deps AS dev
COPY apps/web ./apps/web
EXPOSE 5173
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:5173 || exit 1
CMD ["pnpm", "--filter", "@conference/web", "run", "dev"]

FROM deps AS build
ARG VITE_API_BASE_URL
ARG VITE_SIGNALING_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SIGNALING_URL=${VITE_SIGNALING_URL}
COPY apps/web ./apps/web
RUN pnpm --filter @conference/web run build

FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:80/health || exit 1
