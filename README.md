# Origo Stack 

## Overview

Origo Stack is a production-standard video conferencing platform built using microservices architecture. It provides scalable video calling, screen sharing, recording, and chat functionality similar to Zoom, designed for high availability and performance.

## Architecture

This platform consists of 16 core microservices built with Spring Boot, Go, Python (FastAPI), and JavaScript/TypeScript:

### Core Services

1. **Signaling Service** — WebSocket-based room lifecycle management, ICE/SDP handshake, token issuance
2. **SFU Cluster** — Media processing using mediasoup/Pion/Janus worker fleet
3. **TURN/STUN Service** — NAT traversal & relay using coturn
4. **Auth & Identity Service** — OAuth2/OIDC, JWT tokens, RBAC authorization
5. **Control Plane Service** — REST API for rooms, recordings, scheduling, billing
6. **Recording Service** — RTP capture, FFmpeg processing, S3-compatible storage
7. **Chat Service** — Low-latency messaging with presence (Redis/NATS backed)
8. **Notification Service** — Email, push notifications, SMS delivery
9. **Billing & Quota Service** — Usage metering and plan enforcement

### Client Applications

10. **Web Client** — React-based web application
11. **Mobile App** — Capacitor/Electron wrappers for native mobile/desktop
12. **Admin Dashboard** — Management UI for users, rooms, and billing

### Infrastructure Services

13. **API Gateway** — TLS termination, rate limiting (Traefik/Kong/Nginx)
14. **Storage & CDN** — Object storage and content delivery
15. **Observability Stack** — Prometheus, Grafana, Jaeger, Loki/ELK
16. **Security Services** — Secrets management, vulnerability scanning

## Directory Structure

```
origo_stack/
├── services/                 # Microservices
│   ├── signaling-service/    # WebSocket signaling
│   ├── sfu-cluster/         # Media processing
│   ├── turn-stun/           # NAT traversal
│   ├── auth-service/        # Authentication & authorization
│   ├── control-plane/       # REST API backend
│   ├── recording-service/   # Media recording
│   ├── chat-service/        # Real-time messaging
│   ├── notification-service/# Notifications
│   └── billing-service/     # Billing & quotas
├── frontend/                # Client applications
│   ├── web-client/          # React web app
│   ├── mobile-app/          # Mobile/desktop wrappers
│   └── admin-dashboard/     # Admin interface
├── infrastructure/          # Infrastructure as Code
│   ├── terraform/           # Cloud infrastructure
│   ├── helm/               # Kubernetes deployments
│   ├── kubernetes/         # K8s manifests
│   └── docker/             # Container configurations
├── docs/                   # Documentation
│   ├── architecture/       # System design docs
│   ├── api/               # API documentation
│   ├── runbooks/          # Operational procedures
│   └── playbooks/         # Incident response
├── scripts/                # Automation scripts
│   ├── deployment/        # Deployment automation
│   ├── development/       # Local dev setup
│   └── monitoring/        # Monitoring setup
├── config/                 # Environment configurations
│   ├── local/             # Local development
│   ├── staging/           # Staging environment
│   └── production/        # Production environment
├── tests/                  # Test suites
│   ├── e2e/              # End-to-end tests
│   ├── integration/       # Integration tests
│   └── performance/       # Performance tests
├── monitoring/             # Observability
│   ├── prometheus/        # Metrics collection
│   ├── grafana/          # Dashboards
│   ├── jaeger/           # Distributed tracing
│   └── alerting/         # Alert configurations
└── .github/               # CI/CD workflows
    └── workflows/         # GitHub Actions
```

## Technology Stack

- **Backend**: Spring Boot (Java), Go, Python (FastAPI)
- **Frontend**: React, TypeScript, Electron, Capacitor
- **Media**: mediasoup, Pion, Janus, coturn, FFmpeg
- **Databases**: PostgreSQL, Redis, InfluxDB
- **Message Queues**: NATS, Apache Kafka
- **Container Runtime**: Docker, Kubernetes
- **Infrastructure**: Terraform, Helm
- **Observability**: Prometheus, Grafana, Jaeger, Loki
- **CI/CD**: GitHub Actions, ArgoCD

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ and npm
- Java 17+ and Maven
- Go 1.21+
- Python 3.11+
- kubectl and Helm

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd origo_stack

# Start local infrastructure (Redis, PostgreSQL, etc.)
docker compose -f docker-compose.local.yml up -d

# Run setup script
./scripts/development/setup-local.sh

# Start all services
./scripts/development/start-all.sh
```

## Production Deployment

```bash
# Deploy to staging
helm upgrade --install origo-stack ./infrastructure/helm/origo-stack -f config/staging/values.yaml

# Run smoke tests
./scripts/deployment/smoke-tests.sh staging

# Deploy to production (canary)
./scripts/deployment/deploy-canary.sh production 5%
```

## Monitoring & Observability

- **Metrics**: Prometheus metrics at `/metrics` endpoint
- **Health Checks**: Liveness/readiness probes at `/health`
- **Tracing**: OpenTelemetry with Jaeger backend
- **Logs**: Structured JSON logs with request IDs
- **Dashboards**: Grafana dashboards for each service
- **Alerting**: Automated alerts for SLO violations

## Security

- Secrets managed via Vault or cloud secret manager
- Regular dependency scanning and updates
- Container vulnerability scanning with Trivy
- RBAC and OAuth2/OIDC authentication
- Network policies and service mesh security

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Documentation

- [Architecture Overview](docs/architecture/README.md)
- [API Documentation](docs/api/README.md)
- [Deployment Guide](docs/deployment/README.md)
- [Troubleshooting](docs/troubleshooting/README.md)

## License

[MIT License](LICENSE)
