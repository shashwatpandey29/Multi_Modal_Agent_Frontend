import { useState } from "react";
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
  
  // Settings
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[0]);

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
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto gap-6">
      
      {/* 1. Control Panel & Input */}
      <div className="bg-[#1e1e20] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <input
              className="w-full p-4 pl-5 pr-12 rounded-xl bg-[#0a0a0b] border border-white/10 focus:border-indigo-500/50 focus:outline-none transition-all text-white placeholder-gray-600"
              placeholder="Create an image of a player having a rockstone in his hand...create an image of sword with plant type ablity flowing a green when swing also a person is handling it in invisible form ...."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Wand2 className="absolute right-4 top-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-8 py-4 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            {loading ? <span className="animate-pulse">Dreaming...</span> : "Generate"} 
            {!loading && <Sparkles size={18} />}
          </button>
        </div>

        {/* Advanced Settings Toggles */}
        <div className="flex flex-wrap gap-6 border-t border-white/5 pt-4">
            {/* Style Selector */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                    <Layers size={14} /> Art Style
                </label>
                <div className="flex flex-wrap gap-2">
                    {STYLES.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setSelectedStyle(style)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                selectedStyle.id === style.id 
                                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                                : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10"
                            }`}
                        >
                            {style.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ratio Selector */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                    <Maximize2 size={14} /> Aspect Ratio
                </label>
                <div className="flex gap-2">
                    {RATIOS.map((ratio) => (
                        <button
                            key={ratio.id}
                            onClick={() => setSelectedRatio(ratio)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                selectedRatio.id === ratio.id 
                                ? "bg-purple-500/20 border-purple-500 text-purple-300" 
                                : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10"
                            }`}
                        >
                            {ratio.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* 2. Main Canvas Area */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Main Image Display */}
        <div className="flex-1 bg-[#151516] border border-white/5 rounded-2xl p-4 flex items-center justify-center relative overflow-hidden">
            {loading ? (
                // --- NEW BLACK HOLE LOADING STATE ---
                <div className="text-center flex flex-col items-center justify-center h-full space-y-6">
                    <div className="scale-75 md:scale-100">
                         <BlackHoleLoader />
                    </div>
                    <div className="space-y-2 z-10">
                        <p className="text-gray-300 font-medium text-lg animate-pulse tracking-wide">
                            Fabricating Reality...
                        </p>
                        <p className="text-gray-600 text-xs uppercase tracking-[0.2em]">
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
                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={() => handleDownload(selectedImage.url)}
                            className="p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-white/20 transition-all"
                            title="Download"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                </motion.div>
            ) : (
                <div className="text-center text-gray-600">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Generated artwork will appear here</p>
                </div>
            )}
        </div>

        {/* 3. History Sidebar (Right Side) */}
        {history.length > 0 && (
            <div className="w-24 md:w-32 bg-[#1e1e20] border border-white/10 rounded-2xl p-3 overflow-y-auto space-y-3 custom-scrollbar">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center mb-2">History</h3>
                <AnimatePresence>
                    {history.map((img) => (
                        <motion.button
                            key={img.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => setSelectedImage(img)}
                            className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                selectedImage?.id === img.id ? "border-indigo-500 shadow-lg shadow-indigo-500/20" : "border-transparent opacity-60 hover:opacity-100"
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