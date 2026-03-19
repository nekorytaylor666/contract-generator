FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Copy workspace config and all package.jsons
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/config/package.json packages/config/
COPY packages/infra/package.json packages/infra/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/server/ apps/server/
COPY packages/ packages/

# Build the server (tsdown bundles all @contract-builder/* packages)
RUN cd apps/server && pnpm run build

# Production stage - use Bun for runtime (Hono export default convention)
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./package.json

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "dist/index.mjs"]
