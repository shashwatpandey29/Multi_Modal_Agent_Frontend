import { motion } from "framer-motion";

const DocuMindLoader = () => {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center perspective-[800px]">
      
      {/* 1. Ambient Glow */}
      <div className="absolute inset-0 bg-indigo-500/10 blur-[40px] rounded-full" />

      {/* 2. Floating Document Stack */}
      <div className="relative w-20 h-28 transform-style-3d rotate-x-[30deg] rotate-y-[-15deg]">
        
        {/* Bottom Pages (Static Stack) */}
        {[...Array(3)].map((_, i) => (
          <div 
            key={i}
            className="absolute inset-0 rounded-lg border border-indigo-400/30 bg-indigo-900/40 backdrop-blur-sm"
            style={{ 
              transform: `translateZ(${-i * 4}px) translateY(${i * 2}px)`,
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
            }}
          />
        ))}

        {/* Top Active Page (Folding Animation) */}
        <motion.div
          className="absolute inset-0 rounded-lg border border-indigo-300/50 bg-indigo-600/20 backdrop-blur-md overflow-hidden"
          animate={{ 
            rotateX: [0, -15, 0],
            translateZ: [0, 10, 0]
          }}
          transition={{ 
            duration: 3, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
            {/* Fake Text Lines */}
            <div className="p-3 space-y-2 opacity-50">
                <div className="h-1.5 w-3/4 bg-indigo-300/40 rounded-full" />
                <div className="h-1.5 w-full bg-indigo-300/40 rounded-full" />
                <div className="h-1.5 w-5/6 bg-indigo-300/40 rounded-full" />
                <div className="h-1.5 w-full bg-indigo-300/40 rounded-full" />
            </div>

            {/* The Scanning Laser Beam */}
            <motion.div 
                className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee]"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
        </motion.div>
      </div>

      {/* 3. Orbiting Data Particles (The "Analysis") */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`data-${i}`}
          className="absolute w-full h-full"
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 8 + i, 
            repeat: Infinity, 
            ease: "linear", 
            delay: i * 0.5 
          }}
        >
          <div 
            className="absolute w-1.5 h-1.5 bg-cyan-400 rounded-sm shadow-[0_0_5px_currentColor]"
            style={{ 
              top: "50%", 
              left: `${50 + (35 + i * 2)}%`, // Varied orbit distances
              opacity: 0.8
            }} 
          />
        </motion.div>
      ))}

      {/* 4. Search Lens / Eye Effect */}
      <motion.div
        className="absolute w-12 h-12 border-2 border-cyan-400/50 rounded-full flex items-center justify-center z-20"
        animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0, 1, 0],
            x: [-20, 20, -20],
            y: [-10, 10, -10]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
      </motion.div>

    </div>
  );
};

export default DocuMindLoader;