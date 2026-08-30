# ==========================================
# 1. BUILD STAGE
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build TypeScript bundle
COPY src ./src
RUN npm run build

# ==========================================
# 2. PRODUCTION RUNTIME STAGE
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JavaScript dist from builder stage
COPY --from=builder /app/dist ./dist

# Copy database schema/seeds for migration runner if needed
COPY src/database/schema.sql ./dist/database/schema.sql

# Non-root user for security
USER node

EXPOSE 5001

CMD ["node", "dist/server.js"]
