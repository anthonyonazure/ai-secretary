# @aisecretary/auth

Argon2id password hashing (`@node-rs/argon2`), short-lived JWT issuance/verification (HS256 via `jose`), and refresh-token rotation against a pluggable `RefreshTokenStore` (`RedisRefreshTokenStore` for production, `InMemoryRefreshTokenStore` for tests + dev).

Story 1.5a delivers email/password + JWT + refresh-token rotation. OAuth (1.5b), TOTP MFA (1.5c), and email invites (1.5d) extend this package without replacing the surface; SAML is a reserved Fastify plugin slot per `docs/architecture.md` § Authentication & Security.

## Surface

| Export | Purpose |
|---|---|
| `hashPassword(plain)` / `verifyPassword(plain, hash)` | Argon2id with OWASP 2024 params |
| `signAccessToken({ user, secret })` | Mint a 15-minute HS256 JWT |
| `verifyAccessToken(token, secret)` | Verify + return `AccessTokenPayload` |
| `generateRefreshToken()` | 256-bit base64url string |
| `RefreshTokenStore` (interface) | save / lookup / rotate / revoke / revokeAllForUser |
| `RedisRefreshTokenStore` | Production backend; rotation runs as MULTI/EXEC |
| `InMemoryRefreshTokenStore` | Tests + dev fallback |

## Rotation semantics

`rotate(oldToken, { token: newToken, expiresAt })` is atomic in the Redis backend (Redis MULTI/EXEC). If the old token is unknown or revoked, `rotate` returns `null` — route handlers translate that into a 401. Successful rotation deletes the old key, removes it from the per-user index, writes the new key with the new TTL, and adds it to the per-user index. The route handler at `/api/v1/auth/refresh` consumes this contract.

See `docs/architecture.md` § Authentication & Security and the auth route at `apps/api/src/routes/auth.ts`.
