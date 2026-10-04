# Build from the repo root: docker build -f packages/server/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/simulation/package.json packages/simulation/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --workspace @maze/server --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/simulation packages/simulation
COPY packages/server packages/server
RUN npm run build -w @maze/server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/simulation/package.json packages/simulation/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --workspace @maze/server --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/packages/server/dist packages/server/dist
COPY packages/server/src/db/migrations packages/server/src/db/migrations
WORKDIR /app/packages/server
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/index.js"]
