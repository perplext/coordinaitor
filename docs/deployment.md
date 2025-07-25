# Deployment Guide

This comprehensive guide covers all deployment options for the CoordinAItor, from local development to enterprise-scale production deployments across various platforms and orchestration systems.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Platform Deployments](#cloud-platform-deployments)
- [Traditional Server Deployment](#traditional-server-deployment)
- [Environment-Specific Configurations](#environment-specific-configurations)
- [Database Setup](#database-setup)
- [Load Balancing and High Availability](#load-balancing-and-high-availability)
- [Monitoring and Observability](#monitoring-and-observability)
- [Security Considerations](#security-considerations)
- [Performance Optimization](#performance-optimization)
- [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Troubleshooting](#troubleshooting)

## Overview

The CoordinAItor can be deployed in various configurations:

### Deployment Options
- **Development**: Local development with Docker Compose
- **Staging**: Single-server deployment with Docker
- **Production**: Multi-server deployment with Kubernetes
- **Enterprise**: High-availability deployment with auto-scaling

### Architecture Components
- **API Server**: Node.js application server
- **Web UI**: React frontend application
- **Database**: PostgreSQL with Redis cache
- **Queue System**: Redis-based task queue
- **Monitoring**: Prometheus + Grafana
- **Load Balancer**: Nginx or cloud load balancer

## Prerequisites

### System Requirements

#### Minimum Requirements (Development)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100 Mbps

#### Recommended Requirements (Production)
- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB SSD
- **Network**: 1 Gbps

#### High-Availability Requirements
- **CPU**: 16+ cores (per node)
- **RAM**: 32GB+ (per node)
- **Storage**: 500GB+ SSD with IOPS 3000+
- **Network**: 10 Gbps with redundancy

### Software Dependencies
- **Docker**: 20.10+ and Docker Compose 2.0+
- **Kubernetes**: 1.24+ (for Kubernetes deployments)
- **Node.js**: 18.0+ (for traditional deployments)
- **PostgreSQL**: 15+
- **Redis**: 7+
- **Nginx**: 1.20+ (for reverse proxy)

### External Services
- **AI Provider APIs**: OpenAI, Anthropic, Google AI, etc.
- **Email Service**: SMTP server or service (SendGrid, SES)
- **Object Storage**: AWS S3, Google Cloud Storage, or MinIO
- **Monitoring**: External monitoring services (optional)

## Docker Deployment

### Development Deployment

#### Docker Compose Setup

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: orchestrator-postgres
    environment:
      POSTGRES_DB: multi_agent_orchestrator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./src/database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    ports:
      - "5432:5432"
    networks:
      - orchestrator-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache and Queue
  redis:
    image: redis:7-alpine
    container_name: orchestrator-redis
    command: redis-server --appendonly yes --requirepass redis_password
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - orchestrator-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # API Server
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    container_name: orchestrator-api
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/multi_agent_orchestrator
      REDIS_URL: redis://:redis_password@redis:6379
      JWT_SECRET: dev-jwt-secret-key-32-characters-long
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      LOG_LEVEL: debug
    volumes:
      - .:/app
      - /app/node_modules
      - uploads:/app/uploads
    ports:
      - "3000:3000"
    networks:
      - orchestrator-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Web UI
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      target: development
    container_name: orchestrator-web
    environment:
      REACT_APP_API_URL: http://localhost:3000
      REACT_APP_WS_URL: ws://localhost:3000
    volumes:
      - ./web:/app
      - /app/node_modules
    ports:
      - "3001:3001"
    networks:
      - orchestrator-network
    depends_on:
      - api

  # Development Tools
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: orchestrator-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@orchestrator.com
      PGADMIN_DEFAULT_PASSWORD: admin123
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    ports:
      - "5050:80"
    networks:
      - orchestrator-network
    depends_on:
      - postgres

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: orchestrator-redis-commander
    environment:
      REDIS_HOSTS: redis:redis:6379:0:redis_password
    ports:
      - "8081:8081"
    networks:
      - orchestrator-network
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
  pgadmin_data:
  uploads:

networks:
  orchestrator-network:
    driver: bridge
```

#### Running Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

### Production Docker Deployment

#### Multi-Stage Dockerfile

Create optimized `Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies
RUN npm ci --only=production && \
    cd web && npm ci --only=production

# Copy source code
COPY . .

# Build applications
RUN npm run build && \
    cd web && npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=orchestrator:nodejs /app/dist ./dist
COPY --from=builder --chown=orchestrator:nodejs /app/web/build ./web/build
COPY --from=builder --chown=orchestrator:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=orchestrator:nodejs /app/package.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && \
    chown -R orchestrator:nodejs /app

USER orchestrator

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/healthcheck.js

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

#### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: orchestrator-nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - static_files:/var/www/static
    ports:
      - "80:80"
      - "443:443"
    networks:
      - orchestrator-network
    depends_on:
      - api
      - web
    restart: unless-stopped

  # API Server (Multiple instances)
  api:
    image: orchestrator-api:latest
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/multi_agent_orchestrator
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
    networks:
      - orchestrator-network
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Web UI
  web:
    image: orchestrator-web:latest
    environment:
      NODE_ENV: production
    volumes:
      - static_files:/app/build
    networks:
      - orchestrator-network
    restart: unless-stopped

  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: multi_agent_orchestrator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - orchestrator-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - orchestrator-network
    restart: unless-stopped

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - orchestrator-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
    networks:
      - orchestrator-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  uploads:
  logs:
  static_files:

networks:
  orchestrator-network:
    driver: bridge
```

#### Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        least_conn;
        server api:3000 max_fails=3 fail_timeout=30s;
        server api:3000 max_fails=3 fail_timeout=30s;
        server api:3000 max_fails=3 fail_timeout=30s;
    }

    upstream websocket_backend {
        ip_hash;
        server api:3000;
        server api:3000;
        server api:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Main server block
    server {
        listen 80;
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Redirect HTTP to HTTPS
        if ($scheme != "https") {
            return 301 https://$host$request_uri;
        }

        # Static files
        location / {
            root /var/www/static;
            try_files $uri $uri/ /index.html;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # WebSocket endpoints
        location /ws {
            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        # Authentication endpoints (stricter rate limiting)
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health checks
        location /health {
            proxy_pass http://api_backend;
            access_log off;
        }

        # File uploads
        location /api/upload {
            client_max_body_size 100M;
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_request_buffering off;
        }
    }
}
```

## Kubernetes Deployment

### Namespace and ConfigMap

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: orchestrator
  labels:
    app: coordinaitor
```

Create `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: orchestrator-config
  namespace: orchestrator
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "multi_agent_orchestrator"
  PROMETHEUS_ENABLED: "true"
  WEBSOCKET_ENABLED: "true"
```

### Secrets

Create `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: orchestrator-secrets
  namespace: orchestrator
type: Opaque
stringData:
  JWT_SECRET: "your-super-secure-jwt-secret-key"
  DATABASE_URL: "postgresql://postgres:password@postgres-service:5432/multi_agent_orchestrator"
  REDIS_PASSWORD: "redis-password"
  OPENAI_API_KEY: "sk-your-openai-key"
  ANTHROPIC_API_KEY: "sk-ant-your-anthropic-key"
  GOOGLE_AI_API_KEY: "your-google-ai-key"
```

### PostgreSQL Deployment

Create `k8s/postgres.yaml`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: orchestrator
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: multi_agent_orchestrator
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: orchestrator-secrets
              key: POSTGRES_PASSWORD
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
      storageClassName: ssd

---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: orchestrator
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### Redis Deployment

Create `k8s/redis.yaml`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: orchestrator
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --requirepass
        - $(REDIS_PASSWORD)
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: orchestrator-secrets
              key: REDIS_PASSWORD
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: redis-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
      storageClassName: ssd

---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: orchestrator
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

### API Server Deployment

Create `k8s/api.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator-api
  namespace: orchestrator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orchestrator-api
  template:
    metadata:
      labels:
        app: orchestrator-api
    spec:
      containers:
      - name: api
        image: your-registry/orchestrator-api:latest
        envFrom:
        - configMapRef:
            name: orchestrator-config
        - secretRef:
            name: orchestrator-secrets
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc
      - name: logs
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: orchestrator-api-service
  namespace: orchestrator
spec:
  selector:
    app: orchestrator-api
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-pvc
  namespace: orchestrator
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 50Gi
  storageClassName: nfs
```

### Web UI Deployment

Create `k8s/web.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator-web
  namespace: orchestrator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orchestrator-web
  template:
    metadata:
      labels:
        app: orchestrator-web
    spec:
      containers:
      - name: web
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: web-content
          mountPath: /usr/share/nginx/html
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
      initContainers:
      - name: web-content-init
        image: your-registry/orchestrator-web:latest
        command: ['sh', '-c', 'cp -r /app/build/* /shared/']
        volumeMounts:
        - name: web-content
          mountPath: /shared
      volumes:
      - name: web-content
        emptyDir: {}
      - name: nginx-config
        configMap:
          name: nginx-config

---
apiVersion: v1
kind: Service
metadata:
  name: orchestrator-web-service
  namespace: orchestrator
spec:
  selector:
    app: orchestrator-web
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### Ingress Configuration

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orchestrator-ingress
  namespace: orchestrator
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/websocket-services: "orchestrator-api-service"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
spec:
  tls:
  - hosts:
    - orchestrator.your-domain.com
    secretName: orchestrator-tls
  rules:
  - host: orchestrator.your-domain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: orchestrator-api-service
            port:
              number: 3000
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: orchestrator-api-service
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: orchestrator-web-service
            port:
              number: 80
```

### Horizontal Pod Autoscaler

Create `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orchestrator-api-hpa
  namespace: orchestrator
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orchestrator-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Deployment Commands

```bash
# Apply all Kubernetes configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Check deployment status
kubectl get pods -n orchestrator
kubectl get services -n orchestrator
kubectl get ingress -n orchestrator

# View logs
kubectl logs -f deployment/orchestrator-api -n orchestrator

# Scale deployment
kubectl scale deployment orchestrator-api --replicas=5 -n orchestrator
```

## Cloud Platform Deployments

### AWS Deployment

#### ECS Deployment

Create `aws/task-definition.json`:

```json
{
  "family": "orchestrator-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "orchestrator-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/orchestrator-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:orchestrator/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:orchestrator/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/orchestrator-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### CloudFormation Template

Create `aws/cloudformation.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'CoordinAItor Infrastructure'

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
    Description: VPC ID for deployment
  
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Subnet IDs for deployment
  
  CertificateArn:
    Type: String
    Description: SSL certificate ARN

Resources:
  # RDS Database
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS
      SubnetIds: !Ref SubnetIds

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: orchestrator-db
      DBInstanceClass: db.r5.large
      Engine: postgres
      EngineVersion: '15.4'
      AllocatedStorage: 100
      StorageType: gp3
      DBName: multi_agent_orchestrator
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      BackupRetentionPeriod: 30
      MultiAZ: true
      StorageEncrypted: true
      DeletionProtection: true

  # ElastiCache Redis
  RedisSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for Redis
      SubnetIds: !Ref SubnetIds

  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: orchestrator-redis
      Description: Redis cluster for orchestrator
      NodeType: cache.r6g.large
      NumCacheClusters: 2
      Port: 6379
      CacheSubnetGroupName: !Ref RedisSubnetGroup
      SecurityGroupIds:
        - !Ref RedisSecurityGroup
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true
      AutomaticFailoverEnabled: true

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: orchestrator-cluster
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  # Application Load Balancer
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: orchestrator-alb
      Type: application
      Scheme: internet-facing
      Subnets: !Ref SubnetIds
      SecurityGroups:
        - !Ref LoadBalancerSecurityGroup

  # Security Groups
  LoadBalancerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for load balancer
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for database
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref ECSSecurityGroup

  RedisSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Redis
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 6379
          ToPort: 6379
          SourceSecurityGroupId: !Ref ECSSecurityGroup

  ECSSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for ECS tasks
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          SourceSecurityGroupId: !Ref LoadBalancerSecurityGroup
```

### Google Cloud Platform Deployment

#### GKE Deployment

Create `gcp/cluster.yaml`:

```yaml
apiVersion: container.v1
kind: Cluster
metadata:
  name: orchestrator-cluster
spec:
  location: us-central1
  initialNodeCount: 3
  nodeConfig:
    machineType: e2-standard-4
    diskSizeGb: 100
    diskType: pd-ssd
    imageType: COS_CONTAINERD
    oauthScopes:
      - https://www.googleapis.com/auth/cloud-platform
  addonsConfig:
    horizontalPodAutoscaling:
      disabled: false
    httpLoadBalancing:
      disabled: false
    networkPolicyConfig:
      disabled: false
  networkPolicy:
    enabled: true
  workloadIdentityConfig:
    workloadPool: PROJECT_ID.svc.id.goog
```

#### Cloud SQL Configuration

```bash
# Create Cloud SQL instance
gcloud sql instances create orchestrator-db \
    --database-version=POSTGRES_15 \
    --tier=db-standard-2 \
    --region=us-central1 \
    --storage-type=SSD \
    --storage-size=100GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --deletion-protection

# Create database
gcloud sql databases create multi_agent_orchestrator \
    --instance=orchestrator-db

# Create user
gcloud sql users create orchestrator \
    --instance=orchestrator-db \
    --password=secure-password
```

### Azure Deployment

#### Container Apps Deployment

Create `azure/container-app.yaml`:

```yaml
apiVersion: app.containers.azure.com/v1beta1
kind: ContainerApp
metadata:
  name: orchestrator-api
spec:
  managedEnvironmentId: /subscriptions/SUBSCRIPTION_ID/resourceGroups/RESOURCE_GROUP/providers/Microsoft.App/managedEnvironments/orchestrator-env
  configuration:
    secrets:
    - name: database-url
      value: postgresql://username:password@server:5432/database
    - name: jwt-secret
      value: your-jwt-secret
    ingress:
      external: true
      targetPort: 3000
      traffic:
      - weight: 100
        latestRevision: true
    dapr:
      enabled: false
  template:
    containers:
    - image: your-registry.azurecr.io/orchestrator-api:latest
      name: orchestrator-api
      env:
      - name: NODE_ENV
        value: production
      - name: DATABASE_URL
        secretRef: database-url
      - name: JWT_SECRET
        secretRef: jwt-secret
      resources:
        cpu: 1.0
        memory: 2Gi
    scale:
      minReplicas: 2
      maxReplicas: 10
      rules:
      - name: cpu
        custom:
          type: cpu
          metadata:
            type: Utilization
            value: "70"
```

## Traditional Server Deployment

### Ubuntu Server Setup

#### System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 15
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Install Nginx
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install PM2 for process management
sudo npm install -g pm2

# Install monitoring tools
sudo apt install htop iotop nethogs
```

#### Application Setup

```bash
# Create application user
sudo useradd -m -s /bin/bash orchestrator
sudo usermod -aG sudo orchestrator

# Switch to application user
sudo su - orchestrator

# Clone application
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor

# Install dependencies
npm install
cd web && npm install && cd ..

# Build applications
npm run build:all

# Create directories
mkdir -p logs uploads backups
```

#### Database Setup

```bash
# Configure PostgreSQL
sudo -u postgres psql << EOF
CREATE DATABASE multi_agent_orchestrator;
CREATE USER orchestrator WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE multi_agent_orchestrator TO orchestrator;
\q
EOF

# Run migrations
npm run migration:run

# Create database backup script
cat > /home/orchestrator/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/orchestrator/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U orchestrator multi_agent_orchestrator > "$BACKUP_DIR/db_backup_$DATE.sql"
# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
EOF

chmod +x /home/orchestrator/backup-db.sh

# Add to crontab
crontab << EOF
0 2 * * * /home/orchestrator/backup-db.sh
EOF
```

#### PM2 Process Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'orchestrator-api',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'postgresql://orchestrator:secure_password@localhost:5432/multi_agent_orchestrator',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'your-super-secure-jwt-secret-key',
        OPENAI_API_KEY: 'your-openai-key',
        ANTHROPIC_API_KEY: 'your-anthropic-key'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=2048',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true
    }
  ]
};
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/orchestrator`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Static files
    location / {
        root /home/orchestrator/coordinaitor/web/build;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # File uploads
    location /api/upload {
        client_max_body_size 100M;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/orchestrator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup

# View logs
pm2 logs orchestrator-api

# Monitor processes
pm2 monit
```

## Environment-Specific Configurations

### Development Environment

```env
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orchestrator_dev
REDIS_URL=redis://localhost:6379
WEBPACK_DEV_SERVER=true
HOT_RELOAD=true
RATE_LIMIT_ENABLED=false
```

### Staging Environment

```env
NODE_ENV=staging
LOG_LEVEL=info
DATABASE_URL=postgresql://postgres:password@staging-db:5432/orchestrator_staging
REDIS_URL=redis://staging-redis:6379
RATE_LIMIT_ENABLED=true
MONITORING_ENABLED=true
```

### Production Environment

```env
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_URL=postgresql://user:password@prod-db:5432/orchestrator_prod
REDIS_URL=redis://prod-redis:6379
TRUST_PROXY=true
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
MONITORING_ENABLED=true
BACKUP_ENABLED=true
```

## Database Setup

### PostgreSQL Configuration

#### Production Configuration

Edit `/etc/postgresql/15/main/postgresql.conf`:

```conf
# Memory settings
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB

# Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Connection settings
max_connections = 200
superuser_reserved_connections = 3

# Logging
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200
```

#### Replication Setup

```bash
# On primary server
sudo -u postgres psql << EOF
CREATE USER replica_user REPLICATION LOGIN ENCRYPTED PASSWORD 'replica_password';
EOF

# Edit pg_hba.conf
echo "host replication replica_user REPLICA_IP/32 md5" >> /etc/postgresql/15/main/pg_hba.conf

# On replica server
sudo systemctl stop postgresql
sudo -u postgres pg_basebackup -h PRIMARY_IP -D /var/lib/postgresql/15/main -U replica_user -P -v -R -W -C -S replica_1
sudo systemctl start postgresql
```

### Redis Configuration

#### Production Redis Setup

Edit `/etc/redis/redis.conf`:

```conf
# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass your_redis_password
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command DEBUG ""

# Networking
bind 127.0.0.1 PRIVATE_IP
protected-mode yes
port 6379

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

#### Redis Cluster Setup

```bash
# Create cluster configuration for each node
for port in 7000 7001 7002 7003 7004 7005; do
  mkdir -p /etc/redis/cluster/$port
  cat > /etc/redis/cluster/$port/redis.conf << EOF
port $port
cluster-enabled yes
cluster-config-file nodes-$port.conf
cluster-node-timeout 5000
appendonly yes
bind 0.0.0.0
protected-mode no
EOF
done

# Start cluster nodes
for port in 7000 7001 7002 7003 7004 7005; do
  redis-server /etc/redis/cluster/$port/redis.conf &
done

# Create cluster
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 --cluster-replicas 1
```

## Load Balancing and High Availability

### HAProxy Configuration

Create `/etc/haproxy/haproxy.cfg`:

```conf
global
    daemon
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    option dontlognull
    option redispatch
    retries 3

# Frontend
frontend orchestrator_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/orchestrator.pem
    redirect scheme https if !{ ssl_fc }
    
    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request reject if { sc_http_req_rate(0) gt 20 }
    
    # Routing
    use_backend api_backend if { path_beg /api }
    use_backend websocket_backend if { path_beg /ws }
    default_backend web_backend

# API Backend
backend api_backend
    balance roundrobin
    option httpchk GET /health
    server api1 10.0.1.10:3000 check
    server api2 10.0.1.11:3000 check
    server api3 10.0.1.12:3000 check

# WebSocket Backend
backend websocket_backend
    balance source
    option httpchk GET /health
    server api1 10.0.1.10:3000 check
    server api2 10.0.1.11:3000 check
    server api3 10.0.1.12:3000 check

# Web Backend
backend web_backend
    balance roundrobin
    option httpchk GET /
    server web1 10.0.1.20:80 check
    server web2 10.0.1.21:80 check

# Statistics
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
```

### Keepalived Configuration

Create `/etc/keepalived/keepalived.conf`:

```conf
vrrp_script chk_haproxy {
    script "/bin/kill -0 `cat /var/run/haproxy.pid`"
    interval 2
    weight 2
    fall 3
    rise 2
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 101
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass your_password
    }
    virtual_ipaddress {
        10.0.1.100
    }
    track_script {
        chk_haproxy
    }
}
```

## Monitoring and Observability

### Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'orchestrator-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: /metrics
    scrape_interval: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### Grafana Dashboards

Create `grafana/dashboards/orchestrator.json`:

```json
{
  "dashboard": {
    "id": null,
    "title": "CoordinAItor",
    "tags": ["orchestrator"],
    "timezone": "UTC",
    "panels": [
      {
        "id": 1,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Response Time (s)",
            "min": 0
          }
        ]
      },
      {
        "id": 2,
        "title": "Active Tasks",
        "type": "singlestat",
        "targets": [
          {
            "expr": "orchestrator_active_tasks_total",
            "legendFormat": "Active Tasks"
          }
        ]
      },
      {
        "id": 3,
        "title": "Agent Utilization",
        "type": "graph",
        "targets": [
          {
            "expr": "orchestrator_agent_utilization_ratio",
            "legendFormat": "{{agent_id}}"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "10s"
  }
}
```

### Alert Rules

Create `alert_rules.yml`:

```yaml
groups:
- name: orchestrator.rules
  rules:
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is above 1 second"

  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
      description: "PostgreSQL database is not responding"

  - alert: RedisDown
    expr: up{job="redis"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Redis is down"
      description: "Redis cache is not responding"

  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is above 90%"

  - alert: DiskSpaceLow
    expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Low disk space"
      description: "Disk usage is above 90%"
```

## Security Considerations

### SSL/TLS Configuration

#### Let's Encrypt Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Custom Certificate Setup

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out certificate.csr

# Generate self-signed certificate (for testing)
openssl x509 -req -days 365 -in certificate.csr -signkey private.key -out certificate.crt

# Combine for nginx
cat certificate.crt intermediate.crt > chained.crt
```

### Firewall Configuration

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Application-specific rules
sudo ufw allow from 10.0.0.0/8 to any port 5432  # PostgreSQL
sudo ufw allow from 10.0.0.0/8 to any port 6379  # Redis
sudo ufw allow from 10.0.0.0/8 to any port 9090  # Prometheus
```

### Security Headers

Nginx security configuration:

```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: https:;" always;

# Hide server version
server_tokens off;

# Prevent access to hidden files
location ~ /\. {
    deny all;
    return 404;
}
```

## Performance Optimization

### Database Optimization

#### PostgreSQL Tuning

```sql
-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status);
CREATE INDEX CONCURRENTLY idx_tasks_created_at ON tasks(created_at);
CREATE INDEX CONCURRENTLY idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX CONCURRENTLY idx_tasks_project_id ON tasks(project_id);

-- Composite indexes
CREATE INDEX CONCURRENTLY idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX CONCURRENTLY idx_tasks_project_status ON tasks(project_id, status);

-- Partial indexes
CREATE INDEX CONCURRENTLY idx_tasks_active ON tasks(id) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_tasks_pending ON tasks(id) WHERE status = 'pending';

-- Analyze tables
ANALYZE tasks;
ANALYZE agents;
ANALYZE projects;
```

#### Connection Pooling

```javascript
// Database connection pool configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: 5,
  max: 50,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
  createTimeoutMillis: 3000,
  destroyTimeoutMillis: 5000,
  createRetryIntervalMillis: 200,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200
});
```

### Application Optimization

#### Caching Strategy

```javascript
// Multi-level caching
const cacheConfig = {
  // L1: In-memory cache
  memory: {
    ttl: 60, // 1 minute
    max: 1000
  },
  // L2: Redis cache
  redis: {
    ttl: 300, // 5 minutes
    keyPrefix: 'orchestrator:'
  },
  // L3: Database with query optimization
  database: {
    queryTimeout: 30000,
    maxConnections: 50
  }
};
```

#### Asset Optimization

```javascript
// Webpack production configuration
module.exports = {
  mode: 'production',
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  plugins: [
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
  ],
};
```

## Backup and Disaster Recovery

### Database Backup Strategy

#### Automated Backup Script

```bash
#!/bin/bash
# backup-database.sh

set -e

BACKUP_DIR="/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -b -v -f "$BACKUP_DIR/full_backup_$DATE.dump"

# Compress backup
gzip "$BACKUP_DIR/full_backup_$DATE.dump"

# Upload to S3 (optional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    aws s3 cp "$BACKUP_DIR/full_backup_$DATE.dump.gz" "s3://$AWS_S3_BUCKET/database-backups/"
fi

# Clean old backups
find $BACKUP_DIR -name "full_backup_*.dump.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: full_backup_$DATE.dump.gz"
```

#### Point-in-Time Recovery Setup

```bash
# Enable WAL archiving in PostgreSQL
echo "archive_mode = on" >> /etc/postgresql/15/main/postgresql.conf
echo "archive_command = 'cp %p /backups/wal/%f'" >> /etc/postgresql/15/main/postgresql.conf
echo "wal_level = replica" >> /etc/postgresql/15/main/postgresql.conf

# Create WAL backup directory
mkdir -p /backups/wal
chown postgres:postgres /backups/wal

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Application Backup

#### File System Backup

```bash
#!/bin/bash
# backup-files.sh

BACKUP_DIR="/backups/files"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/home/orchestrator/coordinaitor"

# Create backup
tar -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" \
    --exclude="$APP_DIR/node_modules" \
    --exclude="$APP_DIR/logs" \
    --exclude="$APP_DIR/.git" \
    "$APP_DIR"

# Upload to S3
aws s3 cp "$BACKUP_DIR/app_backup_$DATE.tar.gz" "s3://$AWS_S3_BUCKET/app-backups/"

# Clean old backups
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +7 -delete
```

### Disaster Recovery Plan

#### Recovery Procedures

1. **Database Recovery**:
```bash
# Stop application
pm2 stop orchestrator-api

# Restore database from backup
pg_restore -h localhost -U postgres -d multi_agent_orchestrator_new /backups/database/full_backup_latest.dump.gz

# Update database connection
# Restart application
pm2 start orchestrator-api
```

2. **Application Recovery**:
```bash
# Extract application backup
tar -xzf /backups/files/app_backup_latest.tar.gz -C /tmp/

# Copy to production location
cp -r /tmp/coordinaitor/* /home/orchestrator/coordinaitor/

# Install dependencies and restart
cd /home/orchestrator/coordinaitor
npm install
pm2 restart orchestrator-api
```

3. **Full System Recovery**:
```bash
# Provision new server
# Install dependencies
# Restore database
# Restore application files
# Configure services
# Test functionality
```

## Troubleshooting

### Common Issues

#### Application Won't Start

**Symptoms**: Application fails to start or crashes immediately

**Diagnostic Steps**:
```bash
# Check logs
pm2 logs orchestrator-api
tail -f /home/orchestrator/coordinaitor/logs/api-error.log

# Check process status
pm2 status
ps aux | grep node

# Check port availability
netstat -tlnp | grep :3000
lsof -i :3000

# Test database connection
psql -h localhost -U orchestrator -d multi_agent_orchestrator -c "SELECT 1;"

# Test Redis connection
redis-cli ping
```

**Common Solutions**:
- Verify environment variables are set correctly
- Check database connectivity and credentials
- Ensure Redis is running and accessible
- Verify file permissions
- Check for port conflicts

#### High Response Times

**Symptoms**: API responses are slow, timeouts occurring

**Diagnostic Steps**:
```bash
# Check system resources
htop
iotop
free -h
df -h

# Check database performance
sudo -u postgres psql -d multi_agent_orchestrator -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Check Redis performance
redis-cli --latency-history -h localhost

# Check network latency
ping database-server
traceroute database-server
```

**Common Solutions**:
- Add database indexes
- Optimize database queries
- Increase connection pool size
- Add caching layers
- Scale horizontally

#### Memory Issues

**Symptoms**: High memory usage, out of memory errors

**Diagnostic Steps**:
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -20

# Check Node.js heap usage
pm2 monit

# Check for memory leaks
node --inspect dist/index.js
# Connect Chrome DevTools for heap profiling
```

**Common Solutions**:
- Increase memory limits
- Fix memory leaks
- Optimize data structures
- Add garbage collection tuning
- Scale to more instances

#### Database Connection Issues

**Symptoms**: Database connection errors, timeouts

**Diagnostic Steps**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Check connection limits
sudo -u postgres psql -c "SHOW max_connections;"
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

**Common Solutions**:
- Increase max_connections in PostgreSQL
- Optimize connection pooling
- Fix long-running queries
- Restart PostgreSQL service
- Check network connectivity

### Performance Debugging

#### Application Profiling

```javascript
// Add profiling to critical functions
const profiler = require('clinic/profiler');

if (process.env.NODE_ENV === 'development') {
  profiler.collectCpuProfile({
    sampleInterval: 1000
  });
}

// Memory profiling
if (process.env.ENABLE_MEMORY_PROFILING) {
  setInterval(() => {
    const usage = process.memoryUsage();
    console.log('Memory usage:', {
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB'
    });
  }, 30000);
}
```

#### Database Query Analysis

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
SELECT pg_reload_conf();

-- Analyze slow queries
SELECT query, calls, total_time, mean_time, stddev_time, rows
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking > 100ms on average
ORDER BY mean_time DESC
LIMIT 20;

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

### Log Analysis

#### Centralized Logging Setup

```bash
# Install ELK stack for log analysis
docker run -d --name elasticsearch -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" elasticsearch:7.14.0
docker run -d --name kibana -p 5601:5601 --link elasticsearch:elasticsearch kibana:7.14.0
docker run -d --name logstash -p 5044:5044 --link elasticsearch:elasticsearch logstash:7.14.0
```

#### Log Processing Configuration

```json
{
  "logstash": {
    "input": {
      "beats": {
        "port": 5044
      }
    },
    "filter": {
      "if": "[fields][service] == 'orchestrator'",
      "grok": {
        "match": {
          "message": "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}"
        }
      },
      "date": {
        "match": ["timestamp", "ISO8601"]
      }
    },
    "output": {
      "elasticsearch": {
        "hosts": ["elasticsearch:9200"],
        "index": "orchestrator-logs-%{+YYYY.MM.dd}"
      }
    }
  }
}
```

---

## Quick Reference

### Essential Commands

```bash
# Docker Deployment
docker-compose up -d
docker-compose logs -f
docker-compose down

# Kubernetes Deployment
kubectl apply -f k8s/
kubectl get pods -n orchestrator
kubectl logs -f deployment/orchestrator-api -n orchestrator

# Traditional Deployment
pm2 start ecosystem.config.js
pm2 logs orchestrator-api
pm2 restart orchestrator-api

# Database Operations
pg_dump -h localhost -U postgres multi_agent_orchestrator > backup.sql
psql -h localhost -U postgres -d multi_agent_orchestrator < backup.sql

# Monitoring
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

### Configuration Checklist

- [ ] Environment variables configured
- [ ] Database connection established
- [ ] Redis cache accessible
- [ ] AI provider API keys set
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring setup complete
- [ ] Load balancing configured
- [ ] Health checks working

### Security Checklist

- [ ] SSL/TLS encryption enabled
- [ ] Strong passwords and secrets
- [ ] Firewall properly configured
- [ ] Regular security updates
- [ ] Access logs monitored
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] CORS properly configured

---

*This deployment guide provides comprehensive coverage for all deployment scenarios. Choose the deployment method that best fits your infrastructure requirements and scale.*