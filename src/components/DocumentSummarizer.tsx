import { useCallback, useEffect, useState, useRef } from "react";
import {
  uploadPaper,
  getPapers,
  getSummary,
  askPaper,
  getStats,
} from "../api/api";
import type { Paper } from "../types/api";
import { 
  FileText, 
  Upload, 
  BarChart3, 
  FileSearch, 
  MessageSquare, 
  Send, 
  Cpu, 
  Layers, 
  Sparkles,
  ChevronRight 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import DocuMindLoader from "./DocuMindLoader";

type PaperStats = {
    total_chunks: number;
    total_questions: number;
};

const DocumentSummarizer = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<number | null>(null);
  const [summary, setSummary] = useState<string>("");
    const [factPoints, setFactPoints] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
    const [stats, setStats] = useState<PaperStats | null>(null);
  const [loading, setLoading] = useState(false);
    const [mobileView, setMobileView] = useState<"sources" | "analysis">("sources");
  const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPapers = useCallback(async () => {
    try {
      const data = await getPapers();
      setPapers(data);
    } catch (err) {
      console.error(err);
    }
    }, []);

    // Load papers on mount
    useEffect(() => {
        const fetchTimer = window.setTimeout(() => {
            void fetchPapers();
        }, 0);

        return () => {
            window.clearTimeout(fetchTimer);
        };
    }, [fetchPapers]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    setLoading(true);
    try {
      await uploadPaper(e.target.files[0]);
      await fetchPapers();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSelectPaper = async (paperId: number) => {
    setSelectedPaper(paperId);
        setMobileView("analysis");
    setLoading(true);
    setAnswer(""); // Clear previous answer
    setQuestion("");
        setFactPoints([]);

    try {
            const [summaryRes, statsRes] = await Promise.all([
                getSummary(paperId),
                getStats(paperId),
            ]);

      setSummary(summaryRes.summary);
            setFactPoints(summaryRes.fact_points || []);
      setStats(statsRes);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  const handleAsk = async () => {
    if (!selectedPaper || !question) return;

    setLoading(true);
    try {
      const res = await askPaper({
        paper_id: selectedPaper,
        question,
      });

      setAnswer(res.answer || JSON.stringify(res));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
                <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2 px-2 sm:px-3 lg:hidden">
                <button
                    type="button"
                    onClick={() => setMobileView("sources")}
                    className={`rounded-lg border px-3 py-2 text-xs uppercase tracking-[0.1em] ${
                        mobileView === "sources"
                            ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                            : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
                    }`}
                >
                    Data Sources
                </button>
                <button
                    type="button"
                    onClick={() => setMobileView("analysis")}
                    className={`rounded-lg border px-3 py-2 text-xs uppercase tracking-[0.1em] ${
                        mobileView === "analysis"
                            ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                            : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
                    }`}
                >
                    Analysis
                </button>
            </div>

            <div className="flex flex-col lg:flex-row h-full min-h-0 gap-4 sm:gap-6 p-2 sm:p-6">
      
      {/* LEFT COLUMN: Data Sources */}
                        <div className={`w-full lg:w-1/3 flex-col gap-4 sm:gap-6 min-h-0 ${mobileView === "sources" ? "flex" : "hidden lg:flex"}`}>
        
        {/* Header */}
        <div className="flex items-center gap-3 px-2">
            <div
                className="p-2 rounded-lg border"
                style={{
                    backgroundColor: "color-mix(in srgb, var(--accent-primary) 18%, transparent)",
                    borderColor: "color-mix(in srgb, var(--accent-primary) 45%, transparent)",
                }}
            >
                <FileSearch className="text-[var(--accent-primary)]" size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-[var(--app-text)] tracking-tight">DocuMind</h1>
                <p className="text-xs text-[var(--text-soft)] font-mono uppercase tracking-wider">Analysis Engine</p>
            </div>
        </div>

        {/* Upload Zone */}
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-28 sm:h-32 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] bg-[var(--surface-panel)]/70 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden"
        >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" style={{ backgroundColor: "color-mix(in srgb, var(--accent-primary) 16%, transparent)" }} />
            <Upload className="text-[var(--text-soft)] group-hover:text-[var(--accent-primary)] transition-colors" size={24} />
            <div className="text-center z-10">
                <p className="text-sm font-medium text-[var(--text-muted)] group-hover:text-[var(--app-text)] transition-colors">Upload Document</p>
                <p className="text-xs text-[var(--text-soft)]">PDF, DOCX, TXT</p>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleUpload}
                className="hidden"
            />
        </div>

        {/* Paper List */}
        <div className="flex-1 min-h-[180px] bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-2xl p-4 overflow-hidden flex flex-col">
            <h3 className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wider mb-4 pl-2">Available Data</h3>
            <div className="overflow-y-auto space-y-2 custom-scrollbar pr-2 flex-1">
                {papers.map((paper) => (
                    <button
                        key={paper.paper_id}
                        onClick={() => handleSelectPaper(paper.paper_id)}
                        className={`w-full p-3 rounded-xl border text-left transition-all group flex items-center justify-between ${
                            selectedPaper === paper.paper_id
                            ? "border-[var(--accent-primary)] text-[var(--app-text)]"
                            : "bg-[var(--surface-chip)] border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-chip-hover)] hover:text-[var(--app-text)]"
                        }`}
                        style={selectedPaper === paper.paper_id ? { backgroundColor: "color-mix(in srgb, var(--accent-primary) 14%, transparent)" } : undefined}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FileText size={18} className={selectedPaper === paper.paper_id ? "text-[var(--accent-primary)]" : "text-[var(--text-soft)]"} />
                            <span className="truncate text-sm font-medium">{paper.filename}</span>
                        </div>
                        {selectedPaper === paper.paper_id && <ChevronRight size={14} className="text-[var(--accent-primary)]" />}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Analysis Deck */}
        <div className={`flex-1 min-h-0 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-3xl p-4 sm:p-6 relative overflow-hidden flex-col shadow-2xl ${mobileView === "analysis" ? "flex" : "hidden lg:flex"}`}>
        
{loading ? (
             // --- Loading State ---
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                <div className="scale-125">
                    <DocuMindLoader /> {/* <--- CHANGED HERE */}
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-[var(--app-text)] animate-pulse">Reading Document...</h3>
                    <p className="text-sm text-[var(--accent-tertiary)] font-mono">Extracting semantic vectors & analyzing</p>
                </div>
            </div>
        ) : selectedPaper && summary ? (
            // --- Content State ---
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                
                {/* 1. HUD Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {stats && (
                        <>
                            <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-4">
                                <div
                                    className="p-2 rounded-lg"
                                    style={{
                                        backgroundColor: "color-mix(in srgb, var(--accent-secondary) 22%, transparent)",
                                        color: "var(--accent-secondary)",
                                    }}
                                ><Layers size={20} /></div>
                                <div>
                                    <p className="text-xs text-[var(--text-soft)] font-mono uppercase">Total Chunks</p>
                                    <p className="text-lg font-bold text-[var(--app-text)]">{stats.total_chunks}</p>
                                </div>
                            </div>
                            <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-4">
                                <div
                                    className="p-2 rounded-lg"
                                    style={{
                                        backgroundColor: "color-mix(in srgb, var(--success) 24%, transparent)",
                                        color: "var(--success)",
                                    }}
                                ><BarChart3 size={20} /></div>
                                <div>
                                    <p className="text-xs text-[var(--text-soft)] font-mono uppercase">Queries</p>
                                    <p className="text-lg font-bold text-[var(--app-text)]">{stats.total_questions}</p>
                                </div>
                            </div>
                            <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-4 hidden md:flex">
                                <div
                                    className="p-2 rounded-lg"
                                    style={{
                                        backgroundColor: "color-mix(in srgb, var(--accent-primary) 24%, transparent)",
                                        color: "var(--accent-primary)",
                                    }}
                                ><Cpu size={20} /></div>
                                <div>
                                    <p className="text-xs text-[var(--text-soft)] font-mono uppercase">Status</p>
                                    <p className="text-lg font-bold text-[var(--app-text)]">Active</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* 2. Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 sm:space-y-6 pr-1 sm:pr-2">
                    
                    {/* Summary Section */}
                    <div className="space-y-3">
                        <h2 className="text-lg font-bold text-[var(--app-text)] flex items-center gap-2">
                            <Sparkles size={18} className="text-[var(--accent-tertiary)]" /> Executive Summary
                        </h2>
                        <div className="p-4 sm:p-6 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl text-[var(--text-muted)] leading-relaxed text-sm shadow-inner">
                            {summary}
                        </div>
                    </div>

                    {factPoints.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-bold text-[var(--app-text)] flex items-center gap-2">
                                <Layers size={18} className="text-[var(--accent-secondary)]" /> Precomputed Fact Points
                            </h2>
                            <div className="p-4 sm:p-6 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl text-[var(--text-muted)] text-sm shadow-inner">
                                <ul className="list-disc list-inside space-y-2 marker:text-[var(--accent-secondary)]">
                                    {factPoints.map((point, index) => (
                                        <li key={`${index}-${point.slice(0, 16)}`}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Q&A Result Section */}
                    <AnimatePresence>
                        {answer && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                            >
                                <h2 className="text-lg font-bold text-[var(--app-text)] flex items-center gap-2">
                                    <MessageSquare size={18} className="text-[var(--accent-primary)]" /> AI Response
                                </h2>
                                <div
                                    className="p-4 sm:p-6 border rounded-2xl text-[var(--app-text)] leading-relaxed text-sm shadow-lg"
                                    style={{
                                        background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 22%, transparent), color-mix(in srgb, var(--accent-secondary) 22%, transparent))",
                                        borderColor: "color-mix(in srgb, var(--accent-primary) 45%, transparent)",
                                    }}
                                >
                                    {answer}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Input Area (Sticky Bottom) */}
                <div className="relative group mt-2">
                          <div
                                className="absolute -inset-0.5 rounded-xl opacity-0 group-focus-within:opacity-30 transition duration-500 blur-lg"
                                style={{ background: "linear-gradient(90deg, var(--accent-tertiary), var(--accent-primary))" }}
                          ></div>
                          <div className="relative bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-xl flex items-center p-2 shadow-2xl">
                         <input 
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                            placeholder="Ask a question about this document..."
                                     className="flex-1 bg-transparent p-3 text-[var(--app-text)] placeholder-[var(--placeholder)] focus:outline-none"
                         />
                         <button 
                            onClick={handleAsk}
                                                 className="p-3 bg-[var(--accent-tertiary)] hover:brightness-110 text-[var(--selection-text)] rounded-lg transition-colors font-medium"
                         >
                            <Send size={18} />
                         </button>
                    </div>
                </div>

            </div>
        ) : (
            // --- Empty State ---
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-soft)] space-y-4">
                <div className="p-6 bg-[var(--surface-panel)] rounded-full border border-[var(--border-subtle)]">
                    <FileText size={48} className="opacity-20" />
                </div>
                <p>Select a document from the left to begin analysis</p>
            </div>
        )}
      </div>
    </div>
        </div>
  );
};

export default DocumentSummarizer;