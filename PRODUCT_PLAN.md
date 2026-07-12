# LedgerFlow Product Plan

**Status:** Approved baseline for product and engineering decisions  
**Last updated:** 2026-07-12  
**Initial market:** Independent accounting and bookkeeping firms with 5–50 staff

## 1. Product thesis

LedgerFlow is a secure, deadline-driven client-work platform for accounting firms. It combines configurable workflow boards with client records, recurring engagements, document requests, approvals, and an auditable automation interface for AI agents.

It should feel as direct as a GitLab issue board, but its language and defaults must match accounting work rather than software development.

The primary promise is:

> Know what every client engagement is waiting on, who owns the next action, and which deadline is at risk—then safely let people or agents move the work forward.

## 2. Target customer

### Initial ideal customer profile

- Independent accounting, tax, or bookkeeping firm
- 5–50 employees
- 100–2,000 active clients
- Currently coordinates work through spreadsheets, email, shared drives, and a generic task manager
- Has repeated monthly, quarterly, and annual workflows
- Needs clearer ownership and deadline visibility
- Is interested in AI assistance but requires permissions and an audit trail

### Initial buyer and users

- **Economic buyer:** managing partner or operations director
- **Champion:** practice manager or senior accountant
- **Daily users:** accountants, bookkeepers, reviewers, and administrative staff
- **External participant (later):** client contact using a restricted portal

### Jobs to be done

1. Start a repeatable engagement from a template.
2. See work by stage, owner, client, service, and deadline.
3. Identify work blocked by missing client documents.
4. Hand work from preparer to reviewer with a complete history.
5. Automate routine updates without giving an agent unrestricted access.

## 3. Why accounting first

Accounting firms have repeatable workflows, hard deadlines, review steps, and strong audit requirements. These provide a clearer paid product than a general-purpose board.

Car dealerships are a possible later vertical, particularly for vehicle acquisition, reconditioning, sales handoff, and compliance-document workflows. They should not be included in the MVP because their entities, integrations, terminology, and real-time operational needs differ significantly. Expansion should use a vertical configuration layer only after the accounting product demonstrates repeatable demand.

## 4. Product model

Generic engineering concepts should exist internally while the interface uses domain language.

| Platform concept | Accounting presentation |
| --- | --- |
| Tenant | Firm |
| Workspace/project | Service line or team |
| Issue | Work item |
| Board | Workflow |
| Milestone/iteration | Filing period or engagement cycle |
| Assignee | Owner/reviewer |
| Attachment request | Client document request |

Core entities:

- Firm
- User and membership
- Client
- Contact
- Service line
- Engagement template
- Engagement
- Work item
- Workflow and stage
- Assignment
- Label
- Comment
- Document request (metadata only in the MVP)
- Activity event
- Personal/service access token

## 5. MVP scope

### Included

- Multi-tenant firms with strict tenant isolation
- Email/password authentication and role-based authorization
- Roles: owner, administrator, manager, member, read-only
- Client directory
- Configurable workflows and stages
- Work items with description, owner, reviewer, labels, due date, priority, and estimate
- Drag-and-drop stage and rank updates
- Comments and activity history
- Engagement templates and recurring engagement creation
- Dashboard for overdue, due soon, blocked, and awaiting review
- Search and saved filters
- Personal access tokens with scopes
- MCP tools for approved read and write operations
- Audit records for browser, API, and MCP mutations
- CSV client import
- Docker-based local development and deployment

### Explicitly excluded from the MVP

- Tax calculation or filing
- General ledger or bookkeeping engine
- Billing, payments, payroll, or time-sheet accounting
- Storage of source financial documents
- Email inbox synchronization
- Native mobile applications
- Custom workflow scripting
- Car dealership features
- Public extension marketplace
- Microservices or Kubernetes

Excluded work requires an explicit amendment to this document before implementation.

## 6. Web and MCP architecture decision

