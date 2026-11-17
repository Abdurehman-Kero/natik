import { describe, expect, it } from 'vitest';
import { csvCell, csvDate, csvMoney, toCsv } from './csv';

describe('csv', () => {
  it('starts with a byte-order mark, uses CRLF and keeps Arabic and Ethiopic text', () => {
    const out = toCsv(['Name', 'Course'], [['عبد الرحمن', 'አማርኛ']]);
    expect(out.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = out.toString('utf8');
    expect(text).toBe('﻿Name,Course\r\nعبد الرحمن,አማርኛ\r\n');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('defuses cells that could run as formulas', () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe(`"'=HYPERLINK(""http://x"",""click"")"`);
    for (const start of ['+1', '-2+3', '@sum']) expect(csvCell(start)).toBe(`'${start}`);
    // A real number stays a number.
    expect(csvCell(-5)).toBe('-5');
  });

  it('shows missing values as a dash and never as zero', () => {
    expect(csvCell(null)).toBe('—');
    expect(csvCell(undefined)).toBe('—');
    expect(csvCell('')).toBe('—');
    expect(csvCell(0)).toBe('0');
  });

  it('writes dates in East Africa Time and money with two decimals', () => {
    // 21:30 UTC on 3 Nov is already 4 Nov in Addis Ababa.
    expect(csvDate(new Date('2026-11-03T21:30:00Z'))).toBe('2026-11-04');
    expect(csvMoney(150_000)).toBe('1500.00');
    expect(csvMoney(150_050)).toBe('1500.50');
    expect(csvCell(new Date('2026-11-03T21:30:00Z'))).toBe('2026-11-04');
  });
});
