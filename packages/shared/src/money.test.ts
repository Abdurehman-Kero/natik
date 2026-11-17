import { describe, expect, it } from 'vitest';
import { etbToSantim, formatMoney, formatPrice, MISSING_VALUE, santimToEtb } from './money';

describe('formatMoney', () => {
  it('formats whole birr without decimals', () => {
    expect(formatMoney(150000)).toBe('ETB 1,500');
    expect(formatMoney(0)).toBe('ETB 0');
    expect(formatMoney(100)).toBe('ETB 1');
  });

  it('keeps two decimals when there are santim', () => {
    expect(formatMoney(150050)).toBe('ETB 1,500.50');
    expect(formatMoney(5)).toBe('ETB 0.05');
  });

  it('formats large amounts with thousands separators', () => {
    expect(formatMoney(18600000)).toBe('ETB 186,000');
  });

  it('formats negative amounts', () => {
    expect(formatMoney(-25000)).toBe('-ETB 250');
  });

  it('shows a dash for missing values, never zero (FR-REP-002)', () => {
    expect(formatMoney(null)).toBe(MISSING_VALUE);
    expect(formatMoney(undefined)).toBe(MISSING_VALUE);
    expect(formatMoney(Number.NaN)).toBe(MISSING_VALUE);
  });
});

describe('formatPrice', () => {
  it('shows Free for free courses', () => {
    expect(formatPrice('FREE', null)).toBe('Free');
    expect(formatPrice('FREE', 150000)).toBe('Free');
  });

  it('shows the amount for paid courses', () => {
    expect(formatPrice('PAID', 150000)).toBe('ETB 1,500');
  });

  it('accepts a translated free label', () => {
    expect(formatPrice('FREE', null, 'Bilisaa')).toBe('Bilisaa');
  });
});

describe('conversions', () => {
  it('converts between ETB and santim without float drift', () => {
    expect(etbToSantim(1500)).toBe(150000);
    expect(etbToSantim(0.1 + 0.2)).toBe(30);
    expect(santimToEtb(150050)).toBe(1500.5);
  });

  it('rejects invalid amounts', () => {
    expect(() => etbToSantim(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
