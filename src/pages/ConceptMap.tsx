import { useState } from 'react';
import { Network, Loader2, Sparkles, BookOpen, AlertCircle, Info } from 'lucide-react';
import { api } from '../lib/api';
import './ConceptMap.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConceptNode {
    id: string;
    label: string;
    topic: string;
    mastery: number;
    prereqs: string[];
}

interface ConceptGraphResponse {
    nodes: ConceptNode[];
    generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function masteryColor(m: number): string {
    if (m >= 0.8) return '#5FA89C';   // green — mastered
    if (m >= 0.5) return '#B59A63';   // amber — developing
    return '#C86F7A';                  // red — weak
}

function masteryLabel(m: number): string {
    if (m >= 0.8) return 'Mastered';
    if (m >= 0.5) return 'Developing';
    return 'Weak';
}

// ── Concept Node Card ─────────────────────────────────────────────────────────

function NodeCard({ node, selected, onClick }: { node: ConceptNode; selected: boolean; onClick: () => void }) {
    const color = masteryColor(node.mastery);
    const pct = Math.round(node.mastery * 100);
    return (
        <button
            className={`cm-node-card ${selected ? 'cm-node-selected' : ''}`}
            style={{ '--node-color': color } as any}
            onClick={onClick}
        >
            <div className="cm-node-top">
                <span className="cm-node-label">{node.label}</span>
                <span className="cm-node-pct" style={{ color }}>{pct}%</span>
            </div>
            <div className="cm-node-bar">
                <div className="cm-node-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="cm-node-topic">{node.topic}</span>
        </button>
    );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function NodeDetail({ node, allNodes, onClose }: { node: ConceptNode; allNodes: ConceptNode[]; onClose: () => void }) {
    const prereqNodes = allNodes.filter(n => node.prereqs.includes(n.id));
    const dependents = allNodes.filter(n => n.prereqs.includes(node.id));
    const color = masteryColor(node.mastery);

    return (
        <div className="cm-detail animate-fade-in">
            <div className="cm-detail-header" style={{ borderColor: color }}>
                <div>
                    <h3>{node.label}</h3>
                    <span className="badge" style={{ background: `${color}22`, color }}>{masteryLabel(node.mastery)}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>

            <div className="cm-detail-mastery">
                <span>Mastery</span>
                <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-bar-fill" style={{ width: `${Math.round(node.mastery * 100)}%`, background: color }} />
                </div>
                <span style={{ color, fontWeight: 700 }}>{Math.round(node.mastery * 100)}%</span>
            </div>

            {node.mastery < 0.5 && (
                <div className="cm-detail-alert">
                    <AlertCircle size={16} />
                    <span>This is a weak area. Consider reviewing before attempting dependent concepts.</span>
                </div>
            )}

            {prereqNodes.length > 0 && (
                <div className="cm-detail-section">
                    <h4>Prerequisites</h4>
                    <div className="cm-detail-tags">
                        {prereqNodes.map(n => (
                            <span key={n.id} className="badge" style={{ background: `${masteryColor(n.mastery)}22`, color: masteryColor(n.mastery) }}>
                                {n.label} ({Math.round(n.mastery * 100)}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {dependents.length > 0 && (
                <div className="cm-detail-section">
                    <h4>Unlocks</h4>
                    <div className="cm-detail-tags">
                        {dependents.map(n => (
                            <span key={n.id} className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                                {n.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConceptMapPage() {
    const [courseTitle, setCourseTitle] = useState('');
    const [graph, setGraph] = useState<ConceptGraphResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<ConceptNode | null>(null);
    const [filter, setFilter] = useState<'all' | 'weak' | 'developing' | 'mastered'>('all');

    const generate = async () => {
        if (!courseTitle.trim()) { setError('Enter a course title.'); return; }
        setError('');
        setLoading(true);
        setSelected(null);
        try {
            const result = await api.post<ConceptGraphResponse>('/chat/concept-graph', {
                courseTitle: courseTitle.trim(),
                courses: [{ title: courseTitle.trim(), code: '', progressPercent: 50 }],
                recentQuizScores: [],
            });
            setGraph(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate concept map.');
        } finally {
            setLoading(false);
        }
    };

    const filteredNodes = graph?.nodes.filter(n => {
        if (filter === 'weak') return n.mastery < 0.5;
        if (filter === 'developing') return n.mastery >= 0.5 && n.mastery < 0.8;
        if (filter === 'mastered') return n.mastery >= 0.8;
        return true;
    }) ?? [];

    const weakCount = graph?.nodes.filter(n => n.mastery < 0.5).length ?? 0;
    const devCount = graph?.nodes.filter(n => n.mastery >= 0.5 && n.mastery < 0.8).length ?? 0;
    const masterCount = graph?.nodes.filter(n => n.mastery >= 0.8).length ?? 0;

    return (
        <div className="cm-page">
            <div className="cm-header animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Network size={22} style={{ color: 'var(--accent)' }} />
                    <h1>Concept Knowledge Map</h1>
                </div>
                <p>Visualise every concept in your course with your mastery level. Click any node to see prerequisites and what it unlocks.</p>
            </div>

            <div className="cm-controls animate-fade-in delay-100">
                <input
                    className="input cm-input"
                    placeholder="Enter your course, e.g. Digital Signal Processing"
                    value={courseTitle}
                    onChange={e => setCourseTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                />
                <button className="btn btn-primary" onClick={generate} disabled={loading}>
                    {loading
                        ? <><Loader2 size={16} className="animate-spin" /> Building map...</>
                        : <><Sparkles size={16} /> Generate Map</>}
                </button>
            </div>

            {error && <p className="cm-error">{error}</p>}

            {graph && (
                <>
                    <div className="cm-stats animate-fade-in">
                        <button className={`cm-stat ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                            <span className="cm-stat-val">{graph.nodes.length}</span>
                            <span className="cm-stat-lbl">All Concepts</span>
                        </button>
                        <button className={`cm-stat ${filter === 'weak' ? 'active' : ''}`} onClick={() => setFilter('weak')}>
                            <span className="cm-stat-val" style={{ color: '#C86F7A' }}>{weakCount}</span>
                            <span className="cm-stat-lbl">Weak</span>
                        </button>
                        <button className={`cm-stat ${filter === 'developing' ? 'active' : ''}`} onClick={() => setFilter('developing')}>
                            <span className="cm-stat-val" style={{ color: '#B59A63' }}>{devCount}</span>
                            <span className="cm-stat-lbl">Developing</span>
                        </button>
                        <button className={`cm-stat ${filter === 'mastered' ? 'active' : ''}`} onClick={() => setFilter('mastered')}>
                            <span className="cm-stat-val" style={{ color: '#5FA89C' }}>{masterCount}</span>
                            <span className="cm-stat-lbl">Mastered</span>
                        </button>
                    </div>

                    <div className="cm-legend animate-fade-in">
                        <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span>Click a concept to see its prerequisites and what it unlocks.</span>
                        <span className="cm-legend-dot" style={{ background: '#C86F7A' }} /> Weak (&lt;50%)
                        <span className="cm-legend-dot" style={{ background: '#B59A63' }} /> Developing (50–80%)
                        <span className="cm-legend-dot" style={{ background: '#5FA89C' }} /> Mastered (&gt;80%)
                    </div>

                    <div className="cm-body">
                        <div className="cm-grid animate-fade-in delay-100">
                            {filteredNodes.length === 0 ? (
                                <div className="cm-empty">
                                    <BookOpen size={28} />
                                    <p>No concepts match this filter.</p>
                                </div>
                            ) : filteredNodes.map(node => (
                                <NodeCard
                                    key={node.id}
                                    node={node}
                                    selected={selected?.id === node.id}
                                    onClick={() => setSelected(s => s?.id === node.id ? null : node)}
                                />
                            ))}
                        </div>

                        {selected && (
                            <NodeDetail
                                node={selected}
                                allNodes={graph.nodes}
                                onClose={() => setSelected(null)}
                            />
                        )}
                    </div>
                </>
            )}

            {!graph && !loading && (
                <div className="cm-empty-state animate-fade-in delay-200">
                    <Network size={48} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
                    <h2>Enter a course to build your knowledge map</h2>
                    <p>The AI generates a concept dependency graph tailored to your course and quiz performance, so you can see exactly where your understanding gaps are.</p>
                </div>
            )}
        </div>
    );
}
