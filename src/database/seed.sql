-- Seed data for development and testing
-- This file is automatically executed when the PostgreSQL container starts

-- Insert default organization
INSERT INTO organizations (id, name, display_name, subdomain, tier, status, contact_email, billing_email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'default-org', 'Default Organization', 'default', 'professional', 'active', 'admin@orchestrator.com', 'billing@orchestrator.com', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'demo-org', 'Demo Organization', 'demo', 'enterprise', 'active', 'demo@orchestrator.com', 'demo-billing@orchestrator.com', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert default roles
INSERT INTO roles (id, name, description, permissions, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Administrator with full access', '{"*": ["create", "read", "update", "delete"]}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'user', 'Regular user with standard access', '{"tasks": ["create", "read", "update"], "agents": ["read"]}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'viewer', 'Read-only access', '{"*": ["read"]}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert default users (password is 'admin123' for all users)
INSERT INTO users (id, username, email, password_hash, first_name, last_name, status, role, organization_id, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin', 'admin@orchestrator.com', '$2a$10$YTmGfvZvBn3XgR6gDe8Qxe7kDWH0J8XxBhH6PNR5Y6B1R9Y5xFqGe', 'Admin', 'User', 'active', 'admin', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'demo', 'demo@orchestrator.com', '$2a$10$YTmGfvZvBn3XgR6gDe8Qxe7kDWH0J8XxBhH6PNR5Y6B1R9Y5xFqGe', 'Demo', 'User', 'active', 'user', '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'viewer', 'viewer@orchestrator.com', '$2a$10$YTmGfvZvBn3XgR6gDe8Qxe7kDWH0J8XxBhH6PNR5Y6B1R9Y5xFqGe', 'Viewer', 'User', 'active', 'viewer', '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert user-role associations
INSERT INTO user_roles (user_id, role_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Insert sample agents
INSERT INTO agents (id, name, type, provider, status, capabilities, max_concurrent_tasks, config, organization_id, created_at, updated_at)
VALUES 
  ('claude-001', 'Claude 3 Opus', 'api', 'Anthropic', 'active', '["planning", "development", "testing", "documentation"]', 5, '{"model": "claude-3-opus", "temperature": 0.7}', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('gpt4-001', 'GPT-4 Turbo', 'api', 'OpenAI', 'active', '["design", "development", "security", "optimization"]', 10, '{"model": "gpt-4-turbo", "temperature": 0.8}', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('gemini-001', 'Gemini Pro', 'api', 'Google', 'active', '["analysis", "development", "testing"]', 8, '{"model": "gemini-pro", "temperature": 0.7}', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('bedrock-001', 'AWS Bedrock Claude', 'api', 'AWS', 'inactive', '["planning", "development", "deployment"]', 5, '{"model": "claude-v2", "region": "us-east-1"}', '00000000-0000-0000-0000-000000000002', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample templates
INSERT INTO templates (id, name, description, category, content, variables, tags, organization_id, created_by, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'REST API Service', 'Template for creating a RESTful API service', 'backend', '{"steps": ["Design API endpoints", "Implement controllers", "Add validation", "Write tests", "Document API"]}', '["serviceName", "port", "database"]', '["api", "backend", "rest"]', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'React Component', 'Template for creating a React component', 'frontend', '{"steps": ["Create component structure", "Add props interface", "Implement logic", "Add styling", "Write tests"]}', '["componentName", "props", "hasState"]', '["react", "frontend", "component"]', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample knowledge entries
INSERT INTO knowledge_entries (id, title, content, type, category, tags, metadata, author_id, organization_id, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'TypeScript Best Practices', 'Always use strict mode, prefer interfaces over types for object shapes...', 'best_practice', 'development', '["typescript", "best-practices", "coding-standards"]', '{"version": "5.0", "difficulty": "intermediate"}', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Docker Multi-Stage Builds', 'Use multi-stage builds to reduce image size...', 'guide', 'devops', '["docker", "optimization", "deployment"]', '{"version": "24.0", "difficulty": "advanced"}', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample projects
INSERT INTO projects (id, name, description, status, organization_id, created_by, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'E-Commerce Platform', 'Building a scalable e-commerce platform', 'active', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Mobile App Backend', 'API backend for mobile application', 'planning', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample tasks
INSERT INTO tasks (id, title, description, status, priority, type, assigned_agent_id, project_id, organization_id, created_by, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Design Database Schema', 'Create database schema for user management', 'pending', 'high', 'development', NULL, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Implement Authentication', 'Add JWT-based authentication', 'in_progress', 'critical', 'development', 'claude-001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'Write API Documentation', 'Document all API endpoints', 'pending', 'medium', 'documentation', NULL, '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample workflows
INSERT INTO workflows (id, name, description, definition, triggers, organization_id, created_by, status, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Code Review Workflow', 'Automated code review process', '{"steps": [{"type": "code_analysis", "agent": "gpt4-001"}, {"type": "security_scan", "agent": "claude-001"}]}', '["pull_request", "merge_request"]', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'active', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Deployment Pipeline', 'CI/CD deployment workflow', '{"steps": [{"type": "build", "agent": "any"}, {"type": "test", "agent": "any"}, {"type": "deploy", "agent": "bedrock-001"}]}', '["push", "tag"]', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample agent marketplace entries
INSERT INTO agent_marketplace (
  id, name, description, category, provider, version, pricing_model, 
  price_per_request, price_monthly, capabilities, requirements, 
  documentation_url, support_url, tags, rating, install_count, 
  is_verified, is_featured, status, published_by, organization_id,
  created_at, updated_at
)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    'Code Quality Analyzer',
    'Advanced code quality analysis with AI-powered suggestions',
    'development',
    'QualityAI Inc',
    '2.1.0',
    'per_request',
    0.02,
    NULL,
    '["code-analysis", "quality-metrics", "refactoring-suggestions", "complexity-analysis"]',
    '{"runtime": "node16", "memory": "512MB", "api_keys": ["QUALITY_AI_KEY"]}',
    'https://docs.qualityai.com/analyzer',
    'https://support.qualityai.com',
    '["code-quality", "analysis", "refactoring", "metrics"]',
    4.8,
    1523,
    true,
    true,
    'active',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Security Scanner Pro',
    'Comprehensive security vulnerability scanner for multiple languages',
    'security',
    'SecureDev Tools',
    '3.0.5',
    'monthly',
    NULL,
    49.99,
    '["vulnerability-scanning", "dependency-check", "code-injection-detection", "compliance-check"]',
    '{"runtime": "docker", "memory": "1GB", "permissions": ["read-code", "read-dependencies"]}',
    'https://securedev.io/docs/scanner',
    'https://securedev.io/support',
    '["security", "vulnerability", "scanning", "compliance"]',
    4.9,
    892,
    true,
    false,
    'active',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample billing subscriptions
INSERT INTO billing_subscriptions (
  id, organization_id, plan_name, plan_tier, status, 
  billing_cycle, amount, currency, 
  current_period_start, current_period_end,
  created_at, updated_at
)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Professional Plan',
    'professional',
    'active',
    'monthly',
    99.00,
    'USD',
    DATE_TRUNC('month', CURRENT_DATE),
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Enterprise Plan',
    'enterprise',
    'active',
    'yearly',
    9999.00,
    'USD',
    DATE_TRUNC('year', CURRENT_DATE),
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample organization settings
INSERT INTO organization_settings (
  organization_id, settings_key, settings_value,
  created_at, updated_at
)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    'features',
    '{"natural_language": true, "marketplace": true, "webhooks": true, "sso": false}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'features',
    '{"natural_language": true, "marketplace": true, "webhooks": true, "sso": true}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'limits',
    '{"max_users": 50, "max_tasks_per_month": 10000, "max_agents": 20}',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'limits',
    '{"max_users": -1, "max_tasks_per_month": -1, "max_agents": -1}',
    NOW(),
    NOW()
  )
ON CONFLICT (organization_id, settings_key) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_organization_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_organization_status ON agents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_organization ON knowledge_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_organization_status ON workflows(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_marketplace_category_status ON agent_marketplace(category, status);
CREATE INDEX IF NOT EXISTS idx_agent_marketplace_tags ON agent_marketplace USING gin(tags);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;