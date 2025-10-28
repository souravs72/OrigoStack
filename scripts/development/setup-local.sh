#!/bin/bash

# Origo Stack Local Development Setup Script
# This script sets up the local development environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists docker; then
        missing_tools+=("docker")
    fi
    
    if ! docker compose version >/dev/null 2>&1; then
        missing_tools+=("docker-compose")
    fi
    
    if ! command_exists node; then
        missing_tools+=("node")
    fi
    
    if ! command_exists npm; then
        missing_tools+=("npm")
    fi
    
    if ! command_exists java; then
        missing_tools+=("java")
    fi
    
    if ! command_exists mvn; then
        missing_tools+=("maven")
    fi
    
    if ! command_exists go; then
        missing_tools+=("go")
    fi
    
    if ! command_exists python3; then
        missing_tools+=("python3")
    fi
    
    if ! command_exists pip3; then
        missing_tools+=("pip3")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        echo
        log_info "Please install the missing tools and run this script again."
        echo
        log_info "Installation commands:"
        echo "  - Docker: https://docs.docker.com/get-docker/"
        echo "  - Node.js: https://nodejs.org/ (or use nvm)"
        echo "  - Java 17: https://adoptium.net/"
        echo "  - Maven: https://maven.apache.org/install.html"
        echo "  - Go: https://golang.org/dl/"
        echo "  - Python 3: https://www.python.org/downloads/"
        exit 1
    fi
    
    log_success "All prerequisites are installed"
}

# Setup environment variables
setup_environment() {
    log_info "Setting up environment variables..."
    
    if [ ! -f .env.local ]; then
        log_info "Creating .env.local file..."
        cat > .env.local << EOF
# Origo Stack Local Development Environment

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=origo_stack
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/origo_stack

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# NATS Configuration
NATS_URL=nats://localhost:4222

# Object Storage (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=origo-stack-local

# TURN/STUN Server
TURN_SERVER=turn:localhost:3478
TURN_USERNAME=origo
TURN_PASSWORD=origo123

# JWT Configuration
JWT_SECRET=your-256-bit-secret-key-for-local-development-only
JWT_EXPIRATION=3600

# Service Ports
AUTH_SERVICE_PORT=8081
CONTROL_PLANE_PORT=8082
SIGNALING_SERVICE_PORT=8083
RECORDING_SERVICE_PORT=8084
CHAT_SERVICE_PORT=8085
NOTIFICATION_SERVICE_PORT=8086
BILLING_SERVICE_PORT=8087

# SFU Configuration
SFU_WORKER_PORT_START=8088
SFU_WORKER_COUNT=3

# Frontend Configuration
WEB_CLIENT_PORT=3001
ADMIN_DASHBOARD_PORT=3002

# Monitoring
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3000
JAEGER_URL=http://localhost:16686

# Development Settings
NODE_ENV=development
SPRING_PROFILES_ACTIVE=local
GO_ENV=development
PYTHON_ENV=development

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Email (MailHog for testing)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@origo.local

# Feature Flags
ENABLE_RECORDING=true
ENABLE_CHAT=true
ENABLE_NOTIFICATIONS=true
ENABLE_BILLING=true
EOF
        log_success "Created .env.local file"
    else
        log_info ".env.local already exists, skipping..."
    fi
}

# Start infrastructure services
start_infrastructure() {
    log_info "Starting infrastructure services..."
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    log_info "Starting infrastructure with docker compose..."
    docker compose -f docker-compose.local.yml up -d
    
    log_info "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    timeout 60 bash -c '
        until docker compose -f docker-compose.local.yml exec -T postgres pg_isready -U postgres; do
            sleep 2
        done
    ' || {
        log_error "PostgreSQL failed to start"
        exit 1
    }
    
    # Wait for Redis
    log_info "Waiting for Redis..."
    timeout 30 bash -c '
        until docker compose -f docker-compose.local.yml exec -T redis redis-cli ping | grep -q PONG; do
            sleep 2
        done
    ' || {
        log_error "Redis failed to start"
        exit 1
    }
    
    log_success "Infrastructure services are ready"
}

# Setup databases
setup_databases() {
    log_info "Setting up databases..."
    
    # Run database migrations
    if [ -f scripts/database/init.sql ]; then
        log_info "Running database initialization..."
        docker compose -f docker-compose.local.yml exec -T postgres psql -U postgres -d origo_stack -f /docker-entrypoint-initdb.d/init.sql
    fi
    
    # Create MinIO buckets
    log_info "Setting up MinIO buckets..."
    # Install mc client and create bucket
    docker compose -f docker-compose.local.yml exec -T minio sh -c "
        if ! command -v mc >/dev/null 2>&1; then
            curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
            chmod +x mc
            mv mc /usr/local/bin/
        fi
        mc alias set local http://localhost:9000 minioadmin minioadmin
        mc mb local/origo-stack-local --ignore-existing
    " || log_warning "MinIO bucket setup failed, but MinIO is running"
    
    log_success "Databases setup completed"
}

