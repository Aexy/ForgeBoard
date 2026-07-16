# ForgeBoard Product Plan

**Status:** Approved outcome-led roadmap for product and engineering decisions  
**Last updated:** 2026-07-13  
**Initial market:** Independent accounting and bookkeeping firms with 5–50 staff

### Planning principles

- Prove the browser workflow with real firms before exposing write automation.
- Ship complete operating loops, not isolated entities or endpoints.
- Treat security, recoverability, support, and migration as product capabilities.
- Separate launch blockers from experiments and later scale work.
- Promote a milestone only when its measurable exit gate is demonstrated end to end.

## 1. Product thesis

ForgeBoard is a secure, deadline-driven client-work platform for accounting firms. It combines configurable workflow boards with client records, recurring engagements, document requests, approvals, and an auditable automation interface for AI agents.

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

### Primary operating loop

The product wins when a firm can repeat this loop without a parallel spreadsheet:

1. Configure a reusable service template and its default owners, stages, document requirements, and deadline rules.
2. Generate the next client engagement reliably and surface it to the responsible team.
3. Collect prerequisites, complete preparation, hand off review, resolve exceptions, and finish the engagement.
4. Give managers an accurate portfolio view of risk, capacity, blockers, and next actions.
5. Preserve a searchable history of who or what changed every material state.

The roadmap prioritizes breaks in this loop over breadth elsewhere.

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

Product rules that must be decided before M2 exits:

- Engagement lifecycle, including cancel, reopen, complete, and archive
- Whether an engagement owns one workflow instance or may span several
- How template edits affect engagements already created
- Completion semantics versus simply entering a final workflow stage
- Owner/reviewer defaults, reassignment, absence, and workload visibility
- Deadline timezone, weekend/holiday, override, and escalation rules
- Document reminder, expiry, and external-reference safety rules
- Firm data export, retention, deletion, and offboarding

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

### MVP launch definition

The MVP is not complete merely because all named features exist. It is complete when at least two design-partner firms can onboard representative data, operate one recurring service cycle, recover from common mistakes, and obtain support without engineering editing production data. MCP is post-pilot unless a design partner validates a specific automation job and its risk controls.

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

Milestones are sequential risk-reduction gates. Work may be prepared early, but a later milestone cannot be complete while an earlier exit gate remains open.

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

- Define engagement states: draft, active, blocked, awaiting review, complete, cancelled, reopened, and archived
- Version-aware templates with default stages, owners/reviewers, due-date rules, and document requirements
- Idempotent recurrence with timezone-aware scheduling, failure visibility, retry, and duplicate prevention
- Explicit preparer-to-reviewer handoff, review outcome, reassignment, and completion rules
- Document requests with due dates, reminder/escalation state, and metadata-only external references
- Manager dashboard for overdue, due soon, blocked, unassigned, and awaiting-review work
- Employee provisioning, tenant-consistent work-item ownership, and a server-filtered assigned-work dashboard, covered by authorization and tenant-isolation tests.
- Search and saved portfolio filters by client, service, owner, and filing period
- Validated CSV import with preview, row errors, duplicate handling, and correction flow
- Complete browser flows for templates, engagements, requests, and dashboards—not API-only delivery
- End-to-end tests from recurrence through completion, including tenant isolation

**Exit criterion:** with representative data, a small accounting firm can configure and run a monthly bookkeeping cycle from recurrence through review and completion without a parallel task spreadsheet; a manager can identify all overdue, blocked, unassigned, and awaiting-review engagements in one view.

**Evidence required:** scripted end-to-end acceptance, recurrence idempotency tests, authorization and tenant-isolation tests, import failure tests, and a design-partner walkthrough with unresolved gaps recorded.

### M3 — Pilot-ready SaaS operations

