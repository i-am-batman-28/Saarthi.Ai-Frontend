import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, RotateCcw, Copy, Check, ChevronDown, Terminal,
    Activity, FileText, Loader2, Sparkles, AlertTriangle,
    CheckCircle2, Brain, X, ChevronUp,
} from 'lucide-react';
import GraphOutput from '../components/GraphOutput';
import { api } from '../lib/api';
import './CodeLab.css';

// ── Language config ───────────────────────────────────────────────────────────

const LANGUAGES = [
    { key: 'python',     label: 'Python',     ext: 'py',  color: '#3B82F6' },
    { key: 'javascript', label: 'JavaScript',  ext: 'js',  color: '#F59E0B' },
    { key: 'cpp',        label: 'C++',         ext: 'cpp', color: '#8B5CF6' },
    { key: 'c',          label: 'C',           ext: 'c',   color: '#6366F1' },
    { key: 'java',       label: 'Java',        ext: 'java',color: '#EF4444' },
    { key: 'rust',       label: 'Rust',        ext: 'rs',  color: '#F97316' },
    { key: 'go',         label: 'Go',          ext: 'go',  color: '#06B6D4' },
    { key: 'bash',       label: 'Bash',        ext: 'sh',  color: '#10B981' },
    { key: 'r',          label: 'R',           ext: 'r',   color: '#EC4899' },
];