# Install dependencies for all services
install_dependencies() {
    log_info "Installing dependencies for all services..."
    
    # Java services
    for service in services/auth-service services/billing-service; do
        if [ -d "$service" ] && [ -f "$service/pom.xml" ]; then
            log_info "Installing dependencies for $service..."
            (cd "$service" && mvn dependency:resolve)
        fi
    done
    
    # Go services
    for service in services/control-plane services/chat-service services/recording-service; do
        if [ -d "$service" ] && [ -f "$service/go.mod" ]; then
            log_info "Installing dependencies for $service..."
            (cd "$service" && go mod download)
        fi
    done
    
    # Python services
    for service in services/notification-service; do
        if [ -d "$service" ] && [ -f "$service/requirements.txt" ]; then
            log_info "Installing dependencies for $service..."
            (cd "$service" && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt)
        fi
    done
    
    # Node.js services
    for service in services/signaling-service frontend/web-client frontend/admin-dashboard; do
        if [ -d "$service" ] && [ -f "$service/package.json" ]; then
            log_info "Installing dependencies for $service..."
            (cd "$service" && npm install)
        fi
    done
    
    # E2E tests
    if [ -d "tests/e2e" ] && [ -f "tests/e2e/package.json" ]; then
        log_info "Installing E2E test dependencies..."
        (cd tests/e2e && npm install && npx playwright install)
    fi
    
    log_success "All dependencies installed"
}

# Create VS Code workspace configuration
setup_vscode() {
    log_info "Setting up VS Code workspace..."
    
    if [ ! -f .vscode/settings.json ]; then
        mkdir -p .vscode
        cat > .vscode/settings.json << 'EOF'
{
    "go.gopath": "",
    "go.goroot": "",
    "java.configuration.updateBuildConfiguration": "automatic",
    "java.compile.nullAnalysis.mode": "automatic",
    "python.defaultInterpreterPath": "./services/notification-service/venv/bin/python",
    "typescript.preferences.importModuleSpecifier": "relative",
    "eslint.workingDirectories": [
        "services/signaling-service",
        "frontend/web-client",
        "frontend/admin-dashboard",
        "tests/e2e"
    ],
    "files.exclude": {
        "**/node_modules": true,
        "**/target": true,
        "**/__pycache__": true,
        "**/venv": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/target": true,
        "**/__pycache__": true,
        "**/venv": true
    }
}
EOF
        log_success "Created VS Code settings"
    fi
    
    if [ ! -f .vscode/launch.json ]; then
        cat > .vscode/launch.json << 'EOF'
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Auth Service",
            "type": "java",
            "request": "launch",
            "mainClass": "com.origo.auth.AuthServiceApplication",
            "projectName": "auth-service",
            "env": {
                "SPRING_PROFILES_ACTIVE": "local"
            }
        },
        {
            "name": "Debug Control Plane",
            "type": "go",
            "request": "launch",
            "mode": "auto",
            "program": "${workspaceFolder}/services/control-plane/cmd/main.go",
            "env": {
                "GO_ENV": "development"
            }
        },
        {
            "name": "Debug Signaling Service",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/services/signaling-service/src/index.ts",
            "outFiles": ["${workspaceFolder}/services/signaling-service/dist/**/*.js"],
            "env": {
                "NODE_ENV": "development"
            }
        }
    ]
}
EOF
        log_success "Created VS Code launch configuration"
    fi
}

# Main setup function
main() {
    log_info "Starting Origo Stack local development setup..."
    echo
    
    check_prerequisites
    setup_environment
    start_infrastructure
    setup_databases
    install_dependencies
    setup_vscode
    
    echo
    log_success "Local development setup completed!"
    echo
    log_info "Next steps:"
    echo "  1. Source the environment variables: source .env.local"
    echo "  2. Start the services: ./scripts/development/start-all.sh"
    echo "  3. Open http://localhost:3001 for the web client"
    echo "  4. Open http://localhost:3000 for Grafana (admin/admin)"
    echo "  5. Open http://localhost:16686 for Jaeger"
    echo "  6. Open http://localhost:8025 for MailHog"
    echo
    log_info "For more information, see the README.md file."
}

# Run main function
main "$@"
