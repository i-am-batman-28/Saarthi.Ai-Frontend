import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Plus, FileText, Video, BookOpen, Trash2, X, Save, Paperclip,
    Link as LinkIcon, Heading, Pencil, ExternalLink, Send, Sparkles, Users,
    Mail, LogIn, CheckCircle2, XCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { api, uploadFile, getUploadFullUrl, getMaterialFileUrl, type CourseResponse, type PaginatedResponse, type AssignmentResponse, type MaterialResponse, type StreamItemResponse, type CoursePersonResponse } from '../lib/api';
import Pagination from '../components/Pagination';
import FileDropzone from '../components/FileDropzone';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { renderMath } from '../lib/renderMath';
import './CourseDetail.css';

const PAGE_SIZE = 20;

/* ── Types ── */
interface Assignment {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    points: number;
    status: 'pending' | 'submitted' | 'graded';
    grade?: number;
    attachments: string[];
    createdAt: string;
    topic: string;
}

interface Material {
    id: string;
    title: string;
    description: string;
    type: 'pdf' | 'doc' | 'link' | 'slide';
    url: string;
    createdAt: string;
    topic: string;
}

interface VideoLecture {
    id: string;
    title: string;
    description: string;
    duration: string;
    thumbnail: string;
    url: string;
    watched: boolean;
    createdAt: string;
    topic: string;
}

interface StreamItem {
    id: string;
    type: 'assignment' | 'material' | 'video' | 'announcement';
    title: string;
    description: string;
    createdAt: string;
    author: string;
}

type DocChatSection = { title: string; body: string; understood: boolean | null };
type DocChatMessage =
    | { role: 'user'; content: string }
    | { role: 'assistant'; sections: DocChatSection[]; followUps: string[]; raw: string };

