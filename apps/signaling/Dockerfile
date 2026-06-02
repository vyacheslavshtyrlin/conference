FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/signaling/package.json ./apps/signaling/package.json
RUN pnpm install --filter @conference/signaling... --frozen-lockfile

FROM deps AS dev
COPY apps/signaling ./apps/signaling
EXPOSE 4000
EXPOSE 40000-40100/udp
CMD ["pnpm", "--filter", "@conference/signaling", "run", "dev"]

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
EXPOSE 4000
EXPOSE 40000-40100/udp
CMD ["node", "apps/signaling/dist/main.js"]
