# @aisecretary/workers

pg-boss queue consumers for asynchronous pipeline stages: `transcribe`, `summarize`, `analyze`, `index`, `retention`, plus addendum-introduced handlers (`crm.push`, `crm.sync`). Every job payload carries `tenantId` and `region`; handlers MUST set `app.current_tenant_id` and `app.current_region` before any DB query.

See `docs/architecture.md` § API & Communication Patterns (Async work) and `apps/workers/src/lib/job-context.ts` (once implemented) for the context-propagation pattern.
