# API Documentation

The CoordinAItor provides a comprehensive REST API for programmatic access to all system features. This documentation covers authentication, endpoints, request/response formats, and provides extensive examples.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL and Versioning](#base-url-and-versioning)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-endpoints)
  - [Tasks](#task-endpoints)
  - [Agents](#agent-endpoints)
  - [Projects](#project-endpoints)
  - [Users](#user-endpoints)
  - [System](#system-endpoints)
- [Webhooks](#webhooks)
- [SDK Examples](#sdk-examples)
- [Best Practices](#best-practices)

## Overview

The CoordinAItor API is a RESTful API that uses standard HTTP methods and status codes. All API responses are in JSON format, and the API supports both synchronous and asynchronous operations.

### Key Features
- **RESTful Design**: Standard HTTP methods and status codes
- **JSON Format**: All requests and responses use JSON
- **Real-time Updates**: WebSocket support for live updates
- **Comprehensive Coverage**: Full feature access via API
- **Developer Friendly**: Detailed documentation and examples

### API Principles
- **Stateless**: Each request is independent
- **Idempotent**: Safe operations can be repeated
- **Consistent**: Uniform naming and structure
- **Versioned**: API versions to maintain compatibility

## Authentication

The API uses JWT (JSON Web Token) based authentication with support for multiple authentication methods.

### Authentication Methods

#### 1. JWT Bearer Token (Recommended)

```bash
# Login to get JWT token
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@orchestrator.com",
    "password": "admin123"
  }'

# Response
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "admin@orchestrator.com",
    "name": "Administrator"
  }
}

# Use token in subsequent requests
curl -X GET "http://localhost:3000/api/tasks" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 2. API Key Authentication

```bash
# Generate API key
curl -X POST "http://localhost:3000/api/auth/api-keys" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "permissions": ["tasks:read", "tasks:write", "agents:read"]
  }'

# Use API key
curl -X GET "http://localhost:3000/api/tasks" \
  -H "X-API-Key: ak_1234567890abcdef..."
```

#### 3. OAuth 2.0 (Enterprise)

```bash
# OAuth flow (for enterprise installations)
# Step 1: Authorization URL
https://your-orchestrator.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&scope=tasks:read+agents:read

# Step 2: Exchange code for token
curl -X POST "http://localhost:3000/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=AUTH_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### Token Refresh

```bash
# Refresh expired token
curl -X POST "http://localhost:3000/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

## Base URL and Versioning

### Base URL
```
Production: https://api.orchestrator.com
Development: http://localhost:3000
```

### API Versioning
The API uses URL path versioning:
```
/api/v1/tasks     # Version 1 (current)
/api/v2/tasks     # Version 2 (future)
```

### Content Type
All requests should include:
```
Content-Type: application/json
Accept: application/json
```

## Request/Response Format

### Standard Request Format

```bash
curl -X POST "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task title",
    "description": "Task description",
    "priority": "high"
  }'
```

### Standard Response Format

```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Task title",
    "description": "Task description",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "req-456",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Pagination Format

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "links": {
    "first": "/api/v1/tasks?page=1&limit=20",
    "last": "/api/v1/tasks?page=8&limit=20",
    "next": "/api/v1/tasks?page=2&limit=20",
    "prev": null
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "title": ["Title is required"],
      "priority": ["Priority must be one of: low, medium, high"]
    }
  },
  "meta": {
    "requestId": "req-789",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no content returned |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_ERROR` | Invalid or expired token |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `CONFLICT_ERROR` | Resource conflict |
| `RATE_LIMIT_ERROR` | Rate limit exceeded |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Rate Limiting

The API implements rate limiting to ensure fair usage and system stability.

### Rate Limit Headers

```bash
# Rate limit information is included in response headers
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
X-RateLimit-Window: 3600
```

### Rate Limit Tiers

| User Type | Requests/Hour | Burst Limit |
|-----------|---------------|-------------|
| Free | 1,000 | 50 |
| Pro | 10,000 | 200 |
| Enterprise | 100,000 | 1,000 |
| API Key | Configurable | Configurable |

### Handling Rate Limits

```bash
# Example rate limit exceeded response
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642248600
Retry-After: 3600

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded",
    "retryAfter": 3600
  }
}
```

## Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "organizationId": "org-456"
    }
  }
}
```

#### POST /api/v1/auth/refresh
Refresh expired access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /api/v1/auth/logout
Invalidate current session.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Task Endpoints

#### GET /api/v1/tasks
Retrieve list of tasks with optional filtering.

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (pending, active, completed, failed, cancelled)
- `priority` (string): Filter by priority (low, medium, high)
- `projectId` (string): Filter by project ID
- `agentId` (string): Filter by assigned agent ID
- `search` (string): Search in title and description
- `tags` (string): Comma-separated list of tags
- `createdAfter` (datetime): Filter by creation date
- `createdBefore` (datetime): Filter by creation date
- `sortBy` (string): Sort field (createdAt, updatedAt, priority, dueDate)
- `sortOrder` (string): Sort order (asc, desc)

**Examples:**

```bash
# Get all tasks
curl -X GET "http://localhost:3000/api/v1/tasks" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get high-priority active tasks
curl -X GET "http://localhost:3000/api/v1/tasks?status=active&priority=high" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search tasks with pagination
curl -X GET "http://localhost:3000/api/v1/tasks?search=authentication&page=2&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by project and tags
curl -X GET "http://localhost:3000/api/v1/tasks?projectId=proj-123&tags=frontend,react" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task-123",
      "title": "Implement user authentication",
      "description": "Add JWT-based authentication to the application",
      "status": "active",
      "priority": "high",
      "projectId": "proj-456",
      "agentId": "agent-789",
      "tags": ["authentication", "security"],
      "estimatedHours": 8,
      "actualHours": 3.5,
      "progress": 0.4,
      "dueDate": "2024-02-15T00:00:00Z",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-16T14:20:00Z",
      "createdBy": "user-123",
      "assignedAgent": {
        "id": "agent-789",
        "name": "Senior Developer Bot",
        "type": "coding"
      },
      "project": {
        "id": "proj-456",
        "name": "E-commerce Platform"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### POST /api/v1/tasks
Create a new task.

**Request:**
```json
{
  "title": "Build user dashboard",
  "description": "Create a comprehensive user dashboard with analytics and controls",
  "priority": "medium",
  "projectId": "proj-123",
  "agentId": "agent-456",
  "tags": ["frontend", "dashboard", "analytics"],
  "estimatedHours": 12,
  "dueDate": "2024-02-20T00:00:00Z",
  "requirements": [
    "Responsive design",
    "Real-time data updates",
    "Export functionality"
  ],
  "acceptanceCriteria": [
    "Dashboard loads within 2 seconds",
    "All data is real-time",
    "Export works for all data formats"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-456",
    "title": "Build user dashboard",
    "description": "Create a comprehensive user dashboard with analytics and controls",
    "status": "pending",
    "priority": "medium",
    "projectId": "proj-123",
    "agentId": "agent-456",
    "tags": ["frontend", "dashboard", "analytics"],
    "estimatedHours": 12,
    "actualHours": 0,
    "progress": 0,
    "dueDate": "2024-02-20T00:00:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "createdBy": "user-123",
    "requirements": [
      "Responsive design",
      "Real-time data updates",
      "Export functionality"
    ],
    "acceptanceCriteria": [
      "Dashboard loads within 2 seconds",
      "All data is real-time",
      "Export works for all data formats"
    ]
  }
}
```

#### GET /api/v1/tasks/{taskId}
Retrieve specific task details.

**Path Parameters:**
- `taskId` (string): Task ID

**Query Parameters:**
- `include` (string): Comma-separated list of related data to include (comments, files, history, metrics)

**Examples:**

```bash
# Get basic task details
curl -X GET "http://localhost:3000/api/v1/tasks/task-123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get task with all related data
curl -X GET "http://localhost:3000/api/v1/tasks/task-123?include=comments,files,history,metrics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the application",
    "status": "active",
    "priority": "high",
    "projectId": "proj-456",
    "agentId": "agent-789",
    "tags": ["authentication", "security"],
    "estimatedHours": 8,
    "actualHours": 3.5,
    "progress": 0.4,
    "dueDate": "2024-02-15T00:00:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-16T14:20:00Z",
    "createdBy": "user-123",
    "comments": [
      {
        "id": "comment-123",
        "content": "Started working on the login component",
        "author": "agent-789",
        "createdAt": "2024-01-16T09:00:00Z"
      }
    ],
    "files": [
      {
        "id": "file-123",
        "name": "auth-component.tsx",
        "size": 2048,
        "mimeType": "text/typescript",
        "uploadedAt": "2024-01-16T10:00:00Z"
      }
    ],
    "history": [
      {
        "id": "history-123",
        "action": "status_changed",
        "from": "pending",
        "to": "active",
        "user": "agent-789",
        "timestamp": "2024-01-16T08:00:00Z"
      }
    ],
    "metrics": {
      "timeSpent": 3.5,
      "completionRate": 0.4,
      "qualityScore": 0.85,
      "changeRequests": 1
    }
  }
}
```

#### PUT /api/v1/tasks/{taskId}
Update task details.

**Request:**
```json
{
  "title": "Updated task title",
  "description": "Updated description",
  "priority": "high",
  "status": "active",
  "dueDate": "2024-02-25T00:00:00Z",
  "tags": ["updated", "priority"]
}
```

#### PATCH /api/v1/tasks/{taskId}
Partially update task (only specified fields).

**Request:**
```json
{
  "status": "completed",
  "actualHours": 7.5,
  "progress": 1.0
}
```

#### DELETE /api/v1/tasks/{taskId}
Delete a task.

**Query Parameters:**
- `reason` (string): Reason for deletion

#### POST /api/v1/tasks/{taskId}/assign
Assign task to an agent.

**Request:**
```json
{
  "agentId": "agent-789",
  "priority": "high",
  "dueDate": "2024-02-20T00:00:00Z"
}
```

#### POST /api/v1/tasks/{taskId}/comments
Add comment to task.

**Request:**
```json
{
  "content": "Great progress on the authentication system!",
  "mentions": ["user-123", "user-456"]
}
```

#### POST /api/v1/tasks/{taskId}/files
Upload file to task.

**Request (multipart/form-data):**
```bash
curl -X POST "http://localhost:3000/api/v1/tasks/task-123/files" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@./design-mockup.png" \
  -F "description=UI mockup for authentication screen"
```

### Agent Endpoints

#### GET /api/v1/agents
Retrieve list of agents.

**Query Parameters:**
- `page`, `limit`: Pagination
- `type` (string): Filter by agent type (coding, analysis, review, qa, documentation)
- `status` (string): Filter by status (available, busy, offline, error)
- `capabilities` (string): Comma-separated list of required capabilities
- `available` (boolean): Only available agents

**Examples:**

```bash
# Get all coding agents
curl -X GET "http://localhost:3000/api/v1/agents?type=coding" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get available agents with React capability
curl -X GET "http://localhost:3000/api/v1/agents?available=true&capabilities=react" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-123",
      "name": "Senior React Developer",
      "type": "coding",
      "status": "available",
      "model": "gpt-4",
      "provider": "openai",
      "capabilities": ["react", "typescript", "nodejs", "testing"],
      "specializations": ["frontend", "performance-optimization"],
      "maxConcurrentTasks": 3,
      "currentTasks": 1,
      "averageResponseTime": 45.2,
      "successRate": 0.94,
      "totalTasksCompleted": 127,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastActiveAt": "2024-01-16T14:30:00Z",
      "workingHours": {
        "timezone": "UTC",
        "start": "09:00",
        "end": "17:00"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

#### POST /api/v1/agents
Create a new agent.

**Request:**
```json
{
  "name": "Full Stack Developer Bot",
  "type": "coding",
  "model": "gpt-4",
  "provider": "openai",
  "capabilities": ["react", "nodejs", "python", "postgresql", "aws"],
  "specializations": ["full-stack", "microservices", "devops"],
  "maxConcurrentTasks": 2,
  "workingHours": {
    "timezone": "America/New_York",
    "start": "09:00",
    "end": "17:00",
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
  },
  "configuration": {
    "temperature": 0.7,
    "maxTokens": 4000,
    "codeStyle": "clean-code",
    "testingFramework": "jest",
    "documentationLevel": "comprehensive"
  }
}
```

#### GET /api/v1/agents/{agentId}
Get agent details.

**Query Parameters:**
- `include` (string): Include related data (tasks, metrics, logs)

#### PUT /api/v1/agents/{agentId}
Update agent configuration.

#### POST /api/v1/agents/{agentId}/enable
Enable an agent.

#### POST /api/v1/agents/{agentId}/disable
Disable an agent.

**Request:**
```json
{
  "reason": "Maintenance required"
}
```

#### GET /api/v1/agents/{agentId}/tasks
Get tasks assigned to agent.

#### GET /api/v1/agents/{agentId}/metrics
Get agent performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "agent-123",
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-16T23:59:59Z"
    },
    "taskMetrics": {
      "totalTasks": 127,
      "completedTasks": 119,
      "failedTasks": 3,
      "cancelledTasks": 5,
      "successRate": 0.94,
      "averageCompletionTime": 4.2
    },
    "performanceMetrics": {
      "averageResponseTime": 45.2,
      "qualityScore": 0.87,
      "customerSatisfaction": 4.6,
      "codeQualityScore": 0.91
    },
    "utilizationMetrics": {
      "totalHours": 160,
      "activeHours": 142,
      "utilizationRate": 0.89,
      "peakHours": ["10:00-12:00", "14:00-16:00"]
    }
  }
}
```

### Project Endpoints

#### GET /api/v1/projects
Retrieve list of projects.

**Query Parameters:**
- `page`, `limit`: Pagination
- `status` (string): Filter by status (active, completed, archived, on-hold)
- `search` (string): Search in name and description
- `memberId` (string): Filter by team member

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "proj-123",
      "name": "E-commerce Platform",
      "description": "Full-featured e-commerce platform with admin panel",
      "status": "active",
      "priority": "high",
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z",
      "progress": 0.65,
      "taskCount": {
        "total": 45,
        "completed": 29,
        "active": 8,
        "pending": 8
      },
      "teamSize": 6,
      "assignedAgents": 4,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-16T10:00:00Z"
    }
  ]
}
```

#### POST /api/v1/projects
Create a new project.

**Request:**
```json
{
  "name": "Mobile Application",
  "description": "Cross-platform mobile app for iOS and Android",
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-06-30T23:59:59Z",
  "priority": "medium",
  "budget": {
    "hours": 500,
    "cost": 75000
  },
  "teamMembers": [
    {
      "userId": "user-123",
      "role": "project-manager"
    },
    {
      "userId": "user-456",
      "role": "developer"
    }
  ],
  "agents": ["agent-123", "agent-456"],
  "tags": ["mobile", "react-native", "ios", "android"]
}
```

#### GET /api/v1/projects/{projectId}
Get project details.

#### PUT /api/v1/projects/{projectId}
Update project.

#### DELETE /api/v1/projects/{projectId}
Delete project.

#### GET /api/v1/projects/{projectId}/tasks
Get project tasks.

#### POST /api/v1/projects/{projectId}/members
Add team member to project.

**Request:**
```json
{
  "userId": "user-789",
  "role": "developer",
  "permissions": ["tasks:read", "tasks:write"]
}
```

#### DELETE /api/v1/projects/{projectId}/members/{userId}
Remove team member from project.

### User Endpoints

#### GET /api/v1/users
Get list of users (admin only).

#### GET /api/v1/users/me
Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "developer",
    "organizationId": "org-456",
    "avatar": "https://example.com/avatars/user-123.jpg",
    "preferences": {
      "theme": "dark",
      "language": "en",
      "timezone": "America/New_York",
      "notifications": {
        "email": true,
        "push": true,
        "desktop": false
      }
    },
    "stats": {
      "tasksCreated": 45,
      "tasksCompleted": 38,
      "projectsActive": 3
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-16T08:30:00Z"
  }
}
```

#### PUT /api/v1/users/me
Update current user profile.

#### POST /api/v1/users/me/avatar
Upload user avatar.

#### GET /api/v1/users/me/notifications
Get user notifications.

#### PUT /api/v1/users/me/notifications/{notificationId}/read
Mark notification as read.

### System Endpoints

#### GET /api/v1/system/health
Get system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-16T15:30:00Z",
    "uptime": 86400,
    "version": "1.0.0",
    "environment": "production",
    "services": {
      "database": {
        "status": "healthy",
        "latency": 12.3,
        "connections": 15
      },
      "redis": {
        "status": "healthy",
        "latency": 2.1,
        "memory": "45MB"
      },
      "agents": {
        "status": "healthy",
        "total": 12,
        "available": 8,
        "busy": 4
      }
    },
    "metrics": {
      "activeTasks": 23,
      "completedToday": 45,
      "averageResponseTime": 234.5,
      "errorRate": 0.02
    }
  }
}
```

