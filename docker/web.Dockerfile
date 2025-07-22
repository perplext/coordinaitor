FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./web/
WORKDIR /app/web
RUN npm ci

# Copy source files
COPY web/ .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]