FROM node:22.22.0-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22.22.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app -g 10001 && adduser -S app -u 10001 -G app
COPY --from=production-dependencies --chown=app:app /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app
EXPOSE 3000
CMD ["node", "dist/server.js"]