const STARTER_CODE: Record<string, string> = {
    python: `import numpy as np

# Butterworth Low-Pass Filter (manual computation)
def butterworth_magnitude(f, cutoff=1000, order=4):
    return 1 / np.sqrt(1 + (f / cutoff) ** (2 * order))

freqs = np.linspace(0, 4000, 200)
magnitudes_db = 20 * np.log10(butterworth_magnitude(freqs))

print("Butterworth Filter Frequency Response")
print(f"{'Freq (Hz)':>10} | {'Magnitude (dB)':>14}")
print("-" * 28)
for f, m in zip(freqs[::20], magnitudes_db[::20]):
    print(f"{f:>10.0f} | {m:>14.2f}")

print(f"\\n-3dB point at: {1000:.0f} Hz")
print(f"Roll-off: {-20 * 4:.0f} dB/decade after cutoff")
`,
    javascript: `// Butterworth filter magnitude response
function butterworthMag(f, cutoff = 1000, order = 4) {
  return 1 / Math.sqrt(1 + Math.pow(f / cutoff, 2 * order));
}

console.log("Butterworth Filter Response");
console.log("Freq (Hz) | Magnitude (dB)");
console.log("-".repeat(28));

for (let f = 0; f <= 4000; f += 400) {
  const mag = 20 * Math.log10(butterworthMag(f));
  console.log(\`\${String(f).padStart(9)} | \${mag.toFixed(2).padStart(13)}\`);
}
`,
    cpp: `#include <iostream>
#include <cmath>
#include <iomanip>

double butterworthMag(double f, double cutoff = 1000, int order = 4) {
    return 1.0 / std::sqrt(1.0 + std::pow(f / cutoff, 2 * order));
}

int main() {
    std::cout << "Butterworth Filter Response\\n";
    std::cout << std::setw(10) << "Freq (Hz)" << " | "
              << std::setw(14) << "Magnitude (dB)" << "\\n";
    std::cout << std::string(28, '-') << "\\n";

    for (int f = 0; f <= 4000; f += 400) {
        double mag = 20.0 * std::log10(butterworthMag(f));
        std::cout << std::setw(10) << f << " | "
                  << std::setw(14) << std::fixed << std::setprecision(2) << mag << "\\n";
    }
    return 0;
}
`,
    c: `#include <stdio.h>
#include <math.h>

double butterworthMag(double f, double cutoff, int order) {
    return 1.0 / sqrt(1.0 + pow(f / cutoff, 2 * order));
}

int main() {
    printf("Butterworth Filter Response\\n");
    printf("%10s | %14s\\n", "Freq (Hz)", "Magnitude (dB)");
    for (int f = 0; f <= 4000; f += 400) {
        double mag = 20.0 * log10(butterworthMag((double)f, 1000.0, 4));
        printf("%10d | %14.2f\\n", f, mag);
    }
    return 0;
}
`,
    java: `public class Main {
    static double butterworthMag(double f, double cutoff, int order) {
        return 1.0 / Math.sqrt(1.0 + Math.pow(f / cutoff, 2 * order));
    }

    public static void main(String[] args) {
        System.out.println("Butterworth Filter Response");
        System.out.printf("%10s | %14s%n", "Freq (Hz)", "Magnitude (dB)");
        System.out.println("-".repeat(28));
        for (int f = 0; f <= 4000; f += 400) {
            double mag = 20.0 * Math.log10(butterworthMag(f, 1000, 4));
            System.out.printf("%10d | %14.2f%n", f, mag);
        }
    }
}
`,
    rust: `fn butterworth_mag(f: f64, cutoff: f64, order: u32) -> f64 {
    1.0 / (1.0 + (f / cutoff).powi(2 * order as i32)).sqrt()
}

fn main() {
    println!("Butterworth Filter Response");
    println!("{:>10} | {:>14}", "Freq (Hz)", "Magnitude (dB)");
    println!("{}", "-".repeat(28));
    let mut f = 0.0_f64;
    while f <= 4000.0 {
        let mag = 20.0 * butterworth_mag(f, 1000.0, 4).log10();
        println!("{:>10.0} | {:>14.2}", f, mag);
        f += 400.0;
    }
}
`,
    go: `package main

import (
	"fmt"
	"math"
)

func butterworthMag(f, cutoff float64, order int) float64 {
	return 1.0 / math.Sqrt(1.0+math.Pow(f/cutoff, float64(2*order)))
}

func main() {
	fmt.Println("Butterworth Filter Response")
	fmt.Printf("%10s | %14s\\n", "Freq (Hz)", "Magnitude (dB)")
	for f := 0.0; f <= 4000; f += 400 {
		mag := 20.0 * math.Log10(butterworthMag(f, 1000, 4))
		fmt.Printf("%10.0f | %14.2f\\n", f, mag)
	}
}
`,
    bash: `#!/bin/bash
echo "Butterworth Filter Response (approximation)"
echo "Freq (Hz) | Note"
echo "----------+------------------"
echo "       0  | 0.00 dB (passband)"
echo "     500  | -0.97 dB"
echo "    1000  | -3.01 dB (cutoff)"
echo "    2000  | -18.06 dB"
echo "    4000  | -48.13 dB (stopband)"
echo ""
echo "Order: 4 | Cutoff: 1000 Hz | Roll-off: 80 dB/decade"
`,
    r: `# Butterworth filter magnitude response
butterworth_mag <- function(f, cutoff = 1000, order = 4) {
  1 / sqrt(1 + (f / cutoff)^(2 * order))
}

freqs <- seq(0, 4000, by = 400)
mags  <- 20 * log10(butterworth_mag(freqs))

cat("Butterworth Filter Response\\n")
cat(sprintf("%10s | %14s\\n", "Freq (Hz)", "Magnitude (dB)"))
cat(strrep("-", 28), "\\n")
for (i in seq_along(freqs)) {
  cat(sprintf("%10.0f | %14.2f\\n", freqs[i], mags[i]))
}
`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    language: string;
    runtime: string;
    executionMs?: number;
}

interface ExecResponse {
    result: ExecResult;
    aiExplanation?: string;
    aiSuggestions?: string[];
}

// ── AI Explanation Panel ──────────────────────────────────────────────────────

