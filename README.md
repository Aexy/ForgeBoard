# ForgeBoard

ForgeBoard is the repository for **LedgerFlow**, a secure workflow and Kanban SaaS for independent accounting firms. It combines deadline-driven client work with an auditable MCP interface for approved agent automation.

The product direction and scope guardrails live in [PRODUCT_PLAN.md](PRODUCT_PLAN.md). Meaningful changes must also be recorded in [CHANGELOG.md](CHANGELOG.md).

## Repository structure

```text
backend/     Spring Boot application and shared domain/application core
frontend/    React and TypeScript web client
deploy/      Local and production deployment configuration
docs/        Architecture and operating documentation
```

## Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 22+ and pnpm 10+
- Docker with Compose

## Local development

Copy `.env.example` to `.env`, start PostgreSQL with `docker compose --env-file .env -f deploy/compose.yaml up -d postgres`, and then run:

```shell
mvn -f backend/pom.xml spring-boot:run
pnpm --dir frontend install
pnpm --dir frontend dev
```

The backend listens on `http://localhost:8080`; Vite listens on `http://localhost:5173` and proxies `/api` to the backend.

### Create the first firm

```shell
curl -X POST http://localhost:8080/api/onboarding/firms \
  -H "Content-Type: application/json" \
  -d '{"firmName":"Hearth Accounting","firmSlug":"hearth-accounting","ownerEmail":"owner@example.com","ownerName":"Alex Owner","password":"correct horse battery"}'
```

The response includes the new `firmId`. Browser clients create an HTTP session:

```shell
curl -c cookies.txt -X POST http://localhost:8080/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"correct horse battery"}'
```

Authenticated tenant requests must select a firm explicitly:

```shell
curl -b cookies.txt http://localhost:8080/api/identity/me \
  -H "X-ForgeBoard-Firm: <firmId>"
```

The firm header is checked against persisted membership on every tenant API request. Mutating session requests require the CSRF token returned by `GET /api/auth/csrf`. HTTP Basic remains enabled temporarily for development; scoped service tokens will be the MCP authentication path.

### Client records

All client operations are tenant-scoped and require the selected firm header. For example, after fetching a CSRF token:

```shell
curl -b cookies.txt -X POST http://localhost:8080/api/clients \
  -H "Content-Type: application/json" \
  -H "X-ForgeBoard-Firm: <firmId>" \
  -H "X-XSRF-TOKEN: <csrfToken>" \
  -d '{"legalName":"Northstar Studio GmbH","displayName":"Northstar Studio","primaryEmail":"hello@northstar.at"}'
```

Client reads and writes always include the firm identifier in repository queries; a global client-ID lookup is not used.

### Workflow board API

Create a workflow with ordered stages using `POST /api/workflows`, then create work using
`POST /api/workflows/{workflowId}/items`. The complete persisted board is returned by
`GET /api/workflows/{workflowId}`.

Cards move through `PATCH /api/workflows/{workflowId}/items/{itemId}/position`. The request names the target stage and optional neighboring item IDs; the server calculates a fractional rank and verifies that every referenced row belongs to the selected firm and workflow.

Recent auditable changes are available from `GET /api/activity`, or can be filtered with `targetType` and `targetId` query parameters.

## Current milestone

M1 — Complete workflow slice. See [PRODUCT_PLAN.md](PRODUCT_PLAN.md#11-delivery-milestones).
