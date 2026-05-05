# Threat Model

STRIDE-based threat model for AI Secretary's capture → transcribe →
analyze → share pipeline. Updated alongside any architectural change
that introduces a new trust boundary or processing surface.

**Last updated:** 2026-05-05.

## System diagram (text)

```
[mobile/web client] --(TLS 1.3)--> [apps/api Fastify]
                                       |
                                       +-> [Postgres (RLS)]
                                       +-> [Redis (refresh tokens, heartbeat)]
                                       +-> [pg-boss queues]
                                              |
                                              +-> [apps/workers] -> LLM gateway / Transcription / Notifications
                                              +-> [apps/bot]     -> Zoom/Teams SDK -> S3 (audio chunks)
                                              +-> [apps/workers crm.push handler] -> CRM provider APIs
```

Trust boundaries:

1. **Client ↔ API** — TLS 1.3, JWT-authenticated.
2. **API ↔ Postgres** — RLS-enforced; tenant context set per-request.
3. **API ↔ pg-boss queues** — same Postgres database; tenant context propagates via job payload.
4. **API ↔ third-party providers** (Anthropic, OpenAI, AWS, etc.) — TLS + signed credentials per region.
5. **Workers ↔ Redis** — internal network; ACL'd.
6. **Bot ↔ Zoom/Teams** — provider-managed TLS.
7. **Extension ↔ API** — TLS + dedicated long-lived API token (paired one-time via the web app).

## STRIDE per surface

### S — Spoofing

| Threat | Attack | Mitigation |
|---|---|---|
| Forged JWT | Attacker mints a JWT with arbitrary tenant ID | HS256 signed by per-region secret; secret rotation runbook; refresh tokens stored server-side and revocable |
| OAuth ID-token replay | Replays a stolen ID token within the 5-min window | `jose.jwtVerify` honors `maxTokenAge: '5m'`; nonce + state checks on the OAuth callback path |
| Bot impersonation | Attacker creates a fake bot session | `POST /api/v1/bot-sessions` requires authenticated user with tenant context; bot service validates the session row exists in the same tenant before joining |
| CRM push impersonation | Attacker submits a push for a meeting they don't own | `POST /api/v1/crm/push` validates the integration belongs to the caller's tenant; the worker re-validates by tenant context before decrypting tokens |
| Federated sign-up by stranger | Anyone with a Google account creates a tenant | `httpOauthExchange` returns null when no `users` row matches the email; sign-up requires the F2-admin invite flow |

### T — Tampering

| Threat | Attack | Mitigation |
|---|---|---|
| Audit log tampering | Insider edits `audit_logs` to hide an action | SQL-level `REVOKE UPDATE, DELETE ON audit_logs FROM app_role`; only the `audit-logger` plugin's sink can INSERT |
| Transcript tampering at rest | S3 object overwritten | S3 versioning enabled; `recordings.storage_key` is unique per recording (no overwrite path) |
| Encrypted-token tampering | Attacker flips bytes in the envelope ciphertext | AES-256-GCM auth tag; decryption fails on tamper (verified in `envelope-encryption.test.ts`) |
| RLS bypass via tenant ID injection | Attacker passes `tenantId` in request body | CLAUDE.md anti-pattern: tenantId is read from auth context only, never from request body |
| Cross-region write | Attacker tries to flip a tenant's region | DB trigger `enforce_region_lock` raises after region pin |

### R — Repudiation

| Threat | Mitigation |
|---|---|
| User denies an action | Audit log carries `actor_user_id` + `request_id` + `ip_address` + `user_agent` for every state-changing call |
| Worker denies a job ran | pg-boss persists job state; audit log captures handler-emitted events |
| Bot denies it joined a meeting | `bot_sessions` FSM transitions are audit-logged at every state change |

### I — Information disclosure

| Threat | Attack | Mitigation |
|---|---|---|
| Cross-tenant data leak | Query escapes RLS | RLS policy `USING (tenant_id = current_tenant_id())`; defense in depth via app-layer tenant context plugin |
| Audit log leaks PII into logs | `metadata` includes raw email | DSAR erasure cascade has `redact` strategy; the cascade walker scrubs PII fields on erasure |
| LLM prompt leakage | LLM provider logs the prompt | Anthropic + Bedrock + Azure all support zero-data-retention contracts; routing matrix forces ZDR providers for HIPAA tenants |
| Transcript leakage via shares | Recipient of a share sees more than intended | Share rows carry an explicit `transcript_visibility` flag; cross-org policy gate runs at view time (ADR-0006) |
| Log files contain audio bytes | A handler logs the raw audio buffer | CLAUDE.md anti-pattern: never log passwords, JWTs, raw audio, full transcripts |
| OAuth token in URL | Provider redirects with `code` in query string | Code is exchanged + immediately discarded server-side; never persisted |
| Decrypted CRM token escapes the worker boundary | Token logged or returned in a response | `getDecryptedTokensForJoin` is the only API surface that returns plaintext; callers (worker handler only) immediately pass to provider; never logged |

### D — Denial of service

| Threat | Mitigation |
|---|---|
| Auth-endpoint flood | Per-IP + per-tenant rate-limit middleware |
| LLM cost-exhaustion attack | Per-tenant entitlements gate (`tenant_entitlements`); LLM gateway enforces `maxOutputTokens` per call |
| Storage-fill attack | Per-tenant storage quota; presigned-PUT URLs are time-limited (15 min) and content-type pinned |
| Long-running bot job | pg-boss timeout + abort signal; `BOT_SESSION_DURATION_MS` hard cap (default 4h) |
| Recursive cross-org share | Inbound shares can't re-share without admin approval |

### E — Elevation of privilege

| Threat | Mitigation |
|---|---|
| Org-admin → super-admin | Two distinct roles: `tenant_members.role = 'admin'` (org-level) vs `users.role = 'super_admin'` (platform-level); only platform-level admin actions hit the `/api/v1/admin/*` routes |
| Deactivated user retains access | Deactivation flips `users.role = 'deactivated'`; refresh-token store is revoked at the Redis layer |
| Tenant takeover via password reset | Reset emails go to the email on file; reset tokens are single-use + 30-min TTL |
| MFA bypass via recovery codes | Recovery codes are single-use; consuming one logs the action; tenant admin can require MFA reenrollment |
| Trial-expired tenant exfil | `tenant-state-check` plugin: mutating routes 402; read + DSAR retained |

## Compensating controls

When a primary control fails, these compensating controls limit blast radius:

- **RLS bypass** → audit log captures the attempt (`audit_logs.action = 'rls.unexpected'` would be added on detection)
- **Insider tries to read another tenant's S3 object** → KMS-managed S3 bucket policy + per-tenant key prefix
- **Provider compromise** → per-region secret rotation; LLM ZDR contracts limit exposure window

## Out-of-band threats

- **Physical access to laptops** — out of scope; tenant responsibility.
- **Insider with database admin** — mitigated by audit log immutability + role separation, but a sufficiently privileged attacker who controls the application role can read tenant data. Detection (CloudTrail + Postgres logs) is the only mitigation; prevention requires database-level row encryption (TODO; tracked as a future investment).
- **Supply-chain compromise of `@hubspot/api-client` etc.** — mitigated by package-lock hashes + dependabot; no execution at install time.

## Review cadence

This threat model is updated:

- Whenever an ADR introduces a new trust boundary
- Whenever a new sub-processor is engaged
- Annually as part of the SOC 2 Type II evidence cycle
