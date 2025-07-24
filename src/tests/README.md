# Multi-Agent Orchestrator Test Suite

This directory contains comprehensive tests for the Multi-Agent Orchestrator platform, with special focus on multi-tenancy, user management, and enterprise features.

## Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── tenant-isolation-middleware.test.ts
│   └── organization-aware-task-service.test.ts
├── integration/                    # Integration tests for service interactions
│   └── multi-tenancy.test.ts
├── e2e/                           # End-to-end workflow tests
│   └── multi-tenant-workflow.test.ts
└── README.md
```

## Test Categories

### Unit Tests

**tenant-isolation-middleware.test.ts**
- Tests tenant resolution strategies (subdomain, domain, header, path)
- Validates fallback mechanisms and error handling
- Ensures proper CORS and security headers
- Covers disabled multi-tenancy scenarios

**organization-aware-task-service.test.ts**
- Tests organization-specific agent configurations
- Validates cost and rate limit enforcement
- Tests task validation against organization features
- Covers agent availability and load balancing

### Integration Tests

**multi-tenancy.test.ts**
- Tests complete multi-tenant data isolation
- Validates user invitation workflows across organizations
- Tests billing and subscription isolation
- Validates organization configuration separation
- Tests task execution with tenant-specific settings
- Covers analytics and permission isolation

### End-to-End Tests

**multi-tenant-workflow.test.ts**
- Complete user journey from organization creation to task execution
- Tests real-world scenarios with multiple tenants
- Validates concurrent access and data consistency
- Tests edge cases and error scenarios
- Stress testing with multiple concurrent operations

## Key Test Scenarios

### 1. Tenant Isolation
- ✅ Organizations cannot access each other's data
- ✅ Users are properly scoped to their organizations
- ✅ Cross-tenant requests are blocked
- ✅ Data consistency is maintained across tenants

### 2. User Management
- ✅ Invitations are organization-scoped
- ✅ User roles and permissions work within organizations
- ✅ Bulk operations respect tenant boundaries
- ✅ User data is properly isolated

### 3. Billing Isolation
- ✅ Usage tracking is separate per organization
- ✅ Subscriptions and plans are organization-specific
- ✅ Cost limits are enforced per organization
- ✅ Billing data cannot be accessed cross-tenant

### 4. Agent Configuration
- ✅ Organizations can have different agent settings
- ✅ Rate limits and cost limits are enforced per org
- ✅ Feature toggles work at organization level
- ✅ Agent availability respects organization config

### 5. Task Execution
- ✅ Tasks are executed with organization-specific configurations
- ✅ Task history is isolated per organization
- ✅ Analytics are organization-specific
- ✅ Workflow execution respects tenant boundaries

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Setup test database
npm run test:db:setup
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e
```

### Run Specific Test Files
```bash
# Run tenant isolation tests
npm test -- tenant-isolation-middleware.test.ts

# Run multi-tenancy integration tests
npm test -- multi-tenancy.test.ts

# Run complete workflow tests
npm test -- multi-tenant-workflow.test.ts
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

## Test Configuration

### Environment Variables
```bash
# Test database configuration
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=orchestrator_test
TEST_DB_USER=test_user
TEST_DB_PASSWORD=test_password

# Test JWT secret
TEST_JWT_SECRET=test-secret-key

# Test organization settings
TEST_DEFAULT_ORG_ID=default-test-org
TEST_MULTI_TENANT_ENABLED=true

# Test external services (optional)
TEST_SLACK_WEBHOOK_URL=https://hooks.slack.com/test
TEST_STRIPE_SECRET_KEY=sk_test_...
```

### Test Data
Tests use isolated test data that is created and cleaned up automatically. Each test suite:
- Creates its own test organizations
- Generates test users and invitations
- Sets up test configurations
- Cleans up all data after completion

## Mock Services

The test suite includes comprehensive mocks for:
- **Database Service**: In-memory SQLite for fast testing
- **External APIs**: Mocked HTTP clients for third-party services
- **Email Service**: Mock email delivery for invitation testing
- **Payment Processing**: Mock billing and subscription services
- **Agent Registry**: Mock AI agents for testing without API calls

## Debugging Tests

### Verbose Output
```bash
npm test -- --verbose
```

### Debug Specific Test
```bash
npm test -- --debug tenant-isolation-middleware.test.ts
```

### Test with Real Database
```bash
NODE_ENV=test npm test -- --use-real-db
```

## Continuous Integration

Tests are configured to run in CI/CD pipelines with:
- **GitHub Actions**: Automated testing on pull requests
- **Database Migrations**: Automatic test schema setup
- **Parallel Execution**: Tests run in parallel for faster feedback
- **Coverage Reporting**: Code coverage reports uploaded to coverage services

## Performance Testing

### Load Testing
```bash
npm run test:load
```

### Memory Leak Detection
```bash
npm run test:memory
```

### Concurrent User Simulation
```bash
npm run test:concurrent
```

## Security Testing

### Authentication Tests
- JWT token validation
- Role-based access control
- Session management
- Cross-tenant access prevention

### Data Validation Tests
- Input sanitization
- SQL injection prevention
- XSS protection
- Rate limiting

### Privacy Tests
- Data isolation verification
- PII handling compliance
- GDPR compliance checks
- Data retention policies

## Contributing to Tests

### Adding New Tests
1. Identify the appropriate test category (unit/integration/e2e)
2. Follow existing naming conventions
3. Include comprehensive assertions
4. Add proper cleanup in `afterEach`/`afterAll`
5. Update this README if adding new test files

### Test Best Practices
- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up test data
- **Assertions**: Use specific, meaningful assertions
- **Mocking**: Mock external dependencies appropriately
- **Documentation**: Add comments for complex test logic

### Code Coverage Goals
- **Minimum Coverage**: 80% for all modules
- **Critical Paths**: 95% for authentication and billing
- **New Features**: 90% coverage required for new code
- **Edge Cases**: Include error scenarios and edge cases

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure test database is running
2. **Port Conflicts**: Check for conflicting services on test ports
3. **Memory Issues**: Increase Node.js memory limit for large test suites
4. **Timeout Issues**: Increase test timeouts for slow operations

### Test Flakiness
- Use proper async/await patterns
- Avoid hardcoded timeouts
- Clean up resources properly
- Use deterministic test data

### Performance Issues
- Run tests in parallel where possible
- Use in-memory databases for unit tests
- Mock expensive operations
- Profile test execution time

This comprehensive test suite ensures the Multi-Agent Orchestrator platform maintains high quality, security, and reliability across all multi-tenant scenarios.