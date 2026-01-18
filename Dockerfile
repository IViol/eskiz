FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY package-lock.json* ./

# Copy workspace package files
COPY packages/spec/package.json ./packages/spec/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm ci

# Copy source files
COPY packages/spec ./packages/spec
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build packages and apps
RUN npm run build --workspace=packages/spec
RUN npm run build --workspace=apps/api

FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY package-lock.json* ./

# Copy workspace package files
COPY packages/spec/package.json ./packages/spec/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/spec/dist ./packages/spec/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/tsconfig.base.json ./

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/index.js"]
