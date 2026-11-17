/**
 * Ethiopian mobile numbers (SRS BR-AUTH-002). Users type 09…, 07…, 9…, 251… or +251…;
 * everything is stored as +2519XXXXXXXX or +2517XXXXXXXX.
 */
const NATIONAL = /^[79]\d{8}$/;

/** Returns the canonical "+251…" number, or null if the input isn't a valid Ethiopian mobile. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (/\D/.test(digits)) return null;
  if (digits.startsWith('00251')) digits = digits.slice(5);
  else if (digits.startsWith('251')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return NATIONAL.test(digits) ? `+251${digits}` : null;
}

/** "+251912345678" → "+251 91 234 5678" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '—';
  const m = /^\+251(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+251 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** "+251912345678" → "+251 9•• ••• 678" (shown wherever the full number isn't needed). */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return '—';
  const m = /^\+251(\d)\d{2}\d{3}(\d{3})$/.exec(e164);
  return m ? `+251 ${m[1]}•• ••• ${m[2]}` : '—';
}
