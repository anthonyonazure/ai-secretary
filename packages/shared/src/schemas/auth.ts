import { z } from 'zod';

/**
 * Wire contract for the auth API surface (Story 1.5a).
 *
 * Agent A (apps/api) implements POST /api/v1/auth/{signup,login,refresh,
 * logout} + GET /api/v1/auth/me against these schemas. Agent B
 * (apps/web + apps/mobile) consumes them on the client side.
 *
 * Frozen at this slice: email/password + JWT + refresh-token rotation.
 * OAuth (Story 1.5b), TOTP MFA (1.5c), and email invites (1.5d) land in
 * follow-up stories and add new endpoints — they don't replace this set.
 */

export const regionSchema = z.enum(['us', 'eu']);
export type Region = z.infer<typeof regionSchema>;

export const userRoleSchema = z.enum(['super_admin', 'org_admin', 'org_member', 'org_viewer']);
export type UserRole = z.infer<typeof userRoleSchema>;

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password is too long');

export const signupRequestSchema = z.object({
  tenantName: z.string().min(1).max(120),
  region: regionSchema,
  email: z.string().email().max(254),
  password: passwordSchema,
  name: z.string().min(1).max(120),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Story 1.5e — `refreshToken` is OPTIONAL in the body. Web clients ride
// the httpOnly `aisecretary_refresh` cookie (auto-included via
// `credentials: 'include'`); mobile clients pass the body via
// expo-secure-store. The server reads cookie-first, body-fallback, and
// 401s when both are missing.
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleSchema,
  tenantId: z.string().uuid(),
  region: regionSchema,
  isMfaEnabled: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  /** Seconds until access-token expiry. Clients use this to schedule refresh. */
  expiresIn: z.number().int().positive(),
  refreshToken: z.string(),
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({
  user: authUserSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Story 1.5c — TOTP MFA wire contract.                                        */
/*                                                                            */
/* `/login` now returns a discriminated union: either a fully-issued session  */
/* or an `mfa-required` challenge that the client redeems via `/login/        */
/* verify-mfa`. Enrollment is its own three-step dance: enroll (returns       */
/* secret + recovery codes once), confirm (proves the user has the           */
/* authenticator), then later disable / regenerate (re-verify password +     */
/* TOTP). When `tenant.mfa_required = true` for a user that has not          */
/* enrolled, the challenge response sets `enrollmentRequired: true` so the   */
/* client knows to push the user through enrollment BEFORE issuing a         */
/* session — the verify-mfa endpoint refuses codes in that state.            */
/* -------------------------------------------------------------------------- */

export const sessionResponseSchema = authResponseSchema.extend({
  kind: z.literal('session'),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const mfaChallengeResponseSchema = z.object({
  kind: z.literal('mfa-required'),
  challengeToken: z.string(),
  expiresAt: z.string().datetime(),
  /**
   * True when the tenant policy forces MFA but the user has not yet
   * enrolled. The client routes the user to the enrollment surface
   * with this flag; the verify-mfa endpoint refuses codes for it.
   */
  enrollmentRequired: z.boolean(),
});
export type MfaChallengeResponse = z.infer<typeof mfaChallengeResponseSchema>;

export const loginResponseSchema = z.discriminatedUnion('kind', [
  sessionResponseSchema,
  mfaChallengeResponseSchema,
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const verifyMfaRequestSchema = z.object({
  challengeToken: z.string().min(1),
  // 6-digit TOTP OR a recovery code (4-4-4 hex with dashes; up to 14 chars).
  code: z.string().min(6).max(20),
});
export type VerifyMfaRequest = z.infer<typeof verifyMfaRequestSchema>;

export const mfaEnrollResponseSchema = z.object({
  otpauthUri: z.string(),
  secret: z.string(),
  recoveryCodes: z.array(z.string()).length(10),
});
export type MfaEnrollResponse = z.infer<typeof mfaEnrollResponseSchema>;

export const mfaConfirmRequestSchema = z.object({
  code: z.string().length(6),
});
export type MfaConfirmRequest = z.infer<typeof mfaConfirmRequestSchema>;

export const mfaDisableRequestSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(6).max(20),
});
export type MfaDisableRequest = z.infer<typeof mfaDisableRequestSchema>;

export const mfaRegenerateRequestSchema = mfaDisableRequestSchema;
export type MfaRegenerateRequest = z.infer<typeof mfaRegenerateRequestSchema>;

export const mfaRecoveryCodesResponseSchema = z.object({
  recoveryCodes: z.array(z.string()).length(10),
});
export type MfaRecoveryCodesResponse = z.infer<typeof mfaRecoveryCodesResponseSchema>;
