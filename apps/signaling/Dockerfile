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
COPY apps/signaling ./apps/signaling
WORKDIR /app/apps/signaling
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:4000/health || exit 1
CMD ["node", "/app/node_modules/tsx/dist/cli.mjs", "watch", "src/main.ts"]

FROM deps AS build
COPY apps/signaling ./apps/signaling
RUN pnpm --filter @conference/signaling run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/signaling/package.json ./apps/signaling/package.json
COPY --from=build /app/apps/signaling/dist ./apps/signaling/dist
RUN mkdir -p node_modules/@conference && \
  rm -rf node_modules/@conference/config node_modules/@conference/contracts node_modules/@conference/logger && \
  ln -s ../../packages/config node_modules/@conference/config && \
  ln -s ../../packages/contracts node_modules/@conference/contracts && \
  ln -s ../../packages/logger node_modules/@conference/logger
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:4000/health || exit 1
CMD ["node", "apps/signaling/dist/apps/signaling/src/main.js"]
