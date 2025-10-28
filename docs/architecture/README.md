# Origo Stack Architecture

## System Overview

Origo Stack is a cloud-native, microservices-based video conferencing platform designed for high scalability, availability, and performance. The system follows Domain-Driven Design (DDD) principles with clear service boundaries and responsibilities.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Web Client    │   Mobile App    │   Admin Dashboard           │
│   (React)       │ (Capacitor)     │   (React)                   │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                            │
│              (Traefik/Kong - TLS, Rate Limiting)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Application Services                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Auth Service   │ Control Plane   │  Signaling Service          │
│ (Spring Boot)   │   (Go/FastAPI)  │    (WebSocket)              │
├─────────────────┼─────────────────┼─────────────────────────────┤
│  Chat Service   │   Recording     │  Notification Service       │
│   (Go/NATS)     │   (FFmpeg)      │    (FastAPI)                │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Billing Service │   SFU Cluster   │    TURN/STUN                │
│ (Spring Boot)   │ (mediasoup/Pion)│     (coturn)                │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Data Layer                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   PostgreSQL    │      Redis      │     Object Storage          │
│  (Primary DB)   │   (Cache/Pub)   │      (S3/MinIO)             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Service Architecture

### 1. Signaling Service

- **Technology**: Node.js/TypeScript with Socket.IO
- **Responsibility**: WebSocket connections, room lifecycle, ICE/SDP negotiation
- **Communication**: WebSocket (clients), gRPC (internal services)
- **Data Store**: Redis (session state, room metadata)

### 2. SFU (Selective Forwarding Unit) Cluster

- **Technology**: mediasoup (Node.js) or Pion (Go)
- **Responsibility**: Media routing, bandwidth adaptation, simulcast/SVC
- **Communication**: WebRTC (clients), gRPC (control plane)
- **Scaling**: Horizontal with load balancing

### 3. TURN/STUN Service

- **Technology**: coturn
- **Responsibility**: NAT traversal, media relay for restricted networks
- **Communication**: STUN/TURN protocols
- **Deployment**: Multiple geographic regions

### 4. Auth & Identity Service

- **Technology**: Spring Boot (Java)
- **Responsibility**: OAuth2/OIDC, JWT tokens, RBAC, user management
- **Communication**: REST API, gRPC (internal)
- **Data Store**: PostgreSQL (users, roles, permissions)

### 5. Control Plane Service

- **Technology**: Go with Gin or FastAPI (Python)
- **Responsibility**: Room management, scheduling, recording control, billing integration
- **Communication**: REST API, gRPC (internal)
- **Data Store**: PostgreSQL (rooms, recordings, schedules)

### 6. Recording Service

- **Technology**: Go or Python with FFmpeg
- **Responsibility**: RTP capture, media transcoding, storage management
- **Communication**: gRPC (control plane), Message Queue (async processing)
- **Storage**: S3-compatible object storage

### 7. Chat Service

- **Technology**: Go with NATS or Redis Streams
- **Responsibility**: Real-time messaging, presence, message history
- **Communication**: WebSocket (clients), gRPC (internal)
- **Data Store**: Redis (live messages), PostgreSQL (history)

### 8. Notification Service

- **Technology**: FastAPI (Python) or Go
- **Responsibility**: Email, push notifications, SMS, webhooks
- **Communication**: Message Queue (async), REST API
- **Integrations**: SendGrid, FCM, Twilio, Slack

### 9. Billing & Quota Service

- **Technology**: Spring Boot (Java)
- **Responsibility**: Usage metering, plan enforcement, billing events
- **Communication**: gRPC (internal), REST API (admin)
- **Data Store**: PostgreSQL (billing data), InfluxDB (metrics)

## Communication Patterns

### Synchronous Communication

- **Client-to-Service**: REST API via API Gateway
- **Service-to-Service**: gRPC for low-latency internal calls
- **Real-time**: WebSocket for signaling and chat

### Asynchronous Communication

- **Event Streaming**: Apache Kafka for critical events
- **Message Queues**: NATS for lightweight messaging
- **Pub/Sub**: Redis for real-time notifications

## Data Architecture

### Primary Data Stores

- **PostgreSQL**: Transactional data (users, rooms, billing)
- **Redis**: Caching, sessions, pub/sub, real-time data
- **InfluxDB**: Time-series metrics and usage data
- **Object Storage**: Media files, recordings, static assets

### Data Flow

1. **User Data**: Auth Service → PostgreSQL
2. **Room Data**: Control Plane → PostgreSQL + Redis (cache)
3. **Media Data**: SFU → Object Storage (recordings)
4. **Chat Data**: Chat Service → Redis (live) + PostgreSQL (history)
5. **Metrics**: All Services → Prometheus → InfluxDB

## Security Architecture

### Authentication & Authorization

- **OAuth2/OIDC**: External identity providers
- **JWT Tokens**: Stateless authentication
- **RBAC**: Role-based access control
- **API Keys**: Service-to-service authentication

### Network Security

- **TLS Termination**: At API Gateway
- **Service Mesh**: Istio for inter-service security
- **Network Policies**: Kubernetes network isolation
- **Secrets Management**: Vault or cloud secret manager

### Media Security

- **DTLS**: WebRTC media encryption
- **Turn Authentication**: Time-limited credentials
- **Access Control**: Room-based permissions

## Scalability & Performance

### Horizontal Scaling

- **Stateless Services**: All application services
- **Database Sharding**: User-based partitioning
- **CDN**: Global media distribution
- **Load Balancing**: Service-level and geographic

### Performance Optimizations

- **Connection Pooling**: Database and Redis connections
- **Caching Strategy**: Multi-level caching (Redis, CDN, browser)
- **Media Optimization**: Simulcast, SVC, bandwidth adaptation
- **Async Processing**: Non-blocking operations

## Deployment Architecture

### Container Orchestration

- **Kubernetes**: Container orchestration
- **Helm**: Package management
- **Istio**: Service mesh (optional)

### CI/CD Pipeline

- **GitHub Actions**: Automated testing and deployment
- **ArgoCD**: GitOps continuous deployment
- **Canary Deployments**: Risk mitigation

### Infrastructure as Code

- **Terraform**: Cloud infrastructure provisioning
- **Kubernetes Manifests**: Application deployment
- **Helm Charts**: Configuration management

## Observability

### Monitoring Stack

- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **Jaeger**: Distributed tracing
- **Loki/ELK**: Log aggregation

### Key Metrics

- **Business Metrics**: Active users, meeting minutes, revenue
- **Technical Metrics**: Latency, error rates, resource utilization
- **Media Metrics**: Audio/video quality, packet loss, jitter

### Alerting

- **SLO-based**: Service level objective violations
- **Threshold-based**: Resource utilization limits
- **Anomaly Detection**: ML-based trend analysis

## Disaster Recovery

### Backup Strategy

- **Database Backups**: Automated daily snapshots
- **Configuration Backups**: Infrastructure as Code
- **Media Backups**: Cross-region replication

### High Availability

- **Multi-AZ Deployment**: Database and services
- **Geographic Distribution**: TURN servers and CDN
- **Automatic Failover**: Health check-based routing

### Recovery Procedures

- **RTO**: 15 minutes for critical services
- **RPO**: 1 hour for data loss tolerance
- **Runbooks**: Automated recovery procedures
