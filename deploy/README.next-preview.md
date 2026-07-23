# Next deployment configuration (inactive)

There is no active ForgeBoard deployment. The legacy Vite frontend has been retired in
source; no preview allow-list, rollout, observation period, or rollback route is part of
the cutover. `compose.next.yaml` remains an inactive deployment template and has not
been activated or otherwise changed by this source cutover.

When deployment becomes in scope, configure `AUTH_SECRET`,
`FORGEBOARD_API_BASE_URL`, `FORGEBOARD_BACKEND_NETWORK`, `NEXT_PREVIEW_HOST`,
`ACME_EMAIL`, and `FORGEBOARD_TOKEN_ISSUER` through a secret store or untracked
environment file. The Next BFF must keep Spring bearer credentials server-side and must
not forward Spring cookies to browsers.