### Decision

Build the web product and MCP capability together as one modular product, but keep them as separate inbound adapters.

```text
Web UI -> REST API ---------+
                           |
MCP HTTP endpoint --------> Application services -> Domain -> PostgreSQL
                           |
Scheduled jobs ------------+
```

The REST controllers and MCP tools must not contain business rules or access repositories directly. Both call the same application services, authorization policies, validation, transactions, and audit service.

Initially, the REST API and MCP server may run in the same Spring Boot deployment. Module boundaries must allow MCP to become a separately deployed Spring Boot process later without duplicating domain logic.

### Why not a completely separate MCP application now

- It would duplicate authentication, authorization, validation, and business behavior.
- Web and agent actions could produce inconsistent results.
- Two independently versioned services increase delivery and operational cost before demand is proven.
- Cross-service transactions and audit consistency add unnecessary complexity.

### Why keep MCP as a distinct adapter/module

- MCP can have independent rate limits, token scopes, telemetry, and feature flags.
- Enterprise customers may disable MCP without disabling the web API.
- The MCP process can be isolated or scaled independently later.
- Tool contracts remain intentional rather than mirroring every REST endpoint.

### Extraction triggers

Deploy MCP separately only when at least one is true:

- MCP traffic materially affects interactive web latency.
- A customer requires network-level isolation.
- MCP needs a different release or scaling cadence.
- Long-running agent tasks require a worker-oriented runtime.
- Security review requires a separate public boundary.

## 7. Technology baseline

### Backend

- Java 21
- Spring Boot 3.x
- Spring MVC and Spring Data JPA
- Spring Security
- Spring AI MCP Server
- Bean Validation
- Flyway migrations
- PostgreSQL
- OpenAPI documentation
- JUnit, AssertJ, MockMvc, and Testcontainers

Use a modular monolith organized by business capability. Prefer package-level boundaries first; adopt Spring Modulith if its event and boundary verification features provide concrete value.

### Frontend

- React with TypeScript
- Vite
- TanStack Query
- dnd-kit
- React Hook Form
- A small accessible component system using Tailwind CSS
- Vitest and Playwright

The frontend will be compiled and served by Spring Boot for the initial SaaS deployment. It may be placed behind a CDN later.

### Data and infrastructure

- PostgreSQL as the system of record
- Database-enforced tenant identifiers and application-level authorization
- Object storage only when document attachments enter scope
- Transactional outbox before adding integrations that require reliable event delivery
- OpenTelemetry-compatible structured logs and metrics

## 8. SaaS security baseline

- Every tenant-owned table carries a firm identifier.
- Every application service verifies firm membership and permission.
- MCP uses scoped personal or service tokens; browser sessions are not reused.
- Sensitive values are never returned by generic search or MCP tools.
- All mutations record actor, source, timestamp, target, and a safe change summary.
- Optimistic locking protects concurrent work-item edits.
- Rate limits differ for browser, REST token, and MCP traffic.
- Production backups and restore testing are required before paid launch.
- Security design must anticipate GDPR because the initial deployment is in the EU.

The MVP must avoid storing raw financial documents. Document requests track status, deadline, and secure external reference only.

## 9. MCP product surface

Initial tools:

- `list_clients`
- `get_client`
- `list_workflows`
- `get_workflow`
- `search_work_items`
- `get_work_item`
- `create_work_item`
- `update_work_item`
- `move_work_item`
- `add_comment`
- `assign_work_item`
- `create_document_request`
- `mark_document_request_received`

Initial scopes:

- `clients:read`
- `work:read`
- `work:write`
- `comments:write`
- `documents:read`
- `documents:write`

Destructive bulk operations and tenant administration are not exposed through MCP in the MVP. Tool responses should be compact, stable, and pagination-aware.

## 10. Deployment plan

### Local development

Docker Compose runs PostgreSQL and optional supporting services. The backend and frontend can run with hot reload outside containers.

