# CoordinAItor

[![CI Pipeline](https://github.com/your-org/coordinaitor/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/coordinaitor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

A comprehensive multi-agent orchestration system for coordinating AI coding agents across different platforms (Claude, GPT, Gemini, and more). Provides both a powerful CLI interface and an intuitive web UI for managing complex coding tasks through intelligent agent collaboration.

## 🚀 Features

### Core Capabilities
- **Multi-Agent Orchestration**: Coordinate multiple AI agents working together on complex tasks
- **Platform Agnostic**: Support for Claude, GPT-4, Gemini, and other AI models
- **Real-time Collaboration**: WebSocket-powered real-time updates and collaboration
- **Task Management**: Intelligent task decomposition, assignment, and tracking
- **CLI & Web Interface**: Choose between command-line efficiency or web-based convenience

### Advanced Features
- **Smart Agent Selection**: Automatic agent selection based on task requirements and capabilities
- **Error Recovery**: Comprehensive error handling with automatic recovery strategies
- **Performance Monitoring**: Built-in metrics, logging, and health monitoring
- **Multi-tenancy**: Organization-based isolation and resource management
- **Extensible Architecture**: Plugin system for custom agents and integrations

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [CLI Usage](#cli-usage)
  - [Web UI Usage](#web-ui-usage)
- [Documentation](#documentation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose (recommended)
- At least one AI API key (OpenAI, Anthropic, Google, etc.)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor
npm install
cd web && npm install && cd ..
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys and configuration
nano .env
```

**Required Environment Variables:**
```env
# AI Provider API Keys (at least one required)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_AI_API_KEY=your_google_key_here

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multi_agent_orchestrator
REDIS_URL=redis://localhost:6379

# JWT Secret
JWT_SECRET=your_super_secure_secret_here
```

### 3. Start Development Environment

```bash
# Start databases and services
npm run docker:up

# Run database migrations and seed data
npm run migration:run
npm run db:seed

# Start the application
npm run dev:all
```

The application will be available at:
- **Web UI**: http://localhost:3001
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### 4. First Steps

#### Using the Web UI
1. Open http://localhost:3001
2. Login with demo credentials:
   - Email: `admin@orchestrator.com`
   - Password: `admin123`
3. Create your first project and task
4. Watch agents collaborate in real-time!

#### Using the CLI
```bash
# Check system status
npm run cli -- status

# Create a new task
npm run cli -- task create "Build a React component for user authentication"

# List available agents
npm run cli -- agents list

# Monitor task progress
npm run cli -- task watch <task-id>
```

## 📦 Installation

### Option 1: Docker (Recommended)

The fastest way to get started is using Docker Compose:

```bash
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Initialize database
docker-compose exec api npm run migration:run
docker-compose exec api npm run db:seed
```

### Option 2: Local Development

**Prerequisites:**
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- PostgreSQL 15+
- Redis 7+

```bash
# Clone repository
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor

# Install dependencies
npm install
cd web && npm install && cd ..

# Set up environment
cp .env.example .env
# Configure your .env file

# Start external services (PostgreSQL, Redis)
# Option A: Using Docker
npm run docker:up

# Option B: Using local installations
# Start PostgreSQL and Redis on your system

# Run database setup
npm run migration:run
npm run db:seed

# Start development servers
npm run dev:all
```

### Option 3: Production Deployment

See our comprehensive [Deployment Guide](docs/deployment.md) for production deployment options including:
- Docker Swarm
- Kubernetes
- AWS ECS
- Google Cloud Run
- Traditional server deployment

## ⚙️ Configuration

The application uses environment variables for configuration. See the complete [Configuration Guide](docs/configuration.md) for all options.

### Essential Configuration

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379

# AI Providers (configure at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AI...

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Features
WEBSOCKET_ENABLED=true
METRICS_ENABLED=true
```

### Advanced Configuration

```env
# Performance
WORKER_POOL_SIZE=4
MAX_CONCURRENT_TASKS=10
REQUEST_TIMEOUT=30000

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
LOG_LEVEL=info

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
CORS_ORIGIN=http://localhost:3001
```

## 🖥️ Usage

### CLI Usage

The CLI provides powerful command-line access to all orchestrator features:

```bash
# General usage
npm run cli -- <command> [options]

# Get help
npm run cli -- --help
npm run cli -- <command> --help
```

**Common Commands:**

```bash
# System status and health
npm run cli -- status
npm run cli -- health

# Task management
npm run cli -- task create "Description of task"
npm run cli -- task list
npm run cli -- task show <task-id>
npm run cli -- task watch <task-id>

# Agent management
npm run cli -- agents list
npm run cli -- agents show <agent-id>
npm run cli -- agents create --type=coding --model=gpt-4

# Project management
npm run cli -- project create "My Project"
npm run cli -- project list
npm run cli -- project switch <project-id>
```

See the complete [CLI Documentation](docs/cli.md) for all commands and options.

### Web UI Usage

The web interface provides an intuitive dashboard for managing agents and tasks:

**Key Features:**
- **Dashboard**: Overview of active tasks, agents, and system status
- **Task Manager**: Create, monitor, and manage complex tasks
- **Agent Control**: Configure and monitor AI agents
- **Real-time Updates**: Live progress tracking and collaboration
- **Project Management**: Organize work into projects and workspaces

**Getting Started:**
1. Navigate to http://localhost:3001
2. Login with your credentials
3. Create a new project
4. Add agents to your project
5. Create and assign tasks
6. Monitor progress in real-time

See the complete [Web UI Documentation](docs/web-ui.md) for detailed usage instructions.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

### User Guides
- [CLI Documentation](docs/cli.md) - Complete command reference and examples
- [Web UI Guide](docs/web-ui.md) - Step-by-step web interface usage
- [Configuration Guide](docs/configuration.md) - Environment variables and settings
- [API Reference](docs/api.md) - REST API documentation

### Operations
- [Deployment Guide](docs/deployment.md) - Production deployment options
- [Monitoring Guide](docs/monitoring.md) - Metrics, logging, and alerting
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions
- [Security Guide](docs/security.md) - Security best practices

### Development
- [Developer Guide](docs/development.md) - Architecture and contributing
- [Plugin Development](docs/plugins.md) - Creating custom agents and integrations
- [API Integration](docs/integrations.md) - Integrating with external systems

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Git

### Local Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor
npm install
cd web && npm install && cd ..

# Start development environment
npm run docker:up
npm run migration:run
npm run db:seed

# Start development servers
npm run dev:all
```

### Available Scripts

```bash
# Development
npm run dev              # Start backend only
npm run dev:all          # Start backend + frontend
npm run dev:watch        # Start with file watching

# Building
npm run build            # Build backend
npm run build:all        # Build backend + frontend

# Testing
npm test                 # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e         # Run end-to-end tests
npm run test:coverage    # Run with coverage

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checking
npm run format           # Format code with Prettier

# Database
npm run migration:create # Create new migration
npm run migration:run    # Run migrations
npm run db:seed          # Seed database

# Docker
npm run docker:build     # Build Docker images
npm run docker:up        # Start services
npm run docker:down      # Stop services
```

### Project Structure

```
coordinaitor/
├── src/                 # Backend source code
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── models/         # Database models
│   ├── middleware/     # Express middleware
│   └── utils/          # Utility functions
├── web/                # Frontend React application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom hooks
│   │   └── utils/      # Frontend utilities
│   └── public/         # Static assets
├── docs/               # Documentation
├── tests/              # Test files
├── scripts/            # Build and utility scripts
└── docker/             # Docker configuration
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting guidelines

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check our comprehensive [docs](docs/)
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/your-org/coordinaitor/issues)
- **Discussions**: Join our [GitHub Discussions](https://github.com/your-org/coordinaitor/discussions)
- **Security**: Report security issues to security@your-org.com

## 🎯 Roadmap

### Current Version (v0.1.0)
- ✅ AI agent coordination
- ✅ CLI and Web UI
- ✅ Real-time collaboration
- ✅ Error recovery and monitoring

### Upcoming Features
- 🔄 Advanced workflow automation
- 🔄 Custom agent marketplace
- 🔄 Integration with popular IDEs
- 🔄 Enhanced analytics and reporting
- 🔄 Mobile application support

---

**Made with ❤️ by the CoordinAItor Team**