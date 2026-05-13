import { useState, useRef, useEffect, useCallback } from 'react';
import { usePageTitle } from '../lib/usePageTitle';
import {
    Send, Sparkles, User, Bot, Loader2, BookOpen, Lightbulb, Code2,
    GraduationCap, Plus, Pencil, Trash2, Check, X, Mic, MicOff,
} from 'lucide-react';
import { api, type ConversationResponse, type ConversationDetailResponse, type SendMessageResponse, type PaginatedResponse } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import MathContent from '../components/MathContent';
import './Chat.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const GREETING = "Hello! I'm Saarthi, your AI learning companion. I specialize in:\n\n• **Digital Signal Processing** — FFT, filters, transforms\n• **Machine Learning** — Neural networks, optimization\n• **Data Structures** — Trees, graphs, algorithms\n• **Pattern Recognition** — Classification, feature extraction\n\nHow can I help you today?";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    streaming?: boolean;
}

const suggestedTopics = [
    { icon: BookOpen, label: 'Explain Fourier Transform' },
    { icon: Code2, label: 'Binary Search implementation' },
    { icon: Lightbulb, label: 'What is gradient descent?' },
    { icon: GraduationCap, label: 'DSP exam preparation tips' },
];

function messageFromApi(m: { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }): Message {
    return { id: m.id, role: m.role, content: m.content, timestamp: new Date(m.createdAt) };
}

