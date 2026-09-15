import { describe, expect, it } from 'vitest';

import { escapeSoqlString } from './salesforce.js';

/**
 * Reads a single-quoted SOQL literal the way the Salesforce parser does:
 * a backslash takes the next character literally, an unescaped quote ends it.
 * Returns the decoded value and whatever text followed the closing quote.
 */
const readLiteral = (soql: string): { value: string; rest: string } => {
  let value = '';
  for (let i = 0; i < soql.length; i++) {
    const ch = soql[i];
    if (ch === '\\') {
      value += soql[i + 1] ?? '';
      i++;
    } else if (ch === "'") {
      return { value, rest: soql.slice(i + 1) };
    } else {
      value += ch;
    }
  }
  return { value, rest: '' };
};

describe('escapeSoqlString', () => {
  it('leaves an ordinary email unchanged', () => {
    expect(escapeSoqlString('ada@example.com')).toBe('ada@example.com');
  });

  it('escapes a single quote', () => {
    expect(escapeSoqlString("o'brien@example.com")).toBe("o\\'brien@example.com");
  });

  it('escapes backslashes before quotes, so a trailing backslash cannot unescape the quote', () => {
    expect(escapeSoqlString("x\\'")).toBe("x\\\\\\'");
  });

  it.each(["a@b.com' OR Name != '", "a@b.com\\' OR Name != '", "a@b.com\\\\' OR Name != '", '\\'])(
    'keeps %j inside the string literal',
    (input) => {
      const { value, rest } = readLiteral(`${escapeSoqlString(input)}' LIMIT 1`);
      expect(value).toBe(input);
      expect(rest).toBe(' LIMIT 1');
    },
  );
});
