#!/bin/bash

# Multi-Agent Orchestrator Test Runner
# This script runs all tests for the system

set -e

echo "=================================="
echo "Multi-Agent Orchestrator Test Suite"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests with timing
run_test_suite() {
    local suite_name=$1
    local command=$2
    
    echo -e "${YELLOW}Running $suite_name...${NC}"
    start_time=$(date +%s)
    
    if eval $command; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "${GREEN}✓ $suite_name passed (${duration}s)${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track failures
failed_suites=()

# Backend Tests
echo "1. Backend Tests"
echo "----------------"

# Unit tests
if ! run_test_suite "Backend Unit Tests" "npm run test:unit"; then
    failed_suites+=("Backend Unit Tests")
fi

# Integration tests (requires services to be running)
if [ "$SKIP_INTEGRATION" != "true" ]; then
    if ! run_test_suite "Backend Integration Tests" "npm run test:integration"; then
        failed_suites+=("Backend Integration Tests")
    fi
else
    echo -e "${YELLOW}Skipping integration tests (SKIP_INTEGRATION=true)${NC}"
fi

# Frontend Tests
echo ""
echo "2. Frontend Tests"
echo "-----------------"

cd web

# Puppeteer tests
if [ "$SKIP_E2E" != "true" ]; then
    # Start dev server in background
    echo "Starting frontend dev server..."
    npm run dev &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to be ready..."
    sleep 5
    
    # Run Puppeteer tests
    if ! run_test_suite "Puppeteer E2E Tests" "npm run test:puppeteer"; then
        failed_suites+=("Puppeteer E2E Tests")
    fi
    
    # Run Playwright tests
    if ! run_test_suite "Playwright E2E Tests" "npm run test:playwright"; then
        failed_suites+=("Playwright E2E Tests")
    fi
    
    # Kill dev server
    kill $DEV_SERVER_PID
else
    echo -e "${YELLOW}Skipping E2E tests (SKIP_E2E=true)${NC}"
fi

cd ..

# Type Checking
echo ""
echo "3. Type Checking"
echo "----------------"

if ! run_test_suite "Backend TypeScript" "npm run typecheck"; then
    failed_suites+=("Backend TypeScript")
fi

cd web
if ! run_test_suite "Frontend TypeScript" "npm run typecheck"; then
    failed_suites+=("Frontend TypeScript")
fi
cd ..

cd vscode-extension
if ! run_test_suite "VS Code Extension TypeScript" "npm run compile"; then
    failed_suites+=("VS Code Extension TypeScript")
fi
cd ..

# Linting
echo ""
echo "4. Linting"
echo "----------"

if ! run_test_suite "Backend ESLint" "npm run lint"; then
    failed_suites+=("Backend ESLint")
fi

cd web
if ! run_test_suite "Frontend ESLint" "npm run lint"; then
    failed_suites+=("Frontend ESLint")
fi
cd ..

# Test Coverage Report
echo ""
echo "5. Test Coverage"
echo "----------------"

if [ "$COVERAGE" == "true" ]; then
    run_test_suite "Coverage Report" "npm run test:coverage"
    
    # Display coverage summary
    if [ -f "coverage/lcov-report/index.html" ]; then
        echo ""
        echo "Coverage report generated at: coverage/lcov-report/index.html"
        
        # Extract coverage percentages
        if command -v grep &> /dev/null && command -v awk &> /dev/null; then
            echo ""
            echo "Coverage Summary:"
            cat coverage/lcov.info | grep -A1 "^SF:" | grep "^DA:" | awk -F, '{print $2}' | \
                awk '{s+=$1; t++} END {printf "Lines: %.1f%%\n", (s/t)*100}'
        fi
    fi
else
    echo -e "${YELLOW}Skipping coverage report (COVERAGE not set)${NC}"
fi

# Summary
echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="

if [ ${#failed_suites[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ ${#failed_suites[@]} test suite(s) failed:${NC}"
    for suite in "${failed_suites[@]}"; do
        echo -e "${RED}  - $suite${NC}"
    done
    exit 1
fi