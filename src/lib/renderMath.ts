declare const katex: {
    renderToString: (tex: string, opts: { displayMode: boolean; throwOnError: boolean }) => string;
};

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderKatex(tex: string, display: boolean): string {
    try {
        if (typeof katex !== 'undefined') {
            return katex.renderToString(tex, { displayMode: display, throwOnError: false });
        }
    } catch {
        // katex not yet loaded — show plain fallback
    }
    const escaped = escapeHtml(tex);
    return display
        ? `<div class="math-fallback-display">$$${escaped}$$</div>`
        : `<span class="math-fallback-inline">$${escaped}$</span>`;
}

/**
 * Strip AI boilerplate artifacts that should never be shown to students.
 */
function stripArtifacts(text: string): string {
    return text
        // [Knowledge base answer] / [Knowledge Base Answer] etc.
        .replace(/\[Knowledge\s+[Bb]ase\s+[Aa]nswer\]/g, '')
        // References: section — everything after it until end or next ##
        .replace(/^References:\s*\n([\s\S]*?)(?=\n##|\n---|\n*$)/gm, '')
        // Trailing --- separators
        .replace(/\n---\n/g, '\n')
        .replace(/^---$/gm, '')
        .trim();
}

/**
 * Convert full AI markdown response into safe HTML.
 *
 * Handles:
 *  - $$...$$ display math
 *  - $...$ inline math
 *  - ### / ## / # headings  →  styled heading divs
 *  - **bold**, *italic*
 *  - numbered lists  1. item
 *  - bullet lists  - / • item
 *  - [Source: ...] badges
 *  - --- horizontal rules → ignored
 *  - plain line breaks
 *
 * Code fences (```...```) should be extracted by the caller (MathContent) before calling this.
 */
export function renderMath(text: string): string {
    let out = stripArtifacts(text);

    // 1. Display math  $$...$$
    out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => renderKatex(tex.trim(), true));

    // 2. Inline math  $...$
    out = out.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, tex) => renderKatex(tex.trim(), false));

    // 3. Headings  ### h3, ## h2, # h1
    out = out.replace(/^###\s+(.+)$/gm, '<div class="ai-h3">$1</div>');
    out = out.replace(/^##\s+(.+)$/gm,  '<div class="ai-h2">$1</div>');
    out = out.replace(/^#\s+(.+)$/gm,   '<div class="ai-h1">$1</div>');

    // 4. Bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 5. Italic *text*
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // 6. Horizontal rules --- → ignore (just remove)
    out = out.replace(/^---+$/gm, '');

    // 7. Source badges  [Source: ...]
    out = out.replace(/\[Source:\s*([^\]]+)\]/g, '<span class="ai-source-badge">📚 $1</span>');

    // 8. Numbered lists  1. item
    out = out.replace(/^\d+\.\s+(.+)$/gm, '<li class="ai-ol-item">$1</li>');
    out = out.replace(/(<li class="ai-ol-item">[\s\S]*?<\/li>)+/g, m => `<ol>${m}</ol>`);

    // 9. Bullet lists  - item or • item
    out = out.replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>');
    out = out.replace(/(<li>[\s\S]*?<\/li>)+/g, m => `<ul>${m}</ul>`);

    // 10. Line breaks (skip if inside an HTML block already)
    out = out.replace(/\n/g, '<br/>');

    // 11. Clean up extra <br/> around block elements
    out = out.replace(/(<br\/>)+(<\/?div|<\/?ul|<\/?ol|<\/?li)/g, '$2');
    out = out.replace(/(<\/div>|<\/ul>|<\/ol>)(<br\/>)+/g, '$1');

    return out;
}
