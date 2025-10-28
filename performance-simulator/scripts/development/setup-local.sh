#!/bin/bash

# Performance Simulator Local Development Setup
# This script sets up the local development environment for the Origo Performance Simulator

set -e

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

    if ! command_exists docker-compose; then
        missing_tools+=("docker-compose")
    fi

    if ! command_exists go; then
        missing_tools+=("go")
    fi

    if ! command_exists node; then
        missing_tools+=("node")
    fi

    if ! command_exists npm; then
        missing_tools+=("npm")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and run this script again."
        log_info "Installation guides:"
        log_info "- Docker: https://docs.docker.com/get-docker/"
        log_info "- Go: https://golang.org/doc/install"
        log_info "- Node.js: https://nodejs.org/en/download/"
        exit 1
    fi

    log_success "All prerequisites are installed"
}

# Install Go dependencies and tools
setup_go_backend() {
    log_info "Setting up Go backend..."

    cd backend

    # Download dependencies
    log_info "Downloading Go dependencies..."
    go mod download

    # Install development tools
    log_info "Installing Go development tools..."
    
    if ! command_exists golangci-lint; then
        log_info "Installing golangci-lint..."
        go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
    fi

    if ! command_exists air; then
        log_info "Installing air for hot reload..."
        go install github.com/cosmtrek/air@latest
    fi

    # Run setup tasks
    log_info "Running Go setup tasks..."
    make setup-local

    cd ..
    log_success "Go backend setup complete"
}

# Install Node.js dependencies
setup_node_frontend() {
    log_info "Setting up Node.js frontend..."

    cd frontend

    # Install dependencies
    log_info "Installing npm dependencies..."
    npm ci

    # Run linting and formatting checks
    log_info "Running code quality checks..."
    npm run lint
    npm run format:check

    cd ..
    log_success "Node.js frontend setup complete"
}

# Setup Docker environment
setup_docker() {
    log_info "Setting up Docker environment..."

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi

    # Create Docker network if it doesn't exist
    if ! docker network ls | grep -q "origo-simulator-network"; then
        log_info "Creating Docker network..."
        docker network create origo-simulator-network
    fi

    # Pull required images
    log_info "Pulling required Docker images..."
    docker-compose -f docker-compose.local.yml pull redis postgres prometheus grafana jaeger

    log_success "Docker environment setup complete"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."

    mkdir -p data
    mkdir -p logs
    mkdir -p results

    log_success "Directories created"
}

# Setup monitoring configuration
setup_monitoring() {
    log_info "Setting up monitoring configuration..."

    # Create monitoring directories if they don't exist
    mkdir -p monitoring/{prometheus,grafana/provisioning/{dashboards,datasources}}

    # Create basic Prometheus config if it doesn't exist
    if [ ! -f monitoring/prometheus/prometheus.local.yml ]; then
        log_info "Creating Prometheus configuration..."
        cat > monitoring/prometheus/prometheus.local.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'performance-simulator'
    static_configs:
      - targets: ['simulator-backend:8080']
    scrape_interval: 5s
    metrics_path: '/metrics'

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
    fi

    log_success "Monitoring configuration setup complete"
}

# Main setup function
main() {
    log_info "Starting Origo Performance Simulator local development setup..."

    check_prerequisites
    create_directories
    setup_docker
    setup_monitoring
    setup_go_backend
    setup_node_frontend

    log_success "Local development environment setup complete!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Start the environment: ./scripts/development/start-all.sh"
    log_info "2. Access the frontend: http://localhost:3000"
    log_info "3. Access the backend API: http://localhost:8080"
    log_info "4. Access Grafana: http://localhost:3001 (admin/admin)"
    log_info "5. Access Prometheus: http://localhost:9090"
    log_info "6. Access Jaeger: http://localhost:16686"
    log_info ""
    log_info "For development:"
    log_info "- Backend hot reload: make run-dev (in backend directory)"
    log_info "- Frontend hot reload: npm start (in frontend directory)"
}

# Run main function
main "$@"
