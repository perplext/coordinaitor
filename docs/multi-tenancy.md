# Multi-Tenancy Support

The CoordinAItor supports multi-tenancy, allowing multiple organizations to use the same instance while maintaining complete data isolation and security.

## Overview

Multi-tenancy enables:
- **Data Isolation**: Complete separation of data between organizations
- **Customizable Features**: Organization-specific configurations and features
- **Scalable Architecture**: Support for multiple tenant resolution strategies
- **Flexible Billing**: Per-organization usage tracking and limits
- **Security**: Proper access controls and tenant boundaries

## Configuration

### Environment Variables

```bash
# Enable multi-tenancy
MULTI_TENANT_ENABLED=true

# Tenant resolution strategy
MULTI_TENANT_STRATEGY=subdomain  # subdomain|domain|header|path

# Default organization for single-tenant mode
DEFAULT_ORGANIZATION_ID=org-uuid

# Allowed custom domains (for domain strategy)
ALLOWED_DOMAINS=company1.com,company2.com

# Header-based tenant resolution
REQUIRE_TENANT_HEADER=false
TENANT_HEADER_NAME=X-Tenant-ID
```

### Tenant Resolution Strategies

#### 1. Subdomain Strategy (Recommended)

Organizations are identified by subdomain:
- `acme.platform.com` → Acme Corporation
- `globex.platform.com` → Globex Inc.

```bash
MULTI_TENANT_STRATEGY=subdomain
```

#### 2. Custom Domain Strategy

Organizations use their own domains:
- `acme.com` → Acme Corporation  
- `globex.com` → Globex Inc.

```bash
MULTI_TENANT_STRATEGY=domain
ALLOWED_DOMAINS=acme.com,globex.com
```

#### 3. Header Strategy

Organizations identified by HTTP header:
```bash
MULTI_TENANT_STRATEGY=header
TENANT_HEADER_NAME=X-Tenant-ID
```

Requests must include:
```http
X-Tenant-ID: org-uuid
```

#### 4. Path Strategy

Organizations identified by URL path:
- `/org/acme/api/tasks` → Acme Corporation
- `/org/globex/api/tasks` → Globex Inc.

```bash
MULTI_TENANT_STRATEGY=path
```

## Organization Management

### Creating Organizations

```typescript
import { OrganizationService } from './services/organization-service';

const orgService = new OrganizationService();

const organization = await orgService.createOrganization({
  name: 'acme-corp',
  displayName: 'Acme Corporation',
  subdomain: 'acme',
  domain: 'acme.com', // optional
  tier: 'professional',
  contactEmail: 'admin@acme.com',
  createdBy: 'user-id'
});
```

### Organization Tiers

The platform supports multiple tiers with different limits:

#### Free Tier
- 5 users
- 2 projects
- 100 tasks/month
- 1GB storage
- 1,000 API calls/month
- 2 agents
- Basic features

#### Starter Tier
- 15 users
- 10 projects
- 1,000 tasks/month
- 10GB storage
- 10,000 API calls/month
- 5 agents
- Enhanced features

#### Professional Tier
- 50 users
- 50 projects
- 10,000 tasks/month
- 100GB storage
- 100,000 API calls/month
- 15 agents
- Premium features (SSO, webhooks, etc.)

#### Enterprise Tier
- Unlimited everything
- Custom features
- Dedicated support

## Data Isolation

### Automatic Isolation

The tenant isolation middleware automatically:
- Resolves the organization from the request
- Validates organization status
- Enforces data boundaries
- Tracks usage and limits

### Database Schema

All tables include organization isolation:

```sql
-- Example table with tenant isolation
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title VARCHAR(255) NOT NULL,
  -- ... other fields
);

-- Indexes for efficient tenant queries
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);
```

### API Access Patterns

All API endpoints automatically filter by organization:

```typescript
// Middleware ensures req.tenant is populated
app.get('/api/tasks', async (req: TenantRequest, res) => {
  const organizationId = req.tenant.organization.id;
  
  // Queries automatically scoped to organization
  const tasks = await db.query(
    'SELECT * FROM tasks WHERE organization_id = $1',
    [organizationId]
  );
  
  res.json({ tasks });
});
```