#### GET /api/v1/system/metrics
Get system metrics.

#### GET /api/v1/system/logs
Get system logs (admin only).

**Query Parameters:**
- `level` (string): Log level (error, warn, info, debug)
- `service` (string): Filter by service
- `since` (datetime): Logs since timestamp
- `limit` (integer): Number of log entries

#### GET /api/v1/system/status
Get detailed system status.

## Webhooks

The API supports webhook notifications for real-time event notifications.

### Webhook Configuration

#### POST /api/v1/webhooks
Create a webhook.

**Request:**
```json
{
  "url": "https://your-app.com/webhook/orchestrator",
  "events": [
    "task.created",
    "task.completed",
    "task.failed",
    "agent.status_changed"
  ],
  "secret": "your-webhook-secret",
  "active": true,
  "headers": {
    "User-Agent": "Orchestrator-Webhook/1.0"
  }
}
```

### Webhook Events

#### Available Events
- `task.created` - New task created
- `task.updated` - Task updated
- `task.completed` - Task completed
- `task.failed` - Task failed
- `task.assigned` - Task assigned to agent
- `agent.created` - New agent created
- `agent.status_changed` - Agent status changed
- `project.created` - New project created
- `project.completed` - Project completed
- `user.registered` - New user registered

#### Webhook Payload

