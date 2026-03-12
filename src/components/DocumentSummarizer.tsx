import { useEffect, useState, useRef } from "react";
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
import BlackHoleLoader from "./gargantua";
import DocuMindLoader from "./DocuMindLoader";
const DocumentSummarizer = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<number | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load papers on mount
  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    try {
      const data = await getPapers();
      setPapers(data);
    } catch (err) {
      console.error(err);
    }
  };

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
    setLoading(true);
    setAnswer(""); // Clear previous answer
    setQuestion("");

    try {
      const summaryRes = await getSummary(paperId);
      const statsRes = await getStats(paperId);

      setSummary(summaryRes.summary);
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] max-w-7xl mx-auto gap-6 p-6">
      
      {/* LEFT COLUMN: Data Sources */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                <FileSearch className="text-indigo-400" size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white tracking-tight">DocuMind</h1>
                <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Analysis Engine</p>
            </div>
        </div>

        {/* Upload Zone */}
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-[#1e1e20]/50 hover:bg-[#1e1e20] transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden"
        >
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <Upload className="text-gray-500 group-hover:text-indigo-400 transition-colors" size={24} />
            <div className="text-center z-10">
                <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Upload Document</p>
                <p className="text-xs text-gray-600 group-hover:text-gray-500">PDF, DOCX, TXT</p>
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
        <div className="flex-1 bg-[#1e1e20] border border-white/10 rounded-2xl p-4 overflow-hidden flex flex-col">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pl-2">Available Data</h3>
            <div className="overflow-y-auto space-y-2 custom-scrollbar pr-2 flex-1">
                {papers.map((paper) => (
                    <button
                        key={paper.paper_id}
                        onClick={() => handleSelectPaper(paper.paper_id)}
                        className={`w-full p-3 rounded-xl border text-left transition-all group flex items-center justify-between ${
                            selectedPaper === paper.paper_id
                            ? "bg-indigo-600/10 border-indigo-500/50 text-white shadow-[0_0_15px_rgba(79,70,229,0.1)]"
                            : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FileText size={18} className={selectedPaper === paper.paper_id ? "text-indigo-400" : "text-gray-600"} />
                            <span className="truncate text-sm font-medium">{paper.filename}</span>
                        </div>
                        {selectedPaper === paper.paper_id && <ChevronRight size={14} className="text-indigo-400" />}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Analysis Deck */}
      <div className="flex-1 bg-[#0a0a0b] border border-white/10 rounded-3xl p-6 relative overflow-hidden flex flex-col shadow-2xl">
        
{loading ? (
             // --- Loading State ---
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                <div className="scale-125">
                    <DocuMindLoader /> {/* <--- CHANGED HERE */}
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white animate-pulse">Reading Document...</h3>
                    <p className="text-sm text-cyan-400 font-mono">Extracting semantic vectors & analyzing</p>
                </div>
            </div>
        ) : selectedPaper && summary ? (
            // --- Content State ---
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                
                {/* 1. HUD Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {stats && (
                        <>
                            <div className="bg-[#1e1e20] border border-white/10 rounded-xl p-4 flex items-center gap-4">
                                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Layers size={20} /></div>
                                <div>
                                    <p className="text-xs text-gray-500 font-mono uppercase">Total Chunks</p>
                                    <p className="text-lg font-bold text-white">{stats.total_chunks}</p>
                                </div>
                            </div>
                            <div className="bg-[#1e1e20] border border-white/10 rounded-xl p-4 flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><BarChart3 size={20} /></div>
                                <div>
                                    <p className="text-xs text-gray-500 font-mono uppercase">Queries</p>
                                    <p className="text-lg font-bold text-white">{stats.total_questions}</p>
                                </div>
                            </div>
                            <div className="bg-[#1e1e20] border border-white/10 rounded-xl p-4 flex items-center gap-4 hidden md:flex">
                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Cpu size={20} /></div>
                                <div>
                                    <p className="text-xs text-gray-500 font-mono uppercase">Status</p>
                                    <p className="text-lg font-bold text-white">Active</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* 2. Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                    
                    {/* Summary Section */}
                    <div className="space-y-3">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles size={18} className="text-yellow-400" /> Executive Summary
                        </h2>
                        <div className="p-6 bg-[#151516] border border-white/5 rounded-2xl text-gray-300 leading-relaxed text-sm shadow-inner">
                            {summary}
                        </div>
                    </div>

                    {/* Q&A Result Section */}
                    <AnimatePresence>
                        {answer && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                            >
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <MessageSquare size={18} className="text-cyan-400" /> AI Response
                                </h2>
                                <div className="p-6 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-2xl text-indigo-100 leading-relaxed text-sm shadow-lg">
                                    {answer}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Input Area (Sticky Bottom) */}
                <div className="relative group mt-2">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl opacity-0 group-focus-within:opacity-30 transition duration-500 blur-lg"></div>
                    <div className="relative bg-[#1e1e20] border border-white/10 rounded-xl flex items-center p-2 shadow-2xl">
                         <input 
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                            placeholder="Ask a question about this document..."
                            className="flex-1 bg-transparent p-3 text-white placeholder-gray-500 focus:outline-none"
                         />
                         <button 
                            onClick={handleAsk}
                            className="p-3 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition-colors font-medium"
                         >
                            <Send size={18} />
                         </button>
                    </div>
                </div>

            </div>
        ) : (
            // --- Empty State ---
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                <div className="p-6 bg-[#1e1e20] rounded-full border border-white/5">
                    <FileText size={48} className="opacity-20" />
                </div>
                <p>Select a document from the left to begin analysis</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default DocumentSummarizer;