# Repository Integration Guide

This guide covers the comprehensive GitHub and GitLab integration system implemented in the Multi-Agent Orchestrator.

## Overview

The repository integration system provides:
- **Repository Management**: Connect and manage GitHub/GitLab repositories
- **Webhook Processing**: Real-time event handling from repository changes  
- **Automation Rules**: Automated task creation and workflow triggers
- **AI Agent Integration**: Automatic code review, issue analysis, and PR automation

## Architecture

### Core Components

1. **RepositoryService** (`src/services/repository-service.ts`)
   - Manages API connections to GitHub/GitLab
   - Handles repository operations (list, create, manage)
   - Processes webhook events
   - Manages integrations and webhooks

2. **RepositoryAutomationService** (`src/services/repository-automation-service.ts`)
   - Executes automation rules based on repository events
   - Manages rule creation, evaluation, and execution
   - Integrates with TaskOrchestrator for task creation

3. **GitService** (`src/services/git-service.ts`)
   - Local Git operations for AI agents
   - Branch management and commits
   - Repository cloning and synchronization

4. **API Routes** (`src/routes/repositories.ts`, `src/routes/webhooks.ts`)
   - REST endpoints for repository management
   - Webhook receivers for GitHub/GitLab events
   - Integration configuration APIs

### Database Schema

#### Repository Integrations Table
```sql
CREATE TABLE repository_integrations (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    repository_id VARCHAR(255) NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    provider VARCHAR(20) CHECK (provider IN ('github', 'gitlab')),
    webhook_url VARCHAR(255),
    auto_create_tasks BOOLEAN DEFAULT false,
    auto_create_pr BOOLEAN DEFAULT false,
    settings JSONB,
    -- ... additional fields
);
```

#### Webhook Events Table
```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY,
    repository_integration_id UUID REFERENCES repository_integrations(id),
    event_type VARCHAR(50),
    event_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    processing_results JSONB,
    -- ... additional fields
);
```

#### Automation Rules Table
```sql
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    triggers JSONB NOT NULL,
    actions JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    -- ... additional fields
);
```

## Setup and Configuration

### 1. Environment Variables

Create a `.env.repositories` file:

```bash
# GitHub Configuration
GITHUB_API_URL=https://api.github.com
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# GitLab Configuration  
GITLAB_API_URL=https://gitlab.com/api/v4
GITLAB_WEBHOOK_SECRET=your_gitlab_webhook_secret

# Webhook Base URL (for webhook registration)
WEBHOOK_BASE_URL=https://your-domain.com

# Repository Integration Settings
ENABLE_AUTO_WEBHOOK_CREATION=true
DEFAULT_WEBHOOK_EVENTS=push,pull_request,issues,release
WEBHOOK_SIGNATURE_VERIFICATION=true

# Security
ENCRYPT_ACCESS_TOKENS=true
TOKEN_ENCRYPTION_KEY=your_encryption_key_here
```

### 2. GitHub Setup

1. **Create GitHub App or Personal Access Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create a token with these scopes:
     - `repo` (Full control of private repositories)
     - `admin:repo_hook` (Full control of repository hooks)
     - `read:org` (Read org and team membership)

2. **Configure Webhook URL**
   - Webhook URL: `https://your-domain.com/api/webhooks/github`
   - Content type: `application/json`
   - Secret: Use your webhook secret from environment

### 3. GitLab Setup

