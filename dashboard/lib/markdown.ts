/**
 * Minimal, dependency-free Markdown -> HTML renderer for the briefing books
 * (.desk/briefings/*.md). Only handles the subset those files actually use:
 * headers, bold/italic, bullet lists, horizontal rules, and paragraphs.
 * Not a general-purpose Markdown engine — don't reach for this elsewhere.
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInline(text: string): string {
  let html = escapeHtml(text);
  // Bold before italic so **x** doesn't get half-eaten by the italic pass.
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  return html;
}

export function renderBriefingMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length) {
      blocks.push(`<ul>${listBuffer.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
      listBuffer = [];
    }
  }
  function flushPara() {
    if (paraBuffer.length) {
      blocks.push(`<p>${renderInline(paraBuffer.join(' '))}</p>`);
      paraBuffer = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === '') {
      flushList();
      flushPara();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushList();
      flushPara();
      blocks.push('<hr />');
      continue;
    }
    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      flushList();
      flushPara();
      const level = headerMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
      continue;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushPara();
      listBuffer.push(bulletMatch[1]);
      continue;
    }
    flushList();
    paraBuffer.push(line.trim());
  }
  flushList();
  flushPara();

  return blocks.join('\n');
}
