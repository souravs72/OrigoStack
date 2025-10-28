# Contributing to Origo Stack

This document outlines the development workflow, coding standards, and contribution guidelines for the Origo Stack platform.

## Development Workflow

### 1. Branch Strategy

- **main**: Production-ready code, protected branch
- **staging**: Pre-production testing, auto-deployed to staging environment
- **feat/<ticket>-description**: Feature development branches
- **hotfix/<ticket>-description**: Critical bug fixes
- **chore/<description>**: Maintenance tasks, documentation updates

### 2. Feature Development Process

1. **Create Branch**: `git checkout -b feat/ORG-123-add-recording-service`
2. **Read Related Files**: Follow the [Files-to-Read Rule](#files-to-read-rule)
3. **Implement Changes**: Follow coding standards and add tests
4. **Run Quality Checks**: Linting, formatting, static analysis
5. **Test Locally**: Unit, integration, and E2E tests
6. **Create PR**: Use the standard PR template
7. **Code Review**: Address feedback and required approvals
8. **Deploy**: Automated canary deployment after merge

## Files-to-Read Rule (Critical)

Before making any changes, you **must** perform these steps:

1. **Identify Scope**: Determine all files that might be impacted
2. **Static Analysis**: Use AST parsers to find dependencies
3. **Reference Search**: Find all files referencing modified symbols
4. **Test Mapping**: Identify which tests need to run
5. **Risk Assessment**: Calculate risk score (LOW/MEDIUM/HIGH/CRITICAL)
6. **Impact Analysis**: Document potential breaking changes

Example commands:

```bash
# Find references to UserService
rg 'UserService' --glob '!**/vendor/**' --glob '!**/node_modules/**'

# Find all imports of a module
rg 'import.*auth-service' --type ts --type js

# Check database references
rg 'users_table' --type sql --type java --type py
```

## Code Quality Standards

### Language-Specific Standards

#### Java (Spring Boot)

```bash
# Format and lint
mvn spotless:apply
mvn checkstyle:check
mvn test
```

**Standards:**

- Follow Google Java Style Guide
- Use Spring Boot best practices
- Document public APIs with JavaDoc
- Minimum 80% test coverage

#### Go

```bash
# Format and lint
gofmt -w ./
golangci-lint run ./...
go test ./... -race -cover
```

**Standards:**

- Follow effective Go guidelines
- Use structured logging
- Handle errors explicitly
- Include integration tests

#### Python (FastAPI)

```bash
# Format and lint
black .
ruff check .
mypy .
pytest --cov=./
```

**Standards:**

- Follow PEP 8 style guide
- Use type hints
- Document with docstrings
- Minimum 85% test coverage

#### JavaScript/TypeScript

```bash
# Format and lint
npm run format
npm run lint
npm test
```

**Standards:**

- Use TypeScript for type safety
- Follow ESLint configuration
- Use Prettier for formatting
- Include unit and integration tests

### Common Standards

- **Commit Messages**: Imperative style (`Add`, `Fix`, `Refactor`)
- **API Documentation**: OpenAPI/Swagger for REST APIs
- **Error Handling**: Structured error responses
- **Logging**: Structured JSON logs with correlation IDs
- **Security**: No secrets in code, use environment variables

## Testing Requirements

### Test Pyramid

1. **Unit Tests**: 70% of total tests

   - Fast execution (< 1 second per test)
   - Mock external dependencies
   - Test business logic and edge cases

2. **Integration Tests**: 20% of total tests

   - Test service interactions
   - Use testcontainers for databases
   - Test API contracts

3. **E2E Tests**: 10% of total tests
   - Test complete user workflows
   - Use headless browsers
   - Test critical paths only

### Required Test Coverage

- **New Code**: 100% coverage required
- **Modified Code**: Cannot decrease overall coverage by > 1%
- **Critical Services**: Auth, Billing, SFU must maintain > 90%

### Test Categories

```bash
# Unit tests
npm test
go test ./...
mvn test
pytest tests/unit/

# Integration tests
docker compose -f docker-compose.test.yml up -d
npm run test:integration
go test ./... -tags=integration
pytest tests/integration/

# E2E tests
npm run test:e2e
pytest tests/e2e/
```

## PR Requirements

### PR Template

Use this template for all pull requests:

```markdown
## What

- Brief description of changes

## Why

- Business justification
- Link to ticket/issue

## Risk Assessment

- [ ] LOW: Minor changes, well-tested
- [ ] MEDIUM: Moderate impact, affects single service
- [ ] HIGH: Significant changes, multiple services affected
- [ ] CRITICAL: Infrastructure, security, or breaking changes

## Files-to-Read Report

- [ ] Scope analysis completed
- [ ] Reference search performed
- [ ] Test mapping verified
- [ ] Risk score calculated

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Deployment

- [ ] Database migrations included
- [ ] Configuration changes documented
- [ ] Rollback plan prepared
- [ ] Monitoring alerts updated

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Breaking changes documented
```

### Approval Matrix

Based on risk level, the following approvals are required:

- **LOW**: 1 peer reviewer
- **MEDIUM**: 2 peer reviewers from owning team
- **HIGH**: Security Lead + SRE Lead + domain expert
- **CRITICAL**: Security Lead + SRE Lead + SFU expert + Engineering Manager

## Security Guidelines

### Secrets Management

- Never commit secrets to version control
- Use environment variables or secret management systems
- Rotate credentials every 30 days
- Use least-privilege access

### Dependency Management

- Pin dependency versions in production
- Regular security scanning with Dependabot
- Update critical vulnerabilities within 48 hours
- Document all external dependencies

### Code Security

- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens for state-changing operations

## Deployment Guidelines

### Canary Deployment

1. **Deploy 5%**: Route small percentage of traffic
2. **Monitor**: Watch metrics for 15-30 minutes
3. **Validate**: Run smoke tests
4. **Scale Up**: 25% → 50% → 100% if healthy
5. **Rollback**: Automatic if SLOs violated

### Required Monitoring

All services must expose:

- `/health`: Liveness and readiness probes
- `/metrics`: Prometheus metrics
- Structured logs with correlation IDs
- Distributed tracing headers

### Rollback Procedures

- **Automatic**: Triggered by SLO violations
- **Manual**: One-click rollback via dashboard
- **Timeline**: Complete rollback within 5 minutes
- **Communication**: Automated incident notifications

## Local Development

### Prerequisites

```bash
# Install required tools
brew install docker kubectl helm
npm install -g @nestjs/cli
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
pip install black ruff mypy pytest
```

### Setup

```bash
# Clone repository
git clone <repository-url>
cd origo_stack

# Start local infrastructure
docker compose -f docker-compose.local.yml up -d

# Install dependencies
./scripts/development/install-deps.sh

# Start all services
./scripts/development/start-all.sh
```

### Development Tools

- **API Testing**: Use Postman collections in `docs/api/`
- **Database**: Local PostgreSQL and Redis via Docker
- **Monitoring**: Local Prometheus and Grafana
- **Tracing**: Local Jaeger instance

## Documentation Standards

### API Documentation

- OpenAPI 3.0 specifications
- Include examples and error responses
- Version all public APIs
- Document breaking changes

### Code Documentation

- Document public interfaces
- Include usage examples
- Explain complex business logic
- Keep docs up-to-date with code

### Architecture Documentation

- Update system diagrams for major changes
- Document design decisions in ADRs
- Maintain service dependencies
- Include performance characteristics

## Getting Help

- **General Questions**: Create GitHub Discussion
- **Bug Reports**: Create GitHub Issue with template
- **Security Issues**: Email security@company.com
- **Architecture Discussions**: Schedule RFC review

## Code of Conduct

We follow the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please read and adhere to these guidelines in all interactions.
