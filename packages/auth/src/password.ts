/**
 * Argon2id password hashing.
 *
 * Parameters chosen per OWASP 2024 Password Storage Cheat Sheet:
 *   - memoryCost: 19 MiB (19456 KiB)
 *   - timeCost:   2 iterations
 *   - parallelism: 1 lane
 *   - hashLength: 32 bytes
 *
 * Backed by `@node-rs/argon2` — the native-Rust binding is ~10× faster
 * than pure-JS variants under load (matters for login fan-out under
 * Story 1.5a's ≤500ms median target).
 */

import { hash, verify } from '@node-rs/argon2';

/**
 * `@node-rs/argon2` defaults to Argon2id when `algorithm` is omitted, so
 * we don't pass it explicitly. The library's `Algorithm` type is a
 * `const enum`, which TS rejects under `verbatimModuleSyntax` — keeping
 * the omission also dodges that constraint without runtime risk
 * (Argon2id is the only modern variant we'd ever want).
 *
 * Verification of the PHC string output asserts `$argon2id$` prefix in
 * `password.test.ts` so a future library default change is caught.
 */
export const ARGON2_PARAMS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

/**
 * Hash a plaintext password with Argon2id.
 *
 * Output is the standard PHC string starting with `$argon2id$` — salt is
 * generated internally by `@node-rs/argon2`. Store the entire string in
 * `users.password_hash`.
 */
export const hashPassword = async (plain: string): Promise<string> => {
  return await hash(plain, {
    memoryCost: ARGON2_PARAMS.memoryCost,
    timeCost: ARGON2_PARAMS.timeCost,
    parallelism: ARGON2_PARAMS.parallelism,
    outputLen: ARGON2_PARAMS.hashLength,
  });
};

/**
 * Verify a plaintext password against a stored Argon2id hash.
 *
 * Returns `false` for any verification failure — including malformed
 * hashes — so a corrupted column doesn't surface a 500 to the caller.
 * Errors are logged at the call site (the auth route handler).
 */
export const verifyPassword = async (plain: string, storedHash: string): Promise<boolean> => {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
};
