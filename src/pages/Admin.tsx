import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || 'saarthi-admin-2026';

interface AgentStats {
    document_count: number;
    index_exists: boolean;
    last_indexed: string | null;
    total_chunks: number;
}

interface KBStats {
    agents: Record<string, AgentStats>;
}

const AGENTS = [
    { key: 'notes_agent', label: 'Notes Agent', emoji: '📝', desc: 'Lecture notes & handwritten PDFs' },
    { key: 'books_agent', label: 'Books Agent', emoji: '📚', desc: 'Textbooks & reference material' },
    { key: 'video_agent', label: 'Video Agent', emoji: '🎥', desc: 'Video lecture transcripts' },
];

function timeAgo(isoStr: string | null): string {
    if (!isoStr) return 'Never';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function Admin() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<KBStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/kb/stats', {
                headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
            });
            if (!res.ok) throw new Error('Unauthorized or server error');
            setStats(await res.json());
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStats(); }, []);

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div className="admin-header-left">
                    <span className="admin-logo">🎓</span>
                    <div>
                        <h1>Saarthi Admin</h1>
                        <p>Knowledge Base Management</p>
                    </div>
                </div>
                <button className="admin-refresh-btn" onClick={fetchStats}>↻ Refresh</button>
            </div>

            <div className="admin-body">
                <h2 className="admin-section-title">Knowledge Base Health</h2>

                {loading && <div className="admin-loading">Loading stats...</div>}
                {error && <div className="admin-error">⚠️ {error}</div>}

                {stats && (
                    <div className="admin-agents-grid">
                        {AGENTS.map(({ key, label, emoji, desc }) => {
                            const s = stats.agents[key];
                            const healthy = s?.index_exists;
                            return (
                                <div key={key} className={`admin-agent-card ${healthy ? 'healthy' : 'stale'}`}>
                                    <div className="admin-agent-top">
                                        <span className="admin-agent-emoji">{emoji}</span>
                                        <div className="admin-agent-info">
                                            <h3>{label}</h3>
                                            <p>{desc}</p>
                                        </div>
                                        <span className={`admin-status-badge ${healthy ? 'ok' : 'warn'}`}>
                                            {healthy ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                    <div className="admin-agent-stats">
                                        <span>{s?.document_count ?? 0} docs</span>
                                        <span>·</span>
                                        <span>{s?.total_chunks ?? 0} chunks</span>
                                        <span>·</span>
                                        <span>Last: {timeAgo(s?.last_indexed ?? null)}</span>
                                    </div>
                                    <button
                                        className="admin-manage-btn"
                                        onClick={() => navigate(`/admin/${key}`)}
                                    >
                                        Manage →
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
