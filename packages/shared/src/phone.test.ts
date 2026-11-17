import { describe, expect, it } from 'vitest';
import { formatPhone, maskPhone, normalizePhone } from './phone';
import { isValidPassword, passwordProblems } from './password';

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '+251912345678'],
    ['912345678', '+251912345678'],
    ['+251912345678', '+251912345678'],
    ['251912345678', '+251912345678'],
    ['00251912345678', '+251912345678'],
    ['0712345678', '+251712345678'],
    ['+251 91 234 5678', '+251912345678'],
    ['091-234-5678', '+251912345678'],
    ['(0912) 345 678', '+251912345678'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each([
    '',
    '0812345678',
    '091234567',
    '09123456789',
    '+254712345678',
    'abc',
    '+251 11 123 4567',
    null,
    undefined,
  ])('rejects %s', (input) => expect(normalizePhone(input as string)).toBeNull());

  it('formats and masks', () => {
    expect(formatPhone('+251912345678')).toBe('+251 91 234 5678');
    expect(maskPhone('+251912345678')).toBe('+251 9•• ••• 678');
    expect(maskPhone(null)).toBe('—');
  });
});

describe('password policy', () => {
  it('accepts 8+ chars with a letter and a number', () =>
    expect(isValidPassword('Abdi2026x')).toBe(true));
  it('flags every problem', () => {
    expect(passwordProblems('abc')).toEqual(['TOO_SHORT', 'NO_NUMBER']);
    expect(passwordProblems('12345678')).toEqual(['NO_LETTER']);
    expect(passwordProblems('abcdefgh')).toEqual(['NO_NUMBER']);
  });
  it('accepts Arabic letters', () => expect(isValidPassword('كلمةالسر1')).toBe(true));
});
