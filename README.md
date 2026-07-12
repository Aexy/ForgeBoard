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

The response includes the new `firmId`. Authenticated tenant requests use HTTP Basic during M0 and must select that firm explicitly:

```shell
curl http://localhost:8080/api/identity/me \
  -u owner@example.com:"correct horse battery" \
  -H "X-ForgeBoard-Firm: <firmId>"
```

The firm header is checked against persisted membership on every tenant API request. Browser sessions and scoped service tokens will replace direct Basic authentication before SaaS launch.

## Current milestone

M0 — Foundation and walking skeleton. See [PRODUCT_PLAN.md](PRODUCT_PLAN.md#11-delivery-milestones).
