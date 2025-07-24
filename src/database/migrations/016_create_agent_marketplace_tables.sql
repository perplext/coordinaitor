-- Migration: Create agent marketplace tables
-- Version: 016
-- Description: Create tables for agent marketplace, installations, and reviews

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create marketplace_agents table
CREATE TABLE IF NOT EXISTS marketplace_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    long_description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    author JSONB NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('llm', 'specialized', 'integration', 'workflow', 'utility')),
    tags TEXT[] DEFAULT '{}',
    capabilities TEXT[] DEFAULT '{}',
    pricing JSONB NOT NULL DEFAULT '{"type": "free"}',
    compatibility JSONB NOT NULL DEFAULT '{}',
    configuration JSONB NOT NULL DEFAULT '{}',
    installation JSONB NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{"downloads": 0, "activeInstallations": 0, "averageRating": 0, "totalReviews": 0}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'deprecated', 'suspended')),
    verification JSONB NOT NULL DEFAULT '{"isVerified": false, "securityScanPassed": false}',
    documentation JSONB NOT NULL DEFAULT '{}',
    support JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- Create agent_installations table
CREATE TABLE IF NOT EXISTS agent_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    marketplace_agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'installing' CHECK (status IN ('installing', 'installed', 'failed', 'updating', 'uninstalling')),
    configuration JSONB NOT NULL DEFAULT '{}',
    secrets JSONB NOT NULL DEFAULT '{}',
    installation_data JSONB NOT NULL DEFAULT '{}',
    health JSONB NOT NULL DEFAULT '{"isHealthy": false, "failureCount": 0}',
    usage JSONB NOT NULL DEFAULT '{"tasksExecuted": 0, "totalCost": 0, "averageResponseTime": 0, "errorRate": 0}',
    billing JSONB NOT NULL DEFAULT '{"billingStatus": "active"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    installed_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Create agent_reviews table
CREATE TABLE IF NOT EXISTS agent_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace_agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    version VARCHAR(50) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255) NOT NULL,
    review TEXT NOT NULL,
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    use_case TEXT DEFAULT '',
    is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
    helpful INTEGER NOT NULL DEFAULT 0,
    reported INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'reported')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create marketplace_categories table
CREATE TABLE IF NOT EXISTS marketplace_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    parent_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agent_downloads table for tracking downloads
CREATE TABLE IF NOT EXISTS agent_downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace_agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agent_usage_analytics table
CREATE TABLE IF NOT EXISTS agent_usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id UUID NOT NULL REFERENCES agent_installations(id) ON DELETE CASCADE,
    marketplace_agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_id UUID,
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    success BOOLEAN NOT NULL,
    error_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create marketplace_featured table for featured agents
