# Origo Stack Architecture

## System Overview

Origo Stack is a cloud-native, microservices-based video conferencing platform designed for high scalability, availability, and performance. The system follows Domain-Driven Design (DDD) principles with clear service boundaries and responsibilities.

## High-Level Architecture

### Service Communication Diagram

```
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│ Web Client  │    │ Mobile App  │    │  Admin Dashboard │
│  (React)    │    │(Capacitor)  │    │   (React)        │
└──────┬──────┘    └──────┬──────┘    └──────┬───────────┘
       │ HTTPS/REST       │ HTTPS/REST       │ HTTPS/REST
       └──────────────────┼──────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     API Gateway       │
              │   (Traefik/Kong)      │
              │  TLS, Rate Limiting   │
              └───────────┬───────────┘
                          │ HTTP/gRPC
                          ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                   Service Mesh                              │
    │                                                             │
    │  ┌──────────────┐ gRPC ┌──────────────┐gRPC   ┌───────────┐ │
    │  │ Auth Service ├──────┤Control Plane ├───────┤ Billing   │ │
    │  │(Spring Boot) │      │   (Go/Gin)   │       │ Service   │ │
    │  └─────┬────────┘      └──────┬───────┘       │(Spring)   │ │
    │        │ JWT                  │ gRPC          └─────┬─────┘ │
    │        ▼                      ▼                     │       │
    │  ┌──────────────┐      ┌──────────────┐             │       │
    │  │ Signaling    │ NATS │ Chat Service │             │       │
    │  │ Service      │◄─────┤   (Go/NATS)  │             │       │
    │  │(Go/Gin)      │      └──────────────┘             │       │
    │  └─────┬────────┘                                   │       │
    │        │ WebSocket                                  │       │
    │        ▼                                            │       │
    │  ┌──────────────┐      ┌──────────────┐             │       │
    │  │ SFU Cluster  │ gRPC │ Recording    │             │       │
    │  │(mediasoup/   ├──────┤ Service      │             │       │
    │  │ Pion)        │      │  (FFmpeg)    │             │       │
    │  └─────┬────────┘      └──────┬───────┘             │       │
    │        │ WebRTC              │ S3 API               │       │
    │        ▼                      ▼                     ▼       │
    │  ┌──────────────┐      ┌──────────────┐     ┌──────────────┐│
    │  │ TURN/STUN    │      │Object Storage│     │Notification  ││
    │  │  (coturn)    │      │  (S3/MinIO)  │     │Service       ││
    │  └──────────────┘      └──────────────┘     │ (Go/Gin)     ││
    │                                             └─────┬────────┘│
    └─────────────────────────────────────────────────┼───────────┘
                                                      │ SMTP/FCM/SMS
                                                      ▼
                                              External Services
                                              (Email, Push, SMS)

┌─────────────────────────── Data Layer ───────────────────────────┐
│                                                                  │
│  ┌──────────────┐ SQL ┌──────────────┐ Redis  ┌──────────────┐   │
│  │ PostgreSQL   │◄────┤   Services   ├──────► │    Redis     │   │
│  │(Primary DB)  │     │              │ Pub/Sub│ (Cache/Pub)  │   │
│  │              │     │              │        │              │   │
│  └──────────────┘     └──────────────┘        └──────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─────────────── Documentation & Development Tools ───────────────┐
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │   Markdown   │      │  ASCII Art   │      │ Git/GitHub   │   │
│  │(Documentation)│     │  (Diagrams)  │      │(Version Ctrl)│   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │Swagger/OpenAPI│     │Code Quality  │      │Development   │   │
│  │(API Docs)    │      │(ESLint)      │      │Tools(VS Code)│   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │Documentation │      │  Testing     │      │  Postman     │   │
│  │Generators    │      │ (Jest/JUnit) │      │(API Testing) │   │
│  │(GitBook)     │      │              │      │              │   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Communication Protocols Legend

- **HTTPS/REST**: Client-to-API Gateway communication
- **HTTP/gRPC**: API Gateway to services, inter-service communication
- **WebSocket**: Real-time bidirectional communication (signaling, chat)
- **WebRTC**: Peer-to-peer media streaming (via SFU)
- **STUN/TURN**: NAT traversal protocols
- **JWT**: Authentication token passing
- **NATS**: Lightweight message streaming
- **SQL**: Database queries (PostgreSQL)
- **Redis Protocol**: Caching and pub/sub messaging
- **S3 API**: Object storage operations
- **SMTP/FCM/SMS**: External notification protocols
- **OpenAPI/Swagger**: REST API documentation and specification

## Service Architecture

### 1. Signaling Service

- **Technology**: Go with Gorilla WebSocket + Gin framework
- **Responsibility**: WebSocket connections, room lifecycle, ICE/SDP negotiation
- **Communication**: WebSocket (clients), gRPC (internal services)
- **Data Store**: Redis (session state, room metadata)
- **Rationale**: Go's goroutines provide superior concurrency for thousands of WebSocket connections

### 2. SFU (Selective Forwarding Unit) Cluster

- **Technology**: mediasoup (Node.js) - Primary choice for production
- **Responsibility**: Media routing, bandwidth adaptation, simulcast/SVC
- **Communication**: WebRTC (clients), gRPC (control plane)
- **Scaling**: Horizontal with load balancing
- **Rationale**: Most mature WebRTC SFU with comprehensive feature set, battle-tested in production

### 3. TURN/STUN Service

- **Technology**: coturn
- **Responsibility**: NAT traversal, media relay for restricted networks
- **Communication**: STUN/TURN protocols
- **Deployment**: Multiple geographic regions

### 4. Auth & Identity Service

- **Technology**: Spring Boot (Java) with Spring Security
- **Responsibility**: OAuth2/OIDC, JWT tokens, RBAC, user management
- **Communication**: REST API, gRPC (internal)
- **Data Store**: PostgreSQL (users, roles, permissions)
- **API Documentation**: Swagger/OpenAPI 3.0 specifications
- **Rationale**: Spring Security is the gold standard for enterprise authentication with unmatched OAuth2/OIDC support

### 5. Control Plane Service

- **Technology**: Go with Gin framework
- **Responsibility**: Room management, scheduling, recording control, billing integration
- **Communication**: REST API, gRPC (internal)
- **Data Store**: PostgreSQL (rooms, recordings, schedules)
- **API Documentation**: Swagger/OpenAPI 3.0 specifications
- **Rationale**: Go excels at concurrent request handling and has excellent database performance

### 6. Recording Service

- **Technology**: Go with FFmpeg integration (CLI calls)
- **Responsibility**: RTP capture, media transcoding, storage management
- **Communication**: gRPC (control plane), Message Queue (async processing)
- **Storage**: S3-compatible object storage
- **Rationale**: Go's superior process management and lower overhead for CPU-intensive media processing

### 7. Chat Service

- **Technology**: Go with NATS Streaming
- **Responsibility**: Real-time messaging, presence, message history
- **Communication**: WebSocket (clients), gRPC (internal)
- **Data Store**: Redis (live messages), PostgreSQL (history)
- **Rationale**: Go + NATS provides excellent real-time messaging performance with built-in clustering

### 8. Notification Service

- **Technology**: Go with Gin framework
- **Responsibility**: Email, push notifications, SMS, webhooks
- **Communication**: Message Queue (async), REST API
- **Integrations**: SendGrid, FCM, Twilio, Slack
- **API Documentation**: Swagger/OpenAPI 3.0 specifications
- **Rationale**: Go's superior HTTP client performance and lower resource usage for high-volume external API calls

### 9. Billing & Quota Service

- **Technology**: Spring Boot (Java) with Spring Data JPA
- **Responsibility**: Usage metering, plan enforcement, billing events
- **Communication**: gRPC (internal), REST API (admin)
- **Data Store**: PostgreSQL (billing data), InfluxDB (metrics)
- **API Documentation**: Swagger/OpenAPI 3.0 specifications
- **Rationale**: JVM ecosystem excels at financial applications with robust transaction management and compliance features

### 10. Documentation & Development Tooling

- **API Documentation**: Swagger/OpenAPI 3.0 for REST API specifications
- **Documentation Format**: Markdown with ASCII art diagrams
- **Version Control**: Git with GitHub for collaboration and history
- **Documentation Generators**: GitBook, Docsify, or MkDocs for web hosting
- **API Testing**: Postman collections, automated testing with Newman
- **Diagramming**: ASCII art (manual), optional Mermaid.js or Draw.io integration
- **Code Quality**: ESLint, Prettier for consistent formatting
- **Testing Frameworks**: Jest (Node.js), JUnit (Java), pytest (Python)
- **Development Environment**: VS Code/IntelliJ with extensions for Markdown preview
- **Collaboration**: Pull request reviews, issue tracking via GitHub
- **Hosting**: GitHub Pages, Netlify, or internal documentation portals
- **API Documentation Hosting**: Swagger UI, ReDoc for interactive API docs

## Technology Stack Justification

### Why These Technologies Are the Best Choices

#### Go-First Strategy (80% of services)

- **Superior Concurrency**: Goroutines handle thousands of concurrent connections efficiently
- **Performance**: Compiled binaries with minimal overhead, 10x+ faster than interpreted languages
- **Simple Deployment**: Single binary deployment, no runtime dependencies
- **Resource Efficiency**: Lower memory footprint and CPU usage
- **Strong Ecosystem**: Excellent HTTP clients, database drivers, and gRPC support

#### Strategic Java Usage (Security & Financial Services)

- **Spring Boot for Auth**: Unmatched OAuth2/OIDC ecosystem, battle-tested security
- **Spring Boot for Billing**: Robust transaction management, financial compliance features
- **Enterprise Integration**: Mature enterprise patterns and extensive third-party integrations

#### Node.js for Media (SFU Only)

- **mediasoup Excellence**: Most mature WebRTC SFU implementation
- **Media Ecosystem**: Best-in-class WebRTC libraries and community support
- **Production Proven**: Used by Discord, Zoom competitors, and major platforms

### Performance Benchmarks (Approximate)

- **Go Services**: 50,000+ requests/second per instance
- **Spring Boot**: 10,000+ requests/second per instance (with security overhead)
- **Node.js SFU**: 1,000+ concurrent media streams per instance

## API Documentation Strategy

### OpenAPI/Swagger Integration

- **Standard**: OpenAPI 3.0 specification for all REST APIs
- **Generation**: Auto-generated from code annotations and comments
- **Hosting**: Swagger UI for interactive documentation
- **Testing**: Postman collections generated from OpenAPI specs
- **Validation**: Request/response validation using OpenAPI schemas
- **Versioning**: API versioning strategy documented in OpenAPI specs

### Documentation per Service

- **Auth Service**: `/api/docs` - Authentication & user management endpoints
- **Control Plane**: `/api/docs` - Room management & scheduling endpoints
- **Notification Service**: `/api/docs` - Notification delivery endpoints
- **Billing Service**: `/api/docs` - Billing & quota management endpoints
- **API Gateway**: Aggregated documentation from all services

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
