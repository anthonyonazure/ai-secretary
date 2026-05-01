/**
 * Pure cron-expression validator for scheduled worker handlers + the
 * F2-admin "set retention purge cadence" form. Supports the standard
 * 5-field syntax (minute hour dom month dow) plus a 6-field variant
 * with a leading seconds field used by pg-boss schedulers.
 *
 * Validates field counts, ranges, and basic syntax (`*`, `,`, `-`,
 * `/`). Doesn't compute next-run times — only correctness.
 */

export type CronExprKind = '5-field' | '6-field';

export type CronValidationResult = {
  valid: boolean;
  kind: CronExprKind | null;
  errors: ReadonlyArray<string>;
};

const FIELD_RANGES: ReadonlyArray<{ name: string; min: number; max: number }> = [
  { name: 'second', min: 0, max: 59 },
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day-of-month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day-of-week', min: 0, max: 6 },
];

const validateField = (
  value: string,
  range: { name: string; min: number; max: number },
): string | null => {
  if (value === '*') return null;
  if (value.length === 0) return `${range.name}: empty`;
  for (const part of value.split(',')) {
    const [main, step] = part.split('/');
    if (step !== undefined) {
      const stepN = Number.parseInt(step, 10);
      if (!Number.isFinite(stepN) || stepN <= 0) return `${range.name}: bad step "${step}"`;
    }
    if (main === '*') continue;
    if (main === undefined) return `${range.name}: empty range`;
    if (main.includes('-')) {
      const [lo, hi] = main.split('-');
      const loN = Number.parseInt(lo ?? '', 10);
      const hiN = Number.parseInt(hi ?? '', 10);
      if (!Number.isFinite(loN) || !Number.isFinite(hiN)) {
        return `${range.name}: bad range "${main}"`;
      }
      if (loN < range.min || hiN > range.max || loN > hiN) {
        return `${range.name}: range "${main}" out of [${range.min}-${range.max}]`;
      }
    } else {
      const n = Number.parseInt(main, 10);
      if (!Number.isFinite(n)) return `${range.name}: bad value "${main}"`;
      if (n < range.min || n > range.max) {
        return `${range.name}: value ${n} out of [${range.min}-${range.max}]`;
      }
    }
  }
  return null;
};

export const validateCron = (expr: string): CronValidationResult => {
  const trimmed = expr.trim();
  if (trimmed.length === 0) {
    return { valid: false, kind: null, errors: ['empty expression'] };
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) {
    return {
      valid: false,
      kind: null,
      errors: [`expected 5 or 6 fields, got ${fields.length}`],
    };
  }
  const kind: CronExprKind = fields.length === 5 ? '5-field' : '6-field';
  const ranges = kind === '5-field' ? FIELD_RANGES.slice(1) : FIELD_RANGES;
  const errors: string[] = [];
  fields.forEach((field, idx) => {
    const range = ranges[idx];
    if (range === undefined) return;
    const err = validateField(field, range);
    if (err !== null) errors.push(err);
  });
  return {
    valid: errors.length === 0,
    kind,
    errors,
  };
};
