#!/bin/bash

# Origo Stack - Stop All Services Script
# This script stops all running microservices

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

# PID file directory
PIDS_DIR="./tmp/pids"

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    if [ ! -f "$pid_file" ]; then
        log_warning "$service_name PID file not found, service may not be running"
        return 0
    fi
    
    local pid=$(cat "$pid_file")
    
    if ! kill -0 "$pid" 2>/dev/null; then
        log_warning "$service_name (PID: $pid) is not running"
        rm -f "$pid_file"
        return 0
    fi
    
    log_info "Stopping $service_name (PID: $pid)..."
    
    # Try graceful shutdown first
    if kill -TERM "$pid" 2>/dev/null; then
        # Wait up to 10 seconds for graceful shutdown
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # If still running, force kill
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "$service_name didn't stop gracefully, force killing..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
    
    # Clean up PID file
    rm -f "$pid_file"
    log_success "$service_name stopped"
}

# Function to stop all services by pattern
stop_services_by_pattern() {
    local pattern=$1
    local description=$2
    
    log_info "Stopping $description..."
    
    # Find all matching PID files
    if [ -d "$PIDS_DIR" ]; then
        for pid_file in "$PIDS_DIR"/$pattern.pid; do
            if [ -f "$pid_file" ]; then
                local service_name=$(basename "$pid_file" .pid)
                stop_service "$service_name"
            fi
        done
    fi
}

# Main stop function
main() {
    log_info "Stopping all Origo Stack services..."
    echo
    
    # Stop individual services
    stop_service "auth-service"
    stop_service "billing-service" 
    stop_service "control-plane"
    stop_service "chat-service"
    stop_service "recording-service"
    stop_service "notification-service"
    stop_service "signaling-service"
    
    # Stop SFU workers
    stop_services_by_pattern "sfu-worker-*" "SFU workers"
    
    # Stop frontend services
    stop_service "web-client"
    stop_service "admin-dashboard"
    
    # Stop any remaining services
    if [ -d "$PIDS_DIR" ]; then
        for pid_file in "$PIDS_DIR"/*.pid; do
            if [ -f "$pid_file" ]; then
                local service_name=$(basename "$pid_file" .pid)
                stop_service "$service_name"
            fi
        done
    fi
    
    # Clean up PID directory if empty
    if [ -d "$PIDS_DIR" ] && [ -z "$(ls -A "$PIDS_DIR")" ]; then
        rmdir "$PIDS_DIR"
    fi
    
    # Option to stop infrastructure services
    read -p "Do you want to stop infrastructure services (Docker containers)? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Stopping infrastructure services..."
        docker compose -f docker-compose.local.yml down
        log_success "Infrastructure services stopped"
    fi
    
    echo
    log_success "All services stopped!"
    echo
    log_info "To start services again: ./scripts/development/start-all.sh"
}

# Handle script arguments
case "${1:-}" in
    --infrastructure-only)
        log_info "Stopping infrastructure services only..."
        docker compose -f docker-compose.local.yml down
        log_success "Infrastructure services stopped"
        exit 0
        ;;
    --services-only)
        log_info "Stopping application services only..."
        # Run main function but skip infrastructure prompt
        log_info "Stopping all Origo Stack services..."
        echo
        
        stop_service "auth-service"
        stop_service "billing-service" 
        stop_service "control-plane"
        stop_service "chat-service"
        stop_service "recording-service"
        stop_service "notification-service"
        stop_service "signaling-service"
        stop_services_by_pattern "sfu-worker-*" "SFU workers"
        stop_service "web-client"
        stop_service "admin-dashboard"
        
        if [ -d "$PIDS_DIR" ]; then
            for pid_file in "$PIDS_DIR"/*.pid; do
                if [ -f "$pid_file" ]; then
                    local service_name=$(basename "$pid_file" .pid)
                    stop_service "$service_name"
                fi
            done
        fi
        
        if [ -d "$PIDS_DIR" ] && [ -z "$(ls -A "$PIDS_DIR")" ]; then
            rmdir "$PIDS_DIR"
        fi
        
        log_success "Application services stopped!"
        exit 0
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --services-only       Stop only application services"
        echo "  --infrastructure-only Stop only infrastructure services (Docker)"
        echo "  --help, -h           Show this help message"
        echo
        echo "Default behavior stops all services and prompts for infrastructure."
        exit 0
        ;;
    "")
        # No arguments, run main function
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information."
        exit 1
        ;;
esac
