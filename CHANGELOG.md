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

### Added

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

### Changed

- Chose a shared modular application core with separate REST and MCP adapters instead of independent web and MCP products. This preserves consistent permissions, validation, transactions, and audit history while allowing later deployment separation. (`M0`)
- Marked M0 complete and began M1 after authenticated firm onboarding, tenant isolation, CI, and local developer startup requirements were implemented. (`M1`)
- Marked M1 complete after its client-work-item, persistent workflow movement, and visible-history exit criterion passed backend, PostgreSQL, and frontend verification. (`M1`)

### Fixed

- Enabled Spring Boot 4 Flyway auto-configuration with `spring-boot-starter-flyway`, fixing PostgreSQL integration-test startup before Hibernate schema validation. (`M1`)

### Security

- Established tenant isolation, scoped MCP tokens, auditable mutations, EU deployment, and GDPR-aware data handling as baseline requirements. (`M0`)
- Added BCrypt password hashing with work factor 12 and membership verification before tenant context is exposed. (`M0`)
- Added persisted `firm.created` activity events within the onboarding transaction. (`M0`)
- Added cookie-based CSRF protection for browser-session mutations while keeping onboarding and login as explicit public entry points. (`M0`)
- Hardened session login to require CSRF, removed global HTTP Basic authentication, narrowed tenant-filter exclusions to exact auth routes, and added production cookie settings. (`M0`)
- Enforced client tenant scope in every application operation and repository query, including negative cross-tenant and read-only-role tests. (`M1`)
- Added database-enforced tenant consistency across clients, workflows, stages, and work items using composite foreign keys. (`M1`)
