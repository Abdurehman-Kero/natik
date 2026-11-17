/**
 * CSV files that open cleanly in Excel (AT-14): UTF-8 with a byte-order mark so Arabic and Ethiopic
 * names show correctly, CRLF line endings, RFC 4180 quoting, and cells that could be read as a
 * spreadsheet formula are defused (a student named "=HYPERLINK(…)" exports as plain text).
 */

/** The text shown wherever a value is missing; never a zero (FR-REP-002). */
export const BLANK = '—';

export type CsvCell = string | number | boolean | Date | null | undefined;

const EAT_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Addis_Ababa',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 2026-11-04, in East Africa Time. */
export function csvDate(date: Date): string {
  return EAT_DATE.format(date);
}

/** 150000 santim → "1500.00" (ETB, two decimals). */
export function csvMoney(santim: number): string {
  return (santim / 100).toFixed(2);
}

export function csvCell(value: CsvCell): string {
  let text: string;
  if (value === null || value === undefined || value === '') text = BLANK;
  else if (value instanceof Date) text = csvDate(value);
  else if (typeof value === 'boolean') text = value ? 'Yes' : 'No';
  else text = String(value);

  // A cell that starts with = + - @ (or a tab or carriage return) could run as a formula.
  // Numbers such as -5 are real numbers, so only text is defused.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): Buffer {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}
