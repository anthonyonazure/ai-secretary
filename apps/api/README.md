# @aisecretary/api

Fastify 5 + TypeScript REST API for the AI Secretary platform. Owns the HTTP surface (`/api/v1/*`), authentication, tenant-context propagation, audit-log plugin wiring, consent checks, entitlement checks, and SSE channels for real-time UI updates. Talks to Postgres directly via `@aisecretary/db` and enqueues async work onto pg-boss queues consumed by `@aisecretary/workers`.

See `docs/architecture.md` § API & Communication Patterns and `_bmad-output/planning-artifacts/arch-addendums.md` for the request/response contracts.
