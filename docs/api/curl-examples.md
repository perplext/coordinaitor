# CoordinAItor API - curl Examples

This document provides comprehensive curl examples for testing the CoordinAItor API.

## Environment Setup

Set these environment variables for easier testing:

```bash
export API_BASE="http://localhost:3000/api"
export JWT_TOKEN="your-jwt-token-here"
export ORG_ID="default"
```

## Authentication

### Get Available Authentication Methods

```bash
curl -X GET "${API_BASE}/auth/methods/${ORG_ID}" \
  -H "Content-Type: application/json"
```

### Login (Local Authentication)

```bash
curl -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "organizationId": "'${ORG_ID}'"
  }'
```

Save the JWT token from response:
```bash
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Current User Info

```bash
curl -X GET "${API_BASE}/auth/me" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Logout

```bash
curl -X POST "${API_BASE}/auth/logout" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## System Health

### Health Check

```bash
curl -X GET "${API_BASE}/health"
```

## Agent Management

### List All Agents

```bash
curl -X GET "${API_BASE}/agents" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Agent Metrics

```bash
curl -X GET "${API_BASE}/agents/claude-001/metrics" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Task Management

### Create a Simple Task

```bash
curl -X POST "${API_BASE}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain the concept of microservices architecture",
    "type": "general",
    "priority": "medium"
  }'
```

### Create a Code Generation Task

```bash
curl -X POST "${API_BASE}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a React component for a user profile card with TypeScript",
    "type": "code-generation",
    "priority": "high",
    "context": {
      "framework": "React",
      "language": "TypeScript",
      "styling": "CSS modules",
      "props": ["name", "email", "avatar", "role"]
    }
  }'
```

### Create a Collaborative Task

```bash
curl -X POST "${API_BASE}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Design and implement a REST API for a blog system",
    "type": "code-generation",
    "priority": "high",
    "useCollaboration": true,
    "context": {
      "requirements": ["CRUD operations", "authentication", "pagination"],
      "technology": "Node.js with Express",
      "database": "PostgreSQL"
    }
  }'
```

### List Tasks with Filtering

```bash
# Get all completed tasks
curl -X GET "${API_BASE}/tasks?status=completed" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# Get high priority tasks
curl -X GET "${API_BASE}/tasks?priority=high" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# Get tasks by project
curl -X GET "${API_BASE}/tasks?projectId=project-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# Get tasks by agent
curl -X GET "${API_BASE}/tasks?agentId=claude-001" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Task Details

```bash
curl -X GET "${API_BASE}/tasks/task-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Update Task

```bash
curl -X PUT "${API_BASE}/tasks/task-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "urgent",
    "status": "in-progress"
  }'
```

## Project Management

### Create a Project

```bash
curl -X POST "${API_BASE}/projects" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-commerce Platform",
    "description": "Building a modern e-commerce solution with microservices",
    "priority": "high",
    "tags": ["react", "nodejs", "postgresql", "microservices"],
    "deadline": "2024-06-01T00:00:00.000Z"
  }'
```

### List Projects

```bash
curl -X GET "${API_BASE}/projects" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Project Details

```bash
curl -X GET "${API_BASE}/projects/project-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Update Project

```bash
curl -X PUT "${API_BASE}/projects/project-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "priority": "urgent",
    "description": "Updated project description"
  }'
```

### Delete Project

```bash
curl -X DELETE "${API_BASE}/projects/project-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## SSO Configuration

### Get SSO Settings

```bash
curl -X GET "${API_BASE}/sso/settings" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Update SSO Settings

```bash
curl -X PUT "${API_BASE}/sso/settings" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "allowLocalAuth": true,
    "forceSSO": false,
    "sessionTimeout": 86400000
  }'
```

### List SAML Providers

```bash
curl -X GET "${API_BASE}/sso/saml/providers" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create SAML Provider

```bash
curl -X POST "${API_BASE}/sso/saml/providers" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Okta SAML",
    "entityId": "https://dev-123.okta.com",
    "ssoUrl": "https://dev-123.okta.com/app/app_name/exk123/sso/saml",
    "metadata": "<EntityDescriptor xmlns=\"urn:oasis:names:tc:SAML:2.0:metadata\">...</EntityDescriptor>",
    "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    "attributeMapping": {
      "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
      "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
      "groups": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
    },
    "autoProvisionUsers": true,
    "defaultRole": "org_member",
    "allowedDomains": ["company.com"],
    "enabled": true
  }'
```