function AIExplanationPanel({
    explanation, suggestions, onClose, streaming,
}: {
    explanation: string; suggestions: string[]; onClose: () => void; streaming: boolean;
}) {
    return (
        <div className="cl-ai-panel animate-fade-in">
            <div className="cl-ai-panel-header">
                <div className="cl-ai-panel-title">
                    <Brain size={16} style={{ color: 'var(--accent)' }} />
                    <span>AI Error Analysis</span>
                    {streaming && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                </div>
                <button className="cl-ai-close" onClick={onClose}><X size={14} /></button>
            </div>
            <p className="cl-ai-explanation">
                {explanation}
                {streaming && <span className="chat-cursor" />}
            </p>
            {suggestions.length > 0 && (
                <div className="cl-ai-suggestions">
                    <span className="cl-ai-suggestions-label">Suggestions</span>
                    {suggestions.map((s, i) => (
                        <div key={i} className="cl-ai-suggestion">
                            <span className="cl-ai-suggestion-num">{i + 1}</span>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CodeLabPage() {
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState(STARTER_CODE['python']);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<ExecResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [showLangDropdown, setShowLangDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState<'console' | 'graph' | 'ai'>('console');
    const [aiExplanation, setAiExplanation] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [aiStreaming, setAiStreaming] = useState(false);
    const [showGraph, setShowGraph] = useState(false);
    const [graphData, setGraphData] = useState<{ freq: number; mag: number }[]>([]);
    const [stdin, setStdin] = useState('');
    const [showStdin, setShowStdin] = useState(false);
    const outputRef = useRef<HTMLPreElement>(null);

    // Scroll output to bottom
    useEffect(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, [result]);

    const generateGraphData = useCallback(() => {
        const data = [];
        for (let f = 0; f <= 4000; f += 50) {
            const mag = 1 / Math.sqrt(1 + Math.pow(f / 1000, 8));
            data.push({ freq: f, mag: 20 * Math.log10(mag) });
        }
        return data;
    }, []);

    const streamAIExplanation = async (code: string, lang: string, stderr: string, exitCode: number) => {
        setAiStreaming(true);
        setAiExplanation('');
        setAiSuggestions([]);
        setActiveTab('ai');

        try {
            const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
            const resp = await fetch(`${base}/code/explain/stream`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language: lang, stderr, exitCode, courseContext: 'Engineering' }),
            });

            if (!resp.body) return;
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const token = line.slice(6);
                    if (token === '[DONE]') break;
                    setAiExplanation(prev => prev + token.replace(/\\n/g, '\n'));
                }
            }
        } catch (e) {
            setAiExplanation('Unable to stream explanation. Check your connection.');
        } finally {
            setAiStreaming(false);
        }
    };

    const runCode = async () => {
        setRunning(true);
        setResult(null);
        setAiExplanation('');
        setAiSuggestions([]);
        setActiveTab('console');

        try {
            const resp = await api.post<ExecResponse>('/code/execute', {
                language,
                code,
                stdin,
                explainOnError: false,
            });

            setResult(resp.result);

            const hasError = resp.result.exitCode !== 0 || resp.result.stderr;
            if (hasError) {
                // Stream explanation
                streamAIExplanation(code, language, resp.result.stderr, resp.result.exitCode);
            } else if (language === 'python' && code.includes('butterworth')) {
                setGraphData(generateGraphData());
                setShowGraph(true);
            }
        } catch (e: any) {
            setResult({
                stdout: '',
                stderr: e?.message || 'Failed to reach execution service.',
                exitCode: 1,
                language,
                runtime: language,
            });
        } finally {
            setRunning(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const changeLang = (lang: string) => {
        setLanguage(lang);
        setCode(STARTER_CODE[lang] ?? '');
        setShowLangDropdown(false);
        setResult(null);
        setAiExplanation('');
        setShowGraph(false);
        setActiveTab('console');
    };

    const resetCode = () => {
        setCode(STARTER_CODE[language] ?? '');
        setResult(null);
        setAiExplanation('');
        setShowGraph(false);
    };

    const currentLang = LANGUAGES.find(l => l.key === language) ?? LANGUAGES[0];
    const hasError = result && (result.exitCode !== 0 || result.stderr);
    const hasOutput = result && (result.stdout || result.stderr);

    return (
        <div className="codelab-page">
            {/* ── Problem / Info panel ── */}
            <div className="codelab-problem">
                <div className="codelab-problem-header">
                    <div>
                        <h2>Coding Lab</h2>
                        <span className="cl-problem-sub">DSP · ML · Algorithms</span>
                    </div>
                </div>
                <div className="codelab-problem-body">
                    <div className="problem-meta">
                        <span className="badge badge-warning">Medium</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>50 pts</span>
                    </div>

                    <p>Implement and test a Butterworth low-pass filter. Print the frequency response showing magnitude in dB at key frequencies.</p>

                    <h4>Requirements</h4>
                    <ul>
                        <li><strong>Order:</strong> 4</li>
                        <li><strong>Cutoff:</strong> 1000 Hz</li>
                        <li><strong>Sampling rate:</strong> 8000 Hz</li>
                        <li>Print magnitude table (dB vs Hz)</li>
                        <li>Show -3dB point at cutoff</li>
                    </ul>

                    <h4>Expected output</h4>
                    <div className="cl-expected-output">
                        <pre>{`Freq (Hz) | Magnitude (dB)
       0  |  0.00
    1000  | -3.01
    4000  | -48.1`}</pre>
                    </div>

                    <div className="codelab-buttons-stack">
                        <button className="btn btn-outline btn-sm" onClick={() => {
                            setGraphData(generateGraphData());
                            setShowGraph(true);
                            setActiveTab('graph');
                        }}>
                            <Activity size={14} /> Preview Graph
                        </button>
                    </div>

                    <h4>Hints</h4>
                    <div className="codelab-hint">
                        <p>H(f) = 1 / √(1 + (f/fc)^(2n)) — compute this for each frequency point.</p>
                    </div>

                    {/* AI features callout */}
                    <div className="cl-ai-callout">
                        <Brain size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <strong>AI-powered feedback</strong>
                            <span>Run code with an error and the AI instantly explains what went wrong and how to fix it.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Editor panel ── */}
            <div className="codelab-editor-panel">
                {/* Toolbar */}
                <div className="codelab-toolbar">
                    <div className="codelab-lang-selector">
                        <button
                            className="codelab-lang-btn"
                            onClick={() => setShowLangDropdown(v => !v)}
                        >
                            <span className="cl-lang-dot" style={{ background: currentLang.color }} />
                            {currentLang.label}
                            <ChevronDown size={14} />
                        </button>
                        {showLangDropdown && (
                            <div className="codelab-lang-dropdown animate-scale-in">
                                {LANGUAGES.map(l => (
                                    <button
                                        key={l.key}
                                        className={l.key === language ? 'active' : ''}
                                        onClick={() => changeLang(l.key)}
                                    >
                                        <span className="cl-lang-dot" style={{ background: l.color }} />
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="codelab-toolbar-actions">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowStdin(v => !v)}
                            title="Toggle stdin input"
                        >
                            <FileText size={14} /> Stdin {showStdin ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={copyCode}>
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={resetCode}>
                            <RotateCcw size={14} /> Reset
                        </button>
                        <button
                            className="btn btn-success btn-sm"
                            onClick={runCode}
                            disabled={running}
                        >
                            {running
                                ? <><Loader2 size={14} className="animate-spin" /> Running...</>
                                : <><Play size={14} /> Run Code</>
                            }
                        </button>
                    </div>
                </div>

                {/* Stdin */}
                {showStdin && (
                    <div className="cl-stdin-area">
                        <span className="cl-stdin-label">stdin</span>
                        <input
                            className="cl-stdin-input"
                            placeholder="Program input (one value per line)..."
                            value={stdin}
                            onChange={e => setStdin(e.target.value)}
                        />
                    </div>
                )}

                {/* Editor */}
                <div className="codelab-editor">
                    <div className="codelab-line-numbers">
                        {code.split('\n').map((_, i) => <span key={i}>{i + 1}</span>)}
                    </div>
                    <textarea
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="codelab-textarea"
                        spellCheck={false}
                        onKeyDown={e => {
                            // Tab inserts 4 spaces instead of losing focus
                            if (e.key === 'Tab') {
                                e.preventDefault();
                                const el = e.currentTarget;
                                const start = el.selectionStart;
                                const end = el.selectionEnd;
                                const next = code.substring(0, start) + '    ' + code.substring(end);
                                setCode(next);
                                requestAnimationFrame(() => {
                                    el.selectionStart = el.selectionEnd = start + 4;
                                });
                            }
                        }}
                    />
                </div>

                {/* Output tabs */}
                <div className="codelab-output-section">
                    <div className="codelab-output-tabs">
                        <button className={`output-tab ${activeTab === 'console' ? 'active' : ''}`} onClick={() => setActiveTab('console')}>
                            <Terminal size={14} />
                            Console
                            {hasOutput && (
                                <span className={`cl-tab-dot ${hasError ? 'cl-tab-dot-error' : 'cl-tab-dot-ok'}`} />
                            )}
                        </button>
                        <button className={`output-tab ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveTab('graph')}>
                            <Activity size={14} />
                            Graph
                            {showGraph && <span className="cl-tab-dot cl-tab-dot-ok" />}
                        </button>
                        <button className={`output-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
                            <Sparkles size={14} />
                            AI Feedback
                            {(aiExplanation || aiStreaming) && <span className={`cl-tab-dot ${aiStreaming ? 'cl-tab-dot-stream' : 'cl-tab-dot-ok'}`} />}
                        </button>
                    </div>

                    <div className="codelab-output-content">
                        {/* Console tab */}
                        {activeTab === 'console' && (
                            <div className="cl-console">
                                {running && (
                                    <div className="cl-console-running">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Executing on {currentLang.label} {currentLang.key === 'python' ? '3.10' : ''}...</span>
                                    </div>
                                )}
                                {result && (
                                    <>
                                        <div className="cl-console-meta">
                                            <span className="cl-console-runtime">{result.runtime}</span>
                                            {result.executionMs && (
                                                <span className="cl-console-time">{result.executionMs}ms</span>
                                            )}
                                            <span className={`cl-console-status ${result.exitCode === 0 ? 'ok' : 'err'}`}>
                                                {result.exitCode === 0
                                                    ? <><CheckCircle2 size={12} /> Exit 0</>
                                                    : <><AlertTriangle size={12} /> Exit {result.exitCode}</>
                                                }
                                            </span>
                                        </div>
                                        {result.stdout && (
                                            <pre ref={outputRef} className="codelab-console-text cl-stdout">{result.stdout}</pre>
                                        )}
                                        {result.stderr && (
                                            <pre className="codelab-console-text cl-stderr">{result.stderr}</pre>
                                        )}
                                        {hasError && (
                                            <button className="cl-explain-btn" onClick={() => setActiveTab('ai')}>
                                                <Brain size={14} /> View AI explanation
                                            </button>
                                        )}
                                    </>
                                )}
                                {!result && !running && (
                                    <pre className="codelab-console-text cl-placeholder">
                                        {`Press "Run Code" to execute your ${currentLang.label} program.\nOutput will appear here.`}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Graph tab */}
                        {activeTab === 'graph' && (
                            showGraph
                                ? <GraphOutput data={graphData} cutoff={1000} />
                                : (
                                    <div className="graph-placeholder">
                                        <Activity size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Run the Python code to generate the filter response graph</p>
                                    </div>
                                )
                        )}

                        {/* AI tab */}
                        {activeTab === 'ai' && (
                            <div className="cl-ai-tab">
                                {(aiExplanation || aiStreaming) ? (
                                    <AIExplanationPanel
                                        explanation={aiExplanation}
                                        suggestions={aiSuggestions}
                                        streaming={aiStreaming}
                                        onClose={() => { setAiExplanation(''); setAiSuggestions([]); }}
                                    />
                                ) : (
                                    <div className="cl-ai-empty">
                                        <Brain size={36} style={{ color: 'var(--text-muted)' }} />
                                        <p>Run your code. If it has an error, the AI will instantly explain what went wrong and how to fix it.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