```json
{
  "event": "task.completed",
  "timestamp": "2024-01-16T15:30:00Z",
  "data": {
    "id": "task-123",
    "title": "Implement user authentication",
    "status": "completed",
    "completedAt": "2024-01-16T15:30:00Z",
    "agent": {
      "id": "agent-456",
      "name": "Senior Developer Bot"
    },
    "project": {
      "id": "proj-789",
      "name": "E-commerce Platform"
    }
  },
  "organization": {
    "id": "org-123",
    "name": "Acme Corp"
  }
}
```

### Webhook Security

#### Signature Verification
Webhooks are signed with HMAC-SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Express.js example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-orchestrator-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
});
```

## SDK Examples

### JavaScript/Node.js

```javascript
// Install: npm install orchestrator-sdk

const { OrchestratorClient } = require('orchestrator-sdk');

const client = new OrchestratorClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Create a task
async function createTask() {
  try {
    const task = await client.tasks.create({
      title: 'Build user registration',
      description: 'Implement user registration with email verification',
      priority: 'high',
      projectId: 'proj-123'
    });
    
    console.log('Task created:', task.id);
    return task;
  } catch (error) {
    console.error('Error creating task:', error.message);
  }
}

// Monitor task progress
async function watchTask(taskId) {
  const watcher = client.tasks.watch(taskId);
  
  watcher.on('update', (task) => {
    console.log(`Task ${taskId} progress: ${task.progress * 100}%`);
  });
  
  watcher.on('completed', (task) => {
    console.log(`Task ${taskId} completed!`);
    watcher.close();
  });
  
  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });
}

