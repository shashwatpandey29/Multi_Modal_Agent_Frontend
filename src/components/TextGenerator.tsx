import { useState, useRef, useEffect } from "react";
import { generateText } from "../api/api";
import { Send, User, Bot, Sparkles } from "lucide-react"; // Sparkles added back for the 'Attach' button
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NexusLoader from "./NexusLoader"; 
import AuraOrb from "./AuraOrb"; 

type Message = {
    role: "user" | "ai";
    content: string;
};

const TextGenerator = () => {
    const [prompt, setPrompt] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        
        const userMessage = prompt;
        setPrompt(""); 
        
        // Reset textarea height manually if needed, though React state usually handles content
        const textarea = document.querySelector('textarea');
        if (textarea) textarea.style.height = '56px';

        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setLoading(true);

        try {
            const data = await generateText({ prompt: userMessage });
            setMessages((prev) => [...prev, { role: "ai", content: data.response }]);
        } catch (error) {
            setMessages((prev) => [...prev, { role: "ai", content: "Sorry, I encountered an error." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto">
            {/* Empty State / Welcome Screen */}
            {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="mb-4 flex justify-center scale-125">
                        <AuraOrb />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                            How can I help you today master?
                        </h2>
                        <p className="text-gray-500 font-medium">Powered by Gym</p>
                    </div>
                </div>
            )}

            {/* Chat History */}
            <div className={`flex-1 overflow-y-auto space-y-6 py-6 px-2 ${messages.length > 0 ? "block" : "hidden"}`}>
                <AnimatePresence>
                    {messages.map((msg, index) => (
                        <motion.div 
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            {/* AI Icon */}
                            {msg.role === "ai" && (
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-indigo-500/20">
                                    <Bot size={18} className="text-white" />
                                </div>
                            )}

                            {/* Message Bubble */}
                            <div className={`
                                max-w-[85%] rounded-2xl p-4 leading-relaxed overflow-hidden shadow-sm
                                ${msg.role === "user" 
                                    ? "bg-[#2f2f32] text-white rounded-tr-sm" 
                                    : "text-gray-200"
                                }
                            `}>
                                {msg.role === "ai" ? (
                                    <div className="markdown-container prose prose-invert max-w-none text-sm space-y-4">
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                table: ({node, ...props}) => (
                                                    <div className="overflow-x-auto my-4 border border-white/10 rounded-lg">
                                                        <table className="min-w-full divide-y divide-white/10 bg-white/5" {...props} />
                                                    </div>
                                                ),
                                                th: ({node, ...props}) => (
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-indigo-300 uppercase tracking-wider bg-white/10 border-b border-white/10" {...props} />
                                                ),
                                                td: ({node, ...props}) => (
                                                    <td className="px-4 py-3 text-sm text-gray-300 border-b border-white/5 last:border-0" {...props} />
                                                ),
                                                h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-6 mb-4 pb-2 border-b border-white/10" {...props} />,
                                                h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-6 mb-3" {...props} />,
                                                h3: ({node, ...props}) => <h3 className="text-lg font-bold text-indigo-400 mt-4 mb-2" {...props} />,
                                                strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                                                blockquote: ({node, ...props}) => (
                                                    <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-gray-400 my-4 bg-white/5 py-2 pr-2 rounded-r" {...props} />
                                                ),
                                                ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2 marker:text-indigo-400" {...props} />,
                                                ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2 marker:text-indigo-400" {...props} />,
                                                code: ({node, ...props}) => (
                                                    <code className="bg-black/30 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs" {...props} />
                                                ),
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>

                            {/* User Icon */}
                            {msg.role === "user" && (
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center shrink-0 mt-1">
                                    <User size={18} className="text-white" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {/* Thinking State */}
                {loading && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-4 items-center"
                    >
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                             <NexusLoader />
                        </div>
                        <span className="text-gray-400 text-sm font-medium animate-pulse">
                            Thinking...
                        </span>
                    </motion.div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* --- UPGRADED INPUT BAR --- */}
            <div className="sticky bottom-0 bg-[#0d0d0e] pt-4 pb-6 px-4">
                <div className="max-w-4xl mx-auto relative group">
                    
                    {/* 1. The Gradient Glow Effect (Visible on Focus) */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-0 group-focus-within:opacity-30 transition duration-500 blur-lg"></div>
                    
                    {/* 2. Main Input Container */}
                    <div className="relative bg-[#1e1e20]/90 backdrop-blur-xl border border-white/10 rounded-2xl flex items-end shadow-2xl transition-all">
                        
                        {/* Fake Attachment Button for "Pro" feel */}
                        <button className="p-4 mb-0.5 text-gray-500 hover:text-indigo-400 transition-colors">
                            <Sparkles size={20} className="opacity-50 hover:opacity-100" />
                        </button>

                        <textarea
                            rows={1}
                            className="w-full py-4 bg-transparent resize-none focus:outline-none placeholder-gray-500 text-gray-200 max-h-48 overflow-y-auto leading-relaxed scrollbar-hide"
                            placeholder="Message Nexus AI..."
                            value={prompt}
                            onChange={(e) => {
                                setPrompt(e.target.value);
                                // Auto-grow height logic
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                            style={{ minHeight: '56px' }}
                        />

                        {/* Send Button with Animation */}
                        <div className="p-2">
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !prompt.trim()}
                                className={`
                                    p-3 rounded-xl transition-all duration-300 flex items-center justify-center
                                    ${prompt.trim() 
                                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 rotate-0 scale-100" 
                                        : "bg-white/5 text-gray-600 cursor-not-allowed rotate-90 scale-90 opacity-50"
                                    }
                                `}
                            >
                                <Send size={18} className={prompt.trim() ? "translate-x-0.5 translate-y-0.5" : ""} />
                            </button>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <p className="text-[10px] text-center text-gray-600 mt-3 font-medium tracking-wide uppercase">
                         AI can make mistakes so can you hahahahhaa ;\
                    </p>
                </div>
            </div>
            {/* --------------------------- */}
        </div>
    );
};

export default TextGenerator;