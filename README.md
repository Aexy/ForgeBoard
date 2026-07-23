<p align="center">
  <img src="apps/web/public/forgeboard-logo.svg" alt="ForgeBoard" width="420" />
</p>

<p align="center">
  <strong>From deadline to done.</strong>
</p>

<p align="center">
  A secure, deadline-driven operations platform for independent accounting and bookkeeping firms.
</p>

---

## About ForgeBoard

ForgeBoard gives accounting teams one accountable place to manage recurring client work. It combines configurable workflow boards, client records, engagement templates, document requests, deadline visibility, and a complete activity history.

The product is designed for firms with 5-50 staff that have outgrown spreadsheets, email threads, shared drives, and generic task managers. Its interface uses accounting language while the underlying platform retains reusable workflow primitives.

### What it helps teams do

- See every active engagement, deadline, owner, and handoff in one place.
- Run repeatable monthly, quarterly, and annual workflows from templates.
- Identify overdue, blocked, due-soon, and awaiting-review work early.
- Track missing client documents without storing source financial files.
- Keep browser and API changes tenant-scoped and auditable.
- Prepare for carefully permissioned agent automation through shared application services.

## Current product state

ForgeBoard has completed its foundation and end-to-end workflow milestones. Work is currently focused on **M2 - Accounting workflow value**.

| Capability | Status |
| --- | --- |
| Firm onboarding, authentication, and tenant isolation | Available |
| Client directory and lifecycle | Available |
| Configurable workflow boards and ranked work items | Available |
| Persistent card movement and activity history | Available |
| Engagement templates and recurring engagement records | Available |
| Metadata-only document requests | Available |
| Manager deadline dashboard API | Available |
| CSV client import | In progress |
| Complete engagement lifecycle and portfolio filtering | Planned in M2 |
| Pilot-ready SaaS operations | Planned in M3 |

The approved roadmap, scope boundaries, and milestone evidence gates live in [PRODUCT_PLAN.md](PRODUCT_PLAN.md). Material changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## Product principles

1. **Accounting first.** Product language and defaults must match real accounting-firm work.
2. **Everything tenant-scoped.** Every firm-owned operation verifies membership and firm identity.
3. **One source of business rules.** Browser, REST, scheduled jobs, and future MCP tools use the same application services.
4. **Audit every mutation.** Changes record the actor, source, time, target, and a safe summary.
5. **Automation with boundaries.** Agent access is introduced only through explicit scopes and validated use cases.

## Architecture

ForgeBoard is a modular monolith with separate inbound adapters and a shared application core.

```text
React web client  ──> REST controllers ──┐
                                         │
Future MCP adapter ──────────────────────┼──> Application services ──> Domain ──> PostgreSQL
                                         │
Scheduled jobs ──────────────────────────┘
```

| Layer | Technology |
| --- | --- |
| Web client | Next.js App Router, React, TypeScript, Redux Toolkit, RTK Query, CSS Modules |
| Backend | Java 21, Spring Boot, Spring MVC, Spring Data JPA |
| Security | Auth.js browser sessions, same-origin Next BFF, Spring bearer APIs, tenant selection |
| Database | PostgreSQL with Flyway migrations |
| Testing | JUnit, AssertJ, MockMvc, Testcontainers, Vitest, Testing Library |
| Deployment | OCI container with Docker Compose for local infrastructure |

### Repository layout

```text
backend/     Spring Boot application, domain modules, migrations, and tests
apps/web/    Routed Next.js application, BFF, UI components, and tests
packages/    Shared frontend API-client, UI, and configuration packages
deploy/      Local and production deployment configuration
```

## Run locally

### Prerequisites

- Java 21 or newer
- Maven 3.9 or newer
- Node.js 22 or newer
- pnpm 10 or newer
- Docker with Compose

### 1. Configure the environment

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

The backend automatically reads this local, gitignored `.env` file when it starts. It supplies both the PostgreSQL container settings and the `DB_*` values used by Spring Boot. Also set `FORGEBOARD_API_TOKEN_SECRET` to a random Base64 value of at least 32 bytes; it signs backend API-session JWTs and must not be committed.

### 2. Start PostgreSQL

```bash
docker compose --env-file .env -f deploy/compose.yaml up -d postgres
```

### 3. Start the backend

```bash
mvn -f backend/pom.xml spring-boot:run
```

The API is available at `http://localhost:8080`.

### 4. Start the web application

```bash
pnpm --filter @forgeboard/web dev
```

The web application is available at `http://localhost:3000`. Its same-origin `/api/forgeboard/*` BFF routes obtain the server-side Auth.js session and forward a bearer credential to Spring; browser code never receives Spring credentials.

Open the application, create the first firm and owner account, then configure a client and workflow from the guided interface.

## Verify the project

Run the backend suite:

```bash
mvn -f backend/pom.xml test
```

Run the frontend tests and production build:

```bash
pnpm web:test
pnpm web:check
pnpm web:build
```

Run the browser check after PostgreSQL and Spring Boot are running:

```bash
pnpm --filter @forgeboard/web test:e2e
```

The check starts Next.js, creates an isolated local firm through the onboarding API, and verifies the Auth.js sign-in, firm deep link, client creation, and reload flow in Chromium. It requires the Playwright Chromium browser (`pnpm --filter @forgeboard/web exec playwright install chromium`) on first use.

PostgreSQL integration tests use Testcontainers and require a working Docker environment.

## API conventions

Browser clients use Auth.js cookies only with the Next application. The server-side BFF forwards a bearer credential to Spring and never forwards Spring cookies to the browser. Every tenant request explicitly selects a firm:

```http
X-ForgeBoard-Firm: <firm-id>
```

Core API areas include:

```text
/api/onboarding/firms
/api/auth
/api/identity
/api/clients
/api/workflows
/api/engagements
/api/document-requests
/api/dashboard/deadlines
/api/activity
```

Controllers remain thin: authorization, validation, transactions, domain rules, and audit recording belong to the shared application layer.

## Security model

- Every tenant-owned table carries a firm identifier.
- Every tenant operation verifies the authenticated user's firm membership.
- Browser sessions are Auth.js-only; protected Spring APIs require bearer authentication and are stateless.
- Passwords are hashed with BCrypt.
- Database constraints reinforce cross-tenant consistency.
- Activity records cover browser and API mutations.
- Source financial documents are outside the current product scope.
- The roadmap anticipates EU deployment and GDPR operating requirements.

Security-sensitive implementation details and future controls are documented in [PRODUCT_PLAN.md](PRODUCT_PLAN.md).

## Contributing

Before making a material change:

1. Check that it advances the active milestone and initial accounting-firm use case.
2. Preserve modular boundaries and tenant isolation.
3. Add automated coverage proportional to the risk.
4. Update [CHANGELOG.md](CHANGELOG.md) in the same change.
5. Update [PRODUCT_PLAN.md](PRODUCT_PLAN.md) when scope, architecture, or milestone decisions change.

Generated files under `output/`, temporary files under `tmp/`, and local helper files under `tools/` are intentionally excluded from version control.
