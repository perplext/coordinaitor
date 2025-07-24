-- Multi-Agent Orchestrator Database Schema
-- PostgreSQL Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table (for multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_organization (organization_id),
    INDEX idx_users_email (email),
    INDEX idx_users_username (username)
);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name),
    INDEX idx_roles_organization (organization_id)
);

-- User roles junction table
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- API Keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    scopes JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_api_keys_organization (organization_id),
    INDEX idx_api_keys_user (user_id),
    INDEX idx_api_keys_hash (key_hash)
);

-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    endpoint VARCHAR(500),
    capabilities JSONB DEFAULT '[]',
    max_concurrent_tasks INTEGER DEFAULT 1,
    timeout_ms INTEGER DEFAULT 300000,
    cost_config JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agents_provider (provider),
    INDEX idx_agents_active (is_active)
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prd TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    requirements JSONB DEFAULT '[]',
    milestones JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_projects_organization (organization_id),
    INDEX idx_projects_status (status),
    INDEX idx_projects_created_by (created_by)
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'implementation',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_agent UUID REFERENCES agents(id),
    dependencies UUID[] DEFAULT '{}',
    requirements JSONB DEFAULT '[]',
    input JSONB DEFAULT '{}',
    output JSONB,
    error TEXT,
    estimated_duration INTEGER,
    actual_duration INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tasks_organization (organization_id),
    INDEX idx_tasks_project (project_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_assigned_agent (assigned_agent),
    INDEX idx_tasks_created_by (created_by)
);

-- Task executions table (for tracking multiple attempts)
CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    result JSONB,
    error TEXT,
    tokens_used INTEGER,
    cost DECIMAL(10, 4),
    metadata JSONB DEFAULT '{}',
    INDEX idx_task_executions_task (task_id),
    INDEX idx_task_executions_agent (agent_id),
    INDEX idx_task_executions_status (status)
);

-- Workflows table
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    variables JSONB DEFAULT '{}',
    triggers JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_workflows_organization (organization_id),
    INDEX idx_workflows_active (is_active)
);

-- Workflow executions table
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    variables JSONB DEFAULT '{}',
    current_step VARCHAR(255),
    results JSONB DEFAULT '{}',
    error TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    triggered_by UUID REFERENCES users(id),
    INDEX idx_workflow_executions_workflow (workflow_id),
    INDEX idx_workflow_executions_status (status)
);

-- Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    definition JSONB NOT NULL,
    variables JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_templates_organization (organization_id),
    INDEX idx_templates_category (category),
    INDEX idx_templates_public (is_public)
);

-- Knowledge base table
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    content TEXT,
    embedding VECTOR(1536), -- For semantic search
    metadata JSONB DEFAULT '{}',
    source VARCHAR(255),
    confidence_score FLOAT DEFAULT 1.0,
    usage_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_knowledge_organization (organization_id),
    INDEX idx_knowledge_type (type),
    INDEX idx_knowledge_category (category),
    INDEX idx_knowledge_embedding (embedding)
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    changes JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_organization (organization_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_created (created_at)
);

-- Collaboration sessions table
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    strategy VARCHAR(50) NOT NULL,
    agents UUID[] NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    results JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    INDEX idx_collaboration_task (task_id),
    INDEX idx_collaboration_status (status)
);

-- Agent metrics table
CREATE TABLE agent_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    total_duration_ms BIGINT DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    success_rate FLOAT,
    avg_duration_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, date),
    INDEX idx_agent_metrics_agent (agent_id),
    INDEX idx_agent_metrics_date (date)
);

-- Approval requests table
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
    workflow_step_id VARCHAR(255),
    step_name VARCHAR(255),
    workflow_name VARCHAR(255),
    requested_by UUID REFERENCES users(id),
    approvers UUID[] NOT NULL,
    policy VARCHAR(50) DEFAULT 'all',
    min_approvals INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    timeout_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_approval_organization (organization_id),
    INDEX idx_approval_workflow_execution (workflow_execution_id),
    INDEX idx_approval_status (status)
);

-- Approval responses table
CREATE TABLE approval_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_request_id UUID REFERENCES approval_requests(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id),
    decision VARCHAR(20) NOT NULL,
    comment TEXT,
    responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_approval_responses_request (approval_request_id),
    INDEX idx_approval_responses_approver (approver_id)
);