// List available agents
async function listAgents() {
  const agents = await client.agents.list({
    type: 'coding',
    available: true
  });
  
  console.log(`Found ${agents.data.length} available coding agents`);
  return agents.data;
}
```

### Python

```python
# Install: pip install orchestrator-python-sdk

from orchestrator_sdk import OrchestratorClient
import asyncio

client = OrchestratorClient(
    base_url='http://localhost:3000',
    api_key='your-api-key'
)

async def create_and_monitor_task():
    # Create task
    task = await client.tasks.create({
        'title': 'Build user registration',
        'description': 'Implement user registration with email verification',
        'priority': 'high',
        'project_id': 'proj-123'
    })
    
    print(f'Task created: {task["id"]}')
    
    # Monitor progress
    async for update in client.tasks.watch(task['id']):
        if update['type'] == 'progress':
            print(f'Progress: {update["progress"] * 100}%')
        elif update['type'] == 'completed':
            print('Task completed!')
            break
        elif update['type'] == 'error':
            print(f'Task failed: {update["error"]}')
            break

# Run the example
asyncio.run(create_and_monitor_task())
```

### cURL Examples

```bash
#!/bin/bash

# Configuration
API_BASE="http://localhost:3000/api/v1"
API_KEY="your-api-key"

# Helper function for API calls
api_call() {
  curl -s -H "Authorization: Bearer $API_KEY" \
       -H "Content-Type: application/json" \
       "$@"
}

