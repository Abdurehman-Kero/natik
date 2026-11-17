/**
 * Rich text is stored as Tiptap/ProseMirror JSON and turned into HTML on the server, using only
 * the allow-list below. Anything not listed is dropped, so stored text can never carry scripts,
 * inline styles or event handlers (NFR-SEC-004). Paragraph direction (`dir`) is kept so Arabic and
 * English can sit side by side (FR-TEACH-003, FR-LEARN-011).
 */

interface Node {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  text?: unknown;
  marks?: unknown;
}

const MAX_DEPTH = 12;
const MAX_NODES = 5000;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** Links may only point to web, email or phone addresses. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (href.length === 0 || href.length > 2000) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return null;
}

/** Pictures inside text can only come from our own upload store. */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\/api\/v1\/files\/[A-Za-z0-9_-]{8,40}$/.test(value) ? value : null;
}

const dirAttr = (node: Node): string => {
  const dir = node.attrs?.dir;
  return dir === 'rtl' || dir === 'ltr' ? ` dir="${dir}"` : '';
};

function renderMarks(text: string, marks: unknown): string {
  let html = escapeHtml(text);
  if (!Array.isArray(marks)) return html;
  for (const mark of marks as Node[]) {
    switch (mark?.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        if (href) {
          html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${html}</a>`;
        }
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function renderChildren(node: Node, depth: number, counter: { n: number }): string {
  if (!Array.isArray(node.content)) return '';
  return (node.content as Node[]).map((child) => renderNode(child, depth + 1, counter)).join('');
}

function renderNode(node: Node, depth: number, counter: { n: number }): string {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return '';
  if (++counter.n > MAX_NODES) return '';
  switch (node.type) {
    case 'text':
      return typeof node.text === 'string' ? renderMarks(node.text, node.marks) : '';
    case 'paragraph':
      return `<p${dirAttr(node)}>${renderChildren(node, depth, counter)}</p>`;
    case 'heading': {
      const level = node.attrs?.level === 3 ? 3 : 2;
      return `<h${level}${dirAttr(node)}>${renderChildren(node, depth, counter)}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${renderChildren(node, depth, counter)}</ul>`;
    case 'orderedList':
      return `<ol>${renderChildren(node, depth, counter)}</ol>`;
    case 'listItem':
      return `<li>${renderChildren(node, depth, counter)}</li>`;
    case 'blockquote':
      return `<blockquote>${renderChildren(node, depth, counter)}</blockquote>`;
    case 'hardBreak':
      return '<br />';
    case 'horizontalRule':
      return '<hr />';
    case 'image': {
      const src = safeImageSrc(node.attrs?.src);
      if (!src) return '';
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.slice(0, 200) : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
    }
    default:
      return '';
  }
}

/** Safe HTML for a stored rich-text document. Unknown input gives an empty string. */
export function renderRichText(doc: unknown): string {
  if (!doc || typeof doc !== 'object' || (doc as Node).type !== 'doc') return '';
  return renderChildren(doc as Node, 0, { n: 0 });
}

/** Plain text of a document (used to tell whether a text block is empty). */
export function richTextToPlain(doc: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
    const n = node as Node;
    if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text);
    if (n.type === 'image') parts.push('[image]');
    if (Array.isArray(n.content)) (n.content as unknown[]).forEach((c) => walk(c, depth + 1));
  };
  walk(doc, 0);
  return parts.join(' ').trim();
}

/** True when the document is a Tiptap doc of a sensible size. */
export function isValidRichText(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object' || (doc as Node).type !== 'doc') return false;
  try {
    return JSON.stringify(doc).length <= 200_000;
  } catch {
    return false;
  }
}
