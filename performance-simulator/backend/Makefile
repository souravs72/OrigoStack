# Performance Simulator Backend Makefile

.PHONY: help build test lint format clean run docker-build docker-run

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Build
build: ## Build the application
	@echo "Building performance simulator backend..."
	go build -o bin/simulator cmd/main.go

# Test
test: ## Run tests
	@echo "Running tests..."
	go test ./... -v

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	go test ./... -race -cover -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	go test ./... -tags=integration -v

# Linting and formatting
lint: ## Run linter
	@echo "Running linter..."
	golangci-lint run ./...

format: ## Format code
	@echo "Formatting code..."
	gofmt -w .
	goimports -w .

# Quality checks
quality: format lint test ## Run all quality checks

# Clean
clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf bin/
	rm -f coverage.out coverage.html
	rm -f *.db

# Run
run: ## Run the application
	@echo "Starting performance simulator backend..."
	go run cmd/main.go

run-dev: ## Run in development mode with auto-reload
	@echo "Starting in development mode..."
	air -c .air.toml

# Docker
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t origo-performance-simulator-backend .

docker-run: ## Run Docker container
	@echo "Running Docker container..."
	docker run -p 8080:8080 origo-performance-simulator-backend

# Dependencies
deps: ## Download dependencies
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

deps-update: ## Update dependencies
	@echo "Updating dependencies..."
	go get -u ./...
	go mod tidy

# Database
migrate: ## Run database migrations (placeholder)
	@echo "Running database migrations..."
	# Add migration commands here

# Local development
setup-local: deps ## Setup local development environment
	@echo "Setting up local development environment..."
	@if ! command -v golangci-lint > /dev/null; then \
		echo "Installing golangci-lint..."; \
		go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; \
	fi
	@if ! command -v air > /dev/null; then \
		echo "Installing air for hot reload..."; \
		go install github.com/cosmtrek/air@latest; \
	fi
	@echo "Local development environment ready!"

# Install tools
install-tools: ## Install development tools
	@echo "Installing development tools..."
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/cosmtrek/air@latest
	go install golang.org/x/tools/cmd/goimports@latest
