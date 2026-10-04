# Build from the repo root: docker build -f packages/client/Dockerfile --build-arg NEXT_PUBLIC_SERVER_URL=https://api.example.com .
FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:4000
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/simulation/package.json packages/simulation/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --workspace @maze/client --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/client packages/client
RUN npm run build -w @maze/client

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/packages/client/.next/standalone ./
COPY --from=build /app/packages/client/.next/static packages/client/.next/static
COPY --from=build /app/packages/client/public packages/client/public
USER node
EXPOSE 3000
CMD ["node", "packages/client/server.js"]
