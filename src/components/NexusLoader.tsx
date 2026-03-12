import { motion } from "framer-motion";

const NexusLoader = () => {
  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      {/* Core Gradient Orb (Stationary but pulsing) */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-3 h-3 bg-white rounded-full blur-[2px] shadow-[0_0_10px_rgba(255,255,255,0.8)]"
      />

      {/* Orbiting Ring 1 (Cyan) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-cyan-400 rounded-full blur-[1px] shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      </motion.div>

      {/* Orbiting Ring 2 (Purple) - Reverse & Slower */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute w-6 h-6"
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-500 rounded-full blur-[1px] shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
      </motion.div>
      
      {/* Orbiting Ring 3 (Blue) - Faster */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute w-4 h-4"
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full blur-[0.5px]" />
      </motion.div>
    </div>
  );
};

export default NexusLoader;