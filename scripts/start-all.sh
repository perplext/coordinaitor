#!/bin/bash

echo "Multi-Agent Orchestrator Startup Script"
echo "======================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please edit .env file with your API keys before continuing."
    exit 1
fi

# Parse command line arguments
MODE=${1:-"dev"}
UI=${2:-"web"}

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

if [ "$UI" = "web" ] && [ ! -d "web/node_modules" ]; then
    echo "Installing web UI dependencies..."
    cd web && npm install && cd ..
fi

# Create necessary directories
mkdir -p logs

case "$MODE" in
    "dev")
        echo "Starting in development mode with $UI interface..."
        if [ "$UI" = "web" ]; then
            # Start backend and web UI concurrently
            echo "Starting backend API..."
            npm run dev &
            BACKEND_PID=$!
            
            echo "Waiting for backend to start..."
            sleep 5
            
            echo "Starting web UI..."
            cd web && npm run dev &
            WEB_PID=$!
            
            echo ""
            echo "Services started:"
            echo "- Backend API: http://localhost:3000"
            echo "- Web UI: http://localhost:3001"
            echo "- MCP Server: ws://localhost:4000"
            echo ""
            echo "Press Ctrl+C to stop all services"
            
            # Wait for both processes
            wait $BACKEND_PID $WEB_PID
        else
            # CLI mode
            echo "Starting in CLI mode..."
            npm run dev
        fi
        ;;
        
    "production")
        echo "Starting in production mode..."
        
        # Build projects
        echo "Building backend..."
        npm run build
        
        if [ "$UI" = "web" ]; then
            echo "Building web UI..."
            cd web && npm run build && cd ..
        fi
        
        # Start production server
        NODE_ENV=production npm start
        ;;
        
    "docker")
        echo "Starting with Docker Compose..."
        docker-compose up -d
        
        echo ""
        echo "Services started:"
        echo "- Web UI: http://localhost"
        echo "- Backend API: http://localhost:3000"
        echo "- MCP Server: ws://localhost:4000"
        echo ""
        echo "Run 'docker-compose logs -f' to view logs"
        echo "Run 'docker-compose down' to stop all services"
        ;;
        
    "k8s")
        echo "Deploying to Kubernetes..."
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        echo "WARNING: Update k8s/secret.yaml with your API keys before applying!"
        kubectl apply -f k8s/secret.yaml
        kubectl apply -f k8s/redis.yaml
        kubectl apply -f k8s/postgres.yaml
        kubectl apply -f k8s/orchestrator.yaml
        kubectl apply -f k8s/agents.yaml
        
        echo ""
        echo "Deployment initiated. Check status with:"
        echo "kubectl get pods -n coordinaitor"
        ;;
        
    *)
        echo "Usage: $0 [mode] [ui]"
        echo ""
        echo "Modes:"
        echo "  dev         - Development mode (default)"
        echo "  production  - Production mode"
        echo "  docker      - Docker Compose"
        echo "  k8s         - Kubernetes"
        echo ""
        echo "UI Options:"
        echo "  web         - Web interface (default)"
        echo "  cli         - Command line interface only"
        echo ""
        echo "Examples:"
        echo "  $0                    # Start in dev mode with web UI"
        echo "  $0 dev cli            # Start in dev mode, CLI only"
        echo "  $0 production web     # Start in production with web UI"
        echo "  $0 docker             # Start with Docker Compose"
        exit 1
        ;;
esac