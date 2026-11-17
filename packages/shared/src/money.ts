/**
 * Money is stored and sent as integer santim (1 ETB = 100 santim) to avoid
 * floating-point errors. Display format: "ETB 1,500" or "ETB 1,500.50".
 */

export const SANTIM_PER_ETB = 100;

/** Shown wherever a value is missing (SRS FR-REP-002: never show missing data as zero). */
export const MISSING_VALUE = '—';

export function etbToSantim(etb: number): number {
  if (!Number.isFinite(etb)) throw new RangeError(`Invalid ETB amount: ${etb}`);
  return Math.round(etb * SANTIM_PER_ETB);
}

export function santimToEtb(santim: number): number {
  return santim / SANTIM_PER_ETB;
}

const wholeFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const centsFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `150000` → `"ETB 1,500"` · `150050` → `"ETB 1,500.50"` · `null` → `"—"` */
export function formatMoney(santim: number | null | undefined): string {
  if (santim === null || santim === undefined || !Number.isFinite(santim)) return MISSING_VALUE;
  const negative = santim < 0;
  const abs = Math.abs(Math.round(santim));
  const formatter = abs % SANTIM_PER_ETB === 0 ? wholeFormatter : centsFormatter;
  return `${negative ? '-' : ''}ETB ${formatter.format(abs / SANTIM_PER_ETB)}`;
}

/** Course price label: free courses (or a zero price) show the free label. */
export function formatPrice(
  access: 'FREE' | 'PAID',
  priceSantim: number | null | undefined,
  freeLabel = 'Free',
): string {
  if (access === 'FREE' || !priceSantim) return freeLabel;
  return formatMoney(priceSantim);
}
