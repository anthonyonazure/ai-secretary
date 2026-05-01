/**
 * Story 1.5c — MFA primitive tests.
 *
 * Covers TOTP roundtrip, tamper detection, recovery-code shape +
 * uniqueness, hash normalization, and the boot-time encryption-key guard.
 */

import { authenticator } from 'otplib';
import { describe, expect, it } from 'vitest';
import {
  assertMfaEncryptionKey,
  generateMfaEnrollment,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotpToken,
} from './mfa.js';

describe('generateMfaEnrollment', () => {
  it('produces a base32 secret + otpauth URI + 10 recovery codes', () => {
    const out = generateMfaEnrollment({ accountName: 'jane@acme.test', issuer: 'AI Secretary' });
    expect(out.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(out.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(out.otpauthUri).toContain('jane%40acme.test');
    expect(out.otpauthUri).toContain('AI%20Secretary');
    expect(out.recoveryCodes).toHaveLength(10);
  });

  it('TOTP roundtrip: live code from secret verifies true', () => {
    const out = generateMfaEnrollment({ accountName: 'a@b.test', issuer: 'X' });
    const code = authenticator.generate(out.secret);
    expect(verifyTotpToken({ secret: out.secret, token: code })).toBe(true);
  });

  it('rejects a wrong / random 6-digit code', () => {
    const out = generateMfaEnrollment({ accountName: 'a@b.test', issuer: 'X' });
    expect(verifyTotpToken({ secret: out.secret, token: '000000' })).toBe(false);
  });

  it('rejects empty / non-numeric tokens without throwing', () => {
    const out = generateMfaEnrollment({ accountName: 'a@b.test', issuer: 'X' });
    expect(verifyTotpToken({ secret: out.secret, token: '' })).toBe(false);
    expect(verifyTotpToken({ secret: out.secret, token: '   ' })).toBe(false);
    expect(verifyTotpToken({ secret: out.secret, token: 'abcdef' })).toBe(false);
  });

  it('tamper: a code valid for one secret does not verify against another', () => {
    const a = generateMfaEnrollment({ accountName: 'a@b.test', issuer: 'X' });
    const b = generateMfaEnrollment({ accountName: 'a@b.test', issuer: 'X' });
    const aCode = authenticator.generate(a.secret);
    expect(verifyTotpToken({ secret: a.secret, token: aCode })).toBe(true);
    expect(verifyTotpToken({ secret: b.secret, token: aCode })).toBe(false);
  });
});

describe('generateRecoveryCodes', () => {
  it('returns 10 unique 4-4-4 hex codes by default', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    const formatRe = /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/;
    for (const c of codes) {
      expect(c).toMatch(formatRe);
    }
    expect(new Set(codes).size).toBe(10);
  });

  it('honors the count override', () => {
    const codes = generateRecoveryCodes(3);
    expect(codes).toHaveLength(3);
  });

  it('rejects bad counts', () => {
    expect(() => generateRecoveryCodes(0)).toThrow();
    expect(() => generateRecoveryCodes(-1)).toThrow();
    expect(() => generateRecoveryCodes(1.5)).toThrow();
  });
});

describe('hashRecoveryCode', () => {
  it('is deterministic + normalizes case + dashes + whitespace', () => {
    const a = hashRecoveryCode('a1b2-c3d4-e5f6');
    const b = hashRecoveryCode('A1B2C3D4E5F6');
    const c = hashRecoveryCode('  a1b2 c3d4 e5f6  ');
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different codes hash to different digests', () => {
    expect(hashRecoveryCode('1111-2222-3333')).not.toEqual(hashRecoveryCode('1111-2222-3334'));
  });
});

describe('assertMfaEncryptionKey', () => {
  it('returns the key when valid', () => {
    const key = 'a'.repeat(64);
    expect(assertMfaEncryptionKey(key, 'production')).toBe(key);
  });

  it('throws in production when missing', () => {
    expect(() => assertMfaEncryptionKey(undefined, 'production')).toThrow(
      /MFA_SECRET_ENCRYPTION_KEY/,
    );
  });

  it('throws in production when wrong length', () => {
    expect(() => assertMfaEncryptionKey('abc', 'production')).toThrow();
  });

  it('returns a dev fallback in non-production', () => {
    const key = assertMfaEncryptionKey(undefined, 'development');
    expect(key).toHaveLength(64);
  });
});
