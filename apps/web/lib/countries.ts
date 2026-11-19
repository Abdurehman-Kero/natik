/** ISO 3166-1 alpha-2 codes. Names come from the browser in the person's own language. */
const ALL = (
  'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA CV CF TD CL CN CO ' +
  'KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN ' +
  'HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM ' +
  'MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS ' +
  'SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE ' +
  'GB US UY UZ VU VA VE VN YE ZM ZW'
).split(' ');

/** Shown first: where most of Natik's students are, then the neighbours and the Gulf. */
const FIRST = ['ET', 'ER', 'DJ', 'SO', 'KE', 'SD', 'SS', 'UG', 'SA', 'AE', 'QA', 'KW', 'US', 'GB'];

export const DEFAULT_COUNTRY = 'ET';

/** The flag as an emoji (two regional-indicator letters). Plain letters are used if it cannot be drawn. */
export function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

/** "ET" → "Ethiopia", "ኢትዮጵያ" or "Itoophiyaa", depending on the language. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Options for a country picker: the usual ones first, then everyone else A to Z in that language. */
export function countryOptions(locale: string): { value: string; label: string }[] {
  const label = (code: string) => `${flagOf(code)} ${countryName(code, locale)}`.trim();
  const first = FIRST.map((code) => ({ value: code, label: label(code) }));
  const rest = ALL.filter((code) => !FIRST.includes(code))
    .map((code) => ({ value: code, name: countryName(code, locale), label: label(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map(({ value, label: l }) => ({ value, label: l }));
  return [...first, ...rest];
}
