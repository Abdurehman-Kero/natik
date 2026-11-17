/**
 * Language tagging for content that can be in any script. A title is only marked Arabic (and set
 * right-to-left, with the Arabic font) when it really contains Arabic letters, so an English title
 * on an Arabic course stays normal.
 */
export function contentLang(text: string): { lang?: string; dir?: 'rtl' } {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text) ? { lang: 'ar', dir: 'rtl' } : {};
}
