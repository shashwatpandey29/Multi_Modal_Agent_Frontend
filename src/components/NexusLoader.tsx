import { motion } from "framer-motion";

const NexusLoader = () => {
  return (
    <div className="relative w-8 h-8 flex items-center justify-center">
      {/* Core Gradient Orb (Stationary but pulsing) */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-3 h-3 rounded-full blur-[2px]"
        style={{
          backgroundColor: "var(--app-text)",
          boxShadow: "0 0 10px color-mix(in srgb, var(--app-text) 75%, transparent)",
        }}
      />

      {/* Orbiting Ring 1 (Cyan) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full"
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full blur-[1px]"
          style={{
            backgroundColor: "var(--accent-tertiary)",
            boxShadow: "0 0 8px color-mix(in srgb, var(--accent-tertiary) 78%, transparent)",
          }}
        />
      </motion.div>

      {/* Orbiting Ring 2 (Purple) - Reverse & Slower */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute w-6 h-6"
      >
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full blur-[1px]"
          style={{
            backgroundColor: "var(--accent-secondary)",
            boxShadow: "0 0 8px color-mix(in srgb, var(--accent-secondary) 78%, transparent)",
          }}
        />
      </motion.div>
      
      {/* Orbiting Ring 3 (Blue) - Faster */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute w-4 h-4"
      >
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full blur-[0.5px]"
          style={{ backgroundColor: "var(--accent-primary)" }}
        />
      </motion.div>
    </div>
  );
};

export default NexusLoader;