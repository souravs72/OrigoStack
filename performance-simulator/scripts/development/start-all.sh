#!/bin/bash

# Performance Simulator - Start All Services
# This script starts all services required for local development

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

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Start infrastructure services first
start_infrastructure() {
    log_info "Starting infrastructure services..."
    
    docker-compose -f docker-compose.local.yml up -d redis postgres prometheus grafana jaeger
    
    log_info "Waiting for infrastructure services to be ready..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    until docker-compose -f docker-compose.local.yml exec -T postgres pg_isready -U simulator_user -d performance_simulator >/dev/null 2>&1; do
        sleep 2
    done
    
    # Wait for Redis
    log_info "Waiting for Redis..."
    until docker-compose -f docker-compose.local.yml exec -T redis redis-cli ping >/dev/null 2>&1; do
        sleep 2
    done
    
    log_success "Infrastructure services are ready"
}

# Start application services
start_applications() {
    log_info "Starting application services..."
    
    # Start backend
    log_info "Starting backend service..."
    docker-compose -f docker-compose.local.yml up -d simulator-backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend service..."
    until curl -f http://localhost:8080/health >/dev/null 2>&1; do
        sleep 2
    done
    
    # Start frontend
    log_info "Starting frontend service..."
    docker-compose -f docker-compose.local.yml up -d simulator-frontend
    
    # Wait for frontend to be ready
    log_info "Waiting for frontend service..."
    until curl -f http://localhost:3000/health >/dev/null 2>&1; do
        sleep 2
    done
    
    log_success "Application services are ready"
}

# Show service status
show_status() {
    log_info "Service Status:"
    docker-compose -f docker-compose.local.yml ps
}

# Show access information
show_access_info() {
    log_success "All services are running!"
    log_info ""
    log_info "🚀 Access Information:"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "📊 Performance Simulator Dashboard: http://localhost:3000"
    log_info "🔧 Backend API:                     http://localhost:8080"
    log_info "📈 Grafana Dashboard:               http://localhost:3001 (admin/admin)"
    log_info "🎯 Prometheus Metrics:              http://localhost:9090"
    log_info "🔍 Jaeger Tracing:                  http://localhost:16686"
    log_info "📊 API Documentation:               http://localhost:8080/swagger-ui.html"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info ""
    log_info "💡 Development Tips:"
    log_info "• View logs: docker-compose -f docker-compose.local.yml logs -f"
    log_info "• Stop all: ./scripts/development/stop-all.sh"
    log_info "• Restart service: docker-compose -f docker-compose.local.yml restart <service>"
    log_info "• Backend hot reload: make run-dev (in backend directory)"
    log_info "• Frontend hot reload: npm start (in frontend directory)"
    log_info ""
    log_info "🐛 Troubleshooting:"
    log_info "• Check service health: docker-compose -f docker-compose.local.yml ps"
    log_info "• View service logs: docker-compose -f docker-compose.local.yml logs <service>"
    log_info "• Reset everything: ./scripts/development/stop-all.sh && docker system prune -f"
}

# Main function
main() {
    log_info "Starting Origo Performance Simulator development environment..."
    
    check_docker
    start_infrastructure
    start_applications
    show_status
    show_access_info
}

# Handle script interruption
cleanup() {
    log_warning "Script interrupted. Services may still be starting in the background."
    log_info "Run 'docker-compose -f docker-compose.local.yml ps' to check status"
    log_info "Run './scripts/development/stop-all.sh' to stop all services"
    exit 1
}

# Set up signal handlers
trap cleanup INT TERM

# Run main function
main "$@"