### List OAuth2 Providers

```bash
curl -X GET "${API_BASE}/sso/oauth2/providers" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create OAuth2 Provider (Google)

```bash
curl -X POST "${API_BASE}/sso/oauth2/providers" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Google OAuth2",
    "provider": "google",
    "clientId": "your-client-id.apps.googleusercontent.com",
    "clientSecret": "your-client-secret",
    "scopes": ["openid", "email", "profile"],
    "redirectUri": "http://localhost:3000/auth/oauth2/google/callback",
    "useDiscovery": true,
    "discoveryUrl": "https://accounts.google.com/.well-known/openid_configuration",
    "enabled": true
  }'
```

## Analytics & Monitoring

### Get Analytics Snapshot

```bash
curl -X GET "${API_BASE}/analytics/snapshot" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Agent Analytics

```bash
curl -X GET "${API_BASE}/analytics/agents" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Project Analytics

```bash
curl -X GET "${API_BASE}/analytics/projects" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Task Analytics

```bash
curl -X GET "${API_BASE}/analytics/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Cost Analytics

```bash
curl -X GET "${API_BASE}/analytics/costs" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Performance Insights

```bash
curl -X GET "${API_BASE}/analytics/insights" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Capacity Management

### Get Agent Capacity Status

```bash
curl -X GET "${API_BASE}/capacity/agents" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Update Agent Capacity

```bash
curl -X PUT "${API_BASE}/capacity/agents/claude-001" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "maxConcurrentTasks": 10,
    "enabled": true
  }'
```

### Get Load Balancing Status

```bash
curl -X GET "${API_BASE}/capacity/load-balance" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Workflows

### List Workflows

```bash
curl -X GET "${API_BASE}/workflows" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Workflow Details

```bash
curl -X GET "${API_BASE}/workflows/workflow-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Execute Workflow

```bash
curl -X POST "${API_BASE}/workflows/workflow-123/execute" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "projectName": "My New Project",
      "language": "TypeScript",
      "framework": "React"
    }
  }'
```

### Get Workflow Executions

```bash
curl -X GET "${API_BASE}/workflows/workflow-123/executions" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Templates

### List Templates

```bash
curl -X GET "${API_BASE}/templates" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Template Details

```bash
curl -X GET "${API_BASE}/templates/template-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Apply Template

```bash
curl -X POST "${API_BASE}/templates/template-123/apply" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "componentName": "UserCard",
      "props": ["name", "email", "avatar", "role"],
      "styling": "styled-components"
    }
  }'
```

### Create Template

```bash
curl -X POST "${API_BASE}/templates" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "React Component Template",
    "description": "Template for creating React components",
    "category": "frontend",
    "template": "Generate a React component named {{componentName}} with props {{props}}",
    "variables": [
      {
        "name": "componentName",
        "type": "string",
        "required": true,
        "description": "Name of the component"
      },
      {
        "name": "props",
        "type": "array",
        "required": false,
        "description": "Component props"
      }
    ]
  }'
```

## Git Operations

### Get Git Status

```bash
curl -X GET "${API_BASE}/git/status" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Git History

```bash
curl -X GET "${API_BASE}/git/history?limit=10" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create Git Commit

```bash
curl -X POST "${API_BASE}/git/commit" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Add new user authentication feature",
    "files": ["src/auth/", "src/middleware/auth.ts"]
  }'
```

## Security

### Run Security Scan

```bash
curl -X POST "${API_BASE}/tasks/task-123/security-scan" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Security Scan Results

```bash
curl -X GET "${API_BASE}/security/scans?taskId=task-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Security Report

```bash
curl -X GET "${API_BASE}/security/scans/task-123/report" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Accept: text/markdown"
```

## Collaboration

### Get Collaboration Sessions

```bash
curl -X GET "${API_BASE}/collaboration/sessions" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Start Collaborative Task

```bash
curl -X POST "${API_BASE}/tasks/task-123/collaborate" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Approvals

### List Pending Approvals

```bash
curl -X GET "${API_BASE}/approvals" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Approve Request

```bash
curl -X POST "${API_BASE}/approvals/approval-123/approve" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Approved - looks good to proceed"
  }'
```

### Reject Request

```bash
curl -X POST "${API_BASE}/approvals/approval-123/reject" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Rejected - needs security review",
    "reason": "security_concerns"
  }'