1. **Create GitLab Personal Access Token**
   - Go to GitLab User Settings → Access Tokens
   - Create a token with these scopes:
     - `api` (Access the authenticated user's API)
     - `read_repository` (Read repositories)
     - `write_repository` (Write repositories)

2. **Configure Project Webhooks**
   - Webhook URL: `https://your-domain.com/api/webhooks/gitlab`
   - Secret token: Use your GitLab webhook secret

## API Endpoints

### Repository Management

#### Setup Provider
```http
POST /api/repositories/setup/:provider
Content-Type: application/json

{
  "apiUrl": "https://api.github.com",
  "token": "ghp_xxxxxxxxxxxx",
  "webhookSecret": "webhook_secret",
  "organization": "myorg",
  "defaultBranch": "main"
}
```

#### List Repositories
```http
GET /api/repositories/:provider/repos?organization=myorg&page=1&per_page=10
```

#### Create Repository Integration
```http
POST /api/repositories/:provider/repos/:owner/:repo/integrate
Content-Type: application/json

{
  "autoCreateTasks": true,
  "autoCreatePR": false,
  "branchPrefix": "ai-task-",
  "enabledEvents": ["push", "pull_request", "issues"],
  "taskCreationRules": {
    "issueLabels": ["enhancement", "bug", "feature"],
    "prLabels": ["review-needed"],
    "autoAssign": true
  }
}
```

#### List Integrations
```http
GET /api/repositories/integrations
```

### Webhook Endpoints

#### GitHub Webhook
```http
POST /api/webhooks/github
X-GitHub-Event: push
X-Hub-Signature-256: sha256=...
X-GitHub-Delivery: 12345678-1234-1234-1234-123456789abc

{
  "action": "opened",
  "repository": { ... },
  "pull_request": { ... }
}
```

#### GitLab Webhook
```http
POST /api/webhooks/gitlab
X-Gitlab-Event: Push Hook
X-Gitlab-Token: your_secret_token

{
  "object_kind": "push",
  "project": { ... },
  "commits": [ ... ]
}
```

## Automation Rules

### Rule Structure

```json
{
  "id": "rule-1",
  "name": "Auto-create task from issue",
  "description": "Create development task when issue is labeled",
  "repositoryPattern": "^myorg/.*",
  "enabled": true,
  "triggers": {
    "events": ["issues"],
    "conditions": {
      "labelPattern": "task|enhancement|feature",
      "branchPattern": "main|develop"
    }
  },
  "actions": {
    "createTask": {
      "title": "Resolve issue: {{issue.title}}",
      "description": "{{issue.description}}\n\nIssue URL: {{issue.url}}",
      "type": "development",
      "priority": "medium",
      "assignedAgents": ["github-copilot-001"],
      "metadata": {
        "sourceType": "issue",
        "sourceId": "{{issue.id}}",
        "repository": "{{repository}}"
      }
    }
  }
}
```

### Template Variables

Available variables in rule templates:

**Issue Events:**
- `{{issue.title}}` - Issue title
- `{{issue.description}}` - Issue description  
- `{{issue.number}}` - Issue number
- `{{issue.url}}` - Issue URL
- `{{issue.labels}}` - Array of label names
- `{{repository}}` - Repository full name

**Pull Request Events:**
- `{{pullRequest.title}}` - PR title
- `{{pullRequest.description}}` - PR description
- `{{pullRequest.number}}` - PR number
- `{{pullRequest.url}}` - PR URL
- `{{pullRequest.sourceBranch}}` - Source branch
- `{{pullRequest.targetBranch}}` - Target branch

**Push Events:**
- `{{branch}}` - Branch name
- `{{commits}}` - Array of commit objects
- `{{repository}}` - Repository full name

### Default Rules

The system comes with several pre-configured rules:

1. **Auto-create task from issue**
   - Triggers: Issue events with labels `task|enhancement|feature`
   - Action: Creates development task

2. **Auto-review pull request**
   - Triggers: Pull request events
   - Action: Creates code review task, assigns GitHub Copilot agent

3. **Auto security scan on push**
   - Triggers: Push to main/master/develop branches
   - Action: Creates security scan task, assigns CodeWhisperer agent

## Frontend Components

### Repository Integration Dashboard

Located in `web/src/components/repositories/`:

- **RepositoryIntegration.tsx** - Main dashboard component
- **RepositorySetup.tsx** - Provider setup wizard
- **RepositoryList.tsx** - Repository browser and integration
- **IntegrationSettings.tsx** - Manage existing integrations
- **WebhookStatus.tsx** - Monitor webhook health and events
- **AutomationRules.tsx** - Create and manage automation rules

### Usage

```typescript
import { RepositoryIntegration } from '@/components/repositories/RepositoryIntegration';

function App() {
  return (
    <div>
      <RepositoryIntegration />
    </div>
  );
}
```

## Testing

### Webhook Testing

1. **Local Development**
   ```bash
   # Start the application
   npm run dev
   
   # Use ngrok to expose local webhook endpoint
   ngrok http 3000
   
   # Configure GitHub/GitLab webhook URL to ngrok URL
   # https://abc123.ngrok.io/api/webhooks/github
   ```

2. **Test Webhook Delivery**
   ```bash
   # Test endpoint
   curl -X POST http://localhost:3000/api/webhooks/test \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

3. **Mock Webhook Events**
   ```bash
   # Send mock GitHub push event
   curl -X POST http://localhost:3000/api/webhooks/github \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: push" \
     -H "X-GitHub-Delivery: test-123" \
     -d @tests/fixtures/github-push-event.json
   ```

### Integration Testing

1. **Repository Connection Test**
   ```typescript
   // Test GitHub API connection
   const service = new RepositoryService({
     provider: 'github',
     apiUrl: 'https://api.github.com',
     token: process.env.GITHUB_TOKEN
   });
   
   await service.initialize();
   const repos = await service.listRepositories();
   ```

2. **Automation Rule Test**
   ```typescript
   // Test rule execution
   const automation = new RepositoryAutomationService(
     repositoryService,
     taskOrchestrator
   );
   
   const mockEvent = {
     type: 'issues',
     repository: 'test/repo',
     data: { /* issue data */ }
   };
   
   await automation.processEvent(mockEvent);
   ```

## Security Considerations

### Webhook Security

1. **Signature Verification**
   - Always verify webhook signatures
   - Use HMAC-SHA256 for GitHub, secret token for GitLab
   - Implement constant-time comparison to prevent timing attacks

2. **Access Token Security**
   - Store access tokens encrypted in database
   - Use environment variables for webhook secrets
   - Implement token rotation for long-lived integrations

3. **Permission Scoping**
   - Use minimal required permissions for tokens
   - Regularly audit and rotate access tokens
   - Implement organization-level access controls

### Rate Limiting

```typescript
// Implement rate limiting for API calls
const rateLimiter = {
  github: new RateLimiter(5000, 'hour'), // 5000 requests per hour
  gitlab: new RateLimiter(2000, 'hour')  // 2000 requests per hour
};
```

## Monitoring and Logging

### Webhook Event Monitoring

- Track webhook delivery success/failure rates
- Monitor processing times and queue depths
- Alert on high error rates or processing delays

### Integration Health Checks

```typescript
// Health check endpoint
GET /api/repositories/health

{
  "status": "healthy",
  "services": {
    "github": true,
    "gitlab": false
  },
  "webhooks": {
    "totalConfigured": 15,
    "activeDeliveries": 8,
    "failedDeliveries": 2
  },
  "automationRules": {
    "enabled": 12,
    "executionsToday": 45,
    "successRate": 95.5
  }
}
```

## Troubleshooting

### Common Issues

1. **Webhook Not Firing**
   - Check webhook URL is accessible from internet
   - Verify webhook secret matches configuration
   - Check repository webhook settings in GitHub/GitLab

2. **API Authentication Failures**
   - Verify access token has correct permissions
   - Check token expiration date
   - Ensure API URL is correct for your GitHub/GitLab instance

3. **Automation Rules Not Executing**
   - Check rule patterns match repository names
   - Verify event types are included in triggers
   - Check rule conditions (labels, branches, etc.)

### Debug Mode

Enable debug logging:

```bash
DEBUG_REPOSITORY_INTEGRATION=true
DEBUG_WEBHOOK_PROCESSING=true
DEBUG_AUTOMATION_RULES=true
```

### Webhook Event Replay

Replay failed webhook events:

```typescript
// Replay webhook event
POST /api/webhooks/replay/:eventId

// Retry failed automation executions  
POST /api/automation/executions/:executionId/retry
```

## Migration and Backup

### Data Export

```bash
# Export repository integrations
GET /api/repositories/export

# Export automation rules
GET /api/automation/rules/export
```

### Data Import

```bash
# Import integrations and rules
POST /api/repositories/import
Content-Type: application/json

{
  "integrations": [...],
  "automationRules": [...],
  "preserveIds": false
}
```

## Performance Optimization

### Webhook Processing

- Implement async webhook processing with queues
- Use database connection pooling
- Cache frequently accessed repository data
- Implement circuit breakers for external API calls

### Automation Execution

- Batch automation rule evaluations
- Use database indexes for rule matching
- Implement rule execution prioritization
- Cache rule compilation results

## Future Enhancements

### Planned Features

1. **Advanced Rule Conditions**
   - File path patterns and change detection
   - Commit message analysis with AI
   - Time-based and scheduled rule execution

2. **Enhanced AI Integration**
   - Multi-agent collaboration on PRs
   - Automatic test generation
   - Intelligent issue categorization

3. **Additional Providers**
   - Bitbucket integration
   - Azure DevOps support
   - Self-hosted Git providers

4. **Advanced Automation**
   - Visual rule builder
   - Rule templates and marketplace
   - Workflow orchestration integration