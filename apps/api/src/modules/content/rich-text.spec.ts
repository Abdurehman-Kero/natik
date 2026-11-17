import { describe, expect, it } from 'vitest';
import { renderRichText, richTextToPlain, safeHref } from './rich-text';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (text: string, attrs?: Record<string, unknown>) => ({
  type: 'paragraph',
  attrs,
  content: [{ type: 'text', text }],
});

describe('rich text rendering', () => {
  it('keeps the direction of each paragraph', () => {
    const html = renderRichText(
      doc(p('الفتحة ـَ', { dir: 'rtl' }), p('The fatha', { dir: 'ltr' })),
    );
    expect(html).toBe('<p dir="rtl">الفتحة ـَ</p><p dir="ltr">The fatha</p>');
  });

  it('escapes markup typed as text', () => {
    expect(renderRichText(doc(p('<script>alert(1)</script>')))).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('drops unknown nodes, marks and attributes', () => {
    const html = renderRichText(
      doc(
        { type: 'script', content: [{ type: 'text', text: 'x' }] },
        {
          type: 'paragraph',
          attrs: { dir: 'javascript:1', style: 'color:red', onclick: 'x()' },
          content: [{ type: 'text', text: 'hi', marks: [{ type: 'highlight' }] }],
        },
      ),
    );
    expect(html).toBe('<p>hi</p>');
  });

  it('only allows web, email and phone links', () => {
    expect(safeHref('https://natik.example/x')).toBe('https://natik.example/x');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,<b>')).toBeNull();
    const html = renderRichText(
      doc({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'bad',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      }),
    );
    expect(html).toBe('<p>bad</p>');
  });

  it('only allows pictures from our own store', () => {
    const own = renderRichText(
      doc({ type: 'image', attrs: { src: '/api/v1/files/clx1234567890' } }),
    );
    expect(own).toContain('<img src="/api/v1/files/clx1234567890"');
    expect(
      renderRichText(doc({ type: 'image', attrs: { src: 'https://evil.example/a.png' } })),
    ).toBe('');
  });

  it('tells whether text is empty', () => {
    expect(richTextToPlain(doc({ type: 'paragraph' }))).toBe('');
    expect(richTextToPlain(doc(p('Hello')))).toBe('Hello');
  });
});
