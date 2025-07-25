#!/bin/bash

# Start Database Services Script
# This script starts PostgreSQL and Redis using Docker Compose

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Multi-Agent Orchestrator Database Services..."
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Navigate to project root
cd "$PROJECT_ROOT"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# Start PostgreSQL and Redis
echo "🗄️  Starting PostgreSQL and Redis..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo " ✅"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo " ✅"

echo ""
echo "✅ Database services are ready!"
echo ""
echo "📊 Service URLs:"
echo "  - PostgreSQL: postgresql://postgres:postgres@localhost:5432/coordinaitor"
echo "  - Redis: redis://:redis_password@localhost:6379"
echo ""
echo "🔧 Management Tools:"
echo "  - pgAdmin: http://localhost:5050 (admin@orchestrator.com / admin)"
echo ""
echo "📝 Default Users:"
echo "  - Admin: admin@orchestrator.com / admin123"
echo "  - Demo: demo@orchestrator.com / admin123"
echo "  - Viewer: viewer@orchestrator.com / admin123"
echo ""
echo "💡 To stop services: docker-compose -f docker-compose.dev.yml down"
echo "💡 To view logs: docker-compose -f docker-compose.dev.yml logs -f [service]"
echo ""

# Optionally start additional services
read -p "Would you like to start additional services (pgAdmin, Mailhog, etc.)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting additional services..."
    docker-compose -f docker-compose.dev.yml up -d pgadmin mailhog
    echo ""
    echo "📊 Additional Service URLs:"
    echo "  - pgAdmin: http://localhost:5050"
    echo "  - Mailhog: http://localhost:8025"
fi

echo ""
echo "✨ All done! Your database environment is ready for development."