# Railway service definitions

Railway is the locked deploy target for control plane + US data plane;
EU data plane runs on Railway eu-west. Every app maps to one service +
its own Dockerfile under `infra/docker/`.

See [docs/architecture.md § Infrastructure & Deployment](../../docs/architecture.md#infrastructure--deployment) for the higher-level decisions.

## Services (per region)

| Service | Dockerfile                            | Type      | Notes                                                     |
|---------|---------------------------------------|-----------|-----------------------------------------------------------|
| api     | `infra/docker/api.Dockerfile`         | HTTP      | Fastify; `PORT=3001` (Railway-assigned).                  |
| workers | `infra/docker/workers.Dockerfile`     | worker    | pg-boss handlers; no public ports.                        |
| web     | `infra/docker/web.Dockerfile`         | HTTP      | Caddy serving the Vite SPA on `:8080`.                    |
| bot     | `infra/docker/bot.Dockerfile` (TODO)  | worker    | Zoom Meeting SDK + Teams Graph; no public ports.          |

## Add-ons

- **Postgres 16** — primary data plane. Connection URL → `DATABASE_URL`.
- **Redis 7** — refresh tokens, heartbeat keys, presigned-URL cache. → `REDIS_URL`.
- **S3** — recordings + DSAR exports. Bring your own bucket; configure
  `S3_BUCKET` + `S3_REGION` + AWS credentials.

pg-boss runs in the same Postgres as the data — no separate broker
service required.

## Environment

Each service inherits the variable set documented in `/.env.example`.
For production, set secrets via the Railway dashboard or
`railway variables --set`. Keep variable NAMES identical between dev +
prod; only values differ. The `services.json` in this directory lists
which env vars each Railway service needs.

### Region pinning

| Variable        | US value     | EU value     |
|-----------------|--------------|--------------|
| REGION          | `us`         | `eu`         |
| BEDROCK_REGION  | `us-east-1`  | `eu-west-1`  |
| S3_REGION       | `us-east-1`  | `eu-west-1`  |

The `tenants.region` field controls per-tenant region pin; the API
process REGION env var asserts the deployment's identity.

## First deploy

1. `railway login`
2. `railway init` (pick the project; create one per region).
3. For each service, link a Dockerfile:
   ```
   railway service create api
   railway service connect api
   railway up --service api --dockerfile infra/docker/api.Dockerfile
   ```
4. Add the Postgres + Redis add-ons; copy connection URLs into the
   service env.
5. Run migrations from your shell against the prod DB:
   ```
   DATABASE_URL=$RAILWAY_DATABASE_URL pnpm --filter @aisecretary/db db:migrate
   ```
6. Smoke test: `curl https://<api-domain>/healthz` → `{ "status": "ok" }`.
7. Sign up at the web service domain → record a meeting → verify the
   transcribe job lands in the workers' logs.

## Local-dev parity

`infra/docker/docker-compose.local.yml` brings up Postgres + Redis +
MinIO so the api + workers can run end-to-end locally without cloud
accounts. Same Dockerfiles, same code paths.

## Known constraints

- The web service's static-asset cache lives in the Caddy layer; cold
  cache after deploy is fine — Cloudflare in front amortizes it. If
  you put Cloudflare in front of the api service, configure it to NOT
  cache `Authorization`-bearing routes (default behavior; just don't
  override).
- Worker `cronMonitorIntervalSeconds` defaults to 30s; the
  `recording-watchdog` cron fires every 15s. Set
  `PG_BOSS_CRON_MONITOR_SECONDS=15` on the workers service if you need
  the tighter interval for capture-at-risk SLA (Story 4.4).
- The `apps/admin` placeholder is reserved for the F2-admin flow (Story
  12.x); no Railway service exists for it yet.
- The `apps/bot` Dockerfile + Railway service definition land alongside
  Story 9.1 (Zoom S2S OAuth) — placeholder reserved.
