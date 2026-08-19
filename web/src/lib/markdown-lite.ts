/**
 * markdown-lite.ts — Minimal markdown-to-HTML renderer for task notes.
 * Purpose: Render a small, safe subset of markdown (bold/italic/links/code/
 *          lists/headings/line breaks) without pulling in a heavy editor or
 *          markdown parser dependency.
 * Inputs: Raw markdown string (user-authored task notes).
 * Outputs: Sanitized HTML string safe to render via dangerouslySetInnerHTML —
 *          all input is HTML-escaped before any markdown substitution runs,
 *          so no raw HTML/script from user input can execute.
 * Constraints: Pure function, no DOM access; supports: #/##/### headings,
 *              **bold**, *italic*, `code`, [text](url) links (http/https only),
 *              "- " bullet lists, blank-line paragraph breaks.
 * SPORT: D2-S7 notes UX (lightweight markdown, no heavy editor dep).
 */

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Render inline markdown spans (bold/italic/code/links) within an already-escaped line. */
function renderInline(escapedLine: string): string {
  return escapedLine
    // links: [text](https://...) — scheme restricted to http(s) to avoid javascript: URLs
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-brand-primary">$1</a>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

/** Convert a markdown-lite string into safe HTML for read-only preview. */
export function renderMarkdownLite(source: string): string {
  const lines = source.split('\n')
  const htmlParts: string[] = []
  let inList = false

  for (const rawLine of lines) {
    const escaped = escapeHtml(rawLine)
    const trimmed = rawLine.trim()

    if (trimmed === '') {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      const level = heading[1]?.length ?? 1
      const text = renderInline(escapeHtml(heading[2] ?? ''))
      const sizeClass = level === 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold'
      htmlParts.push(`<p class="${sizeClass} mt-2 mb-1">${text}</p>`)
      continue
    }

    if (/^-\s+/.test(trimmed)) {
      if (!inList) { htmlParts.push('<ul class="list-disc list-inside space-y-0.5">'); inList = true }
      htmlParts.push(`<li>${renderInline(escapeHtml(trimmed.replace(/^-\s+/, '')))}</li>`)
      continue
    }

    if (inList) { htmlParts.push('</ul>'); inList = false }
    htmlParts.push(`<p>${renderInline(escaped)}</p>`)
  }

  if (inList) htmlParts.push('</ul>')
  return htmlParts.join('')
}
