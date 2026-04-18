import { useState } from "react";
import { generateCode } from "../api/api";
import { Code, Copy, Check, Terminal, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeGenerator = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setResult(""); // Clear previous result
    
    try {
      const data = await generateCode({ prompt });
      setResult(data.generated_code);
    } catch {
      setResult("// Error generating code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* Input Section - Styled like a Terminal Command */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
        <div className="relative bg-[#1e1e20] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
          
          {/* Terminal Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/5">
            <Terminal size={16} className="text-emerald-400" />
            <span className="text-xs font-mono text-emerald-100/50">user@nexus-ai:~/projects/code-gen</span>
          </div>

          <textarea
            className="w-full p-4 sm:p-6 bg-[#0a0a0b] focus:outline-none resize-none text-gray-200 placeholder-gray-600 font-mono text-sm leading-relaxed"
            placeholder="// Describe the function, component, or algorithm you need..."
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleSubmit()}
          />

          <div className="flex justify-between items-center p-3 bg-white/[0.02] border-t border-white/5">
            <span className="text-xs text-gray-600 font-mono pl-2 hidden md:block">
               Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-400">Ctrl + Enter</kbd> to generate
            </span>
            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate Code
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Output Section - The "VS Code" Look */}
      <AnimatePresence>
        {(result || loading) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-xl overflow-hidden border border-white/10 bg-[#1e1e1e] shadow-2xl ring-1 ring-white/5"
          >
            {/* Editor Tab Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-white/5">
               <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 mr-4">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] text-gray-300 text-xs rounded-t-lg border-t border-l border-r border-transparent">
                    <Code size={12} className="text-blue-400" />
                    <span>generated_script.tsx</span>
                  </div>
               </div>

               {result && (
                 <button 
                  onClick={copyToClipboard}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-xs font-medium px-2 py-1 hover:bg-white/5 rounded"
                 >
                   {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                   {copied ? "Copied" : "Copy"}
                 </button>
               )}
            </div>

            {/* Code Content */}
            <div className="relative group">
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-4">
                   <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                   <p className="text-sm text-gray-500 font-mono animate-pulse">Writing code...</p>
                </div>
              ) : (
                <SyntaxHighlighter
                  language="typescript"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: '#1e1e1e',
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                  }}
                  showLineNumbers={true}
                  wrapLines={true}
                  wrapLongLines={true}
                >
                  {result}
                </SyntaxHighlighter>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CodeGenerator;