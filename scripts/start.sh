#!/bin/bash

echo "Starting Multi-Agent Orchestrator..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please edit .env file with your API keys before continuing."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create logs directory
mkdir -p logs

# Start services based on argument
case "$1" in
    "docker")
        echo "Starting with Docker Compose..."
        docker-compose up -d
        ;;
    "k8s")
        echo "Starting with Kubernetes..."
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        kubectl apply -f k8s/secret.yaml
        kubectl apply -f k8s/redis.yaml
        kubectl apply -f k8s/postgres.yaml
        kubectl apply -f k8s/orchestrator.yaml
        kubectl apply -f k8s/agents.yaml
        ;;
    "dev")
        echo "Starting in development mode..."
        npm run dev
        ;;
    *)
        echo "Starting in production mode..."
        npm run build
        npm start
        ;;
esac