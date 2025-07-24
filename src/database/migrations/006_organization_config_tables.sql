-- Migration: Create organization configuration tables
-- Created: 2024-01-07
-- Description: Add tables for organization-specific agent, feature, workflow, and integration configurations

-- Create organization agent configurations table
CREATE TABLE IF NOT EXISTS organization_agent_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 50,
    max_concurrent_tasks INTEGER NOT NULL DEFAULT 5,
    config JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, agent_id)
);

-- Create organization feature configurations table
CREATE TABLE IF NOT EXISTS organization_feature_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, feature_name)
);

-- Create organization workflows table
CREATE TABLE IF NOT EXISTS organization_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    trigger_events JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    conditions JSONB DEFAULT '[]',
    schedule JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create organization integrations table
CREATE TABLE IF NOT EXISTS organization_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_type VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted credentials
    config JSONB NOT NULL DEFAULT '{}',
    webhook_url VARCHAR(2048),
    webhook_secret VARCHAR(255),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) CHECK (sync_status IN ('success', 'error', 'pending')),
    sync_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, integration_type, name)
);

-- Create organization custom prompts table
CREATE TABLE IF NOT EXISTS organization_custom_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255),
    prompt_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    agent_ids JSONB DEFAULT '[]', -- Which agents can use this prompt
    enabled BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, name)
);

-- Create organization API keys table
CREATE TABLE IF NOT EXISTS organization_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    rate_limits JSONB DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create organization notification preferences table
CREATE TABLE IF NOT EXISTS organization_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_type VARCHAR(255) NOT NULL,
    channels JSONB NOT NULL DEFAULT '[]', -- email, slack, teams, webhook
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '{}', -- When to send notifications
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, notification_type)
);

