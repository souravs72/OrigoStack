#!/bin/bash

# Performance Simulator - Stop All Services
# This script stops all services and cleans up the development environment

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

# Parse command line arguments
CLEAN_VOLUMES=false
CLEAN_IMAGES=false
FORCE_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean-volumes)
            CLEAN_VOLUMES=true
            shift
            ;;
        --clean-images)
            CLEAN_IMAGES=true
            shift
            ;;
        --force)
            FORCE_CLEANUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean-volumes    Remove Docker volumes (will delete all data)"
            echo "  --clean-images     Remove Docker images"
            echo "  --force           Force cleanup without confirmation"
            echo "  --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                          # Stop services only"
            echo "  $0 --clean-volumes         # Stop services and remove volumes"
            echo "  $0 --clean-images          # Stop services and remove images"
            echo "  $0 --clean-volumes --force # Force cleanup with volumes"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            log_info "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Confirm destructive operations
confirm_cleanup() {
    if [ "$FORCE_CLEANUP" = true ]; then
        return 0
    fi

    if [ "$CLEAN_VOLUMES" = true ] || [ "$CLEAN_IMAGES" = true ]; then
        log_warning "⚠️  DESTRUCTIVE OPERATION WARNING ⚠️"
        log_warning ""
        
        if [ "$CLEAN_VOLUMES" = true ]; then
            log_warning "This will DELETE ALL DATA including:"
            log_warning "• Database data (PostgreSQL)"
            log_warning "• Cache data (Redis)"
            log_warning "• Monitoring data (Prometheus, Grafana)"
            log_warning "• Application data and logs"
        fi
        
        if [ "$CLEAN_IMAGES" = true ]; then
            log_warning "This will REMOVE DOCKER IMAGES"
            log_warning "• All performance simulator images"
            log_warning "• Downloaded base images"
        fi
        
        log_warning ""
        echo -n "Are you sure you want to continue? (type 'yes' to confirm): "
        read -r confirmation
        
        if [ "$confirmation" != "yes" ]; then
            log_info "Operation cancelled"
            exit 0
        fi
    fi
}

# Stop services gracefully
stop_services() {
    log_info "Stopping Performance Simulator services..."
    
    if [ -f docker-compose.local.yml ]; then
        # Stop services in reverse order
        log_info "Stopping application services..."
        docker-compose -f docker-compose.local.yml stop simulator-frontend simulator-backend || true
        
        log_info "Stopping infrastructure services..."
        docker-compose -f docker-compose.local.yml stop redis postgres prometheus grafana jaeger || true
        
        # Remove containers
        log_info "Removing containers..."
        docker-compose -f docker-compose.local.yml down --remove-orphans
        
        log_success "Services stopped successfully"
    else
        log_warning "docker-compose.local.yml not found. Attempting to stop containers manually..."
        
        # Stop containers by name pattern
        CONTAINERS=$(docker ps -a --filter "name=performance-simulator" --format "{{.Names}}" | head -20)
        
        if [ -n "$CONTAINERS" ]; then
            log_info "Stopping containers: $CONTAINERS"
            echo "$CONTAINERS" | xargs docker stop || true
            echo "$CONTAINERS" | xargs docker rm || true
        else
            log_info "No performance simulator containers found"
        fi
    fi
}

# Clean up volumes
clean_volumes() {
    if [ "$CLEAN_VOLUMES" = true ]; then
        log_info "Removing Docker volumes..."
        
        # Remove named volumes
        VOLUMES=$(docker volume ls --filter "name=origo-" --format "{{.Name}}")
        
        if [ -n "$VOLUMES" ]; then
            log_info "Removing volumes: $VOLUMES"
            echo "$VOLUMES" | xargs docker volume rm -f || true
        else
            log_info "No performance simulator volumes found"
        fi
        
        # Remove compose volumes if docker-compose file exists
        if [ -f docker-compose.local.yml ]; then
            docker-compose -f docker-compose.local.yml down -v --remove-orphans || true
        fi
        
        log_success "Volumes cleaned up"
    fi
}

# Clean up images
clean_images() {
    if [ "$CLEAN_IMAGES" = true ]; then
        log_info "Removing Docker images..."
        
        # Remove performance simulator images
        IMAGES=$(docker images --filter "reference=*performance-simulator*" --format "{{.Repository}}:{{.Tag}}")
        
        if [ -n "$IMAGES" ]; then
            log_info "Removing images: $IMAGES"
            echo "$IMAGES" | xargs docker rmi -f || true
        else
            log_info "No performance simulator images found"
        fi
        
        # Clean up build cache
        log_info "Cleaning up build cache..."
        docker builder prune -f || true
        
        log_success "Images cleaned up"
    fi
}

# Clean up networks
clean_networks() {
    log_info "Cleaning up networks..."
    
    # Remove the simulator network if it exists and has no containers
    if docker network ls --filter "name=origo-simulator-network" --format "{{.Name}}" | grep -q "origo-simulator-network"; then
        log_info "Removing origo-simulator-network..."
        docker network rm origo-simulator-network 2>/dev/null || log_warning "Could not remove network (may have active containers)"
    fi
}

# Show cleanup summary
show_summary() {
    log_success "Cleanup completed!"
    log_info ""
    log_info "📊 Summary:"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "✅ Services stopped and containers removed"
    
    if [ "$CLEAN_VOLUMES" = true ]; then
        log_info "✅ Docker volumes removed (all data deleted)"
    else
        log_info "ℹ️  Docker volumes preserved (data retained)"
    fi
    
    if [ "$CLEAN_IMAGES" = true ]; then
        log_info "✅ Docker images removed"
    else
        log_info "ℹ️  Docker images preserved"
    fi
    
    log_info "✅ Cleanup networks"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info ""
    log_info "💡 Next steps:"
    log_info "• Restart environment: ./scripts/development/start-all.sh"
    log_info "• View remaining containers: docker ps -a"
    log_info "• View remaining volumes: docker volume ls"
    log_info "• View remaining images: docker images"
    
    if [ "$CLEAN_VOLUMES" = true ]; then
        log_warning ""
        log_warning "⚠️  All data has been deleted. Next start will initialize fresh databases."
    fi
}

# Main function
main() {
    log_info "Stopping Origo Performance Simulator development environment..."
    
    confirm_cleanup
    stop_services
    clean_volumes
    clean_images
    clean_networks
    show_summary
}

# Handle script interruption
cleanup() {
    log_warning "Script interrupted. Some cleanup may be incomplete."
    log_info "Run the script again to complete cleanup."
    exit 1
}

# Set up signal handlers
trap cleanup INT TERM

# Run main function
main "$@"
