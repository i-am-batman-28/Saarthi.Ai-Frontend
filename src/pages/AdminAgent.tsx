import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './AdminAgent.css';

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || 'saarthi-admin-2026';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const AGENT_META: Record<string, { label: string; emoji: string; desc: string }> = {
    notes_agent: { label: 'Notes Agent', emoji: '📝', desc: 'Lecture notes & handwritten PDFs' },
    books_agent: { label: 'Books Agent', emoji: '📚', desc: 'Textbooks & reference material' },
    video_agent: { label: 'Video Agent', emoji: '🎥', desc: 'Video lecture transcripts' },
};

interface DocItem {
    name: string;
    size_kb: number;
    uploaded_at: string;
}

interface IndexStatusResponse {
    job_id: string;
    agent: string;
    status: string;
    progress: string;
    documents_processed: number;
    total_documents: number;
    chunks_created: number;
}

function authHeaders() {
    return { Authorization: `Bearer ${ADMIN_TOKEN}` };
}

export default function AdminAgent() {
    const { agentKey } = useParams<{ agentKey: string }>();
    const navigate = useNavigate();
    const meta = AGENT_META[agentKey || ''];

    const [docs, setDocs] = useState<DocItem[]>([]);
    const [docsLoading, setDocsLoading] = useState(true);
    const [docsError, setDocsError] = useState('');

    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<IndexStatusResponse | null>(null);
    const [indexLogs, setIndexLogs] = useState<string[]>([]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [deletingFile, setDeletingFile] = useState<string | null>(null);

    if (!meta) {
        return (
            <div className="admin-agent-page">
                <div className="admin-error">Unknown agent: {agentKey}</div>
            </div>
        );
    }

    const fetchDocs = async () => {
        setDocsLoading(true);
        setDocsError('');
        try {
            const res = await fetch(`${API}/admin/kb/docs?agent_name=${agentKey}`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error('Failed to load documents');
            const data = await res.json();
            setDocs(data.documents);
        } catch (e: any) {
            setDocsError(e.message);
        } finally {
            setDocsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [agentKey]);

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setUploadMsg('');
        const form = new FormData();
        form.append('agent_name', agentKey!);
        Array.from(files).forEach((f) => form.append('files', f));
        try {
            const res = await fetch(`${API}/admin/kb/upload`, {
                method: 'POST',
                headers: authHeaders(),
                body: form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
                throw new Error(err.detail || 'Upload failed');
            }
            const data = await res.json();
            setUploadMsg(`Uploaded: ${data.files.join(', ')}`);
            await fetchDocs();
        } catch (e: any) {
            setUploadMsg(`Error: ${e.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`Delete ${filename}?`)) return;
        setDeletingFile(filename);
        try {
            const res = await fetch(
                `${API}/admin/kb/docs?agent_name=${agentKey}&filename=${encodeURIComponent(filename)}`,
                { method: 'DELETE', headers: authHeaders() }
            );
            if (!res.ok) throw new Error('Delete failed');
            await fetchDocs();
        } catch (e: any) {
            alert(`Delete failed: ${e.message}`);
        } finally {
            setDeletingFile(null);
        }
    };

    const startPolling = (id: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API}/admin/kb/index/status?job_id=${id}`, {
                    headers: authHeaders(),
                });
                if (!res.ok) return;
                const status: IndexStatusResponse = await res.json();
                setJobStatus(status);
                setIndexLogs((prev) => {
                    const last = prev[prev.length - 1];
                    if (last !== status.progress) return [...prev, status.progress];
                    return prev;
                });
                if (status.status !== 'running') {
                    clearInterval(pollRef.current!);
                    pollRef.current = null;
                }
            } catch {
                // ignore poll errors
            }
        }, 2000);
    };

    const handleReindex = async () => {
        setIndexLogs(['Starting re-index...']);
        setJobStatus(null);
        try {
            const res = await fetch(`${API}/admin/kb/index`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_name: agentKey }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Index failed' }));
                throw new Error(err.detail || 'Index failed');
            }
            const data = await res.json();
            setJobId(data.job_id);
            startPolling(data.job_id);
        } catch (e: any) {
            setIndexLogs([`Error: ${e.message}`]);
        }
    };

    const isIndexing = jobStatus?.status === 'running' || (jobId && !jobStatus);

    return (
        <div className="admin-agent-page">
            <div className="admin-agent-header">
                <button className="admin-back-btn" onClick={() => navigate('/admin')}>← Back</button>
                <span className="admin-agent-title-emoji">{meta.emoji}</span>
                <div>
                    <h1>{meta.label} Knowledge Base</h1>
                    <p>{meta.desc}</p>
                </div>
            </div>

            <div className="admin-agent-body">

                {/* ── Current Documents ── */}
                <section className="admin-section">
                    <h2>Current Documents</h2>
                    {docsLoading && <div className="admin-loading">Loading...</div>}
                    {docsError && <div className="admin-error">⚠️ {docsError}</div>}
                    {!docsLoading && !docsError && (
                        docs.length === 0 ? (
                            <div className="admin-empty">No documents uploaded yet.</div>
                        ) : (
                            <table className="admin-docs-table">
                                <thead>
                                    <tr>
                                        <th>Filename</th>
                                        <th>Size</th>
                                        <th>Uploaded</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {docs.map((doc) => (
                                        <tr key={doc.name}>
                                            <td className="admin-doc-name">{doc.name}</td>
                                            <td>{doc.size_kb} KB</td>
                                            <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    className="admin-delete-btn"
                                                    onClick={() => handleDelete(doc.name)}
                                                    disabled={deletingFile === doc.name}
                                                >
                                                    {deletingFile === doc.name ? '...' : '🗑️'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </section>

                {/* ── Upload New Documents ── */}
                <section className="admin-section">
                    <h2>Upload New Documents</h2>
                    <div
                        className={`admin-dropzone ${dragOver ? 'drag-over' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            handleUpload(e.dataTransfer.files);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <span className="admin-dropzone-icon">📂</span>
                        <p>Drop PDFs / TXTs here or click to browse</p>
                        <p className="admin-dropzone-sub">Max 50 MB per file</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleUpload(e.target.files)}
                    />

                    <div className="admin-upload-actions">
                        <button
                            className="admin-upload-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? 'Uploading...' : '⬆️ Upload Files'}
                        </button>
                        <button
                            className="admin-reindex-btn"
                            onClick={handleReindex}
                            disabled={!!isIndexing}
                        >
                            {isIndexing ? '⏳ Indexing...' : '🔄 Re-index Now'}
                        </button>
                    </div>

                    {uploadMsg && (
                        <div className={`admin-upload-msg ${uploadMsg.startsWith('Error') ? 'error' : 'success'}`}>
                            {uploadMsg}
                        </div>
                    )}
                </section>

                {/* ── Indexing Log ── */}
                {indexLogs.length > 0 && (
                    <section className="admin-section">
                        <h2>Indexing Log</h2>
                        <div className="admin-index-log">
                            {indexLogs.map((line, i) => (
                                <div key={i} className="admin-log-line">
                                    {line.startsWith('Error') ? '❌' : i === indexLogs.length - 1 && isIndexing ? '⏳' : '✅'} {line}
                                </div>
                            ))}
                            {jobStatus && jobStatus.status !== 'running' && (
                                <div className={`admin-log-line ${jobStatus.status === 'complete' ? 'success' : 'error'}`}>
                                    {jobStatus.status === 'complete'
                                        ? `✅ Done — ${jobStatus.total_documents} docs → ${jobStatus.chunks_created} chunks`
                                        : `❌ Failed`}
                                </div>
                            )}
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
}
