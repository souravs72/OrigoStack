# Origo Stack — Zoom-like Microservices Platform

**Purpose:**
Create a production-standard zoom like microservices app built using Spring Boot, or best suitable frameworks in python, javascript, Go. This app will have grpc for internal service to service calls and http rest for frontend.

---

## 1. High-level agent responsibilities

- **Implement** new features from this defined doc and prioritize by importance (critical/major/minor).
- **Read** all the filed in this repository and the full test suite before proposing or applying changes.
- **Analyze** change impact using static analysis, call-graph, and dependency mapping.
- **Run** the full local and CI test matrix before committing any change.
- **Create** minimal, focused commits and open Pull Requests with a descriptive changelog and risk assessment. All entities must have auditable entities.
- **Label** PRs with risk level and required reviewers (security, infra, SFU expert) automatically.
- **Deploy** canary releases to a staging cluster, run smoke tests, and promote to production only after threshold checks pass.
- **Monitor** runtime metrics and automatically revert if SLOs degrade beyond thresholds.
- **Notify** humans per escalation rules (on-call, engineering manager) with a clear playbook.
- **Document** every design decision changed and update `docs/ChangeLog.md` and architecture diagrams.
- **Commit** changes after verifying the changes are working properly in properly. Take user's consent before every push

---

## 2. Required services (full list)

1. **Signaling Service** (WebSocket) — room lifecycle, ICE/SDP handshake, token issuance.
2. **SFU Cluster** — mediasoup / Pion / Janus worker fleet.
3. **TURN/STUN** (coturn) — NAT traversal & relay.
4. **Auth & Identity** (Spring Boot) — OAuth2/OIDC, JWT, RBAC.
5. **REST Control Plane** (Spring Boot / Go / FastAPI) — rooms, recordings, scheduling, billing.
6. **Recording Service** — RTP capture, FFmpeg, store to S3-compatible object store.
7. **Chat Service** — low-latency messaging, presence (Redis / NATS backed).
8. **Notification Service** — emails, push, SMS.
9. **Frontend Client(s)** — React (web), Electron/Capacitor wrappers for desktop/mobile.
10. **Ingress / API Gateway** — TLS termination, rate limiting (Traefik / Kong / Nginx).
11. **Storage & CDN** — S3, CDN for recordings/live VOD.
12. **Observability** — Prometheus, Grafana, Jaeger, Loki/ELK.
13. **CI/CD & Infra** — GitHub Actions / ArgoCD / Helm / Terraform.
14. **Billing & Quota Service** — metering, plan enforcement.
15. **Admin Dashboard** — user, room, and billing admin UI.
16. **Security services** — secrets manager (Vault or cloud), SCA and container scanning.

---

## 3. Decision hierarchy & default preferences

When the agent must choose between options, follow this preference order:

1. **Safety-first**: prefer smaller, reversible changes and tests over large risky refactors.
2. **Production-proven**: prefer widely adopted libraries (mediasoup, Pion, coturn, Prometheus) unless performance reasons demand custom code.
3. **Observability**: choose changes that improve traceability and metrics.
4. **Performance**: choose scalable solutions (SFU over MCU, simulcast/SVC support).
5. **Maintainability**: prefer code clarity and documented patterns.
6. **Cost-awareness**: estimate egress costs and optimize before proposing features that increase egress.

---

## 4. Files-to-read-before-change rule (critical)

Before altering any file, the agent **must** perform these steps in order and record the result in a pre-commit analysis report:

1. **Identify scope:** determine the set of files `S` that are changed or might be impacted. Start with the direct files and expand by static analysis (import graph, call graph, routes, protobufs/openapi links). Use language-aware parsers (Java AST, Go AST, Python AST, TypeScript AST).
2. **Run references search:** find all files referencing symbols, classes, endpoints, config keys, environment variables, and DB tables modified. (e.g., `rg 'UserService' --glob '!**/vendor/**'`).
3. **Run tests subset mapping:** map changed modules to unit/integration tests; mark tests to run. If mapping is missing, conservatively run the whole test suite.
4. **Compute risk score:** based on past failure rates per module, external integrations, and whether change touches infra/security/third-party connectors. Assign risk: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
5. **Require approvals:** if `HIGH` or `CRITICAL`, block auto-merge and request human approval per the approval matrix.
6. **Generate impact summary:** list potential DB migrations, schema changes, backward-incompatibilities, public API changes, and dependent services.

