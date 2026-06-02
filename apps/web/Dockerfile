FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --filter @conference/web... --frozen-lockfile

FROM deps AS dev
COPY apps/web ./apps/web
EXPOSE 5173
CMD ["pnpm", "--filter", "@conference/web", "run", "dev"]

FROM deps AS build
COPY apps/web ./apps/web
RUN pnpm --filter @conference/web run build

FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
