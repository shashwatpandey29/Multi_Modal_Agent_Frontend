import { useEffect, useRef, useState } from "react";
import { generateImage } from "../api/api";
import { Sparkles, Download, Wand2, History, Layers, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BlackHoleLoader from "./gargantua"; // Import the Black Hole component

// Types for our enhanced state
type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
};

const STYLES = [
  { id: "realistic", label: "Photorealistic", suffix: ", highly detailed, 8k, photorealistic, cinematic lighting" },
  { id: "anime", label: "Anime Style", suffix: ", anime style, studio ghibli, vibrant colors, cell shaded" },
  { id: "cyberpunk", label: "Cyberpunk", suffix: ", cyberpunk, neon lights, futuristic, high tech, dark atmosphere" },
  { id: "3d", label: "3D Render", suffix: ", 3d render, unreal engine 5, octane render, isometric" },
];

const RATIOS = [
  { id: "square", label: "Square (1:1)", class: "aspect-square" },
  { id: "landscape", label: "Landscape (16:9)", class: "aspect-video" },
  { id: "portrait", label: "Portrait (9:16)", class: "aspect-[9/16]" },
];

const ImageGenerator = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"canvas" | "history">("canvas");
  const historyRef = useRef<GeneratedImage[]>([]);
  
  // Settings
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[0]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    return () => {
      historyRef.current.forEach((item) => {
        URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    try {
      setLoading(true);
      
      // Enhance prompt with style suffix
      const finalPrompt = `${prompt}${selectedStyle.suffix}`;
      
      const blob = await generateImage({ prompt: finalPrompt });
      const url = URL.createObjectURL(blob);
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url,
        prompt: finalPrompt,
        timestamp: Date.now(),
      };

      setHistory((prev) => [newImage, ...prev]);
      setSelectedImage(newImage);
      setMobilePanel("canvas");
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus-art-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-w-6xl mx-auto gap-4 sm:gap-6">
      
      {/* 1. Control Panel & Input */}
      <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-2xl p-3 sm:p-6 shadow-2xl space-y-4 sm:space-y-6">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative group">
            <textarea
              className="w-full min-h-[110px] sm:min-h-[64px] p-4 pl-5 pr-12 rounded-xl bg-[var(--surface-input)] border border-[var(--border-subtle)] focus:outline-none transition-all text-[var(--app-text)] placeholder-[var(--placeholder)] resize-y"
              style={{ boxShadow: "0 0 0 0 transparent" }}
              placeholder="Describe the image you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
            />
            <Wand2 className="absolute right-4 top-4 text-[var(--text-soft)] group-focus-within:text-[var(--accent-primary)] transition-colors" size={18} />
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="px-6 sm:px-8 py-4 rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2 min-w-[140px] sm:min-w-[160px] w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed text-[var(--selection-text)]"
            style={{ background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))" }}
          >
            {loading ? <span className="animate-pulse">Dreaming...</span> : "Generate"} 
            {!loading && <Sparkles size={18} />}
          </button>
        </div>

        {/* Advanced Settings Toggles */}
        <div className="flex flex-wrap gap-4 sm:gap-6 border-t border-[var(--border-subtle)] pt-4">
            {/* Style Selector */}
          <div className="space-y-2 w-full lg:w-auto">
                <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-2">
                    <Layers size={14} /> Art Style
                </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
                    {STYLES.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setSelectedStyle(style)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border shrink-0 ${
                                selectedStyle.id === style.id 
                                ? "border-[var(--accent-primary)] text-[var(--accent-tertiary)]" 
                                : "bg-[var(--surface-chip)] border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-chip-hover)]"
                            }`}
                            style={selectedStyle.id === style.id ? { backgroundColor: "color-mix(in srgb, var(--accent-primary) 18%, transparent)" } : undefined}
                        >
                            {style.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ratio Selector */}
            <div className="space-y-2 w-full lg:w-auto">
              <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-2">
                    <Maximize2 size={14} /> Aspect Ratio
                </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                    {RATIOS.map((ratio) => (
                        <button
                            key={ratio.id}
                            onClick={() => setSelectedRatio(ratio)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border shrink-0 ${
                                selectedRatio.id === ratio.id 
                              ? "border-[var(--accent-secondary)] text-[var(--accent-secondary)]" 
                              : "bg-[var(--surface-chip)] border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-chip-hover)]"
                            }`}
                            style={selectedRatio.id === ratio.id ? { backgroundColor: "color-mix(in srgb, var(--accent-secondary) 18%, transparent)" } : undefined}
                        >
                            {ratio.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* 2. Main Canvas Area */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => setMobilePanel("canvas")}
            className={`rounded-lg px-3 py-2 text-xs uppercase tracking-[0.1em] border ${
              mobilePanel === "canvas"
                ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
            }`}
          >
            Canvas
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("history")}
            className={`rounded-lg px-3 py-2 text-xs uppercase tracking-[0.1em] border ${
              mobilePanel === "history"
                ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
            }`}
          >
            History
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col xl:flex-row gap-4 sm:gap-6 min-h-0">
        {/* Main Image Display */}
        <div className={`flex-1 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-3 sm:p-4 flex items-center justify-center relative overflow-hidden min-h-[260px] sm:min-h-[360px] ${mobilePanel === "canvas" ? "flex" : "hidden"} xl:flex`}>
            {loading ? (
                // --- NEW BLACK HOLE LOADING STATE ---
                <div className="text-center flex flex-col items-center justify-center h-full space-y-6">
                    <div className="scale-75 md:scale-100">
                         <BlackHoleLoader />
                    </div>
                    <div className="space-y-2 z-10">
                <p className="text-[var(--app-text)] font-medium text-lg animate-pulse tracking-wide">
                            Fabricating Reality...
                        </p>
                <p className="text-[var(--text-soft)] text-xs uppercase tracking-[0.2em]">
                            Neural Engine Active
                        </p>
                    </div>
                </div>
                // ------------------------------------
            ) : selectedImage ? (
                <motion.div 
                    key={selectedImage.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  className={`relative group max-h-full shadow-2xl ${selectedRatio.class}`}
                >
                    <img 
                        src={selectedImage.url} 
                        alt={selectedImage.prompt} 
                        className="max-h-full max-w-full rounded-lg object-contain shadow-black/50" 
                    />
                    
                    {/* Hover Overlay Actions */}
                    <div className="absolute bottom-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={() => handleDownload(selectedImage.url)}
                          className="p-3 bg-[var(--surface-overlay)] backdrop-blur-md border border-[var(--border-subtle)] rounded-xl text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-all"
                            title="Download"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                </motion.div>
            ) : (
              <div className="text-center text-[var(--text-soft)]">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Generated artwork will appear here</p>
                </div>
            )}
        </div>

        {/* 3. History Sidebar (Right Side) */}
        {history.length > 0 && (
          <div className={`w-full xl:w-36 bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-2xl p-3 overflow-x-auto xl:overflow-y-auto space-x-3 xl:space-x-0 xl:space-y-3 custom-scrollbar ${mobilePanel === "history" ? "flex" : "hidden"} xl:flex xl:flex-col`}>
          <h3 className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wider text-center mb-2 hidden xl:block">History</h3>
                <AnimatePresence>
                    {history.map((img) => (
                        <motion.button
                            key={img.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => {
                              setSelectedImage(img);
                              setMobilePanel("canvas");
                            }}
                  className={`relative w-20 h-20 sm:w-24 sm:h-24 xl:w-full xl:h-auto xl:aspect-square rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                              selectedImage?.id === img.id ? "border-[var(--accent-primary)] shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                            }`}
                        >
                            <img src={img.url} className="w-full h-full object-cover" />
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;