-- Migration: Create billing and subscription tables
-- Created: 2024-01-07
-- Description: Add tables for billing plans, subscriptions, invoices, and usage tracking

-- Create billing plans table
CREATE TABLE IF NOT EXISTS billing_plans (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tier VARCHAR(50) NOT NULL CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
    price JSONB NOT NULL DEFAULT '{}',
    features JSONB NOT NULL DEFAULT '{}',
    trial_days INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(255) NOT NULL REFERENCES billing_plans(id),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'unpaid')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    billing_cycle_anchor TIMESTAMP WITH TIME ZONE NOT NULL,
    customer_id VARCHAR(255), -- External billing provider customer ID
    external_subscription_id VARCHAR(255), -- External billing provider subscription ID
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    external_invoice_id VARCHAR(255), -- External billing provider invoice ID
    payment_method VARCHAR(255),
    line_items JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create usage records table
CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('card', 'bank_account', 'paypal')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    last4 VARCHAR(4),
    brand VARCHAR(50),
    expiry_month INTEGER,
    expiry_year INTEGER,
    bank_name VARCHAR(255),
    account_type VARCHAR(50),
    external_payment_method_id VARCHAR(255), -- External billing provider payment method ID
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create billing webhook events table
CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(255) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    provider_id VARCHAR(255) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_usage_records_organization_id ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric_period ON usage_records(metric_name, period);
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp ON usage_records(timestamp);

CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_id ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(organization_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_processed ON billing_webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_type ON billing_webhook_events(type);

-- Create trigger to ensure only one default payment method per organization
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    -- If this payment method is being set as default
    IF NEW.is_default = true THEN
        -- Set all other payment methods for this organization to not default
        UPDATE payment_methods 
        SET is_default = false 
        WHERE organization_id = NEW.organization_id 
        AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_method_default_trigger
    BEFORE INSERT OR UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_payment_method();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_plans_updated_at_trigger
    BEFORE UPDATE ON billing_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER subscriptions_updated_at_trigger
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER invoices_updated_at_trigger
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default billing plans
INSERT INTO billing_plans (id, name, description, tier, price, features, trial_days, active) VALUES
('free', 'Free', 'Perfect for individuals and small teams getting started', 'free', 
 '{"amount": 0, "currency": "USD", "interval": "month", "intervalCount": 1}',
 '{"maxUsers": 5, "maxProjects": 2, "maxTasksPerMonth": 100, "maxStorageGB": 1, "maxAPICallsPerMonth": 1000, "maxAgents": 2, "maxCollaborators": 3, "maxWebhooks": 1, "maxIntegrations": 2, "retentionDays": 30, "sso": false, "analytics": true, "apiAccess": true, "customBranding": false, "webhooks": false, "repositoryIntegration": false, "securityScanning": false, "prioritySupport": false}',
 0, true),

('starter', 'Starter', 'Great for growing teams that need more power', 'starter',
 '{"amount": 29, "currency": "USD", "interval": "month", "intervalCount": 1}',
 '{"maxUsers": 15, "maxProjects": 10, "maxTasksPerMonth": 1000, "maxStorageGB": 10, "maxAPICallsPerMonth": 10000, "maxAgents": 5, "maxCollaborators": 10, "maxWebhooks": 5, "maxIntegrations": 5, "retentionDays": 90, "sso": false, "analytics": true, "apiAccess": true, "customBranding": false, "webhooks": true, "repositoryIntegration": true, "securityScanning": false, "prioritySupport": false}',
 14, true),

('professional', 'Professional', 'Advanced features for professional teams', 'professional',
 '{"amount": 99, "currency": "USD", "interval": "month", "intervalCount": 1}',
 '{"maxUsers": 50, "maxProjects": 50, "maxTasksPerMonth": 10000, "maxStorageGB": 100, "maxAPICallsPerMonth": 100000, "maxAgents": 15, "maxCollaborators": 25, "maxWebhooks": 15, "maxIntegrations": 10, "retentionDays": 365, "sso": true, "analytics": true, "apiAccess": true, "customBranding": true, "webhooks": true, "repositoryIntegration": true, "securityScanning": true, "prioritySupport": false}',
 14, true),

('enterprise', 'Enterprise', 'Everything you need for large organizations', 'enterprise',
 '{"amount": 299, "currency": "USD", "interval": "month", "intervalCount": 1}',
 '{"maxUsers": -1, "maxProjects": -1, "maxTasksPerMonth": -1, "maxStorageGB": -1, "maxAPICallsPerMonth": -1, "maxAgents": -1, "maxCollaborators": -1, "maxWebhooks": -1, "maxIntegrations": -1, "retentionDays": -1, "sso": true, "analytics": true, "apiAccess": true, "customBranding": true, "webhooks": true, "repositoryIntegration": true, "securityScanning": true, "prioritySupport": true}',
 30, true)

ON CONFLICT (id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE billing_plans IS 'Available billing plans with pricing and features';
COMMENT ON TABLE subscriptions IS 'Organization subscriptions to billing plans';
COMMENT ON TABLE invoices IS 'Generated invoices for billing periods';
COMMENT ON TABLE usage_records IS 'Usage metrics for billing calculations';
COMMENT ON TABLE payment_methods IS 'Payment methods for organizations';
COMMENT ON TABLE billing_webhook_events IS 'Webhook events from external billing providers';

COMMENT ON COLUMN subscriptions.trial_end IS 'End date of trial period, null if no trial';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'Whether to cancel at the end of current period';
COMMENT ON COLUMN invoices.line_items IS 'JSON array of invoice line items';
COMMENT ON COLUMN usage_records.period IS 'Billing period in YYYY-MM format';
COMMENT ON COLUMN payment_methods.is_default IS 'Whether this is the default payment method for the organization';