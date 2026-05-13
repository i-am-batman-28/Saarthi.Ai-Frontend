import { renderMath } from '../lib/renderMath';
import './MathContent.css';

interface Props {
    content: string;
    streaming?: boolean;
}

/**
 * Renders AI response text with full markdown + KaTeX math support.
 * Handles code fences (```lang\n...\n```) separately to avoid math
 * processing inside code blocks.
 */
export default function MathContent({ content, streaming }: Props) {
    // Split on code fences first
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
        <div className="math-content">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const lines = part.slice(3).split('\n');
                    const lang = lines[0].trim();
                    const code = (lang ? lines.slice(1) : lines).join('\n').replace(/```$/, '').trimEnd();
                    return (
                        <pre key={i} className="math-code-block">
                            {lang && <span className="math-code-lang">{lang}</span>}
                            <code>{code}</code>
                        </pre>
                    );
                }
                return (
                    <span
                        key={i}
                        dangerouslySetInnerHTML={{ __html: renderMath(part) }}
                    />
                );
            })}
            {streaming && <span className="chat-cursor" />}
        </div>
    );
}