-- Create organization audit logs table
CREATE TABLE IF NOT EXISTS organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    result VARCHAR(50) NOT NULL CHECK (result IN ('success', 'failure', 'error')),
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_agent_configs_org_id ON organization_agent_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_agent_configs_agent_id ON organization_agent_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_org_agent_configs_enabled ON organization_agent_configs(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_agent_configs_priority ON organization_agent_configs(organization_id, priority);

CREATE INDEX IF NOT EXISTS idx_org_feature_configs_org_id ON organization_feature_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_feature_configs_feature ON organization_feature_configs(feature_name);
CREATE INDEX IF NOT EXISTS idx_org_feature_configs_enabled ON organization_feature_configs(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_org_workflows_org_id ON organization_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_workflows_enabled ON organization_workflows(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_workflows_trigger_events ON organization_workflows USING GIN(trigger_events);

CREATE INDEX IF NOT EXISTS idx_org_integrations_org_id ON organization_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_type ON organization_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_org_integrations_enabled ON organization_integrations(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_integrations_sync_status ON organization_integrations(sync_status);

CREATE INDEX IF NOT EXISTS idx_org_custom_prompts_org_id ON organization_custom_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_custom_prompts_category ON organization_custom_prompts(category);
CREATE INDEX IF NOT EXISTS idx_org_custom_prompts_enabled ON organization_custom_prompts(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_org_api_keys_org_id ON organization_api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_api_keys_hash ON organization_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_org_api_keys_enabled ON organization_api_keys(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_api_keys_expires ON organization_api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_notification_prefs_org_id ON organization_notification_preferences(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_notification_prefs_type ON organization_notification_preferences(notification_type);
CREATE INDEX IF NOT EXISTS idx_org_notification_prefs_enabled ON organization_notification_preferences(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_org_id ON organization_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_user_id ON organization_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_action ON organization_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_resource ON organization_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_timestamp ON organization_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_result ON organization_audit_logs(result);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER org_agent_configs_updated_at_trigger
    BEFORE UPDATE ON organization_agent_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER org_feature_configs_updated_at_trigger
    BEFORE UPDATE ON organization_feature_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER org_workflows_updated_at_trigger
    BEFORE UPDATE ON organization_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER org_integrations_updated_at_trigger
    BEFORE UPDATE ON organization_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER org_custom_prompts_updated_at_trigger
    BEFORE UPDATE ON organization_custom_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER org_api_keys_updated_at_trigger
    BEFORE UPDATE ON organization_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER org_notification_prefs_updated_at_trigger
    BEFORE UPDATE ON organization_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to validate agent configuration limits based on organization tier
CREATE OR REPLACE FUNCTION validate_agent_config_limits()
RETURNS TRIGGER AS $$
DECLARE
    org_tier TEXT;
    max_agents INTEGER;
    current_count INTEGER;
BEGIN
    -- Get organization tier
    SELECT tier INTO org_tier
    FROM organizations 
    WHERE id = NEW.organization_id;
    
    -- Set max agents based on tier
    CASE org_tier
        WHEN 'free' THEN max_agents := 2;
        WHEN 'starter' THEN max_agents := 5;
        WHEN 'professional' THEN max_agents := 15;
        WHEN 'enterprise' THEN max_agents := -1; -- unlimited
        ELSE max_agents := 2; -- default to free tier limits
    END CASE;
    
    -- Skip validation for enterprise (unlimited)
    IF max_agents = -1 THEN
        RETURN NEW;
    END IF;
    
    -- Count current enabled agents for organization
    SELECT COUNT(*) INTO current_count
    FROM organization_agent_configs
    WHERE organization_id = NEW.organization_id 
    AND enabled = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    -- Check if adding/enabling this agent would exceed limits
    IF NEW.enabled = true AND current_count >= max_agents THEN
        RAISE EXCEPTION 'Agent limit exceeded for % tier (max: %)', org_tier, max_agents;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_agent_config_limits_trigger
    BEFORE INSERT OR UPDATE ON organization_agent_configs
    FOR EACH ROW
    EXECUTE FUNCTION validate_agent_config_limits();

-- Function to validate feature availability based on organization tier
CREATE OR REPLACE FUNCTION validate_feature_availability()
RETURNS TRIGGER AS $$
DECLARE
    org_tier TEXT;
    org_settings JSONB;
    feature_available BOOLEAN := false;
BEGIN
    -- Get organization tier and settings
    SELECT tier, settings INTO org_tier, org_settings
    FROM organizations 
    WHERE id = NEW.organization_id;
    
    -- Check if feature is available in organization settings
    IF org_settings->'features'->NEW.feature_name IS NOT NULL THEN
        feature_available := (org_settings->'features'->>NEW.feature_name)::BOOLEAN;
    END IF;
    
    -- If trying to enable a feature that's not available
    IF NEW.enabled = true AND feature_available = false THEN
        RAISE EXCEPTION 'Feature % is not available for % tier', NEW.feature_name, org_tier;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_feature_availability_trigger
    BEFORE INSERT OR UPDATE ON organization_feature_configs
    FOR EACH ROW
    EXECUTE FUNCTION validate_feature_availability();

-- Comments for documentation
COMMENT ON TABLE organization_agent_configs IS 'Organization-specific configurations for AI agents';
COMMENT ON TABLE organization_feature_configs IS 'Organization-specific feature configurations and settings';
COMMENT ON TABLE organization_workflows IS 'Custom workflows defined by organizations';
COMMENT ON TABLE organization_integrations IS 'Third-party integrations configured by organizations';
COMMENT ON TABLE organization_custom_prompts IS 'Custom prompt templates created by organizations';
COMMENT ON TABLE organization_api_keys IS 'API keys generated for organizations';
COMMENT ON TABLE organization_notification_preferences IS 'Notification preferences for organizations';
COMMENT ON TABLE organization_audit_logs IS 'Audit trail of organization activities';

COMMENT ON COLUMN organization_agent_configs.priority IS 'Agent priority for task assignment (lower number = higher priority)';
COMMENT ON COLUMN organization_agent_configs.config IS 'Agent-specific configuration (API keys, models, etc.)';
COMMENT ON COLUMN organization_feature_configs.limits IS 'Feature-specific usage limits and constraints';
COMMENT ON COLUMN organization_workflows.trigger_events IS 'Events that trigger this workflow';
COMMENT ON COLUMN organization_workflows.actions IS 'Actions to execute when workflow is triggered';
COMMENT ON COLUMN organization_workflows.conditions IS 'Conditions that must be met for workflow execution';
COMMENT ON COLUMN organization_integrations.credentials IS 'Encrypted integration credentials';
COMMENT ON COLUMN organization_custom_prompts.variables IS 'Variables that can be used in the prompt template';
COMMENT ON COLUMN organization_api_keys.key_hash IS 'Hashed API key for security';
COMMENT ON COLUMN organization_api_keys.key_prefix IS 'First few characters of the key for identification';
COMMENT ON COLUMN organization_notification_preferences.channels IS 'Notification channels (email, slack, teams, webhook)';
COMMENT ON COLUMN organization_audit_logs.details IS 'Additional details about the action performed';