- Guided onboarding, sample templates, useful empty states, and a first-value checklist
- Invitations, role management, membership removal/suspension, password reset, and session revocation
- Firm lifecycle: pilot/trial state, limits, suspension, export, deletion request, and offboarding; billing remains feature-flagged
- EU production deployment with environment separation and controlled migrations
- Logs, metrics, traces, uptime checks, alert ownership, and support correlation IDs
- Encrypted backups and a timed restore drill with recorded recovery results
- Security review of tenant isolation, permission matrix, secrets, sessions, dependencies, rate limits, abuse cases, and audit integrity
- GDPR operating basics: retention, export/delete procedures, subprocessors, privacy terms, and incident response
- Safe, audited support diagnostics without silent tenant impersonation
- Pilot analytics for activation, adoption, completion, deadline visibility, errors, retention, and support burden
- Accessibility, browser compatibility, performance budgets, and critical-path CI checks

**Exit criterion:** two pilot firms can be onboarded, operated, supported, isolated, exported, and recovered safely in production for one complete recurring cycle, without engineers manually mutating tenant data.

**Evidence required:** production-readiness review, successful restore drill, tenant-boundary report, incident/offboarding tabletop exercises, pilot analytics, and acceptance notes from each pilot.

### M4 — Security, privacy, and compliance hardening

M4 makes ForgeBoard suitable for broader EU SaaS use. It establishes demonstrable controls and operating evidence; it does not claim legal certification or replace advice from qualified counsel.

- Data inventory and classification for every stored field, export, log, backup, and third-party processor; document purpose, owner, lawful basis, retention period, and access path
- Privacy-by-design controls: collect only required data, separate operational metadata from sensitive notes, mask personal data in logs and support views, and prohibit secrets or document content in audit summaries
- Firm-managed retention schedules with safe deletion/erasure workflows, legal-hold handling, deletion certificates, and verification that deleted data is absent from primary stores and accessible exports
- Self-service data-subject request workflow for access, rectification, export, and erasure, with identity verification, auditable fulfilment, and defined response ownership
- Security posture: MFA for privileged roles, hardened password and session controls, device/session visibility, suspicious-login detection, and immediate administrator revocation
- Authorization hardening: documented role-permission matrix, deny-by-default authorization tests, periodic membership/access review, and sensitive-action re-authentication
- Encryption and secret management: TLS enforcement, managed encryption at rest, secret rotation, least-privilege production access, and an inventory of keys, certificates, and dependencies
- Audit integrity: append-only mutation history, protected audit access, tamper-evidence strategy, retention policy, and exportable audit reports for a firm
- Secure delivery: dependency and container scanning, SBOM, critical-vulnerability triage SLA, branch protections, environment-specific configuration, and release approval evidence
- Resilience and incident readiness: tested backup restores, disaster-recovery runbook, incident severity model, breach-assessment workflow, customer-notification templates, and annual tabletop exercise
- Vendor and transfer controls: processor register, data-processing agreement checklist, EU data-residency verification, subprocessors review, and transfer-impact review where applicable
- Independent penetration test or equivalent external security assessment; remediate critical/high findings before broader launch

**Exit criterion:** the team can demonstrate, for a representative firm, least-privilege access, protected and exportable audit history, timely data-subject fulfilment, verified deletion, tested recovery, and a rehearsed security-incident response; no unresolved critical or high-risk findings remain from the M4 assessment.

**Evidence required:** data map and retention schedule, permission matrix and automated authorization suite, deletion and data-subject-request test records, restore and incident exercises, vulnerability/SBOM report, processor register, and independent assessment report or documented equivalent.

### Post-MVP candidates

- Billing and self-service subscriptions after willingness-to-pay is validated
- Restricted client portal and secure exchange after storage, malware scanning, retention, and consent are designed
- Email/calendar and accounting-platform integrations selected from pilot demand and backed by a transactional outbox
- Capacity planning and richer reporting after workflow data is proven trustworthy
- Separate worker or MCP deployment only when section 6 extraction triggers are met
- MCP automation, retained as an architectural option and revisited only after a specific pilot-proven automation job, threat model, and product amendment