CREATE TABLE IF NOT EXISTS marketplace_featured (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace_agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL CHECK (feature_type IN ('homepage', 'category', 'trending', 'new', 'recommended')),
    priority INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_status ON marketplace_agents(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_category ON marketplace_agents(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_tags ON marketplace_agents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_capabilities ON marketplace_agents USING GIN(capabilities);
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_created_at ON marketplace_agents(created_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_rating ON marketplace_agents((metrics->>'averageRating')::float);
CREATE INDEX IF NOT EXISTS idx_marketplace_agents_downloads ON marketplace_agents((metrics->>'downloads')::int);

CREATE INDEX IF NOT EXISTS idx_agent_installations_org_id ON agent_installations(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_installations_marketplace_agent_id ON agent_installations(marketplace_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_installations_status ON agent_installations(status);
CREATE INDEX IF NOT EXISTS idx_agent_installations_agent_id ON agent_installations(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_reviews_marketplace_agent_id ON agent_reviews(marketplace_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_organization_id ON agent_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_user_id ON agent_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_rating ON agent_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_status ON agent_reviews(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_categories_parent_id ON marketplace_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_sort_order ON marketplace_categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_agent_downloads_marketplace_agent_id ON agent_downloads(marketplace_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_downloads_organization_id ON agent_downloads(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_downloads_downloaded_at ON agent_downloads(downloaded_at);

CREATE INDEX IF NOT EXISTS idx_agent_usage_analytics_installation_id ON agent_usage_analytics(installation_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_analytics_marketplace_agent_id ON agent_usage_analytics(marketplace_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_analytics_organization_id ON agent_usage_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_analytics_created_at ON agent_usage_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_marketplace_featured_agent_id ON marketplace_featured(marketplace_agent_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_featured_type ON marketplace_featured(feature_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_featured_dates ON marketplace_featured(start_date, end_date);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_installations_org_marketplace_agent 
ON agent_installations(organization_id, marketplace_agent_id) 
WHERE status IN ('installing', 'installed', 'updating');

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_reviews_unique_user_agent 
ON agent_reviews(marketplace_agent_id, organization_id, user_id) 
WHERE status = 'active';

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_marketplace_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agent_installations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agent_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_marketplace_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_marketplace_agents_updated_at ON marketplace_agents;
CREATE TRIGGER trigger_update_marketplace_agents_updated_at
    BEFORE UPDATE ON marketplace_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_agents_updated_at();

DROP TRIGGER IF EXISTS trigger_update_agent_installations_updated_at ON agent_installations;
CREATE TRIGGER trigger_update_agent_installations_updated_at
    BEFORE UPDATE ON agent_installations
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_installations_updated_at();

DROP TRIGGER IF EXISTS trigger_update_agent_reviews_updated_at ON agent_reviews;
CREATE TRIGGER trigger_update_agent_reviews_updated_at
    BEFORE UPDATE ON agent_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_reviews_updated_at();

DROP TRIGGER IF EXISTS trigger_update_marketplace_categories_updated_at ON marketplace_categories;
CREATE TRIGGER trigger_update_marketplace_categories_updated_at
    BEFORE UPDATE ON marketplace_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_categories_updated_at();

-- Create function to update agent metrics when reviews are added/updated
CREATE OR REPLACE FUNCTION update_agent_rating_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update average rating and total reviews for the agent
    UPDATE marketplace_agents 
    SET metrics = jsonb_set(
        jsonb_set(
            metrics, 
            '{averageRating}', 
            (
                SELECT COALESCE(AVG(rating), 0)::text::jsonb 
                FROM agent_reviews 
                WHERE marketplace_agent_id = COALESCE(NEW.marketplace_agent_id, OLD.marketplace_agent_id) 
                AND status = 'active'
            )
        ),
        '{totalReviews}',
        (
            SELECT COUNT(*)::text::jsonb
            FROM agent_reviews 
            WHERE marketplace_agent_id = COALESCE(NEW.marketplace_agent_id, OLD.marketplace_agent_id) 
            AND status = 'active'
        )
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.marketplace_agent_id, OLD.marketplace_agent_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating agent ratings
DROP TRIGGER IF EXISTS trigger_update_agent_rating_metrics ON agent_reviews;
CREATE TRIGGER trigger_update_agent_rating_metrics
    AFTER INSERT OR UPDATE OR DELETE ON agent_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_rating_metrics();

-- Create function to track agent downloads
CREATE OR REPLACE FUNCTION track_agent_download()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment download count
    UPDATE marketplace_agents 
    SET metrics = jsonb_set(
        metrics, 
        '{downloads}', 
        (COALESCE((metrics->>'downloads')::int, 0) + 1)::text::jsonb
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.marketplace_agent_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracking downloads
DROP TRIGGER IF EXISTS trigger_track_agent_download ON agent_downloads;
CREATE TRIGGER trigger_track_agent_download
    AFTER INSERT ON agent_downloads
    FOR EACH ROW
    EXECUTE FUNCTION track_agent_download();

-- Create function to update installation metrics
CREATE OR REPLACE FUNCTION update_installation_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle installation status changes
    IF TG_OP = 'INSERT' AND NEW.status = 'installed' THEN
        -- Increment active installations
        UPDATE marketplace_agents 
        SET metrics = jsonb_set(
            metrics, 
            '{activeInstallations}', 
            (COALESCE((metrics->>'activeInstallations')::int, 0) + 1)::text::jsonb
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.marketplace_agent_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status transitions
        IF OLD.status = 'installed' AND NEW.status != 'installed' THEN
            -- Decrement active installations
            UPDATE marketplace_agents 
            SET metrics = jsonb_set(
                metrics, 
                '{activeInstallations}', 
                GREATEST(COALESCE((metrics->>'activeInstallations')::int, 0) - 1, 0)::text::jsonb
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.marketplace_agent_id;
        ELSIF OLD.status != 'installed' AND NEW.status = 'installed' THEN
            -- Increment active installations
            UPDATE marketplace_agents 
            SET metrics = jsonb_set(
                metrics, 
                '{activeInstallations}', 
                (COALESCE((metrics->>'activeInstallations')::int, 0) + 1)::text::jsonb
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.marketplace_agent_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'installed' THEN
        -- Decrement active installations
        UPDATE marketplace_agents 
        SET metrics = jsonb_set(
            metrics, 
            '{activeInstallations}', 
            GREATEST(COALESCE((metrics->>'activeInstallations')::int, 0) - 1, 0)::text::jsonb
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.marketplace_agent_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for installation metrics
DROP TRIGGER IF EXISTS trigger_update_installation_metrics ON agent_installations;
CREATE TRIGGER trigger_update_installation_metrics
    AFTER INSERT OR UPDATE OR DELETE ON agent_installations
    FOR EACH ROW
    EXECUTE FUNCTION update_installation_metrics();

-- Create helpful views
CREATE OR REPLACE VIEW popular_agents AS
SELECT 
    ma.*,
    (ma.metrics->>'downloads')::int as downloads,
    (ma.metrics->>'activeInstallations')::int as active_installations,
    (ma.metrics->>'averageRating')::float as average_rating,
    (ma.metrics->>'totalReviews')::int as total_reviews
FROM marketplace_agents ma
WHERE ma.status = 'approved'
ORDER BY (ma.metrics->>'downloads')::int DESC, (ma.metrics->>'averageRating')::float DESC;

CREATE OR REPLACE VIEW trending_agents AS
SELECT 
    ma.*,
    COUNT(ad.id) as recent_downloads,
    (ma.metrics->>'averageRating')::float as average_rating
FROM marketplace_agents ma
LEFT JOIN agent_downloads ad ON ma.id = ad.marketplace_agent_id 
    AND ad.downloaded_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
WHERE ma.status = 'approved'
GROUP BY ma.id
ORDER BY recent_downloads DESC, average_rating DESC;

CREATE OR REPLACE VIEW agent_installation_summary AS
SELECT 
    ai.organization_id,
    ma.id as marketplace_agent_id,
    ma.name,
    ma.display_name,
    ma.category,
    ai.status,
    ai.version,
    ai.installed_at,
    ai.last_used_at,
    (ai.usage->>'tasksExecuted')::int as tasks_executed,
    (ai.usage->>'totalCost')::float as total_cost,
    (ai.health->>'isHealthy')::boolean as is_healthy
FROM agent_installations ai
JOIN marketplace_agents ma ON ai.marketplace_agent_id = ma.id;

-- Insert default categories
INSERT INTO marketplace_categories (name, display_name, description, icon, sort_order) VALUES
('llm', 'Large Language Models', 'AI models for text generation, analysis, and conversation', 'brain', 1),
('specialized', 'Specialized AI', 'Domain-specific AI agents for particular use cases', 'target', 2),
('integration', 'Integrations', 'Agents that connect to external services and APIs', 'link', 3),
('workflow', 'Workflow Automation', 'Agents for automating complex workflows and processes', 'flow', 4),
('utility', 'Utilities', 'Helper agents for common tasks and operations', 'tool', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert sample marketplace agents for testing
DO $$
DECLARE
    sample_org_id UUID;
BEGIN
    -- Get first organization ID for sample data
    SELECT id INTO sample_org_id FROM organizations LIMIT 1;
    
    IF sample_org_id IS NOT NULL THEN
        -- Insert sample marketplace agents
        INSERT INTO marketplace_agents (
            name, display_name, description, long_description, version, author, category,
            tags, capabilities, pricing, installation, status, published_at
        ) VALUES
        (
            'code-reviewer',
            'Code Reviewer Pro',
            'Advanced code review agent with security scanning',
            'A comprehensive code review agent that analyzes code quality, security vulnerabilities, and best practices. Supports multiple programming languages and integrates with popular version control systems.',
            '2.1.0',
            '{"name": "DevTools Corp", "email": "support@devtools.com", "website": "https://devtools.com"}',
            'specialized',
            ARRAY['code-review', 'security', 'quality'],
            ARRAY['code-analysis', 'security-scanning', 'best-practices'],
            '{"type": "freemium", "pricePerTask": 0.10, "trialPeriod": 14}',
            '{"type": "api", "apiEndpoint": "https://api.codereview.com/v2"}',
            'approved',
            CURRENT_TIMESTAMP - INTERVAL '30 days'
        ),
        (
            'data-analyst',
            'Smart Data Analyst',
            'AI-powered data analysis and visualization agent',
            'Automatically analyze datasets, generate insights, and create visualizations. Supports CSV, JSON, Excel files and can connect to databases.',
            '1.5.2',
            '{"name": "DataViz Solutions", "email": "hello@dataviz.io", "website": "https://dataviz.io"}',
            'specialized',
            ARRAY['data-analysis', 'visualization', 'insights'],
            ARRAY['data-processing', 'chart-generation', 'statistical-analysis'],
            '{"type": "subscription", "monthlyPrice": 29.99, "yearlyPrice": 299.99}',
            '{"type": "docker", "dockerImage": "dataviz/analyst:latest"}',
            'approved',
            CURRENT_TIMESTAMP - INTERVAL '15 days'
        ),
        (
            'slack-bot',
            'Intelligent Slack Assistant',
            'Smart Slack bot for team communication and automation',
            'Enhance your Slack workspace with AI-powered assistance. Answer questions, schedule meetings, manage tasks, and automate routine communications.',
            '3.0.1',
            '{"name": "BotWorks Inc", "email": "bots@botworks.com", "organization": "BotWorks Inc"}',
            'integration',
            ARRAY['slack', 'communication', 'automation'],
            ARRAY['chat-integration', 'task-management', 'scheduling'],
            '{"type": "free"}',
            '{"type": "webhook", "webhookUrl": "https://hooks.slack.com/services/..."}',
            'approved',
            CURRENT_TIMESTAMP - INTERVAL '7 days'
        )
        ON CONFLICT (name) DO NOTHING;
        
        -- Insert sample reviews
        INSERT INTO agent_reviews (
            marketplace_agent_id, organization_id, user_id, version, rating, title, review,
            pros, cons, use_case, is_verified_purchase
        ) SELECT 
            ma.id,
            sample_org_id,
            uuid_generate_v4(),
            ma.version,
            4 + (random() * 1)::int, -- Random rating between 4-5
            'Great agent for our team',
            'This agent has significantly improved our workflow. Easy to set up and very reliable.',
            ARRAY['Easy setup', 'Great performance', 'Good documentation'],
            ARRAY['Could use more customization options'],
            'We use this for our daily code reviews',
            true
        FROM marketplace_agents ma
        WHERE ma.name IN ('code-reviewer', 'data-analyst')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE marketplace_agents IS 'Stores available agents in the marketplace';
COMMENT ON TABLE agent_installations IS 'Tracks agent installations for organizations';
COMMENT ON TABLE agent_reviews IS 'User reviews and ratings for marketplace agents';
COMMENT ON TABLE marketplace_categories IS 'Categories for organizing marketplace agents';
COMMENT ON TABLE agent_downloads IS 'Tracks agent download events for analytics';
COMMENT ON TABLE agent_usage_analytics IS 'Detailed usage analytics for installed agents';
COMMENT ON TABLE marketplace_featured IS 'Featured agents for promotional purposes';

COMMENT ON COLUMN marketplace_agents.pricing IS 'Pricing information including type (free/freemium/paid/subscription) and costs';
COMMENT ON COLUMN marketplace_agents.compatibility IS 'Platform and feature compatibility requirements';
COMMENT ON COLUMN marketplace_agents.configuration IS 'Configuration schema and defaults for the agent';
COMMENT ON COLUMN marketplace_agents.installation IS 'Installation method and parameters';
COMMENT ON COLUMN marketplace_agents.permissions IS 'Required permissions and access levels';
COMMENT ON COLUMN marketplace_agents.metrics IS 'Download counts, ratings, and usage statistics';
COMMENT ON COLUMN marketplace_agents.verification IS 'Verification status and security scan results';

COMMENT ON COLUMN agent_installations.secrets IS 'Encrypted secrets and API keys for the agent';
COMMENT ON COLUMN agent_installations.health IS 'Health status and monitoring information';
COMMENT ON COLUMN agent_installations.usage IS 'Usage statistics and performance metrics';
COMMENT ON COLUMN agent_installations.billing IS 'Billing and subscription information';

-- Grant appropriate permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON marketplace_agents TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON agent_installations TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON agent_reviews TO app_user;
-- GRANT SELECT ON marketplace_categories TO app_user;
-- GRANT SELECT, INSERT ON agent_downloads TO app_user;
-- GRANT SELECT, INSERT ON agent_usage_analytics TO app_user;