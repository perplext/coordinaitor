# CoordinAItor API Documentation

Welcome to the comprehensive API documentation for the CoordinAItor platform. This documentation provides detailed information about all available endpoints, authentication methods, and usage examples.

## 🚀 Quick Start

### Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.coordinaitor.com`

### Interactive Documentation
Visit our interactive Swagger UI documentation:
- **Local**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Production**: [https://api.coordinaitor.com/api/docs](https://api.coordinaitor.com/api/docs)

### API Specification
Download the OpenAPI 3.0 specification:
- **JSON**: [http://localhost:3000/api/docs.json](http://localhost:3000/api/docs.json)

## 🔐 Authentication

The API supports multiple authentication methods:

### 1. JWT Bearer Token
```bash
curl -H "Authorization: Bearer your-jwt-token" \
  https://api.coordinaitor.com/api/agents
```

### 2. API Key
```bash
curl -H "X-API-Key: your-api-key" \
  https://api.coordinaitor.com/api/agents
```

### 3. Session Cookie
Session-based authentication for web applications:
```bash
curl -b "sessionId=your-session-id" \
  https://api.coordinaitor.com/api/agents
```

### 4. SSO Authentication
- **SAML 2.0**: Enterprise single sign-on
- **OAuth2/OIDC**: Google, Microsoft, GitHub, and custom providers

## 📚 API Endpoints Overview

### Core Features

#### 🤖 Agent Management
- `GET /api/agents` - List all registered agents
- `GET /api/agents/{id}/metrics` - Get agent performance metrics
- Agent types: LLM, Tool, Workflow, Custom
- Providers: Anthropic, OpenAI, Google, AWS, Azure

#### 📋 Task Orchestration
- `POST /api/tasks` - Create and execute tasks
- `GET /api/tasks` - List tasks with filtering
- `GET /api/tasks/{id}` - Get task details
- `PUT /api/tasks/{id}` - Update task
- Task types: General, Code Generation, Data Analysis, Documentation, Testing, Review

#### 📁 Project Management
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Enterprise Features

#### 🔒 SSO Configuration
- `GET /api/sso/settings` - Get SSO settings
- `PUT /api/sso/settings` - Update SSO settings
- `GET /api/sso/saml/providers` - List SAML providers
- `POST /api/sso/saml/providers` - Create SAML provider
- `GET /api/sso/oauth2/providers` - List OAuth2 providers
- `POST /api/sso/oauth2/providers` - Create OAuth2 provider

#### 🔐 Authentication
- `GET /api/auth/methods` - Get available auth methods
- `POST /api/auth/login` - Local authentication
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info

#### 🌐 Repository Integration
- `GET /api/repositories` - List connected repositories
- `POST /api/repositories` - Connect repository
- `POST /api/repositories/{id}/webhook` - Handle webhook events
- GitHub and GitLab integration with automation

#### 📊 Analytics & Monitoring
- `GET /api/analytics/snapshot` - Get current metrics snapshot
- `GET /api/analytics/agents` - Agent performance metrics
- `GET /api/analytics/projects` - Project analytics
- `GET /api/analytics/tasks` - Task execution metrics
- `GET /api/analytics/costs` - Cost analysis

### Workflow & Automation

#### 🔄 Workflows
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `POST /api/workflows/{id}/execute` - Execute workflow
- `GET /api/workflows/{id}/executions` - Get execution history

#### 📝 Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `POST /api/templates/{id}/apply` - Apply template

#### ✅ Approvals
- `GET /api/approvals` - List pending approvals
- `POST /api/approvals/{id}/approve` - Approve request
- `POST /api/approvals/{id}/reject` - Reject request

### System Management

#### 🏗️ Capacity Management
- `GET /api/capacity/agents` - Agent capacity status
- `PUT /api/capacity/agents/{id}` - Update agent capacity
- `GET /api/capacity/load-balance` - Load balancing status

#### 🛡️ Security
- `POST /api/tasks/{id}/security-scan` - Run security scan
- `GET /api/security/scans` - List security scan results
- `GET /api/security/scans/{id}/report` - Get security report

#### 🔧 Git Operations
- `GET /api/git/status` - Get repository status
- `GET /api/git/history` - Get commit history
- `POST /api/git/commit` - Create commit

#### 👥 Onboarding
- `GET /api/onboarding/profile` - Get user profile
- `PUT /api/onboarding/profile` - Update profile
- `POST /api/onboarding/complete` - Complete onboarding

## 📖 Usage Examples

### Creating a Task
```bash
curl -X POST \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a React component for a user profile card",
    "type": "code-generation",
    "priority": "high",
    "context": {
      "framework": "React",
      "styling": "CSS modules"
    }
  }' \
  https://api.coordinaitor.com/api/tasks
```

### Listing Agents
```bash
curl -H "Authorization: Bearer your-token" \
  https://api.coordinaitor.com/api/agents
```

### Creating a Project
```bash
curl -X POST \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-commerce Platform",
    "description": "Building a modern e-commerce solution",
    "priority": "high",
    "tags": ["react", "nodejs", "postgresql"]
  }' \
  https://api.coordinaitor.com/api/projects
```

## 🔢 Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2023-12-07T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Detailed error description",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  },
  "meta": {
    "timestamp": "2023-12-07T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

## 📏 Rate Limiting

API requests are rate-limited to ensure fair usage:
- **Free tier**: 100 requests per hour
- **Pro tier**: 1,000 requests per hour
- **Enterprise**: Custom limits

Rate limit headers:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Window reset time

## 🏷️ API Versioning

The API uses URL versioning:
- Current version: `v1`
- URL format: `/api/v1/endpoint`
- Version header: `API-Version: v1`

## 🌐 CORS Policy

CORS is enabled for web applications:
- Allowed origins: Configurable
- Allowed methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed headers: Content-Type, Authorization, X-API-Key

## 📞 Support & Resources

- **Documentation**: [https://docs.coordinaitor.com](https://docs.coordinaitor.com)
- **GitHub**: [https://github.com/coordinaitor/api](https://github.com/coordinaitor/api)
- **Support**: [support@coordinaitor.com](mailto:support@coordinaitor.com)
- **Status Page**: [https://status.coordinaitor.com](https://status.coordinaitor.com)

## 🏗️ SDKs & Libraries

Official SDKs available for:
- **JavaScript/TypeScript**: `npm install coordinaitor-sdk`
- **Python**: `pip install coordinaitor`
- **Go**: `go get github.com/coordinaitor/go-sdk`
- **Java**: Maven/Gradle packages available

## 🧪 Testing

Test your integration:
- **Postman Collection**: [Download here](./postman-collection.json)
- **Insomnia Workspace**: [Download here](./insomnia-workspace.json)
- **curl Examples**: [View examples](./curl-examples.md)

---

*Last updated: December 7, 2023*
*API Version: 1.0.0*