## 12. Success measures

### Activation and value

- A firm configures its first workflow in under 30 minutes.
- A firm creates or imports 20 clients and launches its first engagement in one session.
- At least 70% of generated engagements reach an explicit terminal outcome.
- At least 80% of active engagements are represented in ForgeBoard after four weeks.
- Managers can identify overdue and blocked work without maintaining a parallel spreadsheet.
- At least 60% of invited operational users are weekly active during a live filing cycle.

### Reliability and trust

- Recurrence creates no duplicate engagements across retries or restarts.
- Every tenant mutation has an attributable, queryable audit event.
- Pilot restore target: RPO ≤ 24 hours and RTO ≤ 4 hours; tighten before general availability.
- No unresolved critical tenant-isolation or authentication findings at pilot launch.
- No unresolved critical or high-risk finding from the M4 security and privacy assessment at broader launch.
- Board updates complete in under 300 ms at the API p95 under expected pilot load.

### Learning and commercial signal

- Every pilot has a named buyer, champion, target workflow, baseline pain, and weekly feedback owner.
- At least two pilots complete a recurring cycle and request continued use.
- Track time-to-first-value, weekly active firms, engagements per firm, completion rate, overdue aging, support requests, and willingness to pay.

Targets remain hypotheses until pilot baselines exist and are reviewed after two complete cycles.

## 13. Product risks and missing decisions

| Risk or missing decision | Why it matters | Resolve by |
| --- | --- | --- |
| No design-partner evidence is recorded | The roadmap may optimize an imagined workflow | Before M2 scope locks |
| Engagement lifecycle and template-version rules are unspecified | Recurrence and reporting will conflict | Early M2 |
| Deadline and calendar rules are unspecified | Accounting deadlines cannot be trusted | Early M2 |
| Roles lack an explicit permission matrix | Browser/MCP parity cannot be proven | M2 |
| Invitations, reset, removal, export, and deletion are absent | Pilots cannot be operated safely | M3 |
| Recovery lacks RPO/RTO and restore evidence | Backups alone are not a usable promise | M3 |
| GDPR is intent rather than procedure | EU pilots create immediate obligations | M3 |
| MCP tools are solution-led rather than job-led | Tool breadth adds risk without proven value | Post-MVP product amendment |
| Pricing, packaging, and limits are undecided | Commercial learning and abuse controls suffer | During M3 pilots |
| Incident, migration, and support ownership is unspecified | Failures become customer-visible chaos | Before first pilot |

## 14. Release gates and roadmap governance

- Each milestone has an accountable owner, target user, measurable outcome, risks, acceptance evidence, and non-goals.
- A feature includes its browser flow, authorization, audit behavior, failure recovery, observability, and documentation in proportion to risk.
- New scope states which milestone outcome improves and what existing work moves out.
- Pilot feedback records frequency, severity, affected role, workaround, and decision.
- Security or tenant-isolation defects can stop a release regardless of schedule.
- MCP remains deferred; it cannot enter production without a new product amendment, threat model, and release gates.

## 15. Decision guardrails

Before adding a feature, answer:

1. Does it help the initial accounting-firm customer complete or oversee client work?
2. Is it required for the current milestone exit criterion?
3. Can it reuse the shared application services and permission model?
4. Does it preserve strict tenant isolation and auditable changes?
5. Is there evidence that it belongs now rather than after pilot feedback?

If the answer to 1 or 4 is no, do not implement it. If the answer to 2 or 5 is no, place it in the later backlog rather than the active milestone.

## 16. Plan maintenance

- This file is the product and architecture baseline.
- Material scope, market, architecture, database, or deployment changes require a dated entry in `CHANGELOG.md` and an update to the relevant section here.
- Implementation work should name the milestone it advances.
- At the end of every meaningful code change, update `CHANGELOG.md` in the same commit or patch.
- Completed milestone exit criteria should be marked here only after automated verification succeeds.
