import { htmlComentarioParaTextoPlano } from '@/lib/kanban/mencao-comentario';

const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/gi;

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'P', 'DIV', 'SPAN', 'A']);

const LINK_CLASS = 'moni-comentario-link';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Remove pontuação final comum que não faz parte da URL. */
function splitUrlTrailingPunctuation(raw: string): { href: string; trailing: string } {
  let href = raw;
  let trailing = '';
  while (href.length > 0) {
    const last = href.slice(-1);
    if (!/[.,;:!?)]+/.test(last)) break;
    if (last === ')') {
      const opens = (href.match(/\(/g) ?? []).length;
      const closes = (href.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
    }
    trailing = last + trailing;
    href = href.slice(0, -1);
  }
  return { href, trailing };
}

function criarAnchorHtml(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="${LINK_CLASS}">${safeLabel}</a>`;
}

/** Linkifica URLs em texto plano (sem tags HTML). */
export function linkifyPlainTextAsHtml(text: string): string {
  const plain = String(text ?? '');
  if (!plain.trim()) return '';

  URL_REGEX.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(plain)) !== null) {
    const start = match.index;
    const rawUrl = match[0];
    const { href, trailing } = splitUrlTrailingPunctuation(rawUrl);
    if (!isSafeHttpUrl(href)) continue;

    result += escapeHtml(plain.slice(lastIndex, start));
    result += criarAnchorHtml(href, href);
    result += escapeHtml(trailing);
    lastIndex = start + rawUrl.length;
  }

  result += escapeHtml(plain.slice(lastIndex));
  return result.replace(/\n/g, '<br />');
}

function normalizeLinkElement(a: HTMLAnchorElement): void {
  const href = (a.getAttribute('href') ?? '').trim();
  if (!isSafeHttpUrl(href)) {
    a.replaceWith(document.createTextNode(a.textContent ?? href));
    return;
  }
  for (const attr of [...a.attributes]) {
    if (!['href', 'target', 'rel', 'class'].includes(attr.name.toLowerCase())) {
      a.removeAttribute(attr.name);
    }
  }
  a.setAttribute('href', href);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener noreferrer');
  a.className = LINK_CLASS;
}

function sanitizeComentarioElement(el: Element): void {
  const children = [...el.children];
  for (const child of children) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      while (child.firstChild) {
        el.insertBefore(child.firstChild, child);
      }
      el.removeChild(child);
      sanitizeComentarioElement(el);
      continue;
    }

    for (const attr of [...child.attributes]) {
      if (child.tagName === 'A') {
        if (!['href', 'target', 'rel', 'class'].includes(attr.name.toLowerCase())) {
          child.removeAttribute(attr.name);
        }
      } else {
        child.removeAttribute(attr.name);
      }
    }

    if (child.tagName === 'A') {
      normalizeLinkElement(child as HTMLAnchorElement);
    }

    sanitizeComentarioElement(child);
  }
}

function linkifyTextNode(textNode: Text): void {
  const parent = textNode.parentElement;
  if (!parent || parent.closest('a')) return;

  const text = textNode.textContent ?? '';
  URL_REGEX.lastIndex = 0;
  if (!URL_REGEX.test(text)) return;
  URL_REGEX.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const start = match.index;
    const rawUrl = match[0];
    const { href, trailing } = splitUrlTrailingPunctuation(rawUrl);
    if (!isSafeHttpUrl(href)) continue;

    if (start > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = LINK_CLASS;
    a.textContent = href;
    frag.appendChild(a);

    if (trailing) {
      frag.appendChild(document.createTextNode(trailing));
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex === 0) return;

  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  textNode.replaceWith(frag);
}

function linkifyComentarioHtmlDom(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  sanitizeComentarioElement(div);

  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  for (const textNode of textNodes) {
    linkifyTextNode(textNode);
  }

  return div.innerHTML;
}

/** Sanitiza HTML do comentário e torna URLs clicáveis na exibição. */
export function prepararHtmlComentarioExibicao(raw: string): string {
  const html = String(raw ?? '').trim();
  if (!html) return '';

  if (typeof document === 'undefined') {
    const plain = html.includes('<') ? htmlComentarioParaTextoPlano(html) : html;
    return linkifyPlainTextAsHtml(plain);
  }

  return linkifyComentarioHtmlDom(html);
}
