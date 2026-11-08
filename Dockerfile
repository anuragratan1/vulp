# Multi-stage production build for VULP Workflow Automation Platform
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./
COPY packages/engine/package*.json ./packages/engine/
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies
RUN npm ci

# Copy source code and configs
COPY tsconfig.json ./
COPY packages/engine ./packages/engine
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build packages (engine, web, server)
RUN npm run build

# Prune dev dependencies for lean production image
RUN npm prune --omit=dev

# ------------------------------------------------------------------------------
# Production Runner
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DB_DIR=/app/data

# Create data directory with permissions
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production artifacts from builder
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/engine/package*.json ./packages/engine/
COPY --from=builder --chown=node:node /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder --chown=node:node /app/packages/engine/node_modules ./packages/engine/node_modules
COPY --from=builder --chown=node:node /app/apps/server/package*.json ./apps/server/
COPY --from=builder --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=node:node /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder --chown=node:node /app/apps/web/package*.json ./apps/web/
COPY --from=builder --chown=node:node /app/apps/web/dist ./apps/web/dist

# Persistent SQLite database volume
VOLUME ["/app/data"]

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Run as non-privileged user
USER node

CMD ["node", "apps/server/dist/index.js"]