-- Repository integrations table
CREATE TABLE repository_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    repository_id VARCHAR(255) NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    repository_url VARCHAR(255),
    repository_description TEXT,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('github', 'gitlab')),
    webhook_url VARCHAR(255),
    webhook_id VARCHAR(255),
    auto_create_tasks BOOLEAN DEFAULT false,
    auto_create_pr BOOLEAN DEFAULT false,
    branch_prefix VARCHAR(100),
    default_branch VARCHAR(100) DEFAULT 'main',
    settings JSONB DEFAULT '{"enabledEvents": ["push", "pull_request", "issues"], "taskCreationRules": {}}',
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error')),
    sync_error TEXT,
    is_active BOOLEAN DEFAULT true,
    access_token_encrypted TEXT,
    access_token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_repository_integrations_organization (organization_id),
    INDEX idx_repository_integrations_repository_id (repository_id),
    INDEX idx_repository_integrations_provider (provider),
    INDEX idx_repository_integrations_repository_name (repository_name),
    UNIQUE(organization_id, repository_id, provider)
);

-- Webhook events table
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_integration_id UUID REFERENCES repository_integrations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('push', 'pull_request', 'issues', 'release', 'tag_push', 'wiki', 'pipeline', 'deployment')),
    repository_name VARCHAR(255) NOT NULL,
    repository_id VARCHAR(255) NOT NULL,
    webhook_delivery_id VARCHAR(255),
    event_action VARCHAR(100),
    event_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_duration_ms INTEGER,
    processing_results JSONB,
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    received_at TIMESTAMP NOT NULL,
    signature_verified BOOLEAN DEFAULT false,
    raw_headers JSONB,
    raw_payload_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_webhook_events_repository_integration (repository_integration_id),
    INDEX idx_webhook_events_organization (organization_id),
    INDEX idx_webhook_events_event_type (event_type),
    INDEX idx_webhook_events_status (status),
    INDEX idx_webhook_events_received_at (received_at),
    INDEX idx_webhook_events_repository_name (repository_name)
);

-- Automation rules table
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    repository_integration_id UUID REFERENCES repository_integrations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    repository_pattern VARCHAR(255) DEFAULT '.*',
    rule_type VARCHAR(20) DEFAULT 'event_triggered' CHECK (rule_type IN ('event_triggered', 'scheduled', 'manual')),
    enabled BOOLEAN DEFAULT true,
    triggers JSONB NOT NULL,
    actions JSONB NOT NULL,
    execution_order INTEGER DEFAULT 0,
    max_executions_per_hour INTEGER,
    max_executions_per_day INTEGER,
    cooldown_minutes INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    average_execution_time_ms INTEGER,
    is_template BOOLEAN DEFAULT false,
    template_category VARCHAR(100),
    created_by_user_id UUID REFERENCES users(id),
    updated_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_automation_rules_organization (organization_id),
    INDEX idx_automation_rules_repository_integration (repository_integration_id),
    INDEX idx_automation_rules_enabled (enabled),
    INDEX idx_automation_rules_rule_type (rule_type),
    INDEX idx_automation_rules_repository_pattern (repository_pattern)
);

-- Automation executions table
CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    repository_integration_id UUID REFERENCES repository_integrations(id) ON DELETE SET NULL,
    webhook_event_id UUID REFERENCES webhook_events(id) ON DELETE SET NULL,
    repository_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50),
    event_action VARCHAR(100),
    triggered_by VARCHAR(20) NOT NULL CHECK (triggered_by IN ('webhook', 'schedule', 'manual', 'api')),
    execution_context JSONB NOT NULL,
    event_data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    execution_results JSONB,
    execution_metrics JSONB,
    error_message TEXT,
    error_stack TEXT,
    error_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    timeout_seconds INTEGER,
    progress_percentage INTEGER DEFAULT 0,
    current_step VARCHAR(255),
    total_steps INTEGER,
    logs TEXT,
    execution_node VARCHAR(255),
    execution_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_automation_executions_automation_rule (automation_rule_id),
    INDEX idx_automation_executions_organization (organization_id),
    INDEX idx_automation_executions_repository_integration (repository_integration_id),
    INDEX idx_automation_executions_status (status),
    INDEX idx_automation_executions_triggered_by (triggered_by),
    INDEX idx_automation_executions_started_at (started_at),
    INDEX idx_automation_executions_repository_name (repository_name),
    INDEX idx_automation_executions_event_type (event_type)
);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update timestamp trigger to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_entries_updated_at BEFORE UPDATE ON knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repository_integrations_updated_at BEFORE UPDATE ON repository_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_executions_updated_at BEFORE UPDATE ON automation_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_tasks_pending ON tasks(organization_id, status) WHERE status = 'pending';
CREATE INDEX idx_tasks_active ON tasks(organization_id, status) WHERE status IN ('assigned', 'in_progress');
CREATE INDEX idx_workflows_active ON workflows(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_active ON api_keys(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_repository_integrations_active ON repository_integrations(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_webhook_events_pending ON webhook_events(repository_integration_id, status) WHERE status = 'pending';
CREATE INDEX idx_automation_rules_enabled ON automation_rules(organization_id, enabled) WHERE enabled = true;
CREATE INDEX idx_automation_executions_running ON automation_executions(automation_rule_id, status) WHERE status = 'running';