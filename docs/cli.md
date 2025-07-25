# CLI Documentation

The CoordinAItor CLI provides a powerful command-line interface for managing agents, tasks, projects, and system operations. This guide covers installation, configuration, and comprehensive usage instructions.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Basic Commands](#basic-commands)
- [Task Management](#task-management)
- [Agent Management](#agent-management)
- [Project Management](#project-management)
- [System Commands](#system-commands)
- [Advanced Usage](#advanced-usage)
- [Tips and Tricks](#tips-and-tricks)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Access to the CoordinAItor API

### Installing the CLI

The CLI is included with the main application. Install it by setting up the project:

```bash
# Clone the repository
git clone https://github.com/your-org/coordinaitor.git
cd coordinaitor

# Install dependencies
npm install

# Verify CLI installation
npm run cli -- --version
```

### Global Installation (Optional)

For global access to the CLI:

```bash
# Create a global link
npm link

# Now use the CLI directly
orchestrator --version
```

## Configuration

### Environment Setup

The CLI reads configuration from environment variables. Create a `.env` file:

```bash
cp .env.example .env
```

**Essential CLI Configuration:**

```env
# API Configuration
API_URL=http://localhost:3000
API_TIMEOUT=30000

# Authentication
JWT_SECRET=your-secret-key
DEFAULT_USER_EMAIL=admin@orchestrator.com

# Output Format
CLI_OUTPUT_FORMAT=table  # table, json, yaml
CLI_COLOR=true
CLI_VERBOSE=false
```

### Authentication

The CLI supports multiple authentication methods:

#### 1. Interactive Login

```bash
npm run cli -- auth login
# Follow prompts to enter credentials
```

#### 2. API Key Authentication

```bash
npm run cli -- auth login --api-key your-api-key-here
```

#### 3. Environment Variable

```bash
export ORCHESTRATOR_API_KEY=your-api-key-here
npm run cli -- status
```

#### 4. Config File

```bash
# Create config file
npm run cli -- config init

# Edit config
npm run cli -- config edit
```

### Configuration Commands

```bash
# View current configuration
npm run cli -- config show

# Set configuration values
npm run cli -- config set api.url http://localhost:3000
npm run cli -- config set output.format json

# Reset configuration to defaults
npm run cli -- config reset
```

## Basic Commands

### Getting Help

```bash
# General help
npm run cli -- --help
npm run cli -- -h

# Command-specific help
npm run cli -- task --help
npm run cli -- agents create --help

# List all available commands
npm run cli -- commands
```

### Version Information

```bash
# Show CLI version
npm run cli -- --version
npm run cli -- -v

# Show detailed version info
npm run cli -- version --detailed
```

### System Status

```bash
# Quick status check
npm run cli -- status

# Detailed system health
npm run cli -- health

# Service connectivity test
npm run cli -- ping

# Show system information
npm run cli -- info
```

## Task Management

Tasks are the core work units in the orchestrator. The CLI provides comprehensive task management capabilities.

### Creating Tasks

#### Basic Task Creation

```bash
# Create a simple task
npm run cli -- task create "Build a login component for React"

# Create task with description
npm run cli -- task create "Build login component" \
  --description "Create a reusable login component with validation"

# Create task with priority
npm run cli -- task create "Fix critical bug" --priority high

# Create task with specific agent
npm run cli -- task create "Code review" --agent-id agent-123
```

#### Advanced Task Creation

```bash
# Create task with multiple options
npm run cli -- task create "Build user dashboard" \
  --description "Create a comprehensive user dashboard" \
  --priority medium \
  --project-id proj-456 \
  --tags frontend,react,dashboard \
  --due-date "2024-02-15" \
  --estimated-hours 8

# Create task from template
npm run cli -- task create --template react-component \
  --name "UserProfile" \
  --props "user,onEdit,onDelete"

# Create task from file specification
npm run cli -- task create --spec ./task-spec.json
```

#### Task Specification File Example

```json
{
  "title": "Implement JWT Authentication",
  "description": "Add JWT-based authentication to the API",
  "priority": "high",
  "tags": ["backend", "security", "auth"],
  "requirements": [
    "Use industry-standard JWT library",
    "Implement refresh token mechanism",
    "Add proper error handling",
    "Include comprehensive tests"
  ],
  "acceptanceCriteria": [
    "Users can login with email/password",
    "JWT tokens expire after 1 hour",
    "Refresh tokens work correctly",
    "All endpoints are protected"
  ],
  "estimatedHours": 12,
  "dueDate": "2024-02-20"
}
```

### Viewing Tasks

```bash
# List all tasks
npm run cli -- task list

# List tasks with filters
npm run cli -- task list --status active
npm run cli -- task list --priority high
npm run cli -- task list --project-id proj-123
npm run cli -- task list --assigned-to agent-456

# Show specific task details
npm run cli -- task show task-789

# Show task with related information
npm run cli -- task show task-789 --include-messages --include-files

# List tasks in different formats
npm run cli -- task list --format table
npm run cli -- task list --format json
npm run cli -- task list --format yaml
```

### Task Status Management

```bash
# Update task status
npm run cli -- task update task-123 --status in-progress
npm run cli -- task update task-123 --status completed

# Assign task to agent
npm run cli -- task assign task-123 agent-456

# Reassign task
npm run cli -- task reassign task-123 agent-789

# Cancel task
npm run cli -- task cancel task-123 --reason "Requirements changed"

# Restart failed task
npm run cli -- task restart task-123
```

### Task Monitoring

```bash
# Watch task progress in real-time
npm run cli -- task watch task-123

# Watch multiple tasks
npm run cli -- task watch task-123,task-456,task-789

# Monitor all active tasks
npm run cli -- task monitor

# Show task logs
npm run cli -- task logs task-123

# Follow task logs in real-time
npm run cli -- task logs task-123 --follow

# Export task report
npm run cli -- task report task-123 --format html --output report.html
```

### Task Collaboration

```bash
# Add comment to task
npm run cli -- task comment task-123 "Great progress on the UI components!"

# Add file to task
npm run cli -- task attach task-123 ./design-mockup.png

# Share task with team member
npm run cli -- task share task-123 user@example.com

# Subscribe to task notifications
npm run cli -- task subscribe task-123

# Unsubscribe from task
npm run cli -- task unsubscribe task-123
```

## Agent Management

Agents are AI-powered workers that execute tasks. The CLI provides comprehensive agent management capabilities.

### Listing and Viewing Agents

```bash
# List all agents
npm run cli -- agents list

# List agents by type
npm run cli -- agents list --type coding
npm run cli -- agents list --type analysis
npm run cli -- agents list --type review

# List available agents (not busy)
npm run cli -- agents list --available

# Show agent details
npm run cli -- agents show agent-123

# Show agent with current tasks
npm run cli -- agents show agent-123 --include-tasks

# Show agent performance metrics
npm run cli -- agents show agent-123 --metrics
```

### Creating Agents

```bash
# Create a basic coding agent
npm run cli -- agents create \
  --name "GPT-4 Coder" \
  --type coding \
  --model gpt-4 \
  --provider openai

# Create agent with specific capabilities
npm run cli -- agents create \
  --name "React Specialist" \
  --type coding \
  --model gpt-4 \
  --provider openai \
  --capabilities "react,typescript,testing" \
  --max-concurrent-tasks 2

# Create agent from template
npm run cli -- agents create --template full-stack-developer \
  --name "Full Stack Agent" \
  --model claude-3-opus

# Create agent with custom configuration
npm run cli -- agents create \
  --config ./agent-config.json
```

#### Agent Configuration File Example

```json
{
  "name": "Senior Backend Developer",
  "type": "coding",
  "model": "gpt-4",
  "provider": "openai",
  "capabilities": [
    "nodejs",
    "python",
    "database-design",
    "api-development",
    "testing",
    "devops"
  ],
  "specializations": [
    "microservices",
    "scalability",
    "security"
  ],
  "maxConcurrentTasks": 3,
  "workingHours": {
    "timezone": "UTC",
    "start": "09:00",
    "end": "17:00"
  },
  "preferences": {
    "codeStyle": "clean-code",
    "testingFramework": "jest",
    "documentationLevel": "comprehensive"
  }
}
```

### Agent Configuration

```bash
# Update agent settings
npm run cli -- agents update agent-123 \
  --max-concurrent-tasks 5 \
  --capabilities "react,vue,angular"

# Configure agent working hours
npm run cli -- agents config agent-123 \
  --working-hours "09:00-17:00" \
  --timezone "America/New_York"

# Set agent preferences
npm run cli -- agents config agent-123 \
  --code-style "prettier" \
  --test-framework "vitest"

# Enable/disable agent
npm run cli -- agents enable agent-123
npm run cli -- agents disable agent-123
```

### Agent Monitoring

```bash
# Monitor agent activity
npm run cli -- agents monitor agent-123

# View agent performance
npm run cli -- agents performance agent-123

# Show agent workload
npm run cli -- agents workload

# View agent logs
npm run cli -- agents logs agent-123

# Export agent performance report
npm run cli -- agents report agent-123 --period last-week
```

### Agent Templates

```bash
# List available agent templates
npm run cli -- agents templates

# Show template details
npm run cli -- agents template show full-stack-developer

# Create custom template
npm run cli -- agents template create \
  --name "my-custom-template" \
  --config ./custom-template.json

# Export agent as template
npm run cli -- agents template export agent-123 \
  --name "proven-react-specialist"
```

## Project Management

Projects organize related tasks and agents into logical groups.

### Creating Projects

```bash
# Create a basic project
npm run cli -- project create "E-commerce Website"

# Create project with description
npm run cli -- project create "Mobile App" \
  --description "Cross-platform mobile application for iOS and Android"

# Create project with team members
npm run cli -- project create "API Redesign" \
  --description "Redesign the REST API for better performance" \
  --members "user1@example.com,user2@example.com"

# Create project from template
npm run cli -- project create --template web-application \
  --name "Corporate Website" \
  --stack "react,nodejs,postgresql"
```

### Project Management

```bash
# List all projects
npm run cli -- project list

# Show project details
npm run cli -- project show proj-123

# Switch to a project (sets context)
npm run cli -- project switch proj-123

# Show current project
npm run cli -- project current

# Update project information
npm run cli -- project update proj-123 \
  --description "Updated project description" \
  --status active

# Archive completed project
npm run cli -- project archive proj-123

# Delete project (with confirmation)
npm run cli -- project delete proj-123 --confirm
```

### Project Team Management

```bash
# Add team member
npm run cli -- project add-member proj-123 user@example.com --role developer

# Remove team member
npm run cli -- project remove-member proj-123 user@example.com

# List project members
npm run cli -- project members proj-123

# Update member role
npm run cli -- project update-member proj-123 user@example.com --role lead
```

### Project Agents

```bash
# Assign agent to project
npm run cli -- project assign-agent proj-123 agent-456

# Remove agent from project
npm run cli -- project remove-agent proj-123 agent-456

# List project agents
npm run cli -- project agents proj-123

# Show agent utilization in project
npm run cli -- project agent-stats proj-123
```

### Project Reporting

```bash
# Generate project status report
npm run cli -- project report proj-123

# Export project data
npm run cli -- project export proj-123 --format json --output project-data.json

# Show project metrics
npm run cli -- project metrics proj-123

# Project timeline
npm run cli -- project timeline proj-123
```

## System Commands

### Health Monitoring

```bash
# System health check
npm run cli -- health

# Detailed health information
npm run cli -- health --detailed

# Check specific services
npm run cli -- health --service database
npm run cli -- health --service redis
npm run cli -- health --service agents

# Continuous health monitoring
npm run cli -- health --watch --interval 30
```

### System Metrics

```bash
# Show system metrics
npm run cli -- metrics

# Show specific metric categories
npm run cli -- metrics --category performance
npm run cli -- metrics --category errors
npm run cli -- metrics --category usage

# Export metrics
npm run cli -- metrics --export --format json --output metrics.json

# Real-time metrics dashboard
npm run cli -- metrics --dashboard
```

### System Administration

```bash
# View system logs
npm run cli -- logs

# View logs for specific service
npm run cli -- logs --service orchestrator
npm run cli -- logs --service agent-manager

# Follow logs in real-time
npm run cli -- logs --follow

# Clear old logs
npm run cli -- logs --clear --older-than 7d

# System maintenance
npm run cli -- maintenance start
npm run cli -- maintenance stop
npm run cli -- maintenance status
```

### Database Operations

```bash
# Database status
npm run cli -- db status

# Run database migrations
npm run cli -- db migrate

# Seed database with sample data
npm run cli -- db seed

# Create database backup
npm run cli -- db backup --output backup-$(date +%Y%m%d).sql

# Show database statistics
npm run cli -- db stats

# Cleanup old data
npm run cli -- db cleanup --older-than 30d
```

## Advanced Usage

### Batch Operations

```bash
# Create multiple tasks from file
npm run cli -- task batch-create --file tasks.json

# Update multiple tasks
npm run cli -- task batch-update --filter "status:pending" --set "priority:high"

# Assign multiple tasks to agent
npm run cli -- task batch-assign --filter "project:proj-123" --agent agent-456

# Export multiple tasks
npm run cli -- task batch-export --filter "completed" --format csv
```

### Automation and Scripting

```bash
# Create automation script
npm run cli -- script create task-automation.js

# Run automation script
npm run cli -- script run task-automation.js

# Schedule recurring script
npm run cli -- schedule create "daily-reports" \
  --script generate-reports.js \
  --cron "0 9 * * *"

# List scheduled tasks
npm run cli -- schedule list

# Webhook management
npm run cli -- webhook create --url https://api.example.com/webhook \
  --events task.completed,task.failed
```

### Custom Commands

```bash
# Create custom command
npm run cli -- command create "deploy-to-staging" \
  --script ./scripts/deploy-staging.js

# List custom commands
npm run cli -- command list

# Execute custom command
npm run cli -- deploy-to-staging --environment staging
```

### Integration with External Tools

```bash
# Import tasks from Jira
npm run cli -- import jira --project KEY-123 --api-key your-key

# Export to GitHub Issues
npm run cli -- export github --repo owner/repo --token your-token

# Sync with Slack
npm run cli -- integration slack setup --webhook-url your-webhook

# Connect to external API
npm run cli -- integration api setup --name "external-api" \
  --url "https://api.example.com" \
  --auth-token "your-token"
```

## Tips and Tricks

### 1. Command Aliases

Create aliases for frequently used commands:

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
alias orc="npm run cli --"
alias task-ls="npm run cli -- task list"
alias task-new="npm run cli -- task create"
alias agent-ls="npm run cli -- agents list"

# Usage
orc status
task-ls --status active
task-new "Fix user authentication bug"
```

### 2. Output Formatting

```bash
# JSON output for scripting
npm run cli -- task list --format json | jq '.[] | select(.priority == "high")'

# Table output with custom columns
npm run cli -- task list --format table --columns id,title,status,priority

# Export to CSV
npm run cli -- task list --format csv > tasks.csv

# Pretty-print with colors
npm run cli -- task list --color always
```

### 3. Filtering and Searching

```bash
# Complex filters
npm run cli -- task list \
  --filter "status:active AND priority:high AND created:>2024-01-01"

# Search in task content
npm run cli -- task search "authentication" --include-comments

# Regex matching
npm run cli -- task list --title-regex "^Bug.*"

# Tag-based filtering
npm run cli -- task list --tags "frontend,urgent"
```

### 4. Configuration Profiles

```bash
# Create different profiles for different environments
npm run cli -- config profile create development
npm run cli -- config profile create staging
npm run cli -- config profile create production

# Switch between profiles
npm run cli -- config profile use staging

# List profiles
npm run cli -- config profile list
```

### 5. Bulk Operations

```bash
# Use shell loops for bulk operations
for task in $(npm run cli -- task list --status pending --format json | jq -r '.[].id'); do
  npm run cli -- task update $task --priority high
done

# Bulk update with filters
npm run cli -- task bulk-update \
  --filter "created:<2024-01-01 AND status:pending" \
  --set "status:cancelled,reason:outdated"
```

### 6. Real-time Monitoring

```bash
# Monitor system in real-time
watch -n 5 "npm run cli -- status"

# Continuous task monitoring
npm run cli -- task watch --all --updates-only

# Live metrics dashboard
npm run cli -- metrics --live --refresh 10
```

### 7. Error Recovery

```bash
# Retry failed tasks
npm run cli -- task retry --filter "status:failed" --max-attempts 3

# Automatic recovery mode
npm run cli -- system auto-recover enable

# Diagnostic mode
npm run cli -- diagnose --comprehensive
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

```bash
# Clear authentication cache
npm run cli -- auth clear-cache

# Re-authenticate
npm run cli -- auth login --force

# Check authentication status
npm run cli -- auth status
```

#### 2. Connection Issues

```bash
# Test API connectivity
npm run cli -- ping --verbose

# Check network configuration
npm run cli -- config show | grep -i url

# Use different API endpoint
npm run cli -- --api-url http://different-host:3000 status
```

#### 3. Performance Issues

```bash
# Enable verbose logging
npm run cli -- --verbose task list

# Check system resources
npm run cli -- system resources

# Optimize configuration
npm run cli -- config optimize
```

#### 4. Data Inconsistencies

```bash
# Refresh local cache
npm run cli -- cache clear

# Synchronize with server
npm run cli -- sync --force

# Verify data integrity
npm run cli -- verify --comprehensive
```

### Debug Mode

```bash
# Enable debug output
DEBUG=orchestrator:* npm run cli -- task list

# Save debug output to file
DEBUG=orchestrator:* npm run cli -- task list 2> debug.log

# Debug specific component
DEBUG=orchestrator:api npm run cli -- task create "Debug test"
```

### Getting Support

```bash
# Generate diagnostic report
npm run cli -- support generate-report --output support-report.zip

# Show version and environment info
npm run cli -- support info

# Submit issue with logs
npm run cli -- support submit-issue --title "CLI Issue" --logs
```

---

## Command Reference Quick Guide

| Category | Command | Description |
|----------|---------|-------------|
| **Authentication** | `auth login` | Login to orchestrator |
| | `auth logout` | Logout |
| | `auth status` | Check auth status |
| **Tasks** | `task create <title>` | Create new task |
| | `task list` | List tasks |
| | `task show <id>` | Show task details |
| | `task update <id>` | Update task |
| | `task watch <id>` | Monitor task progress |
| **Agents** | `agents list` | List all agents |
| | `agents show <id>` | Show agent details |
| | `agents create` | Create new agent |
| | `agents monitor <id>` | Monitor agent |
| **Projects** | `project create <name>` | Create project |
| | `project list` | List projects |
| | `project switch <id>` | Switch to project |
| | `project show <id>` | Show project details |
| **System** | `status` | System status |
| | `health` | Health check |
| | `metrics` | System metrics |
| | `logs` | View logs |

For the complete command reference, use `npm run cli -- --help` or refer to the built-in help system.

---

*This documentation is maintained alongside the CLI. For the most up-to-date information, always refer to the built-in help: `npm run cli -- <command> --help`*