import { motion } from "framer-motion";

const AuraOrb = () => {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center perspective-[500px]">
      
      {/* 1. Ambient Background Glow (The "Presence") */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-indigo-500/20 blur-[50px] rounded-full"
      />

      {/* 2. The Shockwaves - Non-linear expansion */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={`wave-${i}`}
          className="absolute inset-0 rounded-full border border-indigo-400/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [1, 2.5], 
            opacity: [0.6, 0],
            rotate: [0, 90] // Slight rotation as it expands
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            delay: i * 1.2, 
            ease: "easeOut" 
          }}
        >
           {/* Subtle texture on waves */}
           <div className="w-full h-full rounded-full border-t border-indigo-300/30 rotate-45" />
        </motion.div>
      ))}

      {/* 3. Gyroscopic Rings (The "Tech" feel) */}
      {/* Ring A: Tilted X */}
      <motion.div
        animate={{ rotateX: 360, rotateY: 180, rotateZ: 90 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute w-32 h-32 border border-cyan-500/30 rounded-full"
        style={{ borderStyle: "dashed", borderWidth: "1px" }}
      />
      
      {/* Ring B: Tilted Y */}
      <motion.div
        animate={{ rotateY: 360, rotateX: 45 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute w-28 h-28 border border-purple-500/30 rounded-full"
        style={{ borderTopColor: "transparent", borderLeftColor: "transparent" }}
      />

      {/* 4. The Main Vortex (Swirling Gradients) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-24 h-24 rounded-full mix-blend-screen"
        style={{
          background: "conic-gradient(from 0deg, transparent 0%, #06b6d4 40%, #8b5cf6 80%, transparent 100%)",
          filter: "blur(8px)",
          opacity: 0.8
        }}
      />

      {/* 5. The Singularity Core (Dense & Bright) */}
      <div className="relative w-14 h-14 bg-black rounded-full flex items-center justify-center z-10 shadow-[0_0_40px_rgba(139,92,246,0.6)] ring-1 ring-white/20">
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1], 
            backgroundColor: ["#4f46e5", "#8b5cf6", "#4f46e5"] 
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full rounded-full blur-md opacity-80"
        />
        {/* The White-Hot Center */}
        <div className="absolute w-6 h-6 bg-white rounded-full blur-[2px] shadow-[0_0_15px_white]" />
      </div>

      {/* 6. Orbiting Satellites (Particles) */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`part-${i}`}
          className="absolute w-full h-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 10 + i * 5, repeat: Infinity, ease: "linear", delay: i * 2 }}
        >
          <motion.div 
            className={`absolute rounded-full shadow-[0_0_10px_currentColor] ${i % 2 === 0 ? "text-cyan-400" : "text-purple-400"}`}
            style={{ 
              width: i % 2 === 0 ? "4px" : "3px",
              height: i % 2 === 0 ? "4px" : "3px",
              top: `${10 + i * 5}%`, // Varying orbits
              left: "50%",
              backgroundColor: "currentColor"
            }}
          />
        </motion.div>
      ))}

    </div>
  );
};  

export default AuraOrb;