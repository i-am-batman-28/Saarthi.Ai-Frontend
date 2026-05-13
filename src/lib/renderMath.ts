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
        // katex not yet loaded
    }
    const escaped = escapeHtml(tex);
    return display
        ? `<span class="math-fallback-display">$$${escaped}$$</span>`
        : `<span class="math-fallback-inline">$${escaped}$</span>`;
}

/**
 * Convert a full AI markdown response into safe HTML.
 * Handles: $$...$$ display math, $...$ inline math, **bold**, *italic*,
 * bullet lists (- / •), [Source: ...] badges, and plain line breaks.
 * Code blocks (```...```) are left for the caller to handle separately.
 */
export function renderMath(text: string): string {
    // 1. Display math $$...$$
    let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => renderKatex(tex.trim(), true));

    // 2. Inline math $...$ (not $$, not empty)
    out = out.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, tex) => renderKatex(tex.trim(), false));

    // 3. Bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 4. Italic *text* (not already inside **)
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // 5. Source badges [Source: ...]
    out = out.replace(/\[Source:\s*([^\]]+)\]/g,
        '<span class="ai-source-badge">📚 $1</span>');

    // 6. Bullet lines (- item or • item)
    out = out.replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive <li> runs in <ul>
    out = out.replace(/(<li>.*?<\/li>(\n|<br\/>)*)+/gs, (m) => `<ul>${m}</ul>`);

    // 7. Line breaks
    out = out.replace(/\n/g, '<br/>');

    return out;
}
