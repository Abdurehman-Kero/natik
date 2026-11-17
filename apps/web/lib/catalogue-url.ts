export type CatalogueKind = 'all' | 'free' | 'premium';

/** The address of the course list for a choice of type, language and level. */
export function catalogueHref(
  basePath: string,
  language: string,
  level: string,
  kind: CatalogueKind,
): string {
  const params = new URLSearchParams();
  if (kind !== 'all') params.set('type', kind);
  if (language) params.set('language', language);
  if (level) params.set('level', level);
  const text = params.toString();
  return text ? `${basePath}?${text}` : basePath;
}
