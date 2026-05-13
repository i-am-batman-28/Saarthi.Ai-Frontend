declare const katex: {
    renderToString: (tex: string, opts: { displayMode: boolean; throwOnError: boolean }) => string;
};

function escapeHtml(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderKatex(tex: string, display: boolean): string {
    try {
        if (typeof katex !== 'undefined') {
            return katex.renderToString(tex, { displayMode: display, throwOnError: false });
        }
    } catch {
        // katex not loaded yet — fall back to plain text
    }
    return display ? `<div class="math-block">$$${escapeHtml(tex)}$$</div>` : `<span class="math-inline">$${escapeHtml(tex)}$</span>`;
}

/** Convert markdown-ish text with $...$ and $$...$$ into HTML with KaTeX. */
export function renderMath(text: string): string {
    // Display math first ($$...$$)
    let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => renderKatex(tex.trim(), true));
    // Inline math ($...$) — single $, not followed by another $
    out = out.replace(/\$([^$\n]+?)\$/g, (_, tex) => renderKatex(tex.trim(), false));
    // Basic markdown: **bold**, *italic*, bullet lines
    out = out
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
        // Collapse consecutive </ul><ul>
        .replace(/<\/ul>\s*<ul>/g, '')
        // Line breaks
        .replace(/\n/g, '<br/>');
    return out;
}
