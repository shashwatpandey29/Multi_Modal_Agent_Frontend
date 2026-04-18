import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  FileText,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TabId = "text" | "code" | "image" | "docs";
type DeviceType = "mobile" | "tablet" | "desktop";
type MenuItem = { id: TabId; label: string; icon: ReactNode };

const MENU_ITEMS: MenuItem[] = [
  { id: "text", label: "Text Chat", icon: <MessageSquare size={18} /> },
  { id: "code", label: "Code Assistant", icon: <Code size={18} /> },
  { id: "image", label: "Image Studio", icon: <ImageIcon size={18} /> },
  { id: "docs", label: "DocuMind", icon: <FileText size={18} /> },
];

const getDeviceType = (): DeviceType => {
  const width = window.innerWidth;
  const mobileByWidth = width < 768;
  const tabletByWidth = width >= 768 && width < 1024;
  const ua = navigator.userAgent.toLowerCase();
  const mobileByUa = /iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua);

  if (mobileByWidth || mobileByUa) {
    return "mobile";
  }

  if (tabletByWidth) {
    return "tablet";
  }

  return "desktop";
};

const updateViewportHeight = () => {
  const dynamicHeight = `${window.innerHeight}px`;
  document.documentElement.style.setProperty("--app-height", dynamicHeight);
};

type SidebarPanelProps = {
  mobile?: boolean;
  deviceType: DeviceType;
  activeTab: TabId;
  onTabClick: (tab: TabId) => void;
};

function SidebarPanel({ mobile = false, deviceType, activeTab, onTabClick }: SidebarPanelProps) {
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-6 mb-2">
        <div className="relative flex items-center justify-center w-10 h-10 bg-white/5 rounded-xl border border-white/5 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]">
          <NexusLoader />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white leading-none font-mono">NEXUS</h1>
          <p className="text-[10px] text-gray-500 font-medium mt-1 tracking-widest uppercase">
            {deviceType.toUpperCase()} MODE
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 mt-4">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabClick(item.id)}
            className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group overflow-hidden ${
              activeTab === item.id ? "text-white" : "text-gray-400 hover:text-gray-100"
            }`}
          >
            {activeTab === item.id && (
              <motion.div
                layoutId={mobile ? "activeTabMobile" : "activeTabDesktop"}
                className="absolute inset-0 bg-white/5 border border-white/5 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            <span className="relative z-10 group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
            <span className="relative z-10 text-sm font-medium tracking-wide">{item.label}</span>

            {activeTab === item.id && (
              <motion.div
                layoutId={mobile ? "activeIndicatorMobile" : "activeIndicatorDesktop"}
                className="absolute right-3 w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]"
              />
            )}
          </button>
        ))}
      </nav>

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
    </>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isMobile = deviceType === "mobile";
  const activeLabel = useMemo(() => MENU_ITEMS.find((item) => item.id === activeTab)?.label ?? "Workspace", [activeTab]);

  useEffect(() => {
    const updateDevice = () => {
      const currentDevice = getDeviceType();
      setDeviceType(currentDevice);
      document.documentElement.dataset.device = currentDevice;
      updateViewportHeight();
    };

    updateDevice();
    window.addEventListener("resize", updateDevice);
    window.addEventListener("orientationchange", updateDevice);

    return () => {
      window.removeEventListener("resize", updateDevice);
      window.removeEventListener("orientationchange", updateDevice);
    };
  }, []);

  const handleTabClick = (tab: TabId) => {
    setActiveTab(tab);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-[var(--app-height,100dvh)] w-full bg-[#050505] text-gray-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-900/10 rounded-full blur-[150px]" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[150px]" />
         <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      </div>

      {!isMobile && (
        <aside className="w-72 relative z-10 bg-[#0a0a0b]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col p-4 shadow-2xl">
          <SidebarPanel deviceType={deviceType} activeTab={activeTab} onTabClick={handleTabClick} />
        </aside>
      )}

      {isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm"
                aria-label="Close menu overlay"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="fixed top-0 left-0 z-40 h-[var(--app-height,100dvh)] w-[85vw] max-w-[320px] bg-[#0a0a0b]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col p-4 shadow-2xl"
              >
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>
                <SidebarPanel mobile deviceType={deviceType} activeTab={activeTab} onTabClick={handleTabClick} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      <main className="flex-1 min-h-0 overflow-hidden relative z-10 flex flex-col scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <header className="sticky top-0 z-20 px-4 sm:px-8 py-3 sm:py-4 flex justify-between items-center bg-[#050505]/50 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest font-semibold font-mono">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="mr-2 p-2 rounded-lg border border-white/10 bg-white/5 text-gray-200"
                aria-label="Open navigation menu"
              >
                <Menu size={16} />
              </button>
            )}
            <Sparkles size={12} className="text-indigo-500" />
            <span>Workspace</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-200 truncate max-w-[110px] sm:max-w-none">{activeLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono text-emerald-500 tracking-wider">ONLINE</span>
          </div>
        </header>

        <div className="w-full p-0 flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="w-full h-full min-h-0"
            >
              {activeTab === "text" && <div className="p-3 sm:p-8 pb-20 max-w-5xl mx-auto h-full min-h-0"><TextGenerator /></div>}
              {activeTab === "code" && <div className="p-3 sm:p-8 pb-20 max-w-5xl mx-auto h-full min-h-0"><CodeGenerator /></div>}
              {activeTab === "image" && <div className="p-3 sm:p-8 pb-20 max-w-6xl mx-auto h-full min-h-0"><ImageGenerator /></div>}
              {activeTab === "docs" && <DocumentSummarizer />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;