// ── Voice recognition hook ────────────────────────────────────────────────────
function useVoiceInput(onTranscript: (text: string) => void) {
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const startListening = useCallback(() => {
        if (!supported) return;
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const rec: SpeechRecognition = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-IN';
        rec.onresult = (e) => {
            const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ');
            onTranscript(transcript);
        };
        rec.onerror = () => setListening(false);
        rec.onend = () => setListening(false);
        recognitionRef.current = rec;
        rec.start();
        setListening(true);
    }, [supported, onTranscript]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    return { supported, listening, startListening, stopListening };
}

// ── Message renderer ──────────────────────────────────────────────────────────

// ── Main component ─────────────────────────────────────────────────────────────
export default function ChatPage() {
    usePageTitle('AI Tutor');
    const [conversations, setConversations] = useState<ConversationResponse[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loadingList, setLoadingList] = useState(true);
    const [loadingChat, setLoadingChat] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listRetryCount, setListRetryCount] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const { supported: voiceSupported, listening, startListening, stopListening } = useVoiceInput(
        (text) => setInput((prev) => prev ? `${prev} ${text}` : text)
    );

    const fetchConversations = useCallback(async () => {
        setLoadingList(true);
        try {
            const res = await api.get<PaginatedResponse<ConversationResponse>>('/chat/conversations', { limit: 50, offset: 0 });
            setConversations(res.items || []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load conversations';
            setError(msg.includes('401') ? 'Please log in to use chat.' : msg);
        } finally {
            setLoadingList(false);
        }
    }, [listRetryCount]);

    useEffect(() => { fetchConversations(); }, [fetchConversations]);

    const loadConversation = useCallback(async (id: string) => {
        setEditingId(null);
        setCurrentId(id);
        setLoadingChat(true);
        setError(null);
        try {
            const res = await api.get<ConversationDetailResponse>(`/chat/conversations/${id}`);
            setMessages((res.messages || []).map(messageFromApi));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load conversation');
            setMessages([]);
        } finally {
            setLoadingChat(false);
        }
    }, []);

    const startRename = (e: React.MouseEvent, c: ConversationResponse) => {
        e.stopPropagation();
        setEditingId(c.id);
        setEditTitle(c.title || 'New Chat');
        setTimeout(() => renameInputRef.current?.focus(), 0);
    };

    const submitRename = async (id: string) => {
        const title = editTitle.trim() || 'New Chat';
        try {
            await api.patch<ConversationResponse>(`/chat/conversations/${id}`, { title });
            setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to rename');
        }
        setEditingId(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmId) return;
        const id = deleteConfirmId;
        setDeleteConfirmId(null);
        try {
            await api.delete(`/chat/conversations/${id}`);
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (currentId === id) { setCurrentId(null); setMessages([]); }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete');
        }
    };

    const handleNewChat = async () => {
        setSending(true);
        try {
            const conv = await api.post<ConversationResponse>('/chat/conversations', { title: 'New Chat' });
            setConversations((prev) => [conv, ...prev]);
            setCurrentId(conv.id);
            setMessages([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create chat');
        } finally {
            setSending(false);
        }
    };

    // ── Streaming send ──────────────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!input.trim() || sending) return;
        const q = input.trim();
        setInput('');
        setError(null);

        let conversationId = currentId;
        if (!conversationId) {
            setSending(true);
            try {
                const conv = await api.post<ConversationResponse>('/chat/conversations', { title: 'New Chat' });
                setConversations((prev) => [conv, ...prev]);
                setCurrentId(conv.id);
                conversationId = conv.id;
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create chat');
                setSending(false);
                return;
            }
            setSending(false);
        }

        // Optimistic user message
        const userMsgId = `u-${Date.now()}`;
        const streamMsgId = `s-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: userMsgId, role: 'user', content: q, timestamp: new Date() },
            { id: streamMsgId, role: 'assistant', content: '', timestamp: new Date(), streaming: true },
        ]);
        setSending(true);

        // Build history from current messages (exclude the two we just added)
        const historyMessages = messages.map((m) => ({ role: m.role, content: m.content }));

        try {
            const ctrl = new AbortController();
            abortRef.current = ctrl;

            const res = await fetch(`${BASE_URL}/chat/stream`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: q,
                    conversationHistory: historyMessages,
                    conversationId,
                }),
                signal: ctrl.signal,
            });

            if (!res.ok || !res.body) throw new Error('Stream request failed');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6);
                    if (payload === '[DONE]') break;
                    if (payload.startsWith('[ERROR]')) {
                        throw new Error(payload.slice(8));
                    }
                    accumulated += payload.replace(/\\n/g, '\n');
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === streamMsgId
                                ? { ...m, content: accumulated, streaming: true }
                                : m
                        )
                    );
                }
            }

            // Mark streaming done, update conversation list
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === streamMsgId ? { ...m, streaming: false } : m
                )
            );
            fetchConversations();

        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            // Fallback to non-streaming
            try {
                const data = await api.post<SendMessageResponse>(
                    `/chat/conversations/${conversationId}/messages`,
                    { message: q }
                );
                setMessages((prev) => {
                    const filtered = prev.filter((m) => m.id !== userMsgId && m.id !== streamMsgId);
                    return [...filtered, messageFromApi(data.userMessage), messageFromApi(data.assistantMessage)];
                });
                fetchConversations();
            } catch (fallbackErr) {
                setMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== streamMsgId));
                setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to send message');
            }
        } finally {
            setSending(false);
            abortRef.current = null;
        }
    };

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const displayMessages = messages.length === 0 && !loadingChat
        ? [{ id: 'greeting', role: 'assistant' as const, content: GREETING, timestamp: new Date() }]
        : messages;

    return (
        <div className="chat-page">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <button
                    type="button"
                    className="btn btn-primary chat-new-btn"
                    onClick={handleNewChat}
                    disabled={sending || loadingList}
                >
                    {sending && !currentId ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {' '}New Chat
                </button>
                <div className="chat-history">
                    <p className="chat-history-label">Recent Conversations</p>
                    {loadingList ? (
                        <div className="chat-history-loading"><Loader2 size={14} className="animate-spin" /> Loading...</div>
                    ) : error && conversations.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 1rem', textAlign: 'center' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{error}</p>
                            <button className="btn btn-primary btn-sm" onClick={() => { setError(null); setListRetryCount(c => c + 1); }}>
                                Try again
                            </button>
                        </div>
                    ) : conversations.length === 0 ? (
                        <EmptyState icon={<Sparkles size={28} />} title="No conversations yet" description="Start a new chat to get help from Saarthi." />
                    ) : (
                        conversations.map((c) => (
                            <div key={c.id} className={`chat-history-item-wrap ${currentId === c.id ? 'active' : ''}`}>
                                <button type="button" className="chat-history-item" onClick={() => loadConversation(c.id)}>
                                    {editingId === c.id ? (
                                        <input
                                            ref={renameInputRef}
                                            className="chat-history-rename-input"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') submitRename(c.id); if (e.key === 'Escape') setEditingId(null); }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <><Sparkles size={14} className="chat-history-icon" /><span className="chat-history-title">{c.title || 'New Chat'}</span></>
                                    )}
                                </button>
                                {editingId === c.id ? (
                                    <div className="chat-history-actions">
                                        <button type="button" className="chat-history-action" onClick={() => submitRename(c.id)}><Check size={14} /></button>
                                        <button type="button" className="chat-history-action" onClick={() => setEditingId(null)}><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="chat-history-actions">
                                        <button type="button" className="chat-history-action" onClick={(e) => startRename(e, c)}><Pencil size={14} /></button>
                                        <button type="button" className="chat-history-action chat-history-action-delete" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }}><Trash2 size={14} /></button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main */}
            <div className="chat-main">
                {error && <div className="chat-error" role="alert">{error}</div>}
                {loadingChat && messages.length === 0 ? (
                    <div className="chat-loading-state"><Loader2 size={24} className="animate-spin" /> Loading conversation...</div>
                ) : (
                    <>
                        <div className="chat-messages">
                            {displayMessages.map((msg) => (
                                <div key={msg.id} className={`chat-msg ${msg.role}`}>
                                    <div className={`chat-msg-avatar ${msg.role}`}>
                                        {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                                    </div>
                                    <div className="chat-msg-content">
                                        <div className="chat-msg-header">
                                            <span className="chat-msg-name">{msg.role === 'user' ? 'You' : 'Saarthi AI'}</span>
                                            <span className="chat-msg-time">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {msg.streaming && msg.content === '' ? (
                                            <div className="chat-typing">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>Saarthi is thinking...</span>
                                            </div>
                                        ) : (
                                            <MathContent content={msg.content} streaming={msg.streaming} />
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={endRef} />
                        </div>

                        {displayMessages.length <= 1 && (
                            <div className="chat-suggestions">
                                {suggestedTopics.map((topic, i) => {
                                    const Icon = topic.icon;
                                    return (
                                        <button key={i} type="button" className="chat-suggestion-btn" onClick={() => setInput(topic.label)}>
                                            <Icon size={16} /> {topic.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="chat-input-area">
                            <div className="chat-input-wrapper">
                                {voiceSupported && (
                                    <button
                                        type="button"
                                        className={`chat-voice-btn ${listening ? 'active' : ''}`}
                                        onClick={listening ? stopListening : startListening}
                                        title={listening ? 'Stop listening' : 'Voice input'}
                                        disabled={sending}
                                    >
                                        {listening ? <MicOff size={16} /> : <Mic size={16} />}
                                    </button>
                                )}
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={listening ? 'Listening...' : 'Ask Saarthi anything about your subjects...'}
                                    rows={1}
                                    disabled={sending}
                                />
                                <button
                                    type="button"
                                    className="chat-send-btn"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || sending}
                                >
                                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                            <p className="chat-input-hint">
                                Enter to send · Shift+Enter for new line
                                {voiceSupported && ' · Mic for voice input'}
                            </p>
                        </div>
                    </>
                )}
            </div>

            <ConfirmModal
                open={deleteConfirmId !== null}
                title="Delete conversation"
                message="This conversation will be permanently deleted. This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </div>
    );
}