function parseDocChatResponse(raw: string): { sections: DocChatSection[]; followUps: string[] } {
    // Split off FOLLOWUPS line
    const followUpsMatch = raw.match(/FOLLOWUPS:\s*(.+)$/m);
    const followUps = followUpsMatch
        ? followUpsMatch[1].split('|').map(q => q.trim()).filter(Boolean)
        : [];
    const body = raw.replace(/FOLLOWUPS:.+$/m, '').trim();

    // Split on ## headings
    const parts = body.split(/(?=^## )/m).filter(Boolean);
    const sections: DocChatSection[] = parts.map(part => {
        const lines = part.split('\n');
        const titleLine = lines[0].replace(/^##\s*/, '').trim();
        const sectionBody = lines.slice(1).join('\n').replace(/CHECKPOINT\s*/g, '').trim();
        return { title: titleLine, body: sectionBody, understood: null };
    });

    if (sections.length === 0 && body) {
        sections.push({ title: '', body, understood: null });
    }
    return { sections, followUps };
}

const tabs = [
    { id: 'stream', label: 'Stream' },
    { id: 'classwork', label: 'Classwork' },
    { id: 'people', label: 'People' },
];

type ModalType = 'assignment' | 'material' | 'video' | 'topic' | null;

function mapAssignment(a: AssignmentResponse): Assignment {
    return {
        id: a.id,
        title: a.title,
        description: a.description ?? '',
        dueDate: a.dueDate,
        points: a.points,
        status: 'pending',
        attachments: a.attachments ? [a.attachments] : [],
        createdAt: a.createdAt,
        topic: a.topic ?? 'No topic',
    };
}

function mapMaterial(m: MaterialResponse): Material {
    return {
        id: m.id,
        title: m.title,
        description: m.description ?? '',
        type: m.type as Material['type'],
        url: m.url,
        createdAt: m.createdAt,
        topic: m.topic ?? 'No topic',
    };
}

function mapStreamItem(s: StreamItemResponse): StreamItem {
    return {
        id: s.id,
        type: (s.type as StreamItem['type']) || 'announcement',
        title: s.title ?? '',
        description: s.description,
        createdAt: s.createdAt,
        author: s.author,
    };
}

export default function CourseDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const toast = useToast();
    const isAdmin = user?.role === 'admin';
    const isInstructor = isAdmin || user?.role === 'teacher';
    const courseId = id ?? '';

    const [course, setCourse] = useState<CourseResponse | null>(null);
    const [courseLoading, setCourseLoading] = useState(true);
    const [courseError, setCourseError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('stream');
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [assignmentsTotal, setAssignmentsTotal] = useState(0);
    const [assignmentsOffset, setAssignmentsOffset] = useState(0);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [materialsTotal, setMaterialsTotal] = useState(0);
    const [materialsOffset, setMaterialsOffset] = useState(0);
    const [stream, setStream] = useState<StreamItem[]>([]);
    const [streamTotal, setStreamTotal] = useState(0);
    const [streamOffset, setStreamOffset] = useState(0);
    const [people, setPeople] = useState<CoursePersonResponse[]>([]);
    const [peopleTotal, setPeopleTotal] = useState(0);
    const [peopleOffset, setPeopleOffset] = useState(0);
    const [videos, setVideos] = useState<VideoLecture[]>([]);
    const [topics, setTopics] = useState<string[]>(['Course Materials', 'Class Work', 'Projects', 'Video Lectures', 'Post Exam - Solutions']);

    const courseDisplay = course ? { title: course.title, code: course.code, instructor: course.instructor, emoji: course.thumbnailEmoji || '📚', color: course.color || '#3f4244' } : { title: '…', code: '', instructor: '', emoji: '📚', color: '#3f4244' };
    const userName = user?.name || (isInstructor ? courseDisplay.instructor : 'Student');

    useEffect(() => {
        if (!courseId) return;
        let cancelled = false;
        setCourseLoading(true);
        setCourseError(null);
        api.get<CourseResponse>(`/courses/${courseId}`)
            .then((c) => { if (!cancelled) setCourse(c); })
            .catch((e) => { if (!cancelled) setCourseError(e instanceof Error ? e.message : 'Course not found'); })
            .finally(() => { if (!cancelled) setCourseLoading(false); });
        return () => { cancelled = true; };
    }, [courseId]);

    useEffect(() => {
        if (!courseId) return;
        let cancelled = false;
        api.get<PaginatedResponse<AssignmentResponse>>(`/courses/${courseId}/assignments`, { limit: PAGE_SIZE, offset: assignmentsOffset })
            .then((r) => { if (!cancelled) { setAssignments((r.items || []).map(mapAssignment)); setAssignmentsTotal(r.total ?? 0); } })
            .catch(() => { if (!cancelled) setAssignments([]); });
        return () => { cancelled = true; };
    }, [courseId, assignmentsOffset]);

    useEffect(() => {
        if (!courseId) return;
        let cancelled = false;
        api.get<PaginatedResponse<MaterialResponse>>(`/courses/${courseId}/materials`, { limit: PAGE_SIZE, offset: materialsOffset })
            .then((r) => { if (!cancelled) { setMaterials((r.items || []).map(mapMaterial)); setMaterialsTotal(r.total ?? 0); } })
            .catch(() => { if (!cancelled) setMaterials([]); });
        return () => { cancelled = true; };
    }, [courseId, materialsOffset]);

    useEffect(() => {
        if (!courseId) return;
        let cancelled = false;
        api.get<PaginatedResponse<StreamItemResponse>>(`/courses/${courseId}/stream`, { limit: PAGE_SIZE, offset: streamOffset })
            .then((r) => { if (!cancelled) { setStream((r.items || []).map(mapStreamItem)); setStreamTotal(r.total ?? 0); } })
            .catch(() => { if (!cancelled) setStream([]); });
        return () => { cancelled = true; };
    }, [courseId, streamOffset]);

    useEffect(() => {
        if (!courseId || activeTab !== 'people') return;
        let cancelled = false;
        api.get<PaginatedResponse<CoursePersonResponse>>(`/courses/${courseId}/people`, { limit: PAGE_SIZE, offset: peopleOffset })
            .then((r) => { if (!cancelled) { setPeople(r.items || []); setPeopleTotal(r.total ?? 0); } })
            .catch(() => { if (!cancelled) setPeople([]); });
        return () => { cancelled = true; };
    }, [courseId, activeTab, peopleOffset]);

    const handleSubmitAssignment = async () => {
        if (!courseId || !submitAssignmentId) return;
        setSubmitting(true);
        try {
            let attachmentUrl: string | undefined;
            if (submitFile) {
                const { url } = await uploadFile(submitFile);
                attachmentUrl = url;
            }
            await api.post(`/courses/${courseId}/assignments/${submitAssignmentId}/submit`, { attachmentUrl });
            setAssignments((prev) => prev.map((a) => (a.id === submitAssignmentId ? { ...a, status: 'submitted' as const } : a)));
            setSubmitAssignmentId(null);
            setSubmitFile(null);
            toast.showToast('Assignment submitted');
        } catch (e) {
            toast.showToast(e instanceof Error ? e.message : 'Submit failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Compose Annoucnement
    const [isComposing, setIsComposing] = useState(false);
    const [announcementText, setAnnouncementText] = useState('');

    // Modal
    const [modalType, setModalType] = useState<ModalType>(null);
    const [editItem, setEditItem] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});
    const [createMenuOpen, setCreateMenuOpen] = useState(false);
    const [submitAssignmentId, setSubmitAssignmentId] = useState<string | null>(null);
    const [submitFile, setSubmitFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
    const [savingMaterial, setSavingMaterial] = useState(false);
    const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
    const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
    const [materialFormError, setMaterialFormError] = useState<string | null>(null);
    const [docChatMessages, setDocChatMessages] = useState<DocChatMessage[]>([]);
    const [docChatInput, setDocChatInput] = useState('');
    const [docChatSending, setDocChatSending] = useState(false);
    const docChatBottomRef = useRef<HTMLDivElement>(null);
    const docChatScrollRef = useRef<HTMLDivElement>(null);
    const [docPdfObjectUrl, setDocPdfObjectUrl] = useState<string | null>(null);
    const [docPdfError, setDocPdfError] = useState<string | null>(null);
    const [docPdfLoading, setDocPdfLoading] = useState(false);

    // Invite state (teacher)
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
    const [inviteError, setInviteError] = useState('');
    const [csvResults, setCsvResults] = useState<{ email: string; sent: boolean; error?: string }[]>([]);
    const [csvLoading, setCsvLoading] = useState(false);

    // Join state (student)
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinSuccess, setJoinSuccess] = useState('');

    const handlePostAnnouncement = () => {
        if (!announcementText.trim()) return;
        const now = new Date().toISOString().split('T')[0];
        const newPost: StreamItem = {
            id: Date.now().toString(),
            type: 'announcement',
            title: '',
            description: announcementText.trim(),
            createdAt: now,
            author: userName
        };
        setStream(prev => [newPost, ...prev]);
        setAnnouncementText('');
        setIsComposing(false);
    };

    const openModal = (type: ModalType, item?: any) => {
        setCreateMenuOpen(false);
        setModalType(type);
        setEditItem(item || null);
        setMaterialFormError(null);
        if (item) {
            setFormData({ ...item });
        } else {
            if (type === 'assignment') setFormData({ title: '', description: '', dueDate: '', points: 100, attachments: [], topic: topics[0] || '' });
            if (type === 'material') setFormData({ title: '', description: '', type: 'pdf', url: '', topic: topics[0] || '' });
            if (type === 'video') setFormData({ title: '', description: '', duration: '', url: '', topic: topics[0] || '' });
            if (type === 'topic') setFormData({ title: '' });
        }
    };

    const handleSave = async () => {
        const now = new Date().toISOString().split('T')[0];
        if (modalType === 'topic') {
            if (formData.title && !topics.includes(formData.title)) {
                setTopics([...topics, formData.title]);
            }
            setModalType(null);
            return;
        }
        if (modalType === 'material' && courseId) {
            setMaterialFormError(null);
            if (!formData.title?.trim()) {
                setMaterialFormError('Title is required.');
                return;
            }
            if (!formData.url?.trim()) {
                setMaterialFormError('Please upload a file or enter a URL.');
                return;
            }
            setSavingMaterial(true);
            try {
                const payload = {
                    title: formData.title.trim(),
                    description: formData.description?.trim() || undefined,
                    type: formData.type || 'pdf',
                    url: formData.url.trim(),
                    topic: formData.topic || undefined,
                };
                if (editItem) {
                    const updated = await api.patch<MaterialResponse>(`/courses/${courseId}/materials/${editItem.id}`, payload);
                    setMaterials((prev) => prev.map((m) => (m.id === editItem.id ? mapMaterial(updated) : m)));
                } else {
                    const created = await api.post<MaterialResponse>(`/courses/${courseId}/materials`, payload);
                    setMaterials((prev) => [mapMaterial(created), ...prev]);
                    setMaterialsTotal((t) => t + 1);
                    setStream((prev) => [{ id: created.id, type: 'material', title: `${userName} posted a new material:`, description: formData.title, createdAt: now, author: userName }, ...prev]);
                }
                setModalType(null);
                setMaterialFormError(null);
            } catch (e) {
                setMaterialFormError(e instanceof Error ? e.message : 'Failed to save material.');
            } finally {
                setSavingMaterial(false);
            }
            return;
        }
        if (modalType === 'assignment') {
            if (editItem) {
                setAssignments((prev) => prev.map((a) => (a.id === editItem.id ? { ...a, ...formData } : a)));
            } else {
                const newA: Assignment = { id: Date.now().toString(), ...formData, status: 'pending', createdAt: now };
                setAssignments((prev) => [newA, ...prev]);
                setStream((prev) => [{ id: Date.now().toString(), type: 'assignment', title: `${userName} posted a new assignment:`, description: formData.title, createdAt: now, author: userName }, ...prev]);
            }
        }
        else if (modalType === 'video') {
            if (editItem) {
                setVideos((prev) => prev.map((v) => (v.id === editItem.id ? { ...v, ...formData } : v)));
            } else {
                const newV: VideoLecture = { id: Date.now().toString(), ...formData, thumbnail: '🎬', watched: false, createdAt: now };
                setVideos((prev) => [newV, ...prev]);
                setStream((prev) => [{ id: Date.now().toString(), type: 'video', title: `${userName} posted a new video lecture:`, description: formData.title, createdAt: now, author: userName }, ...prev]);
            }
        }
        setModalType(null);
    };

    useEffect(() => {
        if (viewingMaterial) {
            setDocChatMessages([]);
            setDocChatInput('');
        }
    }, [viewingMaterial?.id]);

    const isPdfMaterial = (m: Material) => m.type === 'pdf' || (m.url && /\.pdf$/i.test(m.url));

    useEffect(() => {
        if (!viewingMaterial || !courseId || !isPdfMaterial(viewingMaterial)) {
            setDocPdfObjectUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            setDocPdfError(null);
            setDocPdfLoading(false);
            return;
        }
        const url = getMaterialFileUrl(courseId, viewingMaterial.id);
        setDocPdfError(null);
        setDocPdfLoading(true);
        setDocPdfObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        fetch(url, { credentials: 'include' })
            .then((res) => {
                if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Please sign in again to view this file.' : `Could not load file (${res.status}).`);
                return res.blob();
            })
            .then((blob) => {
                setDocPdfObjectUrl(URL.createObjectURL(blob));
                setDocPdfError(null);
            })
            .catch((e) => {
                setDocPdfError(e instanceof Error ? e.message : 'Failed to load PDF.');
            })
            .finally(() => setDocPdfLoading(false));
        return () => {
            setDocPdfObjectUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        };
    }, [viewingMaterial?.id, courseId, viewingMaterial?.type, viewingMaterial?.url]);

    const sendDocChatMessage = async (overrideMessage?: string) => {
        if (!viewingMaterial || docChatSending) return;
        const userContent = (overrideMessage ?? docChatInput).trim();
        if (!userContent) return;
        setDocChatInput('');
        const historyForApi = docChatMessages.map(m =>
            m.role === 'user'
                ? { role: 'user', content: m.content }
                : { role: 'assistant', content: m.raw }
        );
        setDocChatMessages(prev => [...prev, { role: 'user', content: userContent }]);
        setDocChatSending(true);
        requestAnimationFrame(() => { if (docChatScrollRef.current) docChatScrollRef.current.scrollTop = docChatScrollRef.current.scrollHeight; });
        try {
            const data = await api.post<{ response: string }>('/chat/message', {
                message: userContent,
                conversationHistory: historyForApi,
                contextMaterialTitle: viewingMaterial.title,
                courseId: courseId ? parseInt(courseId) : undefined,
            });
            const { sections, followUps } = parseDocChatResponse(data.response);
            setDocChatMessages(prev => [...prev, { role: 'assistant', sections, followUps, raw: data.response }]);
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
            setDocChatMessages(prev => [...prev, {
                role: 'assistant',
                sections: [{ title: '', body: errMsg, understood: null }],
                followUps: [],
                raw: errMsg,
            }]);
        } finally {
            setDocChatSending(false);
            requestAnimationFrame(() => { if (docChatScrollRef.current) docChatScrollRef.current.scrollTop = docChatScrollRef.current.scrollHeight; });
        }
    };

    const markSectionUnderstood = (msgIdx: number, secIdx: number, val: boolean) => {
        setDocChatMessages(prev => prev.map((m, mi) => {
            if (mi !== msgIdx || m.role !== 'assistant') return m;
            const sections = m.sections.map((s, si) => si === secIdx ? { ...s, understood: val } : s);
            return { ...m, sections };
        }));
    };

    const handleDeleteMaterialClick = (material: Material) => {
        setMaterialToDelete(material);
    };

    const handleDeleteMaterialConfirm = async () => {
        if (!courseId || !materialToDelete) return;
        setDeletingMaterialId(materialToDelete.id);
        try {
            await api.delete(`/courses/${courseId}/materials/${materialToDelete.id}`);
            setMaterials((prev) => prev.filter((m) => m.id !== materialToDelete.id));
            setMaterialsTotal((t) => Math.max(0, t - 1));
            setMaterialToDelete(null);
        } catch (e) {
            setMaterialFormError(e instanceof Error ? e.message : 'Failed to delete material.');
        } finally {
            setDeletingMaterialId(null);
        }
    };


    const handleSendInvite = async () => {
        if (!inviteEmail.trim() || !courseId) return;
        setInviteSending(true);
        setInviteError('');
        try {
            await api.post(`/courses/${courseId}/invite`, { email: inviteEmail.trim() });
            setInvitedEmails((prev) => [...prev, inviteEmail.trim()]);
            setInviteEmail('');
        } catch (e) {
            setInviteError(e instanceof Error ? e.message : 'Failed to send invite.');
        } finally {
            setInviteSending(false);
        }
    };

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !courseId) return;
        e.target.value = '';
        const text = await file.text();
        const emails = Array.from(
            new Set(
                text.split(/[\r\n,;\t]+/)
                    .map((s) => s.replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase())
                    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
            )
        );
        if (emails.length === 0) {
            setInviteError('No valid email addresses found in the CSV.');
            return;
        }
        setInviteError('');
        setCsvLoading(true);
        setCsvResults([]);
        const results: { email: string; sent: boolean; error?: string }[] = [];
        for (const email of emails) {
            try {
                await api.post(`/courses/${courseId}/invite`, { email });
                results.push({ email, sent: true });
            } catch (err) {
                results.push({ email, sent: false, error: err instanceof Error ? err.message : 'Failed' });
            }
            setCsvResults([...results]);
        }
        setCsvLoading(false);
    };

    const handleJoinCourse = async () => {
        if (!joinCode.trim()) return;
        setJoinLoading(true);
        setJoinError('');
        setJoinSuccess('');
        try {
            const res = await api.post<{ courseTitle: string; message: string }>('/courses/join', { inviteCode: joinCode.trim() });
            setJoinSuccess(res.message || `You joined ${res.courseTitle}!`);
            setJoinCode('');
            // Reload people list
            const r = await api.get<{ items: CoursePersonResponse[]; total: number }>(`/courses/${courseId}/people`, { limit: PAGE_SIZE, offset: 0 });
            setPeople(r.items || []);
            setPeopleTotal(r.total ?? 0);
        } catch (e) {
            setJoinError(e instanceof Error ? e.message : 'Invalid or expired invite code.');
        } finally {
            setJoinLoading(false);
        }
    };

    // Calculate Items by Topic
    const itemsByTopic: Record<string, any[]> = {};
    topics.forEach(t => itemsByTopic[t] = []);
    itemsByTopic['No topic'] = [];

    assignments.forEach(a => {
        const topic = a.topic && topics.includes(a.topic) ? a.topic : 'No topic';
        itemsByTopic[topic].push({ ...a, itemType: 'assignment' });
    });
    materials.forEach(m => {
        const topic = m.topic && topics.includes(m.topic) ? m.topic : 'No topic';
        itemsByTopic[topic].push({ ...m, itemType: 'material' });
    });
    videos.forEach(v => {
        const topic = v.topic && topics.includes(v.topic) ? v.topic : 'No topic';
        itemsByTopic[topic].push({ ...v, itemType: 'video' });
    });

    if (courseLoading && !course) {
        return <div className="cd-page"><div className="cd-loading">Loading course…</div></div>;
    }
    if (courseError || (!courseLoading && courseId && !course)) {
        return (
            <div className="cd-page">
                <div className="cd-error">
                    {courseError || 'Course not found'}
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/courses')}>Back to Courses</button>
                </div>
            </div>
        );
    }

    return (
        <div className="cd-page">
            {/* Tabs matching Classroom look */}
            <div className="cd-tabs-wrapper">
                <button className="cd-back-btn" onClick={() => navigate('/courses')}>
                    <ArrowLeft size={20} />
                </button>
                <div className="cd-cr-tabs">
                    {tabs.map((tab) => (
                        <button key={tab.id} className={`cd-cr-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Stream Tab ── */}
            {activeTab === 'stream' && (
                <div className="cd-stream-container">
                    <div className="cd-stream-sidebar">
                        <div className="cd-upcoming-box">
                            <h4>Upcoming</h4>
                            <p>Woohoo, no work due in soon!</p>
                            <a href="#" className="cd-upcoming-link">View all</a>
                        </div>
                    </div>

                    <div className="cd-stream-main">
                        {/* Banner inside stream */}
                        <div className="cd-cr-banner" style={{ backgroundColor: courseDisplay.color }}>
                            <div className="cd-cr-banner-content">
                                <h1>{courseDisplay.title}</h1>
                                <p>{courseDisplay.code}</p>
                            </div>
                        </div>

                        {/* Compose Post */}
                        <div className="cd-compose-card">
                            {!isComposing ? (
                                <div className="cd-compose-trigger" onClick={() => setIsComposing(true)}>
                                    <div className="cd-avatar">{userName.charAt(0)}</div>
                                    <span style={{ color: 'var(--primary)' }}>Announce something to your class</span>
                                </div>
                            ) : (
                                <div className="cd-compose-editor animate-fade-in">
                                    <div className="cd-editor-top">
                                        <textarea
                                            placeholder="Announce something to your class"
                                            value={announcementText}
                                            onChange={(e) => setAnnouncementText(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="cd-editor-tools">
                                        <div className="cd-editor-icons">
                                            <button className="btn-icon"><Heading size={16} /></button>
                                            <button className="btn-icon"><LinkIcon size={16} /></button>
                                            <button className="btn-icon"><Video size={16} /></button>
                                            <button className="btn-icon"><Paperclip size={16} /></button>
                                        </div>
                                        <div className="cd-editor-actions">
                                            <button className="btn btn-ghost" onClick={() => setIsComposing(false)}>Cancel</button>
                                            <button className="btn btn-primary" onClick={handlePostAnnouncement} disabled={!announcementText.trim()}>Post</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stream Feed */}
                        <div className="cd-feed">
                            {[...stream].slice().reverse().map((item) => (
                                <div key={item.id} className="cd-feed-item">
                                    <div className="cd-feed-header">
                                        <div className="cd-feed-icon">
                                            {item.type === 'announcement' ? (
                                                <div className="cd-avatar">{item.author.charAt(0)}</div>
                                            ) : (
                                                <div className="cd-icon-badge" style={{ backgroundColor: item.type === 'assignment' ? 'var(--primary)' : 'var(--gray-500)' }}>
                                                    {item.type === 'assignment' && <FileText size={16} color="white" />}
                                                    {item.type === 'material' && <BookOpen size={16} color="white" />}
                                                    {item.type === 'video' && <Video size={16} color="white" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="cd-feed-meta">
                                            <p className="cd-feed-author">
                                                {item.type === 'announcement' ? item.author : item.title}
                                            </p>
                                            <p className="cd-feed-date">{item.createdAt}</p>
                                        </div>
                                    </div>
                                    <div className="cd-feed-body">
                                        {item.type === 'announcement' && item.title && <h4>{item.title}</h4>}
                                        <p>{item.description}</p>
                                    </div>
                                    <div className="cd-feed-footer">
                                        <button className="btn btn-ghost btn-sm">Add class comment</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {streamTotal > PAGE_SIZE && (
                            <Pagination total={streamTotal} limit={PAGE_SIZE} offset={streamOffset} onPageChange={setStreamOffset} />
                        )}
                    </div>
                </div>
            )}

            {/* ── Classwork Tab ── */}
            {activeTab === 'classwork' && (
                <div className="cd-classwork-container">
                    <div className="cd-cw-actions">
                        {isInstructor && (
                            <div className="cd-create-dropdown">
                                <button className="btn btn-primary" onClick={() => setCreateMenuOpen(!createMenuOpen)}>
                                    <Plus size={18} /> Create
                                </button>
                                {createMenuOpen && (
                                    <div className="cd-dropdown-menu">
                                        <button onClick={() => openModal('assignment')}><FileText size={16} /> Assignment</button>
                                        <button onClick={() => openModal('material')}><BookOpen size={16} /> Material</button>
                                        <button onClick={() => openModal('video')}><Video size={16} /> Video Lecture</button>
                                        <div className="cd-divider"></div>
                                        <button onClick={() => openModal('topic')}><Heading size={16} /> Topic</button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button className="btn btn-outline" style={{ marginLeft: isInstructor ? '1rem' : '0' }}><FileText size={16} /> View your work</button>
                    </div>

                    <div className="cd-topics-view">
                        {topics.concat('No topic').map(topic => {
                            const items = itemsByTopic[topic];
                            if (!isInstructor && items.length === 0 && topic !== 'No topic') return null; // hide empty topics for students
                            if (topic === 'No topic' && items.length === 0) return null;

                            return (
                                <div key={topic} className="cd-topic-group">
                                    <h2 className="cd-topic-title">{topic}</h2>
                                    <div className="cd-topic-items">
                                        {items.map(item => (
                                            <div key={item.id} className="cd-cw-item">
                                                <div className="cd-cw-item-left">
                                                    <div className="cd-cw-icon" style={{ backgroundColor: item.itemType === 'assignment' ? 'var(--primary)' : 'var(--gray-500)' }}>
                                                        {item.itemType === 'assignment' && <FileText size={18} color="white" />}
                                                        {item.itemType === 'material' && <BookOpen size={18} color="white" />}
                                                        {item.itemType === 'video' && <Video size={18} color="white" />}
                                                    </div>
                                                    {item.itemType === 'material' ? (
                                                        <button
                                                            type="button"
                                                            className="cd-cw-title cd-cw-title-link"
                                                            onClick={() => setViewingMaterial(item)}
                                                        >
                                                            {item.title}
                                                        </button>
                                                    ) : (
                                                        <span className="cd-cw-title">{item.title}</span>
                                                    )}
                                                </div>
                                                <div className="cd-cw-item-right">
                                                    {item.itemType === 'assignment' && (
                                                        <>
                                                            <span className="cd-cw-due">Due {item.dueDate}</span>
                                                            {!isInstructor && item.status !== 'submitted' && (
                                                                <button className="btn btn-outline btn-sm" onClick={() => setSubmitAssignmentId(item.id)}>
                                                                    Submit
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    {item.itemType === 'material' && (
                                                        <>
                                                            <span className="cd-cw-due">Posted {item.createdAt}</span>
                                                            {isInstructor && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon"
                                                                        onClick={() => openModal('material', item)}
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon"
                                                                        onClick={() => handleDeleteMaterialClick(item)}
                                                                        disabled={deletingMaterialId === item.id}
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    {item.itemType !== 'material' && isInstructor && <button className="btn-icon"><Trash2 size={16} /></button>}
                                                </div>
                                            </div>
                                        ))}
                                        {isInstructor && items.length === 0 && (
                                            <div className="cd-cw-empty">Students will see this topic once work is added to it</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── People Tab ── */}
            {activeTab === 'people' && (
                <div className="cd-people-container">
                    <div className="cd-people-section">
                        <div className="cd-people-header">
                            <h2>Classmates ({peopleTotal})</h2>
                            {isInstructor ? (
                                <button className="btn btn-primary btn-sm" onClick={() => { setShowInviteModal(true); setInviteResult(null); setInviteError(''); }}>
                                    <Mail size={15} /> Invite Students
                                </button>
                            ) : (
                                <button className="btn btn-outline btn-sm" onClick={() => { setShowJoinModal(true); setJoinError(''); setJoinSuccess(''); }}>
                                    <LogIn size={15} /> Join with Code
                                </button>
                            )}
                        </div>
                        {people.length === 0 && peopleTotal === 0 && (
                            <EmptyState icon={<Users size={28} />} title="No one enrolled yet" description="Enrolled classmates will appear here." />
                        )}
                        {people.map((p) => (
                            <div key={p.userId} className="cd-person">
                                <div className="cd-avatar">{p.fullName.charAt(0).toUpperCase()}</div>
                                <div>
                                    <span>{p.fullName}</span>
                                    <span className="cd-person-progress">{p.progressPercent}% complete</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {peopleTotal > PAGE_SIZE && (
                        <Pagination total={peopleTotal} limit={PAGE_SIZE} offset={peopleOffset} onPageChange={setPeopleOffset} />
                    )}
                </div>
            )}

            {/* ── Modals ── */}
            {modalType && (
                <div className="cd-modal-overlay" onClick={() => setModalType(null)}>
                    <div className="cd-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="cd-modal-header">
                            <h2>{editItem ? 'Edit' : 'Add'} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}</h2>
                            <button className="cd-modal-close" onClick={() => setModalType(null)}><X size={20} /></button>
                        </div>
                        <div className="cd-modal-body">
                            <div className="cd-modal-field">
                                <label>{modalType === 'topic' ? 'Topic Name' : 'Title *'}</label>
                                <input className="input" placeholder="Enter title..." value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                            </div>

                            {modalType !== 'topic' && (
                                <>
                                    <div className="cd-modal-field">
                                        <label>Description</label>
                                        <textarea className="input" rows={3} placeholder="Enter description..." value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                    </div>
                                    <div className="cd-modal-field">
                                        <label>Topic</label>
                                        <select className="input" value={formData.topic || 'No topic'} onChange={(e) => setFormData({ ...formData, topic: e.target.value })}>
                                            <option value="No topic">No topic</option>
                                            {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {modalType === 'assignment' && (
                                <div className="cd-modal-row">
                                    <div className="cd-modal-field">
                                        <label>Due Date *</label>
                                        <input className="input" type="date" value={formData.dueDate || ''} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                                    </div>
                                    <div className="cd-modal-field">
                                        <label>Points</label>
                                        <input className="input" type="number" value={formData.points || 100} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            )}

                            {modalType === 'material' && (
                                <div className="cd-modal-row">
                                    <div className="cd-modal-field">
                                        <label>Type</label>
                                        <select className="input" value={formData.type || 'pdf'} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="pdf">PDF</option>
                                            <option value="doc">Document</option>
                                            <option value="slide">Slides</option>
                                        </select>
                                    </div>
                                    <div className="cd-modal-field cd-modal-field-full">
                                        <label>File</label>
                                        <FileDropzone
                                            mode="upload"
                                            onUploaded={(url) => setFormData((prev: Record<string, unknown>) => ({ ...prev, url: getUploadFullUrl(url) }))}
                                            onClear={() => setFormData((prev: Record<string, unknown>) => ({ ...prev, url: '' }))}
                                            currentUrl={formData.url || null}
                                            maxSizeMB={20}
                                        />
                                        <label className="cd-modal-field-label-optional">Or paste URL</label>
                                        <input className="input" placeholder="https://..." value={formData.url || ''} onChange={(e) => setFormData({ ...formData, url: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {modalType === 'video' && (
                                <div className="cd-modal-row">
                                    <div className="cd-modal-field">
                                        <label>Video URL</label>
                                        <input className="input" placeholder="https://youtube.com/..." value={formData.url || ''} onChange={(e) => setFormData({ ...formData, url: e.target.value })} />
                                    </div>
                                    <div className="cd-modal-field">
                                        <label>Duration</label>
                                        <input className="input" placeholder="e.g. 45:20" value={formData.duration || ''} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} />
                                    </div>
                                </div>
                            )}
                            {modalType === 'material' && materialFormError && (
                                <div className="cd-modal-inline-error">
                                    <span>{materialFormError}</span>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaterialFormError(null)}>Close</button>
                                </div>
                            )}
                        </div>
                        <div className="cd-modal-footer">
                            <button className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={modalType === 'material' && savingMaterial}
                            >
                                <Save size={16} /> {modalType === 'material' && savingMaterial ? 'Saving…' : (editItem ? 'Update' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full-screen document view with PDF + AI sidebar (like reference) */}
            {viewingMaterial && (
                <div className="cd-doc-view-overlay">
                    <div className="cd-doc-view" onClick={(e) => e.stopPropagation()}>
                        <header className="cd-doc-view-header">
                            <div className="cd-doc-view-header-title">
                                <BookOpen size={20} className="cd-doc-view-icon" />
                                <h1 className="cd-doc-view-title">{viewingMaterial.title}</h1>
                            </div>
                            <div className="cd-doc-view-header-actions">
                                <a
                                    href={getMaterialFileUrl(courseId, viewingMaterial.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline btn-sm"
                                >
                                    <ExternalLink size={16} /> Open in new tab
                                </a>
                                <button type="button" className="btn btn-ghost" onClick={() => setViewingMaterial(null)}>
                                    <X size={20} /> Close
                                </button>
                            </div>
                        </header>
                        <div className="cd-doc-view-main">
                            <div className="cd-doc-view-pdf-wrap">
                                {!isPdfMaterial(viewingMaterial) ? (
                                    <div className="cd-doc-view-fallback">
                                        <p>Preview not available.</p>
                                        <a href={getMaterialFileUrl(courseId, viewingMaterial.id)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Open in new tab</a>
                                    </div>
                                ) : docPdfLoading ? (
                                    <div className="cd-doc-view-loading">
                                        <p>Loading PDF…</p>
                                    </div>
                                ) : docPdfError ? (
                                    <div className="cd-doc-view-fallback">
                                        <p className="cd-doc-view-error">{docPdfError}</p>
                                        <a href={getMaterialFileUrl(courseId, viewingMaterial.id)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Open in new tab</a>
                                    </div>
                                ) : docPdfObjectUrl ? (
                                    <iframe
                                        title={viewingMaterial.title}
                                        src={docPdfObjectUrl}
                                        className="cd-doc-view-iframe"
                                    />
                                ) : null}
                            </div>
                            <aside className="cd-doc-view-sidebar">
                                <div className="cd-doc-view-sidebar-header">
                                    <Sparkles size={18} className="cd-doc-view-sidebar-icon" />
                                    <h2 className="cd-doc-view-sidebar-title">Summary</h2>
                                </div>
                                <p className="cd-doc-view-sidebar-summary">
                                    Ask questions below to get explanations, summaries, or key points about this document. Our AI will answer in the context of &quot;{viewingMaterial.title}&quot;.
                                </p>
                                <div className="cd-doc-view-sidebar-chat">
                                    <div className="cd-doc-view-messages" ref={docChatScrollRef}>
                                        {docChatMessages.length === 0 && (
                                            <div className="cd-doc-view-messages-empty">
                                                <Sparkles size={22} className="cd-doc-view-empty-icon" />
                                                <p>Ask anything about this document —<br/>I'll walk you through it step by step.</p>
                                                <div className="cd-doc-view-starter-chips">
                                                    {['What is this document about?', 'Explain the key concepts', 'Give me a quick summary'].map(q => (
                                                        <button key={q} className="cd-doc-chip cd-doc-chip-starter" onClick={() => sendDocChatMessage(q)}>{q}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {docChatMessages.map((msg, msgIdx) => (
                                            <div key={msgIdx} className={`cd-doc-view-msg cd-doc-view-msg-${msg.role}`}>
                                                {msg.role === 'user' ? (
                                                    <>
                                                        <span className="cd-doc-view-msg-role">You</span>
                                                        <div className="cd-doc-view-msg-content">{msg.content}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="cd-doc-view-msg-role">
                                                            <Sparkles size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                            Saarthi
                                                        </span>
                                                        <div className="cd-doc-sections">
                                                            {msg.sections.map((sec, secIdx) => (
                                                                <div key={secIdx} className="cd-doc-section">
                                                                    {sec.title && <div className="cd-doc-section-title">{sec.title}</div>}
                                                                    <div className="cd-doc-section-body" dangerouslySetInnerHTML={{ __html: renderMath(sec.body) }} />
                                                                    <div className="cd-doc-section-checkpoint">
                                                                        {sec.understood === null ? (
                                                                            <>
                                                                                <span className="cd-doc-checkpoint-label">Did you get that?</span>
                                                                                <button className="cd-doc-chip cd-doc-chip-yes" onClick={() => markSectionUnderstood(msgIdx, secIdx, true)}>Got it ✓</button>
                                                                                <button className="cd-doc-chip cd-doc-chip-no" onClick={() => { markSectionUnderstood(msgIdx, secIdx, false); sendDocChatMessage(`Can you explain "${sec.title || 'this'}" more simply?`); }}>Explain more</button>
                                                                            </>
                                                                        ) : sec.understood ? (
                                                                            <span className="cd-doc-checkpoint-done">✓ Got it</span>
                                                                        ) : (
                                                                            <span className="cd-doc-checkpoint-pending">Asking for more…</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {msg.followUps.length > 0 && (
                                                                <div className="cd-doc-followups">
                                                                    <span className="cd-doc-followups-label">Ask next:</span>
                                                                    {msg.followUps.map(q => (
                                                                        <button key={q} className="cd-doc-chip cd-doc-chip-followup" onClick={() => sendDocChatMessage(q)}>{q}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                        {docChatSending && (
                                            <div className="cd-doc-view-msg cd-doc-view-msg-assistant">
                                                <span className="cd-doc-view-msg-role"><Sparkles size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Saarthi</span>
                                                <div className="cd-doc-thinking">
                                                    <span /><span /><span />
                                                </div>
                                            </div>
                                        )}
                                        <div ref={docChatBottomRef} />
                                    </div>
                                    <div className="cd-doc-view-input-wrap">
                                        <input
                                            type="text"
                                            className="input cd-doc-view-input"
                                            placeholder="Ask about this document…"
                                            value={docChatInput}
                                            onChange={(e) => setDocChatInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendDocChatMessage()}
                                            disabled={docChatSending}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary cd-doc-view-send"
                                            onClick={() => sendDocChatMessage()}
                                            disabled={(!docChatInput.trim() && !docChatSending) || docChatSending}
                                            title="Send"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete material confirmation (theme-matched modal) */}
            <ConfirmModal
                open={!!materialToDelete}
                title="Delete material"
                message={materialToDelete ? `Delete "${materialToDelete.title}"? This cannot be undone.` : ''}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDeleteMaterialConfirm}
                onCancel={() => setMaterialToDelete(null)}
                loading={!!deletingMaterialId}
            />

            {/* ── Invite Students Modal (teacher) ── */}
            {showInviteModal && (
                <div className="cd-modal-overlay" onClick={() => { setShowInviteModal(false); setCsvResults([]); setInvitedEmails([]); }}>
                    <div className="cd-modal cd-modal-wide animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="cd-modal-header">
                            <h2><Mail size={18} /> Invite Students</h2>
                            <button className="cd-modal-close" onClick={() => { setShowInviteModal(false); setCsvResults([]); setInvitedEmails([]); }}><X size={20} /></button>
                        </div>
                        <div className="cd-modal-body">

                            {/* Single invite */}
                            <div className="cd-invite-section">
                                <p className="cd-invite-section-label">Invite by email</p>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    The student will receive an email with a link. One click and they're enrolled — no code needed.
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        className="input"
                                        placeholder="student@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                                    />
                                    <button className="btn btn-primary" onClick={handleSendInvite} disabled={inviteSending || !inviteEmail.trim()}>
                                        {inviteSending ? 'Sending…' : 'Send Invite'}
                                    </button>
                                </div>
                            </div>

                            {/* Sent confirmations */}
                            {invitedEmails.length > 0 && (
                                <div className="cd-invited-list">
                                    {invitedEmails.map((em, i) => (
                                        <div key={i} className="cd-invited-row">
                                            <CheckCircle2 size={15} style={{ color: '#5FA89C', flexShrink: 0 }} />
                                            <span>{em}</span>
                                            <span className="cd-invited-tag">Invite sent</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Divider */}
                            <div className="cd-invite-divider"><span>or invite multiple at once</span></div>

                            {/* CSV bulk invite */}
                            <div className="cd-invite-section">
                                <p className="cd-invite-section-label">Bulk invite via CSV</p>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Upload a CSV — all email addresses are detected automatically and each gets an invite email.
                                </p>
                                <label className="cd-csv-upload-btn">
                                    <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} style={{ display: 'none' }} />
                                    <Mail size={15} /> {csvLoading ? `Sending invites… (${csvResults.length} done)` : 'Upload CSV'}
                                </label>
                            </div>

                            {inviteError && <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{inviteError}</p>}

                            {/* CSV results */}
                            {csvResults.length > 0 && (
                                <div className="cd-csv-results">
                                    <div className="cd-csv-results-header">
                                        <span>{csvResults.filter(r => r.sent).length} of {csvResults.length} invites sent</span>
                                    </div>
                                    <div className="cd-csv-table">
                                        {csvResults.map((r, i) => (
                                            <div key={i} className={`cd-csv-row ${r.error ? 'cd-csv-row-error' : ''}`}>
                                                {r.sent
                                                    ? <CheckCircle2 size={14} style={{ color: '#5FA89C', flexShrink: 0 }} />
                                                    : <XCircle size={14} style={{ color: '#C86F7A', flexShrink: 0 }} />
                                                }
                                                <span className="cd-csv-email">{r.email}</span>
                                                {r.error && <span className="cd-csv-err">{r.error}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="cd-modal-footer">
                            <button className="btn btn-outline" onClick={() => { setShowInviteModal(false); setCsvResults([]); setInvitedEmails([]); }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Join with Code Modal (student) ── */}
            {showJoinModal && (
                <div className="cd-modal-overlay" onClick={() => setShowJoinModal(false)}>
                    <div className="cd-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="cd-modal-header">
                            <h2><LogIn size={18} /> Join with Code</h2>
                            <button className="cd-modal-close" onClick={() => setShowJoinModal(false)}><X size={20} /></button>
                        </div>
                        <div className="cd-modal-body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Enter the invite code your teacher shared with you.
                            </p>
                            <div className="cd-modal-field">
                                <label>Invite Code</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        className="input"
                                        placeholder="e.g. aB3xYz9Qr1"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleJoinCourse()}
                                    />
                                    <button className="btn btn-primary" onClick={handleJoinCourse} disabled={joinLoading || !joinCode.trim()}>
                                        {joinLoading ? 'Joining…' : 'Join'}
                                    </button>
                                </div>
                            </div>
                            {joinError && <p style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{joinError}</p>}
                            {joinSuccess && <p style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 600 }}>{joinSuccess}</p>}
                        </div>
                        <div className="cd-modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowJoinModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Submit Assignment Modal (file upload) */}
            {submitAssignmentId && (
                <div className="cd-modal-overlay" onClick={() => { if (!submitting) { setSubmitAssignmentId(null); setSubmitFile(null); } }}>
                    <div className="cd-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="cd-modal-header">
                            <h2>Submit Assignment</h2>
                            <button className="cd-modal-close" onClick={() => { if (!submitting) { setSubmitAssignmentId(null); setSubmitFile(null); } }} disabled={submitting}><X size={20} /></button>
                        </div>
                        <div className="cd-modal-body">
                            <div className="cd-modal-field">
                                <label>Attachment (optional)</label>
                                <FileDropzone
                                    mode="select"
                                    onFileSelected={(file) => setSubmitFile(file ?? null)}
                                    onClear={() => setSubmitFile(null)}
                                    currentFile={submitFile}
                                    maxSizeMB={20}
                                />
                            </div>
                        </div>
                        <div className="cd-modal-footer">
                            <button className="btn btn-outline" onClick={() => { setSubmitAssignmentId(null); setSubmitFile(null); }} disabled={submitting}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmitAssignment} disabled={submitting}>
                                {submitting ? 'Submitting…' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
