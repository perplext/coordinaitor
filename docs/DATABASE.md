# Database Setup Guide

## Overview

The CoordinAItor uses PostgreSQL as its primary database with TypeORM as the ORM layer. This guide covers database setup, migrations, and management.

## Prerequisites

- PostgreSQL 13+ installed
- Node.js 18+ installed
- Docker (optional, for containerized setup)

## Quick Start

### Using Docker Compose (Recommended)

1. Start the database services:
```bash
docker-compose up -d postgres redis
```

2. Run migrations:
```bash
npm run migration:run
```

3. Seed initial data (optional):
```bash
npm run db:seed
```

### Manual PostgreSQL Setup

1. Install PostgreSQL:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Windows
# Download installer from https://www.postgresql.org/download/windows/
```

2. Create database and user:
```sql
CREATE DATABASE orchestrator;
CREATE USER orchestrator_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE orchestrator TO orchestrator_user;
```

3. Update `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=orchestrator_user
DB_PASSWORD=your_password
DB_NAME=orchestrator
DB_SSL=false
```

4. Run migrations:
```bash
npm run migration:run
```

## Database Schema

### Core Tables

- **organizations**: Multi-tenant organizations
- **users**: User accounts with authentication
- **roles**: Role definitions with permissions
- **user_roles**: User-role assignments
- **agents**: AI agent configurations
- **projects**: Project management
- **tasks**: Task tracking and execution
- **workflows**: Workflow definitions
- **templates**: Reusable templates

### Features

- UUID primary keys for all tables
- JSONB columns for flexible metadata storage
- Automatic timestamp management
- Comprehensive indexes for performance
- Foreign key constraints for data integrity

## Migrations

### Create a new migration:
```bash
npm run migration:create -- -n MigrationName
```

### Run pending migrations:
```bash
npm run migration:run
```

### Revert last migration:
```bash
npm run migration:revert
```

## Database Management

### Using pgAdmin

1. Access pgAdmin at http://localhost:5050
2. Default credentials:
   - Email: admin@example.com
   - Password: admin

3. Add server connection:
   - Host: postgres
   - Port: 5432
   - Username: postgres
   - Password: postgres

### Backup and Restore

Backup database:
```bash
docker exec orchestrator-postgres pg_dump -U postgres orchestrator > backup.sql
```

Restore database:
```bash
docker exec -i orchestrator-postgres psql -U postgres orchestrator < backup.sql
```

## Testing

### Create test database:
```bash
CREATE DATABASE orchestrator_test;
```

### Run tests with test database:
```bash
NODE_ENV=test DB_NAME=orchestrator_test npm test
```

## Performance Optimization

### Indexes

The schema includes indexes on:
- Foreign key columns
- Status fields for filtering
- Timestamp fields for sorting
- Unique constraints

### Query Optimization

- Use TypeORM query builder for complex queries
- Implement pagination for large datasets
- Use database views for complex reports
- Consider materialized views for analytics

## Troubleshooting

### Connection Issues

1. Check PostgreSQL is running:
```bash
# Docker
docker ps | grep postgres

# System service
sudo service postgresql status
```

2. Verify connection parameters in `.env`

3. Check PostgreSQL logs:
```bash
docker logs orchestrator-postgres
```

### Migration Issues

1. Check migration status:
```bash
npm run migration:show
```

2. Reset database (WARNING: destroys all data):
```bash
DROP DATABASE orchestrator;
CREATE DATABASE orchestrator;
npm run migration:run
```

### Performance Issues

1. Check slow queries:
```sql
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

2. Analyze table statistics:
```sql
ANALYZE;
```

3. Check index usage:
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

## Security Best Practices

1. **Use strong passwords** for database users
2. **Enable SSL** for production connections
3. **Restrict network access** using firewall rules
4. **Regular backups** with encryption
5. **Audit logging** for sensitive operations
6. **Principle of least privilege** for database users
7. **Keep PostgreSQL updated** with security patches

## Production Deployment

1. Use connection pooling:
```typescript
{
  type: 'postgres',
  extra: {
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
}
```

2. Enable query logging for debugging:
```env
DB_LOGGING=true
```

3. Monitor database metrics:
- Connection count
- Query performance
- Disk usage
- Replication lag (if applicable)

4. Set up automated backups with retention policy

5. Configure read replicas for scaling read operations