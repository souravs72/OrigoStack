#!/bin/bash

# Origo Stack - Start All Services Script
# This script starts all microservices for local development

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

# Load environment variables
if [ -f .env.local ]; then
    source .env.local
    log_info "Loaded environment variables from .env.local"
else
    log_warning ".env.local not found. Using default values."
fi

# Default ports if not set
AUTH_SERVICE_PORT=${AUTH_SERVICE_PORT:-8081}
CONTROL_PLANE_PORT=${CONTROL_PLANE_PORT:-8082}
SIGNALING_SERVICE_PORT=${SIGNALING_SERVICE_PORT:-8083}
RECORDING_SERVICE_PORT=${RECORDING_SERVICE_PORT:-8084}
CHAT_SERVICE_PORT=${CHAT_SERVICE_PORT:-8085}
NOTIFICATION_SERVICE_PORT=${NOTIFICATION_SERVICE_PORT:-8086}
BILLING_SERVICE_PORT=${BILLING_SERVICE_PORT:-8087}
WEB_CLIENT_PORT=${WEB_CLIENT_PORT:-3001}
ADMIN_DASHBOARD_PORT=${ADMIN_DASHBOARD_PORT:-3002}

# PID file directory
PIDS_DIR="./tmp/pids"
mkdir -p "$PIDS_DIR"

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local start_command=$3
    local port=$4
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    log_info "Starting $service_name on port $port..."
    
    # Check if already running
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        log_warning "$service_name is already running (PID: $(cat "$pid_file"))"
        return 0
    fi
    
    # Change to service directory
    if [ ! -d "$service_dir" ]; then
        log_error "Service directory $service_dir does not exist"
        return 1
    fi
    
    cd "$service_dir"
    
    # Start the service in background
    nohup bash -c "$start_command" > "../../logs/$service_name.log" 2>&1 &
    local pid=$!
    
    # Save PID
    echo $pid > "../../$pid_file"
    
    # Return to root directory
    cd - > /dev/null
    
    # Wait a moment and check if process is still running
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        log_success "$service_name started successfully (PID: $pid)"
    else
        log_error "$service_name failed to start"
        return 1
    fi
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_error "Port $port is already in use"
        return 1
    fi
    return 0
}

# Create logs directory
mkdir -p logs

# Check infrastructure services
log_info "Checking infrastructure services..."

if ! docker compose -f docker-compose.local.yml ps | grep -q "Up"; then
    log_error "Infrastructure services are not running. Please run:"
    echo "  docker compose -f docker-compose.local.yml up -d"
    exit 1
fi

log_success "Infrastructure services are running"

# Start Auth Service (Spring Boot)
if [ -d "services/auth-service" ]; then
    if check_port $AUTH_SERVICE_PORT; then
        start_service "auth-service" "services/auth-service" \
            "mvn spring-boot:run -Dspring-boot.run.profiles=local -Dserver.port=$AUTH_SERVICE_PORT" \
            $AUTH_SERVICE_PORT
    fi
fi

# Start Billing Service (Spring Boot)
if [ -d "services/billing-service" ]; then
    if check_port $BILLING_SERVICE_PORT; then
        start_service "billing-service" "services/billing-service" \
            "mvn spring-boot:run -Dspring-boot.run.profiles=local -Dserver.port=$BILLING_SERVICE_PORT" \
            $BILLING_SERVICE_PORT
    fi
fi

# Start Control Plane (Go)
if [ -d "services/control-plane" ]; then
    if check_port $CONTROL_PLANE_PORT; then
        start_service "control-plane" "services/control-plane" \
            "go run cmd/main.go" \
            $CONTROL_PLANE_PORT
    fi
fi

# Start Chat Service (Go)
if [ -d "services/chat-service" ]; then
    if check_port $CHAT_SERVICE_PORT; then
        start_service "chat-service" "services/chat-service" \
            "go run cmd/main.go" \
            $CHAT_SERVICE_PORT
    fi
fi

# Start Recording Service (Go)
if [ -d "services/recording-service" ]; then
    if check_port $RECORDING_SERVICE_PORT; then
        start_service "recording-service" "services/recording-service" \
            "go run cmd/main.go" \
            $RECORDING_SERVICE_PORT
    fi
fi

