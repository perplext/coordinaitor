# Configuration Guide

This comprehensive guide covers all configuration options for the CoordinAItor, including environment variables, configuration files, and advanced settings for production deployments.

## Table of Contents

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [AI Provider Configuration](#ai-provider-configuration)
- [Database Configuration](#database-configuration)
- [Security Configuration](#security-configuration)
- [Performance Configuration](#performance-configuration)
- [Monitoring Configuration](#monitoring-configuration)
- [Feature Flags](#feature-flags)
- [Development vs Production](#development-vs-production)
- [Configuration Validation](#configuration-validation)
- [Best Practices](#best-practices)

## Overview

The CoordinAItor uses a hierarchical configuration system that supports:

1. **Environment Variables**: Primary configuration method
2. **Configuration Files**: Structured configuration in JSON/YAML
3. **CLI Arguments**: Override configuration at runtime
4. **Database Settings**: Stored configuration for runtime changes

### Configuration Priority (highest to lowest)
1. CLI arguments
2. Environment variables
3. Configuration files
4. Database settings
5. Default values

## Environment Variables

### Core System Configuration

#### Server Configuration
```env
# Server Configuration
NODE_ENV=development                    # Environment: development, production, test
PORT=3000                              # API server port
HOST=localhost                         # Server host
BASE_URL=http://localhost:3000         # Public base URL for the API

# Frontend Configuration
WEB_PORT=3001                          # Web UI port
WEB_HOST=localhost                     # Web UI host
WEB_BASE_URL=http://localhost:3001     # Public web UI URL

# Process Configuration
WORKER_PROCESSES=auto                  # Number of worker processes (auto = CPU cores)
MAX_MEMORY=2048                        # Maximum memory per process (MB)
GRACEFUL_SHUTDOWN_TIMEOUT=30           # Graceful shutdown timeout (seconds)
```

#### Database Configuration
```env
# PostgreSQL Database
DATABASE_URL=postgresql://username:password@localhost:5432/multi_agent_orchestrator
DB_HOST=localhost                      # Database host
DB_PORT=5432                          # Database port
DB_NAME=multi_agent_orchestrator      # Database name
DB_USER=postgres                      # Database username
DB_PASSWORD=your_password_here        # Database password
DB_SSL=false                          # Enable SSL connection
DB_SSL_REJECT_UNAUTHORIZED=true       # Reject unauthorized SSL certificates

# Connection Pool Configuration
DB_POOL_MIN=2                         # Minimum pool connections
DB_POOL_MAX=20                        # Maximum pool connections
DB_POOL_IDLE_TIMEOUT=30000           # Idle connection timeout (ms)
DB_POOL_ACQUIRE_TIMEOUT=60000        # Connection acquire timeout (ms)

# Database Migrations
DB_MIGRATIONS_AUTO=true               # Run migrations automatically
DB_MIGRATIONS_DIR=src/database/migrations  # Migrations directory
DB_SEED_AUTO=false                    # Run seed data automatically (dev only)
```

#### Redis Configuration
```env
# Redis Cache and Sessions
REDIS_URL=redis://localhost:6379      # Redis connection URL
REDIS_HOST=localhost                   # Redis host
REDIS_PORT=6379                       # Redis port
REDIS_PASSWORD=                       # Redis password (if required)
REDIS_DB=0                            # Redis database number

# Redis Connection Options
REDIS_CONNECT_TIMEOUT=10000           # Connection timeout (ms)
REDIS_COMMAND_TIMEOUT=5000            # Command timeout (ms)
REDIS_RETRY_ATTEMPTS=3                # Retry attempts
REDIS_RETRY_DELAY=1000                # Retry delay (ms)

# Redis Cluster (for production)
REDIS_CLUSTER_ENABLED=false           # Enable cluster mode
REDIS_CLUSTER_NODES=                  # Comma-separated cluster nodes
```

### AI Provider Configuration

#### OpenAI Configuration
```env
# OpenAI API
OPENAI_API_KEY=sk-...                 # OpenAI API key
OPENAI_ORGANIZATION=                  # OpenAI organization ID (optional)
OPENAI_BASE_URL=https://api.openai.com/v1  # OpenAI API base URL
OPENAI_DEFAULT_MODEL=gpt-4            # Default model
OPENAI_MAX_TOKENS=4000                # Default max tokens
OPENAI_TEMPERATURE=0.7                # Default temperature
OPENAI_TIMEOUT=30000                  # Request timeout (ms)
OPENAI_RATE_LIMIT=100                 # Requests per minute
```

#### Anthropic (Claude) Configuration
```env
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...          # Anthropic API key
ANTHROPIC_BASE_URL=https://api.anthropic.com  # Anthropic API base URL
ANTHROPIC_DEFAULT_MODEL=claude-3-opus # Default Claude model
ANTHROPIC_MAX_TOKENS=4000             # Default max tokens
ANTHROPIC_TEMPERATURE=0.7             # Default temperature
ANTHROPIC_TIMEOUT=30000               # Request timeout (ms)
ANTHROPIC_RATE_LIMIT=50               # Requests per minute
```

#### Google AI Configuration
```env
# Google Gemini API
GOOGLE_AI_API_KEY=AI...               # Google AI API key
GOOGLE_AI_PROJECT_ID=                 # Google Cloud project ID
GOOGLE_AI_LOCATION=us-central1        # Google Cloud location
GOOGLE_AI_DEFAULT_MODEL=gemini-pro    # Default Gemini model
GOOGLE_AI_TEMPERATURE=0.7             # Default temperature
GOOGLE_AI_TIMEOUT=30000               # Request timeout (ms)
```

#### Azure OpenAI Configuration
```env
# Azure OpenAI Service
AZURE_OPENAI_API_KEY=...              # Azure OpenAI API key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/  # Azure endpoint
AZURE_OPENAI_API_VERSION=2023-12-01-preview  # API version
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4    # Deployment name
```

#### AWS Bedrock Configuration
```env
# AWS Bedrock
AWS_ACCESS_KEY_ID=AKIA...             # AWS access key
AWS_SECRET_ACCESS_KEY=...             # AWS secret key
AWS_REGION=us-east-1                  # AWS region
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-opus-20240229  # Bedrock model ID
```

### Authentication and Security

#### JWT Configuration
```env
# JWT Authentication
JWT_SECRET=your-super-secure-secret-key-here  # JWT signing secret (required)
JWT_EXPIRES_IN=7d                     # Access token expiration
JWT_REFRESH_EXPIRES_IN=30d            # Refresh token expiration
JWT_ISSUER=coordinaitor   # JWT issuer
JWT_AUDIENCE=orchestrator-users       # JWT audience

# JWT Algorithm and Security
JWT_ALGORITHM=HS256                   # JWT signing algorithm
JWT_PRIVATE_KEY_PATH=                 # Path to private key (for RSA/ECDSA)
JWT_PUBLIC_KEY_PATH=                  # Path to public key (for RSA/ECDSA)
```

#### Session Configuration
```env
# Session Management
SESSION_SECRET=another-secure-secret   # Session secret
SESSION_NAME=orchestrator.sid         # Session cookie name
SESSION_MAX_AGE=86400000              # Session max age (ms)
SESSION_SECURE=false                  # Secure cookies (HTTPS only)
SESSION_HTTP_ONLY=true                # HTTP-only cookies
SESSION_SAME_SITE=lax                 # SameSite cookie policy
```

#### CORS Configuration
```env
# CORS (Cross-Origin Resource Sharing)
CORS_ORIGIN=http://localhost:3001     # Allowed origins (comma-separated)
CORS_METHODS=GET,POST,PUT,DELETE,PATCH  # Allowed methods
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-API-Key  # Allowed headers
CORS_CREDENTIALS=true                 # Allow credentials
CORS_MAX_AGE=86400                    # Preflight cache time (seconds)
```

#### Security Headers
```env
# Security Headers
HELMET_ENABLED=true                   # Enable Helmet security headers
HELMET_CSP_ENABLED=true              # Enable Content Security Policy
HELMET_HSTS_ENABLED=true             # Enable HTTP Strict Transport Security
HELMET_REFERRER_POLICY=same-origin    # Referrer policy

# Content Security Policy
CSP_DEFAULT_SRC='self'                # Default source policy
CSP_SCRIPT_SRC='self' 'unsafe-inline' # Script source policy
CSP_STYLE_SRC='self' 'unsafe-inline'  # Style source policy
CSP_IMG_SRC='self' data: https:       # Image source policy
```

### Performance and Scaling

#### Rate Limiting
```env
# Rate Limiting
RATE_LIMIT_ENABLED=true               # Enable rate limiting
RATE_LIMIT_WINDOW=60000               # Rate limit window (ms)
RATE_LIMIT_MAX=100                    # Max requests per window per IP
RATE_LIMIT_SKIP_SUCCESSFUL=false      # Skip successful requests
RATE_LIMIT_HEADERS=true               # Include rate limit headers

# Advanced Rate Limiting
RATE_LIMIT_STORE=redis                # Rate limit store (memory, redis)
RATE_LIMIT_PREFIX=rl:                 # Redis key prefix
RATE_LIMIT_SKIP_FAILED_REQUESTS=true  # Skip failed requests
```

#### Caching Configuration
```env
# Application Caching
CACHE_ENABLED=true                    # Enable caching
CACHE_TTL=300                         # Default cache TTL (seconds)
CACHE_MAX_SIZE=1000                   # Max cache entries
CACHE_PREFIX=cache:                   # Cache key prefix

# Specific Cache Settings
CACHE_AGENTS_TTL=600                  # Agent cache TTL
CACHE_TASKS_TTL=60                    # Task cache TTL
CACHE_PROJECTS_TTL=300                # Project cache TTL
CACHE_USERS_TTL=1800                  # User cache TTL
```

#### Task Processing
```env
# Task Processing Configuration
TASK_QUEUE_ENABLED=true               # Enable task queue
TASK_QUEUE_CONCURRENCY=5              # Concurrent task processing
TASK_QUEUE_ATTEMPTS=3                 # Max retry attempts
TASK_QUEUE_BACKOFF=exponential        # Backoff strategy
TASK_QUEUE_DELAY=1000                 # Initial retry delay (ms)

# Task Timeouts
TASK_DEFAULT_TIMEOUT=300000           # Default task timeout (ms)
TASK_MAX_TIMEOUT=1800000              # Maximum task timeout (ms)
TASK_CLEANUP_INTERVAL=3600000         # Cleanup interval (ms)
```

#### Agent Configuration
```env
# Agent Management
AGENT_MAX_CONCURRENT_TASKS=3          # Max concurrent tasks per agent
AGENT_RESPONSE_TIMEOUT=30000          # Agent response timeout (ms)
AGENT_HEALTH_CHECK_INTERVAL=60000     # Health check interval (ms)
AGENT_RETRY_ATTEMPTS=3                # Retry attempts for failed operations

# Agent Pool Configuration
AGENT_POOL_SIZE=10                    # Maximum number of agents
AGENT_POOL_MIN_IDLE=2                 # Minimum idle agents
AGENT_POOL_MAX_IDLE=5                 # Maximum idle agents
AGENT_POOL_EVICTION_TIMEOUT=300000    # Idle agent eviction timeout (ms)
```

### Monitoring and Logging

#### Logging Configuration
```env
# Logging Configuration
LOG_LEVEL=info                        # Log level (error, warn, info, debug)
LOG_FORMAT=json                       # Log format (json, text)
LOG_TIMESTAMP=true                    # Include timestamps
LOG_COLORS=true                       # Colorized logs (development)

# Log Files
LOG_FILE_ENABLED=true                 # Enable file logging
LOG_FILE_PATH=logs/application.log    # Log file path
LOG_FILE_MAX_SIZE=10485760           # Max log file size (bytes)
LOG_FILE_MAX_FILES=5                  # Max log files to keep

# Specific Log Levels
LOG_LEVEL_HTTP=info                   # HTTP request logging
LOG_LEVEL_DATABASE=warn               # Database logging
LOG_LEVEL_AGENTS=info                 # Agent logging
LOG_LEVEL_TASKS=info                  # Task logging
```

#### Metrics and Monitoring
```env
# Prometheus Metrics
PROMETHEUS_ENABLED=true               # Enable Prometheus metrics
PROMETHEUS_PORT=9090                  # Metrics server port
PROMETHEUS_PATH=/metrics              # Metrics endpoint path
PROMETHEUS_PREFIX=orchestrator_       # Metric name prefix

# Health Checks
HEALTH_CHECK_ENABLED=true             # Enable health checks
HEALTH_CHECK_PATH=/health             # Health check endpoint
HEALTH_CHECK_TIMEOUT=5000             # Health check timeout (ms)

# APM Integration
APM_ENABLED=false                     # Enable APM
APM_SERVICE_NAME=coordinaitor  # APM service name
APM_ENVIRONMENT=development           # APM environment
APM_SERVER_URL=http://localhost:8200  # APM server URL
```

### Feature Flags

#### Core Features
```env
# Core Feature Flags
WEBSOCKET_ENABLED=true                # Enable WebSocket real-time updates
WEBHOOK_ENABLED=true                  # Enable webhook notifications
FILE_UPLOAD_ENABLED=true              # Enable file uploads
COLLABORATION_ENABLED=true            # Enable real-time collaboration

# Advanced Features
ANALYTICS_ENABLED=true                # Enable analytics and reporting
EXPORT_ENABLED=true                   # Enable data export features
IMPORT_ENABLED=true                   # Enable data import features
BULK_OPERATIONS_ENABLED=true          # Enable bulk operations
```

#### Experimental Features
```env
# Experimental Features (use with caution)
EXPERIMENTAL_AI_ROUTING=false         # AI-based agent routing
EXPERIMENTAL_AUTO_SCALING=false       # Auto-scaling agents
EXPERIMENTAL_PREDICTIVE_CACHING=false # Predictive caching
EXPERIMENTAL_ADVANCED_METRICS=false   # Advanced performance metrics
```

### Integration Configuration

#### Email Integration
```env
# Email Configuration (SMTP)
EMAIL_ENABLED=true                    # Enable email notifications
EMAIL_SMTP_HOST=smtp.gmail.com        # SMTP host
EMAIL_SMTP_PORT=587                   # SMTP port
EMAIL_SMTP_SECURE=true                # Use TLS/SSL
EMAIL_SMTP_USER=your-email@gmail.com  # SMTP username
EMAIL_SMTP_PASS=your-app-password     # SMTP password

# Email Settings
EMAIL_FROM_NAME=CoordinAItor  # Sender name
EMAIL_FROM_ADDRESS=noreply@orchestrator.com  # Sender email
EMAIL_REPLY_TO=support@orchestrator.com     # Reply-to email
```

#### Slack Integration
```env
# Slack Integration
SLACK_ENABLED=false                   # Enable Slack integration
SLACK_BOT_TOKEN=xoxb-...             # Slack bot token
SLACK_SIGNING_SECRET=...             # Slack signing secret
SLACK_APP_TOKEN=xapp-...             # Slack app token
SLACK_DEFAULT_CHANNEL=#general       # Default notification channel
```

#### GitHub Integration
```env
# GitHub Integration
GITHUB_ENABLED=false                  # Enable GitHub integration
GITHUB_TOKEN=ghp_...                 # GitHub personal access token
GITHUB_WEBHOOK_SECRET=...            # GitHub webhook secret
GITHUB_DEFAULT_ORG=your-org          # Default GitHub organization
```

## Configuration Files

### Main Configuration File

Create `config/default.json` for structured configuration:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "cors": {
      "origin": ["http://localhost:3001"],
      "credentials": true
    }
  },
  "database": {
    "type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "multi_agent_orchestrator",
    "synchronize": false,
    "logging": false,
    "pool": {
      "min": 2,
      "max": 20
    }
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "retryAttempts": 3
  },
  "ai": {
    "providers": {
      "openai": {
        "enabled": true,
        "models": {
          "gpt-4": {
            "maxTokens": 4000,
            "temperature": 0.7
          },
          "gpt-3.5-turbo": {
            "maxTokens": 2000,
            "temperature": 0.8
          }
        }
      },
      "anthropic": {
        "enabled": true,
        "models": {
          "claude-3-opus": {
            "maxTokens": 4000,
            "temperature": 0.7
          }
        }
      }
    }
  },
  "features": {
    "websocket": true,
    "webhooks": true,
    "fileUpload": true,
    "analytics": true
  },
  "security": {
    "jwt": {
      "expiresIn": "7d",
      "refreshExpiresIn": "30d"
    },
    "rateLimit": {
      "windowMs": 60000,
      "max": 100
    }
  }
}
```

### Environment-Specific Configuration

#### Development (`config/development.json`)
```json
{
  "server": {
    "port": 3000
  },
  "database": {
    "logging": true,
    "synchronize": true
  },
  "logging": {
    "level": "debug",
    "colorize": true
  },
  "security": {
    "jwt": {
      "expiresIn": "1d"
    }
  }
}
```

#### Production (`config/production.json`)
```json
{
  "server": {
    "port": 8080,
    "trustProxy": true
  },
  "database": {
    "ssl": {
      "rejectUnauthorized": false
    },
    "pool": {
      "min": 5,
      "max": 50
    }
  },
  "logging": {
    "level": "info",
    "file": {
      "enabled": true,
      "path": "/var/log/orchestrator/application.log"
    }
  },
  "security": {
    "helmet": {
      "enabled": true,
      "hsts": true
    },
    "cors": {
      "origin": ["https://your-domain.com"]
    }
  },
  "monitoring": {
    "prometheus": {
      "enabled": true,
      "port": 9090
    },
    "apm": {
      "enabled": true,
      "serviceName": "orchestrator-prod"
    }
  }
}
```

### Agent Configuration

Create `config/agents.yaml` for agent-specific configuration:

```yaml
# Agent Templates
templates:
  senior-developer:
    type: coding
    capabilities:
      - javascript
      - typescript
      - react
      - nodejs
      - python
      - git
    specializations:
      - full-stack-development
      - api-design
      - performance-optimization
    configuration:
      maxConcurrentTasks: 3
      responseTimeout: 30000
      codeStyle: clean-code
      testingFramework: jest

  qa-specialist:
    type: qa
    capabilities:
      - testing
      - automation
      - performance-testing
      - security-testing
    specializations:
      - test-automation
      - load-testing
      - accessibility-testing
    configuration:
      maxConcurrentTasks: 2
      testFrameworks:
        - jest
        - playwright
        - cypress

# Default Agent Configuration
defaults:
  timeout: 30000
  retryAttempts: 3
  healthCheckInterval: 60000
  workingHours:
    timezone: UTC
    schedule:
      monday: "09:00-17:00"
      tuesday: "09:00-17:00"
      wednesday: "09:00-17:00"
      thursday: "09:00-17:00"
      friday: "09:00-17:00"

# Provider-Specific Settings
providers:
  openai:
    rateLimit:
      requestsPerMinute: 100
      tokensPerMinute: 90000
    defaultParams:
      temperature: 0.7
      topP: 1.0
      frequencyPenalty: 0.0
      presencePenalty: 0.0

  anthropic:
    rateLimit:
      requestsPerMinute: 50
      tokensPerMinute: 40000
    defaultParams:
      temperature: 0.7
      topP: 0.9
```

## AI Provider Configuration

### OpenAI Configuration

#### Basic Setup
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_ORGANIZATION=org-...
OPENAI_PROJECT=proj_...
```

#### Advanced Configuration
```json
{
  "ai": {
    "providers": {
      "openai": {
        "enabled": true,
        "apiKey": "${OPENAI_API_KEY}",
        "organization": "${OPENAI_ORGANIZATION}",
        "baseURL": "https://api.openai.com/v1",
        "timeout": 30000,
        "maxRetries": 3,
        "models": {
          "gpt-4": {
            "displayName": "GPT-4",
            "maxTokens": 8192,
            "contextWindow": 8192,
            "costPer1kTokens": {
              "input": 0.03,
              "output": 0.06
            },
            "defaultParams": {
              "temperature": 0.7,
              "topP": 1.0,
              "frequencyPenalty": 0.0,
              "presencePenalty": 0.0
            }
          },
          "gpt-3.5-turbo": {
            "displayName": "GPT-3.5 Turbo",
            "maxTokens": 4096,
            "contextWindow": 4096,
            "costPer1kTokens": {
              "input": 0.001,
              "output": 0.002
            }
          }
        },
        "rateLimits": {
          "requestsPerMinute": 3500,
          "tokensPerMinute": 90000
        }
      }
    }
  }
}
```

### Anthropic Configuration

```json
{
  "ai": {
    "providers": {
      "anthropic": {
        "enabled": true,
        "apiKey": "${ANTHROPIC_API_KEY}",
        "baseURL": "https://api.anthropic.com",
        "version": "2023-06-01",
        "models": {
          "claude-3-opus": {
            "displayName": "Claude 3 Opus",
            "maxTokens": 4096,
            "contextWindow": 200000,
            "costPer1kTokens": {
              "input": 0.015,
              "output": 0.075
            }
          },
          "claude-3-sonnet": {
            "displayName": "Claude 3 Sonnet",
            "maxTokens": 4096,
            "contextWindow": 200000,
            "costPer1kTokens": {
              "input": 0.003,
              "output": 0.015
            }
          }
        }
      }
    }
  }
}
```

### Google AI Configuration

```json
{
  "ai": {
    "providers": {
      "google": {
        "enabled": true,
        "apiKey": "${GOOGLE_AI_API_KEY}",
        "projectId": "${GOOGLE_CLOUD_PROJECT}",
        "location": "us-central1",
        "models": {
          "gemini-pro": {
            "displayName": "Gemini Pro",
            "maxTokens": 32768,
            "contextWindow": 32768,
            "safetySettings": {
              "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
              "HARM_CATEGORY_HATE_SPEECH": "BLOCK_MEDIUM_AND_ABOVE",
              "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_MEDIUM_AND_ABOVE",
              "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_MEDIUM_AND_ABOVE"
            }
          }
        }
      }
    }
  }
}
```

## Database Configuration

### PostgreSQL Configuration

#### Basic Connection
```env
# PostgreSQL Connection
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Or separate components
DB_HOST=localhost
DB_PORT=5432
DB_NAME=multi_agent_orchestrator
DB_USER=postgres
DB_PASSWORD=secure_password
DB_SSL=false
```

#### Advanced PostgreSQL Configuration
```json
{
  "database": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "postgres",
    "password": "password",
    "database": "multi_agent_orchestrator",
    "ssl": {
      "enabled": false,
      "rejectUnauthorized": true,
      "ca": "/path/to/ca-certificate.crt",
      "cert": "/path/to/client-certificate.crt",
      "key": "/path/to/client-key.key"
    },
    "pool": {
      "min": 5,
      "max": 50,
      "acquireTimeoutMillis": 60000,
      "idleTimeoutMillis": 30000,
      "createTimeoutMillis": 3000,
      "destroyTimeoutMillis": 5000,
      "createRetryIntervalMillis": 200
    },
    "options": {
      "trustServerCertificate": false,
      "enableArithAbort": true,
      "encrypt": true,
      "requestTimeout": 300000
    },
    "migrations": {
      "dir": "src/database/migrations",
      "autoRun": true,
      "tableName": "migrations",
      "schemaName": "public"
    },
    "logging": {
      "enabled": true,
      "level": "error",
      "logQueries": false,
      "logQueryErrors": true,
      "logSchema": false
    }
  }
}
```

### Redis Configuration

#### Basic Redis Setup
```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

#### Advanced Redis Configuration
```json
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": "secure_password",
    "db": 0,
    "keyPrefix": "orchestrator:",
    "connectTimeout": 10000,
    "commandTimeout": 5000,
    "retryAttempts": 3,
    "retryDelayOnFailover": 1000,
    "maxRetriesPerRequest": 3,
    "lazyConnect": true,
    "keepAlive": 30000,
    "family": 4,
    "cluster": {
      "enabled": false,
      "enableReadyCheck": true,
      "redisOptions": {},
      "nodes": [
        { "host": "127.0.0.1", "port": 7000 },
        { "host": "127.0.0.1", "port": 7001 },
        { "host": "127.0.0.1", "port": 7002 }
      ]
    },
    "sentinel": {
      "enabled": false,
      "masterName": "mymaster",
      "sentinels": [
        { "host": "localhost", "port": 26379 },
        { "host": "localhost", "port": 26380 }
      ]
    }
  }
}
```

## Security Configuration

### Authentication Configuration

#### JWT Security
```json
{
  "security": {
    "jwt": {
      "secret": "${JWT_SECRET}",
      "algorithm": "HS256",
      "expiresIn": "7d",
      "refreshTokenExpiresIn": "30d",
      "issuer": "coordinaitor",
      "audience": "orchestrator-users",
      "clockTolerance": 30,
      "ignoreExpiration": false,
      "ignoreNotBefore": false
    },
    "session": {
      "secret": "${SESSION_SECRET}",
      "name": "orchestrator.sid",
      "resave": false,
      "saveUninitialized": false,
      "rolling": false,
      "cookie": {
        "secure": false,
        "httpOnly": true,
        "maxAge": 86400000,
        "sameSite": "lax"
      }
    }
  }
}
```

#### Password Policy
```json
{
  "security": {
    "password": {
      "minLength": 8,
      "maxLength": 128,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSymbols": true,
      "forbiddenPasswords": [
        "password",
        "123456",
        "qwerty"
      ],
      "hashRounds": 12,
      "maxAttempts": 5,
      "lockoutTime": 900000
    }
  }
}
```

### API Security

#### Rate Limiting Configuration
```json
{
  "security": {
    "rateLimit": {
      "global": {
        "windowMs": 60000,
        "max": 1000,
        "standardHeaders": true,
        "legacyHeaders": false,
        "store": "redis",
        "keyGenerator": "ip",
        "onLimitReached": "log"
      },
      "api": {
        "windowMs": 60000,
        "max": 100,
        "skip": ["GET /health", "GET /metrics"]
      },
      "auth": {
        "windowMs": 900000,
        "max": 5,
        "skipSuccessfulRequests": true
      }
    }
  }
}
```

#### CORS Configuration
```json
{
  "security": {
    "cors": {
      "origin": [
        "http://localhost:3001",
        "https://your-domain.com"
      ],
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      "allowedHeaders": [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Requested-With"
      ],
      "credentials": true,
      "maxAge": 86400,
      "preflightContinue": false,
      "optionsSuccessStatus": 204
    }
  }
}
```

## Performance Configuration

### Caching Configuration

```json
{
  "cache": {
    "enabled": true,
    "defaultTTL": 300,
    "prefix": "cache:",
    "store": "redis",
    "compression": {
      "enabled": true,
      "algorithm": "gzip",
      "threshold": 1024
    },
    "strategies": {
      "agents": {
        "ttl": 600,
        "tags": ["agents"],
        "invalidateOn": ["agent.updated", "agent.deleted"]
      },
      "tasks": {
        "ttl": 60,
        "tags": ["tasks"],
        "invalidateOn": ["task.updated", "task.deleted"]
      },
      "projects": {
        "ttl": 300,
        "tags": ["projects"],
        "invalidateOn": ["project.updated", "project.deleted"]
      }
    }
  }
}
```

### Queue Configuration

```json
{
  "queue": {
    "enabled": true,
    "redis": {
      "host": "localhost",
      "port": 6379,
      "db": 1
    },
    "defaultJobOptions": {
      "removeOnComplete": 100,
      "removeOnFail": 50,
      "attempts": 3,
      "backoff": {
        "type": "exponential",
        "delay": 2000
      }
    },
    "queues": {
      "tasks": {
        "concurrency": 5,
        "stalledInterval": 30000,
        "maxStalledCount": 1
      },
      "notifications": {
        "concurrency": 10,
        "delay": 1000
      },
      "cleanup": {
        "concurrency": 1,
        "repeat": {
          "cron": "0 2 * * *"
        }
      }
    }
  }
}
```

## Monitoring Configuration

### Logging Configuration

```json
{
  "logging": {
    "level": "info",
    "format": "json",
    "timestamp": true,
    "colorize": false,
    "transports": {
      "console": {
        "enabled": true,
        "level": "info",
        "colorize": true
      },
      "file": {
        "enabled": true,
        "level": "info",
        "filename": "logs/application.log",
        "maxsize": 10485760,
        "maxFiles": 5,
        "tailable": true,
        "zippedArchive": true
      },
      "elasticsearch": {
        "enabled": false,
        "level": "info",
        "index": "orchestrator-logs",
        "host": "http://localhost:9200"
      }
    },
    "categories": {
      "http": "info",
      "database": "warn",
      "agents": "info",
      "tasks": "info",
      "security": "warn",
      "performance": "info"
    }
  }
}
```

### Metrics Configuration

```json
{
  "monitoring": {
    "prometheus": {
      "enabled": true,
      "port": 9090,
      "path": "/metrics",
      "prefix": "orchestrator_",
      "collectDefaultMetrics": true,
      "metrics": {
        "httpRequestDuration": true,
        "httpRequestTotal": true,
        "taskProcessingDuration": true,
        "agentUtilization": true,
        "systemResources": true
      }
    },
    "healthChecks": {
      "enabled": true,
      "interval": 30000,
      "timeout": 5000,
      "checks": {
        "database": true,
        "redis": true,
        "agents": true,
        "queue": true
      }
    }
  }
}
```

## Development vs Production

### Development Configuration

```env
# Development Environment
NODE_ENV=development
LOG_LEVEL=debug
DB_LOGGING=true
CACHE_ENABLED=false
RATE_LIMIT_ENABLED=false
WEBPACK_DEV_SERVER=true
HOT_RELOAD=true
```

### Production Configuration

```env
# Production Environment
NODE_ENV=production
LOG_LEVEL=info
DB_LOGGING=false
CACHE_ENABLED=true
RATE_LIMIT_ENABLED=true
TRUST_PROXY=true
HELMET_ENABLED=true
```

## Configuration Validation

### Environment Variable Validation

```javascript
// config/validation.js
const Joi = require('joi');

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  OPENAI_API_KEY: Joi.string().pattern(/^sk-/).optional(),
  ANTHROPIC_API_KEY: Joi.string().pattern(/^sk-ant-/).optional(),
}).unknown(true);

const { error, value } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = value;
```

### Runtime Configuration Validation

```javascript
// src/config/validator.js
class ConfigValidator {
  static validateAIProviders(config) {
    const providers = config.ai.providers;
    const enabledProviders = Object.entries(providers)
      .filter(([_, provider]) => provider.enabled)
      .map(([name]) => name);

    if (enabledProviders.length === 0) {
      throw new Error('At least one AI provider must be enabled');
    }

    enabledProviders.forEach(providerName => {
      const provider = providers[providerName];
      if (!provider.apiKey) {
        throw new Error(`API key required for ${providerName} provider`);
      }
    });
  }

  static validateDatabase(config) {
    if (!config.database.url && !config.database.host) {
      throw new Error('Database URL or host configuration required');
    }
  }

  static validateSecurity(config) {
    if (!config.security.jwt.secret || config.security.jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
  }
}
```

## Best Practices

### 1. Environment Variables

#### Use a .env File for Development
```bash
# .env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/orchestrator_dev
JWT_SECRET=your-super-secure-secret-key-minimum-32-characters
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

#### Use Environment-Specific Files
```bash
.env                # Default environment variables
.env.local          # Local overrides (git-ignored)
.env.development    # Development-specific variables
.env.production     # Production-specific variables
.env.test          # Test-specific variables
```

### 2. Security Best Practices

#### Secure Secret Management
```bash
# Use a secrets manager in production
AWS_SECRETS_MANAGER_REGION=us-east-1
AWS_SECRETS_MANAGER_SECRET_NAME=orchestrator/production

# Or use HashiCorp Vault
VAULT_ADDR=https://vault.company.com
VAULT_TOKEN=hvs.your-vault-token
VAULT_PATH=secret/orchestrator
```

#### Environment Variable Validation
```javascript
// Validate required environment variables on startup
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_URL'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});
```

### 3. Configuration Management

#### Use Configuration Layers
```javascript
// config/index.js
const config = require('config');
const path = require('path');

// Load configuration in order of precedence
const configuration = {
  ...require('./default.json'),
  ...require(`./${process.env.NODE_ENV || 'development'}.json`),
  ...process.env
};

module.exports = configuration;
```

#### Configuration Hot Reloading (Development)
```javascript
// config/hot-reload.js
const chokidar = require('chokidar');
const path = require('path');

if (process.env.NODE_ENV === 'development') {
  const configPath = path.join(__dirname, '*.json');
  
  chokidar.watch(configPath).on('change', () => {
    console.log('Configuration changed, reloading...');
    delete require.cache[require.resolve('./index.js')];
    // Reload configuration
  });
}
```

### 4. Documentation

#### Document All Configuration Options
```javascript
// config/schema.js
const configSchema = {
  server: {
    port: {
      type: 'number',
      default: 3000,
      description: 'Port for the API server to listen on'
    },
    host: {
      type: 'string',
      default: 'localhost',
      description: 'Host address for the server'
    }
  },
  database: {
    url: {
      type: 'string',
      required: true,
      description: 'PostgreSQL connection URL'
    }
  }
};
```

#### Generate Configuration Documentation
```bash
# Generate configuration documentation
npm run config:docs

# Validate current configuration
npm run config:validate

# Show configuration with masked secrets
npm run config:show
```

---

## Quick Reference

### Essential Environment Variables
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=minimum-32-character-secret
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
```

### Configuration File Locations
- `config/default.json` - Base configuration
- `config/development.json` - Development overrides
- `config/production.json` - Production overrides
- `config/agents.yaml` - Agent configuration
- `.env` - Environment variables

### Common Issues
1. **Missing JWT_SECRET**: Ensure it's at least 32 characters
2. **Database Connection**: Check DATABASE_URL format
3. **AI Provider Keys**: Verify API key format and permissions
4. **Redis Connection**: Ensure Redis is running and accessible
5. **Port Conflicts**: Check if ports are already in use

---

*This configuration guide covers all available options. For specific deployment scenarios, refer to the [Deployment Guide](deployment.md).*