# Create a task
create_task() {
  api_call -X POST "$API_BASE/tasks" -d '{
    "title": "Build user registration",
    "description": "Implement user registration with email verification",
    "priority": "high",
    "projectId": "proj-123"
  }' | jq '.data.id' -r
}

# Monitor task status
monitor_task() {
  local task_id=$1
  while true; do
    status=$(api_call "$API_BASE/tasks/$task_id" | jq '.data.status' -r)
    progress=$(api_call "$API_BASE/tasks/$task_id" | jq '.data.progress' -r)
    
    echo "Task $task_id: $status (${progress}% complete)"
    
    if [[ "$status" == "completed" || "$status" == "failed" ]]; then
      break
    fi
    
    sleep 5
  done
}

# Example usage
TASK_ID=$(create_task)
echo "Created task: $TASK_ID"
monitor_task "$TASK_ID"
```

## Best Practices

### 1. Authentication and Security

#### Use API Keys for Server-to-Server
```javascript
// For server-to-server integration, use API keys
const client = new OrchestratorClient({
  apiKey: process.env.ORCHESTRATOR_API_KEY,
  baseUrl: process.env.ORCHESTRATOR_URL
});
```

#### Implement Token Refresh
```javascript
// Implement automatic token refresh
class AuthenticatedClient {
  constructor(credentials) {
    this.credentials = credentials;
    this.token = null;
    this.refreshToken = null;
  }
  
