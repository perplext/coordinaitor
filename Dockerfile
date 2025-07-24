# Build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies
RUN npm ci
RUN cd web && npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build
RUN cd web && npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist

# Copy configuration files
COPY config ./config
COPY templates ./templates
COPY workflows ./workflows

# Create necessary directories
RUN mkdir -p logs knowledge

# Set user
USER node

# Use tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Expose ports
EXPOSE 3000 4000