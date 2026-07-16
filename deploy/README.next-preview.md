# Next preview dual-stack rollout

`compose.next.yaml` serves the dedicated `NEXT_PREVIEW_HOST` through Caddy. The
existing legacy Vite/Spring deployment remains unchanged and supplies the private
`FORGEBOARD_API_BASE_URL`, so preview firms use the same existing data plane.
Before starting the preview, attach the existing Spring service and this Compose
project to the same external Docker network named by `FORGEBOARD_BACKEND_NETWORK`.
Set `FORGEBOARD_API_BASE_URL` to the Spring service DNS name on that network (for
example, `http://backend:8080`). The Next health check verifies that private Spring
health endpoint before the gateway starts.

Supply all variables through an external secret/configuration file or deployment secret
store. The file must include `AUTH_SECRET`, `FORGEBOARD_API_BASE_URL`,
`FORGEBOARD_BACKEND_NETWORK`,
`NEXT_PREVIEW_HOST`, `ACME_EMAIL`, `FORGEBOARD_TOKEN_ISSUER`, and the server-only
`FORGEBOARD_PREVIEW_FIRM_SLUGS` allow-list. It must not be committed.

Start the pilot from the repository root:

```sh
docker compose --env-file /run/secrets/forgeboard-preview.env -f deploy/compose.next.yaml up -d --build
```

Run the smoke check with disposable pilot credentials:

```sh
SMOKE_BASE_URL=https://next-preview.example.com \\
SMOKE_BACKEND_HEALTH_URL=https://forgeboard.example.com/actuator/health \\
SMOKE_EMAIL=pilot@example.com SMOKE_PASSWORD=... SMOKE_FIRM_SLUG=pilot-accounting \\
sh deploy/smoke-next-preview.sh
```

## Rollback

No database rollback is required. Remove the preview hostname's DNS/load-balancer route
to the gateway (or stop the `next` service) and direct pilot users back to `LEGACY_HOST`.
Keep the legacy hostname and its Vite/Spring routing unchanged during the observation
period. Do not point the preview hostname at Vite: its Auth.js cookies are intentionally
scoped to the dedicated preview origin.