  async ensureAuthenticated() {
    if (!this.token || this.isTokenExpired()) {
      await this.refreshAuth();
    }
  }
  
  async refreshAuth() {
    if (this.refreshToken) {
      // Use refresh token
      const response = await this.post('/auth/refresh', {
        refreshToken: this.refreshToken
      });
      this.token = response.accessToken;
    } else {
      // Login with credentials
      const response = await this.post('/auth/login', this.credentials);
      this.token = response.accessToken;
      this.refreshToken = response.refreshToken;
    }
  }
}
```

### 2. Error Handling

#### Implement Retry Logic
```javascript
async function apiCallWithRetry(apiCall, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### Handle Rate Limits
```javascript
async function handleRateLimit(apiCall) {
  try {
    return await apiCall();
  } catch (error) {
    if (error.status === 429) {
      const retryAfter = error.headers['retry-after'] || 60;
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return await apiCall();
    }
    throw error;
  }
}
```

### 3. Performance Optimization

#### Use Pagination Effectively
```javascript
async function getAllTasks() {
  const allTasks = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await client.tasks.list({
      page,
      limit: 100 // Use maximum page size
    });
    
    allTasks.push(...response.data);
    hasMore = response.pagination.hasNext;
    page++;
  }
  
  return allTasks;
}
```

#### Implement Caching
```javascript
class CachedClient {
  constructor(client) {
    this.client = client;
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute
  }
  
  async getCachedData(key, fetchFunction) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const data = await fetchFunction();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
  
  async getAgent(agentId) {
    return this.getCachedData(
      `agent:${agentId}`,
      () => this.client.agents.get(agentId)
    );
  }
}
```

### 4. Real-time Updates

#### Use WebSocket for Real-time Data
```javascript
// WebSocket connection for real-time updates
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  // Subscribe to task updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'tasks',
    filters: {
      projectId: 'proj-123'
    }
  }));
});

ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  switch (update.type) {
    case 'task.updated':
      handleTaskUpdate(update.data);
      break;
    case 'agent.status_changed':
      handleAgentStatusChange(update.data);
      break;
  }
});
```

### 5. Monitoring and Logging

#### Log API Interactions
```javascript
class LoggingClient {
  constructor(client) {
    this.client = client;
  }
  
  async makeRequest(method, endpoint, data) {
    const startTime = Date.now();
    
    try {
      const result = await this.client[method](endpoint, data);
      const duration = Date.now() - startTime;
      
      console.log(`API ${method.toUpperCase()} ${endpoint}: ${duration}ms`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`API ${method.toUpperCase()} ${endpoint} failed: ${error.message} (${duration}ms)`);
      throw error;
    }
  }
}
```

#### Monitor API Health
```javascript
async function monitorApiHealth() {
  setInterval(async () => {
    try {
      const health = await client.system.health();
      
      if (health.status !== 'healthy') {
        console.warn('API health warning:', health);
        // Send alert
      }
      
    } catch (error) {
      console.error('API health check failed:', error);
      // Send critical alert
    }
  }, 30000); // Check every 30 seconds
}
```

---

## Quick Reference

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

### Authentication Headers
```
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>
```

### Standard Query Parameters
- `page` - Page number
- `limit` - Items per page
- `search` - Search query
- `include` - Include related data

### Response Format
All responses follow the standard format:
```json
{
  "success": boolean,
  "data": object|array,
  "error": object,
  "pagination": object,
  "meta": object
}
```

---

*This API documentation is automatically generated and updated. For the most current information, refer to the interactive API documentation at `/api/docs` when running the application.*