## Usage Tracking & Limits

### Automatic Tracking

The system automatically tracks:
- User count
- Project count
- Monthly task executions
- Storage usage
- API call count
- Agent executions

### Limit Enforcement

```typescript
// Check limits before operations
app.post('/api/tasks', 
  tenantMiddleware.checkLimits('tasks'),
  async (req, res) => {
    // Task creation logic
  }
);
```

### Usage API

```bash
# Get current usage
GET /api/organizations/{id}/usage

# Check limits
GET /api/organizations/{id}/limits
```

## Security Features

### Organization Boundaries

- Users can only access their organization's data
- Super admins can access any organization
- Cross-organization access is logged and monitored

### Feature Gating

```typescript
// Require specific features
app.post('/api/webhooks',
  tenantMiddleware.requireFeature('webhooks'),
  async (req, res) => {
    // Webhook creation logic
  }
);
```

### Audit Logging

All organization activities are logged:
- User actions
- API calls
- Limit violations
- Access attempts

## Frontend Integration

### Organization Dashboard

The admin dashboard (`/web/src/components/admin/OrganizationDashboard.tsx`) provides:
- Organization overview
- Usage statistics
- User management
- Billing information
- Settings configuration

### Multi-Tenant UI

The frontend automatically adapts to the organization context:
- Branding customization
- Feature availability
- User permissions
- Organization-specific settings

## API Examples

### Creating an Organization

```bash
curl -X POST "${API_BASE}/organizations" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acme-corp",
    "displayName": "Acme Corporation",
    "subdomain": "acme",
    "tier": "professional",
    "contactEmail": "admin@acme.com"
  }'
```

### Multi-Tenant Request

```bash
# Using subdomain
curl -X GET "https://acme.platform.com/api/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# Using header
curl -X GET "${API_BASE}/tasks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "X-Tenant-ID: org-uuid"
```

## Deployment Considerations

### Load Balancing

Configure your load balancer to route by subdomain:

```nginx
# Nginx configuration
server {
    server_name *.platform.com;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### SSL Certificates

Use wildcard certificates for subdomain strategy:
- `*.platform.com`

### Monitoring

Set up monitoring per organization:
- Usage metrics
- Performance by tenant
- Error rates
- Cost tracking

## Migration Guide

### From Single-Tenant to Multi-Tenant

1. **Enable multi-tenancy**:
   ```bash
   MULTI_TENANT_ENABLED=true
   MULTI_TENANT_STRATEGY=subdomain
   ```

2. **Create default organization**:
   ```bash
   # Create organization for existing data
   DEFAULT_ORGANIZATION_ID=existing-org-id
   ```

3. **Update database**:
   ```sql
   -- Add organization_id to existing tables
   ALTER TABLE tasks ADD COLUMN organization_id UUID;
   UPDATE tasks SET organization_id = 'existing-org-id';
   ALTER TABLE tasks ALTER COLUMN organization_id SET NOT NULL;
   ```

4. **Test thoroughly**:
   - Verify data isolation
   - Test all tenant strategies
   - Validate permissions

## Best Practices

1. **Security**:
   - Always validate tenant context
   - Log cross-tenant access attempts
   - Regularly audit permissions

2. **Performance**:
   - Index by organization_id
   - Cache organization data
   - Monitor per-tenant performance

3. **Scaling**:
   - Plan for organization growth
   - Monitor resource usage
   - Implement proper rate limiting

4. **Data**:
   - Regular backups per organization
   - Test data isolation
   - Plan for data migration

## Troubleshooting

### Common Issues

1. **Tenant not found**:
   - Check subdomain/domain configuration
   - Verify organization exists and is active
   - Check DNS settings

2. **Cross-tenant access**:
   - Review user permissions
   - Check organization membership
   - Validate middleware configuration

3. **Limit errors**:
   - Check organization tier
   - Review usage statistics
   - Consider tier upgrade

### Debug Mode

Enable debug logging:
```bash
# Enable tenant middleware debugging
DEBUG=tenant:*
```

View logs for troubleshooting:
```bash
tail -f logs/tenant-isolation.log
tail -f logs/organization-service.log
```