-- Migration: Create user invitations tables
-- Version: 015
-- Description: Create tables for user invitation and organization user management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'billing')),
    permissions TEXT[] DEFAULT '{}',
    invited_by UUID NOT NULL,
    invited_by_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID,
    personal_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create organization_users table
CREATE TABLE IF NOT EXISTS organization_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'billing')),
    permissions TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_activation')),
    invitation_id UUID REFERENCES user_invitations(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{
        "notifications": {
            "email": true,
            "slack": false,
            "inApp": true
        },
        "timezone": "UTC",
        "language": "en",
        "theme": "auto"
    }',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bulk_invitations table
CREATE TABLE IF NOT EXISTS bulk_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    total_invites INTEGER NOT NULL DEFAULT 0,
    successful_invites INTEGER NOT NULL DEFAULT 0,
    failed_invites INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    invitations TEXT[] DEFAULT '{}',
    errors TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_organization_id ON user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by ON user_invitations(invited_by);

CREATE INDEX IF NOT EXISTS idx_organization_users_organization_id ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id ON organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_email ON organization_users(email);
CREATE INDEX IF NOT EXISTS idx_organization_users_role ON organization_users(role);
CREATE INDEX IF NOT EXISTS idx_organization_users_status ON organization_users(status);
CREATE INDEX IF NOT EXISTS idx_organization_users_invitation_id ON organization_users(invitation_id);

CREATE INDEX IF NOT EXISTS idx_bulk_invitations_organization_id ON bulk_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_invitations_created_by ON bulk_invitations(created_by);
CREATE INDEX IF NOT EXISTS idx_bulk_invitations_status ON bulk_invitations(status);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invitations_org_email_pending 
ON user_invitations(organization_id, email) 
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_users_org_email 
ON organization_users(organization_id, email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_users_org_user_id 
ON organization_users(organization_id, user_id);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_user_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_organization_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_user_invitations_updated_at ON user_invitations;
CREATE TRIGGER trigger_update_user_invitations_updated_at
    BEFORE UPDATE ON user_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_invitations_updated_at();

DROP TRIGGER IF EXISTS trigger_update_organization_users_updated_at ON organization_users;
CREATE TRIGGER trigger_update_organization_users_updated_at
    BEFORE UPDATE ON organization_users
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_users_updated_at();

-- Create function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE user_invitations 
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending' 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired invitations (can be called by cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_invitations 
    WHERE status IN ('expired', 'declined', 'revoked')
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add helpful views for common queries
CREATE OR REPLACE VIEW active_organization_users AS
SELECT 
    ou.*,
    o.name as organization_name,
    o.display_name as organization_display_name
FROM organization_users ou
JOIN organizations o ON ou.organization_id = o.id
WHERE ou.status = 'active';

CREATE OR REPLACE VIEW pending_invitations AS
SELECT 
    ui.*,
    o.name as organization_name,
    o.display_name as organization_display_name,
    CASE 
        WHEN ui.expires_at < CURRENT_TIMESTAMP THEN true 
        ELSE false 
    END as is_expired
FROM user_invitations ui
JOIN organizations o ON ui.organization_id = o.id
WHERE ui.status = 'pending';

-- Insert some sample data for testing (optional)
-- This can be removed in production
DO $$
DECLARE
    sample_org_id UUID;
    sample_invitation_id UUID;
BEGIN
    -- Get first organization ID for sample data
    SELECT id INTO sample_org_id FROM organizations LIMIT 1;
    
    IF sample_org_id IS NOT NULL THEN
        -- Insert sample invitation
        INSERT INTO user_invitations (
            id, organization_id, email, role, permissions, invited_by, invited_by_email, 
            token, expires_at, personal_message
        ) VALUES (
            uuid_generate_v4(),
            sample_org_id,
            'newuser@example.com',
            'member',
            ARRAY['projects:read', 'projects:write', 'tasks:read', 'tasks:write'],
            uuid_generate_v4(),
            'admin@example.com',
            encode(gen_random_bytes(32), 'hex'),
            CURRENT_TIMESTAMP + INTERVAL '7 days',
            'Welcome to our Multi-Agent Orchestrator platform!'
        ) ON CONFLICT DO NOTHING;
        
        -- Insert sample organization user
        INSERT INTO organization_users (
            id, organization_id, user_id, email, first_name, last_name, role, permissions
        ) VALUES (
            uuid_generate_v4(),
            sample_org_id,
            uuid_generate_v4(),
            'existinguser@example.com',
            'John',
            'Doe',
            'admin',
            ARRAY['users:read', 'users:write', 'projects:read', 'projects:write', 'tasks:read', 'tasks:write', 'settings:read', 'settings:write']
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE user_invitations IS 'Stores invitations sent to users to join organizations';
COMMENT ON TABLE organization_users IS 'Stores users that are members of organizations with their roles and permissions';
COMMENT ON TABLE bulk_invitations IS 'Tracks bulk invitation operations and their status';

COMMENT ON COLUMN user_invitations.token IS 'Secure token used in invitation URLs';
COMMENT ON COLUMN user_invitations.permissions IS 'Array of specific permissions granted to user';
COMMENT ON COLUMN organization_users.preferences IS 'User preferences including notifications, timezone, language, and theme';
COMMENT ON COLUMN organization_users.invitation_id IS 'Reference to the invitation that led to this user joining';

-- Grant appropriate permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_invitations TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON organization_users TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON bulk_invitations TO app_user;
-- GRANT SELECT ON active_organization_users TO app_user;
-- GRANT SELECT ON pending_invitations TO app_user;