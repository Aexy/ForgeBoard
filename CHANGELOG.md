# Change Log

This file records meaningful product, architecture, code, schema, configuration, and documentation changes. Update it whenever new code or a material design change is added.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) with an `Unreleased` section during active development.

## Update rules

- Add entries under `Added`, `Changed`, `Fixed`, `Security`, `Deprecated`, or `Removed`.
- Describe user-visible behavior or architectural impact, not individual file edits.
- Include the relevant milestone (`M0`–`M4`) when applicable.
- Record database migrations by migration identifier.
- Record material plan changes and the reason for them.
- Keep entries concise; link to deeper decision documents when needed.

## [Unreleased]

### Changed

- Updated ForgeBoard's primary README tagline to “From deadline to done.” (`M2`)
- Reworked the project README around the ForgeBoard identity, current M2 capabilities, architecture, security model, and streamlined contributor setup. (`M2`)

- Reframed the roadmap as sequential outcome and evidence gates: expanded M2 into a complete accounting operating loop, moved production pilot readiness ahead of automation in M3, and made M4 a security, privacy, and compliance-hardening milestone. MCP remains in the architecture and deferred backlog, outside the active M4 scope. Added launch criteria, product risks, lifecycle decisions, SaaS operations, GDPR/recovery requirements, and measurable pilot learning goals. (`M2`–`M4`)
- Rolled out the ForgeBoard visual identity across sign-in, onboarding, and the authenticated workspace, including the new production logo and responsive brand layout. (`M2`)
- Excluded generated `output/` brand artifacts from Git while keeping the website logo as a tracked frontend asset. (`M2`)

### Added

- Engagement templates and recurring engagement records, with firm-scoped workflow/client references, period normalization, due-date generation, REST endpoints, and audit events. (`M2`, migration `V004`)
- Client document-request tracking with metadata-only external references, received status, tenant scope, and audit events. (`M2`, migration `V005`)
- Initial manager deadline dashboard API for overdue, due-soon, blocked, and awaiting-review work. (`M2`)
- Linked started engagements to generated board work items, including a persisted `work_item_id`, generated first-stage work item, API exposure, and non-ID frontend confirmation. (`M2`, migration `V007`)

### Fixed

- Aligned the engagement-template due-day migration with Hibernate's integer mapping, restoring PostgreSQL application-context startup and CI integration coverage. (`M2`, migration `V006`)

- Product and architecture baseline for LedgerFlow, targeting independent accounting firms. (`M0`)
- Milestone exit criteria and decision guardrails to prevent uncontrolled scope expansion. (`M0`)
- Change-log convention requiring updates alongside meaningful code additions. (`M0`)
- Spring Boot backend foundation with security defaults, platform metadata, PostgreSQL configuration, and module architecture verification. (`M0`)
- Initial tenancy migration `V001` for firms, users, memberships, and auditable activity events. (`M0`)
- React and TypeScript application shell presenting the first accounting workflow board. (`M0`)
- Docker Compose PostgreSQL environment and GitHub Actions verification workflows. (`M0`)
- Persisted firm, user, and membership domain models with repository boundaries. (`M0`)
- Transactional firm onboarding that normalizes identities, hashes owner passwords, and creates the initial owner membership. (`M0`)
- Database-backed authentication and explicit tenant selection through the `X-ForgeBoard-Firm` request header. (`M0`)
- Tenant authorization that rejects authenticated users without membership in the selected firm. (`M0`)
- Browser-session login, current-session, logout, and CSRF token endpoints. (`M0`)
- PostgreSQL Testcontainers integration coverage for Flyway, onboarding persistence, and activity events; it skips locally when Docker is unavailable. (`M0`)
- A credentialed frontend session client with CSRF-aware logout. (`M0`)
- Accessible React firm-onboarding and owner-login flows with session restoration, sign-out, loading, and error states. (`M0`)
- Tenant-isolated client records with create, list, detail, update, and archive operations. (`M1`)
- Client schema migration `V002` with firm-scoped indexes and status constraints. (`M1`)
- Workflow, ordered-stage, and ranked work-item schema migration `V003` with composite firm foreign keys. (`M1`)
- Tenant-scoped workflow and board APIs for creating workflows, loading boards, creating work items, and moving cards. (`M1`)
- Fractional work-item ranking with neighbor validation and persistent accessible movement semantics. (`M1`)
- Tenant-scoped activity-history query API for recent and target-specific audit events. (`M1`)
- Authenticated React workflow UI for creating workflows and client-linked work items, selecting boards, and loading persisted stages and cards. (`M1`)
- Persistent native drag-and-drop card movement with accessible left/right movement controls. (`M1`)
- Visible tenant-scoped activity panel that refreshes after workflow, work-item, client, and movement mutations. (`M1`)
- Automatic firm discovery after existing-account login so a fresh browser can open the correct tenant without an internal firm ID. (`M1`)

### Changed

- Chose a shared modular application core with separate REST and MCP adapters instead of independent web and MCP products. This preserves consistent permissions, validation, transactions, and audit history while allowing later deployment separation. (`M0`)
- Marked M0 complete and began M1 after authenticated firm onboarding, tenant isolation, CI, and local developer startup requirements were implemented. (`M1`)
- Marked M1 complete after its client-work-item, persistent workflow movement, and visible-history exit criterion passed backend, PostgreSQL, and frontend verification. (`M1`)

### Fixed

- Recent activity now replaces internal workflow and stage IDs with work-item titles, stage names, and readable fallback descriptions. (`M1`)
- Restored sessions now resolve the selected firm's display name instead of showing a generic placeholder. (`M1`)
- Enabled Spring Boot 4 Flyway auto-configuration with `spring-boot-starter-flyway`, fixing PostgreSQL integration-test startup before Hibernate schema validation. (`M1`)

### Security

- Established tenant isolation, scoped MCP tokens, auditable mutations, EU deployment, and GDPR-aware data handling as baseline requirements. (`M0`)
- Added BCrypt password hashing with work factor 12 and membership verification before tenant context is exposed. (`M0`)
- Added persisted `firm.created` activity events within the onboarding transaction. (`M0`)
- Added cookie-based CSRF protection for browser-session mutations while keeping onboarding and login as explicit public entry points. (`M0`)
- Hardened session login to require CSRF, removed global HTTP Basic authentication, narrowed tenant-filter exclusions to exact auth routes, and added production cookie settings. (`M0`)
- Enforced client tenant scope in every application operation and repository query, including negative cross-tenant and read-only-role tests. (`M1`)
- Added database-enforced tenant consistency across clients, workflows, stages, and work items using composite foreign keys. (`M1`)