---

## 5. Change workflow (automated agent flow)

**When implementing a change (ticket → deploy):**

1. **Create** a feature branch `feat/<ticket>-short-title`.
2. **Run** local linters, formatters, and static analyzers (gofmt/golangci-lint; mvn fmt and checkstyle; ruff/mypy/black; eslint + prettier). Fix or explain all linter failures inline.
3. **Run** unit tests for affected modules. If failures occur, **stop** and create a draft PR describing root cause.
4. **Run** integration tests using docker compose or KinD; include SFU worker or mock SFU if necessary.
5. **Run** end-to-end smoke tests using headless browsers for client flows (join room, publish track, subscribe track, record). Keep test artifacts.
6. **Build** container images and perform container scanning (Trivy). Block on critical vulnerabilities.
7. **Open** a PR with: description, why, risk score, test results, screenshots/videos, and a `rollout_plan.md` (canary %, metrics to watch, rollback steps).
8. **Label** PR: `risk:{low|medium|high|critical}`, `area:{sfu,signaling,infra,auth,...}`.
9. **Wait** for required reviewers (automatically requested). If `LOW` and all checks pass, and no blockers, **auto-merge** can be enabled by policy after a configurable wait (e.g., 1 hour) unless humans intervene.
10. **Deploy** to staging via Helm and run canary smoke tests (connectivity, latency, CPU/egress). If thresholds pass, promote to production with progressive rollout.

---

## 6. Approval matrix (who must approve)

- **High / Critical changes** (auth, infra, DB migrations, SFU core): require approvals from _Security Lead_ + _SRE Lead_ + _SFU expert_.
- **Medium changes** (core features, new endpoints): require _two_ peer approvals including one from the owning team.
- **Low changes** (UI tweaks, docs, tests): require one reviewer.

---

## 7. Testing matrix & quality gates

- **Unit tests:** run for each language on every PR. Gate: 100% for new code; coverage drop limit 1% global.
- **Integration tests:** run for affected services; gate: green. Include coturn and a dummy SFU or dockerized SFU.
- **E2E tests:** run nightly and before production deploys. Gate: smoke tests must pass for canary promotion.
- **Performance tests:** run in staging when changing SFU, TURN, networking or autoscaling logic. Gate: p95 latency and CPU/Egress thresholds.
- **Security scans:** run on every image build. Fail on high/critical CVEs or known vulnerable libraries.

---

## 8. Runtime & deployment safety rules

- **Canary deploy:** always deploy a small percentage (e.g., 5%) to production nodes; run smokes and monitor for 15–30 mins before full rollout.
- **Automatic rollback:** revert and notify if any defined SLOs are violated during canary (error rate, latency, CPU over threshold, memory leaks, or large increases in egress).
- **Blue/Green or Rolling:** use Rolling updates with readiness/liveness probes for stateless services; use blue/green for DB-changing releases.

---

## 9. Observability & alerting rules (agent responsibilities)

- **Instrument** every service endpoint and critical path with OpenTelemetry (traces) and Prometheus metrics.
- **Create** dashboards per service (errors, latency, active-sessions, bandwidth, CPU, memory, socket count).
- **Create** automated alerts for: SFU worker OOM, TURN failures, high egress, authentication failure spikes, recording pipeline failures.
- **Run** automated health-checks every 60s; escalate to human if health is degraded for >5 minutes.

---

## 10. Commit & PR standards (enforced automatically)

- **Write** commits as imperative messages: `Add`, `Fix`, `Refactor`, `Remove`.
- **Include** a concise PR template: summary, testing done, rollout plan, risk, related tickets, impact analysis.
- **Require** signed commits for production merges (GPG or commit signing via CI).
- **Never** use emojis or icons in any code, documentation, comments, commit messages, or automation. This is a professional production repository - use clear, descriptive text instead.

