import { describe, expect, it } from 'vitest';

import { validateCron } from './cron-validator.js';

describe('validateCron', () => {
  it('accepts a 5-field expression with all wildcards', () => {
    const r = validateCron('* * * * *');
    expect(r.valid).toBe(true);
    expect(r.kind).toBe('5-field');
  });

  it('accepts a 6-field expression with leading seconds', () => {
    const r = validateCron('0 * * * * *');
    expect(r.valid).toBe(true);
    expect(r.kind).toBe('6-field');
  });

  it('rejects empty input', () => {
    expect(validateCron('').valid).toBe(false);
    expect(validateCron('   ').valid).toBe(false);
  });

  it('rejects malformed field counts', () => {
    expect(validateCron('* * * *').valid).toBe(false);
    expect(validateCron('* * * * * * *').valid).toBe(false);
  });

  it('accepts step expressions', () => {
    expect(validateCron('*/15 * * * *').valid).toBe(true);
    expect(validateCron('*/15 * * * * *').valid).toBe(true);
  });

  it('accepts ranges', () => {
    expect(validateCron('0 9-17 * * 1-5').valid).toBe(true);
  });

  it('accepts comma-separated lists', () => {
    expect(validateCron('0,15,30,45 * * * *').valid).toBe(true);
  });

  it('rejects values out of field range', () => {
    const r = validateCron('60 * * * *');
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/minute/);
  });

  it('rejects backwards ranges', () => {
    const r = validateCron('0 17-9 * * *');
    expect(r.valid).toBe(false);
  });

  it('rejects bad step values', () => {
    const r = validateCron('*/0 * * * *');
    expect(r.valid).toBe(false);
  });

  it('rejects non-numeric values', () => {
    const r = validateCron('abc * * * *');
    expect(r.valid).toBe(false);
  });

  it('returns the field-name in the error', () => {
    const r = validateCron('* * 32 * *');
    expect(r.errors.join(' ')).toMatch(/day-of-month/);
  });
});