# Start Notification Service (Python)
if [ -d "services/notification-service" ]; then
    if check_port $NOTIFICATION_SERVICE_PORT; then
        start_service "notification-service" "services/notification-service" \
            "source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port $NOTIFICATION_SERVICE_PORT --reload" \
            $NOTIFICATION_SERVICE_PORT
    fi
fi

# Start Signaling Service (Node.js)
if [ -d "services/signaling-service" ]; then
    if check_port $SIGNALING_SERVICE_PORT; then
        start_service "signaling-service" "services/signaling-service" \
            "npm run dev" \
            $SIGNALING_SERVICE_PORT
    fi
fi

# Start SFU Workers (mediasoup/Node.js)
SFU_WORKER_PORT_START=${SFU_WORKER_PORT_START:-8088}
SFU_WORKER_COUNT=${SFU_WORKER_COUNT:-3}

if [ -d "services/sfu-cluster" ]; then
    for ((i=0; i<SFU_WORKER_COUNT; i++)); do
        local sfu_port=$((SFU_WORKER_PORT_START + i))
        if check_port $sfu_port; then
            start_service "sfu-worker-$i" "services/sfu-cluster" \
                "WORKER_ID=$i WORKER_PORT=$sfu_port npm run dev" \
                $sfu_port
        fi
    done
fi

# Start Web Client (React)
if [ -d "frontend/web-client" ]; then
    if check_port $WEB_CLIENT_PORT; then
        start_service "web-client" "frontend/web-client" \
            "PORT=$WEB_CLIENT_PORT npm start" \
            $WEB_CLIENT_PORT
    fi
fi

# Start Admin Dashboard (React)
if [ -d "frontend/admin-dashboard" ]; then
    if check_port $ADMIN_DASHBOARD_PORT; then
        start_service "admin-dashboard" "frontend/admin-dashboard" \
            "PORT=$ADMIN_DASHBOARD_PORT npm start" \
            $ADMIN_DASHBOARD_PORT
    fi
fi

# Wait for all services to start
log_info "Waiting for all services to start..."
sleep 5

# Health check function
health_check() {
    local service_name=$1
    local url=$2
    
    if curl -f -s "$url" > /dev/null 2>&1; then
        log_success "$service_name is healthy"
        return 0
    else
        log_warning "$service_name health check failed"
        return 1
    fi
}

# Perform health checks
log_info "Performing health checks..."

health_check "Auth Service" "http://localhost:$AUTH_SERVICE_PORT/actuator/health"
health_check "Control Plane" "http://localhost:$CONTROL_PLANE_PORT/health"
health_check "Signaling Service" "http://localhost:$SIGNALING_SERVICE_PORT/health"
health_check "Recording Service" "http://localhost:$RECORDING_SERVICE_PORT/health"
health_check "Chat Service" "http://localhost:$CHAT_SERVICE_PORT/health"
health_check "Notification Service" "http://localhost:$NOTIFICATION_SERVICE_PORT/health"
health_check "Billing Service" "http://localhost:$BILLING_SERVICE_PORT/actuator/health"

echo
log_success "All services started successfully!"
echo
log_info "Service URLs:"
echo "  Auth Service:         http://localhost:$AUTH_SERVICE_PORT"
echo "  Control Plane:        http://localhost:$CONTROL_PLANE_PORT"
echo "  Signaling Service:    http://localhost:$SIGNALING_SERVICE_PORT"
echo "  Recording Service:    http://localhost:$RECORDING_SERVICE_PORT"
echo "  Chat Service:         http://localhost:$CHAT_SERVICE_PORT"
echo "  Notification Service: http://localhost:$NOTIFICATION_SERVICE_PORT"
echo "  Billing Service:      http://localhost:$BILLING_SERVICE_PORT"
echo "  Web Client:           http://localhost:$WEB_CLIENT_PORT"
echo "  Admin Dashboard:      http://localhost:$ADMIN_DASHBOARD_PORT"
echo
log_info "Infrastructure URLs:"
echo "  Prometheus:           http://localhost:9090"
echo "  Grafana:              http://localhost:3000 (admin/admin)"
echo "  Jaeger:               http://localhost:16686"
echo "  MailHog:              http://localhost:8025"
echo "  MinIO:                http://localhost:9001 (minioadmin/minioadmin)"
echo
log_info "To stop all services: ./scripts/development/stop-all.sh"
log_info "To view logs: tail -f logs/<service-name>.log"
echo
log_info "Development environment is ready!"