```

## Organization Management

### List Organizations (Super Admin)

```bash
curl -X GET "${API_BASE}/organizations?page=1&limit=20" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create Organization

```bash
curl -X POST "${API_BASE}/organizations" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acme-corp",
    "displayName": "Acme Corporation",
    "subdomain": "acme",
    "tier": "professional",
    "contactEmail": "admin@acme.com",
    "billingEmail": "billing@acme.com",
    "industry": "technology",
    "size": "medium",
    "timezone": "America/New_York",
    "language": "en",
    "currency": "USD"
  }'
```

### Get Organization Details

```bash
curl -X GET "${API_BASE}/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Update Organization

```bash
curl -X PUT "${API_BASE}/organizations/${ORG_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Acme Corporation Updated",
    "contactEmail": "newadmin@acme.com",
    "industry": "fintech",
    "size": "large"
  }'
```

### Get Organization Usage Statistics

```bash
curl -X GET "${API_BASE}/organizations/${ORG_ID}/usage" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Check Organization Limits

```bash
curl -X GET "${API_BASE}/organizations/${ORG_ID}/limits" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### List Organization Users

```bash
curl -X GET "${API_BASE}/organizations/${ORG_ID}/users" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Multi-Tenant Request Examples

#### Using Subdomain Strategy

```bash
# Request to acme.platform.com
curl -X GET "https://acme.platform.com/api/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

#### Using Custom Domain Strategy

```bash
# Request to acme.com (if configured)
curl -X GET "https://acme.com/api/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

#### Using Header Strategy

```bash
curl -X GET "${API_BASE}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "X-Tenant-ID: ${ORG_ID}"
```

#### Using Path Strategy

```bash
curl -X GET "${API_BASE}/org/${ORG_ID}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Billing Management

### Get Available Plans

```bash
curl -X GET "${API_BASE}/billing/plans" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Plan Details

```bash
curl -X GET "${API_BASE}/billing/plans/professional" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Current Subscription

```bash
curl -X GET "${API_BASE}/billing/subscription" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create Subscription

```bash
curl -X POST "${API_BASE}/billing/subscription" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "professional",
    "paymentMethodId": "pm_123456"
  }'
```

### Cancel Subscription

```bash
# Cancel at period end
curl -X POST "${API_BASE}/billing/subscription/cancel" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "immediately": false,
    "reason": "No longer needed"
  }'

# Cancel immediately
curl -X POST "${API_BASE}/billing/subscription/cancel" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "immediately": true,
    "reason": "Switching providers"
  }'
```

### Record Usage (Internal API)

```bash
curl -X POST "${API_BASE}/billing/usage" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "api_calls",
    "quantity": 100,
    "metadata": {
      "endpoint": "/api/tasks",
      "method": "POST"
    }
  }'
```

### Get Invoices

```bash
# Get all invoices
curl -X GET "${API_BASE}/billing/invoices" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# Filter by status
curl -X GET "${API_BASE}/billing/invoices?status=paid&limit=10" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Invoice Details

```bash
curl -X GET "${API_BASE}/billing/invoices/inv_123456" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Organization Configuration

### Get Organization Agent Configurations

```bash
curl -X GET "${API_BASE}/organization-config/agents" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Get Available Agents for Organization

```bash
curl -X GET "${API_BASE}/organization-config/agents/available" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Configure Organization Agent

```bash
curl -X PUT "${API_BASE}/organization-config/agents/claude-001" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "priority": 10,
    "maxConcurrentTasks": 5,
    "config": {
      "model": "claude-3-sonnet-20241022",
      "temperature": 0.7,
      "maxTokens": 4000,
      "systemPrompt": "You are a helpful AI assistant for our organization.",
      "rateLimits": {
        "requestsPerMinute": 60,
        "requestsPerHour": 1000,
        "requestsPerDay": 10000
      },
      "costLimits": {
        "maxCostPerTask": 5.00,
        "maxCostPerDay": 100.00,
        "maxCostPerMonth": 1000.00
      },
      "features": {
        "codeGeneration": true,
        "dataAnalysis": true,
        "imageGeneration": false,
        "fileProcessing": true,
        "webSearch": true,
        "collaboration": true
      }
    }
  }'
```

### Get Organization Feature Configurations