---

## 11. Security & secrets policy

- **Never** store secrets in plaintext in the repository. Use secrets manager (Vault / cloud secret manager).
- **Rotate** TURN and SFU credentials every 30 days by default unless lower risk.
- **Run** dependency checks weekly and apply patch PRs for critical security fixes automatically; require human approval for high-impact upgrades.

---

## 12. Dependency & upgrade strategy

- **Automate** minor/patch upgrades via Dependabot/ Renovate and run full test matrix.
- **Schedule** major upgrades as a ticket with a migration plan, smoke tests and rollback steps.
- **Pin** production images and use immutability (image digests) in Helm values.

---

## 13. Bugfix policy (how the agent updates code)

When the agent detects a bug (from monitoring, tests, or issues):

1. **Reproduce** locally and in a staging environment. Document reproduction steps.
2. **Map** code regions involved using the Files-to-read rule. Run static analysis and collect stack traces and traces (Jaeger).
3. **Prepare** a minimal patch addressing the root cause, not a wide refactor. Run full test matrix.
4. **Open** PR with `hotfix/<ticket>` and mark `priority:hotfix` and `risk` accordingly.
5. **Deploy** to canary and monitor; only merge to main after canary passes.
6. **Backport** to release branches if needed.

---

## 14. Emergency rollback & incident playbook

- **Create** a `playbooks/` folder with runbooks per service for common incidents.
- **Define** a single-button rollback in the dashboard for the last known-good helm release. The agent may trigger rollback automatically if SLOs breach during a canary.
- **Run** post-incident report automatically and assign follow-ups.

---

## 15. Example agent configuration (YAML)

```yaml
agent:
  name: cursor-eng-agent
  branches: ["main", "staging"]
  approval_policy:
    high: ["security-lead", "sre-lead", "sfu-expert"]
    medium: ["owner", "peer"]
    low: ["peer"]
  testing:
    unit: true
    integration: true
    e2e: true
    perf: true
  canary:
    enabled: true
    initial_percent: 5
    monitor_window_minutes: 20
  notifications:
    on_call: "#on-call"
    slack: true
    email: true
  read_all_files_before_change: true
  max_auto_merge_risk: "LOW"
```

---

## 16. Example lint/test/build commands (agent will run)

- **Go:** `gofmt -w ./ && golangci-lint run ./... && go test ./...`
- **Java:** `mvn -T 1C -DskipTests=false verify`
- **Python:** `ruff . && black --check . && pytest -q`
- **JS:** `npm ci && npm run lint && npm test`
- **Container scan:** `trivy image --severity CRITICAL,HIGH <image>`

---

## 17. Observability checklist the agent must enforce on new services

- Expose `/health` (liveness/readiness).
- Expose `/metrics` (Prometheus format).
- Include trace context propagation across RPC/HTTP.
- Include structured JSON logs with `request_id`.

---

## 18. Example PR template (auto-filled)

```
Title: <scope>: Short imperative summary

What:
- Bullet list of changes

Why:
- Reason and context

Risk:
- LOW/MEDIUM/HIGH/CRITICAL

Files-read-report:
- auto-generated list of files analyzed and references found

Tests:
- Unit: pass
- Integration: pass
- E2E: pass

Rollout plan:
- Canary 5% -> monitor route -> 30 min -> 25% -> monitor -> full (if green)

Rollback:
- Helm rollback to release X within 5 minutes

Approvals required:
- <list>
```

---

## 19. Final notes & next steps

- **Deploy** the agent in dry-run (read-only) mode for 2–4 weeks to gather data and tune risk/failure thresholds.
- **Gradually increase** permission scope: start with PRs as drafts, then allow auto-opened PRs, then allow auto-merge for `LOW` risk only after confidence.
- **Keep** humans in the loop for high/critical areas (auth, infra, SFU core, billing). The agent **must never** autonomously change keys, rotate secrets, or alter production DB schemas without human app
