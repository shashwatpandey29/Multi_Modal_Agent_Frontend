import { useState } from "react";
import TextGenerator from "./components/TextGenerator";
import CodeGenerator from "./components/CodeGenerator";
import ImageGenerator from "./components/ImageGenerator";
import DocumentSummarizer from "./components/DocumentSummarizer"; // Import the new tool
import NexusLoader from "./components/NexusLoader"; 
import { 
  MessageSquare, 
  Code, 
  Image as ImageIcon, 
  Settings, 
  Sparkles, 
  FileText // Icon for the new tab
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  // 1. Added "docs" to the state type
  const [activeTab, setActiveTab] = useState<"text" | "code" | "image" | "docs">("text");

  // 2. Added Document Summarizer to the menu
  const menuItems = [
    { id: "text", label: "Text Chat", icon: <MessageSquare size={18} /> },
    { id: "code", label: "Code Assistant", icon: <Code size={18} /> },
    { id: "image", label: "Image Studio", icon: <ImageIcon size={18} /> },
    { id: "docs", label: "DocuMind", icon: <FileText size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      
      {/* 1. Enhanced Ambient Background (The "Glass Cockpit" Feel) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         {/* Deep Indigo Void */}
         <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-900/10 rounded-full blur-[150px]" />
         {/* Electric Cyan Accent */}
         <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[150px]" />
         {/* Subtle Noise Texture overlay for industrial matte look */}
         <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      </div>

      {/* 2. Sidebar with Glassmorphism */}
      <aside className="w-72 relative z-10 bg-[#0a0a0b]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col p-4 shadow-2xl">
        {/* Header with Animated Nexus Loader */}
        <div className="flex items-center gap-3 px-3 py-6 mb-2">
          <div className="relative flex items-center justify-center w-10 h-10 bg-white/5 rounded-xl border border-white/5 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]">
            <NexusLoader /> 
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none font-mono">NEXUS</h1>
            <p className="text-[10px] text-gray-500 font-medium mt-1 tracking-widest uppercase"></p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group overflow-hidden ${
                activeTab === item.id ? "text-white" : "text-gray-400 hover:text-gray-100"
              }`}
            >
              {/* The "Sliding" Active Background with Glow */}
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white/5 border border-white/5 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              
              {/* Icon & Label */}
              <span className="relative z-10 group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
              <span className="relative z-10 text-sm font-medium tracking-wide">{item.label}</span>
              
              {/* Subtle Right Indicator for Active Tab */}
              {activeTab === item.id && (
                 <motion.div 
                   layoutId="activeIndicator"
                   className="absolute right-3 w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]"
                 />
              )}
            </button>
          ))}
        </nav>

        {/* User Profile Section (Industrial Standard) */}
        <div className="mt-auto pt-4 border-t border-white/5">
            <button className="flex items-center gap-3 w-full p-2 hover:bg-white/5 rounded-lg transition-colors group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black shadow-lg shadow-orange-500/20 ring-1 ring-white/10">
                    SP
                </div>
                <div className="text-left flex-1">
                    <p className="text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">Shashwat Pandey</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">ADAM</p>
                </div>
                <Settings size={16} className="text-gray-500 group-hover:text-white transition-colors group-hover:rotate-90 duration-500" />
            </button>
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <main className="flex-1 overflow-y-auto relative z-10 flex flex-col scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Top Bar with Breadcrumbs */}
        <header className="sticky top-0 z-20 px-8 py-4 flex justify-between items-center bg-[#050505]/50 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest font-semibold font-mono">
                <Sparkles size={12} className="text-indigo-500" />
                <span>Workspace</span> 
                <span className="text-gray-600">/</span> 
                <span className="text-gray-200">{menuItems.find(i => i.id === activeTab)?.label}</span>
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono text-emerald-500 tracking-wider">ONLINE</span>
            </div>
        </header>

        {/* Content Container */}
        <div className="w-full p-0 flex-1"> 
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="w-full h-full"
            >
              {activeTab === "text" && <div className="p-8 pb-20 max-w-5xl mx-auto"><TextGenerator /></div>}
              {activeTab === "code" && <div className="p-8 pb-20 max-w-5xl mx-auto"><CodeGenerator /></div>}
              {activeTab === "image" && <div className="p-8 pb-20 max-w-6xl mx-auto"><ImageGenerator /></div>}
              {/* Document Summarizer takes full width/height naturally, so we adjust padding less */}
              {activeTab === "docs" && <DocumentSummarizer />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;