```bash
curl -X GET "${API_BASE}/organization-config/features" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Configure Organization Feature

```bash
curl -X PUT "${API_BASE}/organization-config/features/webhooks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "config": {
      "maxWebhooks": 10,
      "allowedDomains": ["*.company.com", "api.partner.com"],
      "retryAttempts": 3,
      "timeoutMs": 30000
    },
    "limits": {
      "maxUsage": 1000,
      "rateLimits": {
        "requestsPerMinute": 100
      }
    }
  }'
```

### Get Organization Workflows

```bash
curl -X GET "${API_BASE}/organization-config/workflows" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create Organization Workflow

```bash
curl -X POST "${API_BASE}/organization-config/workflows" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Review Automation",
    "description": "Automatically review code changes and provide feedback",
    "enabled": true,
    "triggerEvents": ["github:pull_request:opened", "gitlab:merge_request:opened"],
    "actions": [
      {
        "id": "action-1",
        "type": "agent_task",
        "config": {
          "agentId": "claude-001",
          "taskType": "code-review",
          "prompt": "Review the following code changes and provide feedback",
          "includeContext": true
        },
        "order": 1,
        "enabled": true
      },
      {
        "id": "action-2",
        "type": "notification",
        "config": {
          "channel": "slack",
          "message": "Code review completed for {{pullRequest.title}}"
        },
        "order": 2,
        "enabled": true
      }
    ],
    "conditions": [
      {
        "id": "condition-1",
        "field": "pullRequest.size",
        "operator": "less_than",
        "value": 1000,
        "logicalOperator": "AND"
      }
    ]
  }'
```

### Get Organization Integrations

```bash
curl -X GET "${API_BASE}/organization-config/integrations" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Create Organization Integration

```bash
curl -X POST "${API_BASE}/organization-config/integrations" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "integrationType": "slack",
    "name": "Company Slack Workspace",
    "enabled": true,
    "credentials": {
      "botToken": "xoxb-your-bot-token",
      "signingSecret": "your-signing-secret"
    },
    "config": {
      "defaultChannel": "#ai-notifications",
      "allowedChannels": ["#ai-notifications", "#dev-team", "#alerts"],
      "enableThreadReplies": true,
      "mentionUsers": true
    },
    "webhookUrl": "https://your-app.com/webhooks/slack"
  }'
```

## Error Handling Examples

### Handle Authentication Error

```bash
# This will return 401 Unauthorized
curl -X GET "${API_BASE}/agents" \
  -H "Authorization: Bearer invalid-token"
```

### Handle Validation Error

```bash
# This will return 400 Bad Request
curl -X POST "${API_BASE}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invalid-type"
  }'
```

### Handle Permission Error

```bash
# This will return 403 Forbidden if user lacks permissions
curl -X DELETE "${API_BASE}/projects/project-123" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Handle Not Found Error

```bash
# This will return 404 Not Found
curl -X GET "${API_BASE}/tasks/non-existent-task" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## Batch Operations

### Create Multiple Tasks

```bash
# Create multiple tasks in sequence
for prompt in "Explain async/await" "Create a Docker file" "Design database schema"
do
  curl -X POST "${API_BASE}/tasks" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"${prompt}\",
      \"type\": \"general\",
      \"priority\": \"medium\"
    }" \
    -w "\nStatus: %{http_code}\n" \
    -s
done
```

## Testing Scripts

### Complete Authentication Flow

```bash
#!/bin/bash
# auth-flow-test.sh

# Get auth methods
echo "Getting auth methods..."
curl -s "${API_BASE}/auth/methods/default" | jq .

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# Get user info
echo "Getting user info..."
curl -s -H "Authorization: Bearer $TOKEN" "${API_BASE}/auth/me" | jq .

# Logout
echo "Logging out..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" "${API_BASE}/auth/logout" | jq .
```

### Task Lifecycle Test

```bash
#!/bin/bash
# task-lifecycle-test.sh

TOKEN=$1
if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <jwt-token>"
  exit 1
fi

# Create task
echo "Creating task..."
TASK_RESPONSE=$(curl -s -X POST "${API_BASE}/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test task for lifecycle",
    "type": "general",
    "priority": "medium"
  }')

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.task.id')
echo "Created task: $TASK_ID"

# Get task status
echo "Getting task status..."
curl -s -H "Authorization: Bearer $TOKEN" "${API_BASE}/tasks/$TASK_ID" | jq .

# Update task
echo "Updating task..."
curl -s -X PUT "${API_BASE}/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "high"
  }' | jq .
```