### Initial SaaS production

- EU region on a managed application platform such as Render, Railway, or AWS App Runner
- One Spring Boot application container
- Managed PostgreSQL with point-in-time recovery
- TLS termination at the platform edge
- Secrets in the platform secret store
- Automated database migrations during a controlled release step
- GitHub Actions for tests, image build, security checks, and deployment

The provider should be selected during the deployment milestone based on verified EU-region availability, backup guarantees, pricing, and data-processing terms. The architecture must remain deployable via standard OCI containers to avoid provider lock-in.

### Later scale path

1. Add a dedicated background worker for recurring engagements and notifications.
2. Add Redis only for demonstrated caching, rate limiting, or queue requirements.
3. Separate MCP from the web process when an extraction trigger is met.
4. Move static frontend assets to a CDN if needed.

## 11. Delivery milestones

### M0 — Foundation and walking skeleton

**Status: Complete (2026-07-12)**

- Repository structure and architecture checks
- Spring Boot application and React shell
- PostgreSQL/Flyway setup
- Firm, user, and membership model
- CI and local Docker Compose
- One authenticated health-to-database path

**Exit criterion:** a new developer can run the system and an authenticated user belongs to an isolated firm.

### M1 — Complete workflow slice

**Status: Complete (2026-07-13)**

- Clients, workflows, stages, and work items
- Board UI with persistent drag-and-drop ordering
- REST API, permissions, validation, and audit events
- Integration and browser tests for the primary flow

**Exit criterion:** a user can create a client work item and move it through a workflow with a visible history.

Verified by the PostgreSQL integration test and React workflow tests, including persistent card movement and audit refresh.

### M2 — Accounting workflow value

- Engagement templates and recurrence
- Owner/reviewer handoff
- Document request tracking
- Deadline dashboard, filters, and CSV import

**Exit criterion:** a small accounting firm can model and operate a monthly bookkeeping workflow without external task spreadsheets.

### M3 — MCP and automation

- Scoped tokens
- Initial MCP tools
- MCP authorization, audit, rate-limit, and contract tests
- Agent-oriented setup documentation

**Exit criterion:** an authorized MCP client can perform the M1 workflow with exactly the same rules and audit visibility as the browser.

### M4 — SaaS readiness

- Subscription-ready tenant lifecycle (billing integration may remain feature-flagged)
- Production observability, backup/restore verification, and security review
- EU production deployment
- Onboarding and sample accounting templates

**Exit criterion:** pilot firms can be onboarded, supported, isolated, and recovered safely.

## 12. Success measures

Pilot targets:

- A firm configures its first workflow in under 30 minutes.
- At least 80% of active engagements are represented in LedgerFlow after four weeks.
- Managers can identify overdue and blocked work without maintaining a parallel spreadsheet.
- At least 30% of pilot users return weekly.
- MCP automation produces no authorization bypasses or unaudited mutations.
- Board updates complete in under 300 ms at the API p95 under expected pilot load.

## 13. Decision guardrails

Before adding a feature, answer:

1. Does it help the initial accounting-firm customer complete or oversee client work?
2. Is it required for the current milestone exit criterion?
3. Can it reuse the shared application services and permission model?
4. Does it preserve strict tenant isolation and auditable changes?
5. Is there evidence that it belongs now rather than after pilot feedback?

If the answer to 1 or 4 is no, do not implement it. If the answer to 2 or 5 is no, place it in the later backlog rather than the active milestone.

## 14. Plan maintenance

- This file is the product and architecture baseline.
- Material scope, market, architecture, database, or deployment changes require a dated entry in `CHANGELOG.md` and an update to the relevant section here.
- Implementation work should name the milestone it advances.
- At the end of every meaningful code change, update `CHANGELOG.md` in the same commit or patch.
- Completed milestone exit criteria should be marked here only after automated verification succeeds.
