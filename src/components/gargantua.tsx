import { motion } from "framer-motion";

const BlackHoleLoader = () => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      
      {/* 1. Distant Nebula Glow (Ambient Background) */}
      <div
        className="absolute inset-0 blur-[60px] rounded-full opacity-50"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent-primary) 24%, transparent)" }}
      />

      {/* 2. Accretion Disk - Outer Swirl (Deep Blue) */}
      {/* We use a mask to fade the outer edges naturally */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full rounded-full mix-blend-screen opacity-80"
        style={{
          background: "conic-gradient(transparent 0deg, var(--accent-primary) 60deg, transparent 120deg, var(--accent-primary) 180deg, transparent 240deg, var(--accent-primary) 300deg, transparent 360deg)",
          filter: "blur(10px)",
        }}
      />

      {/* 3. Accretion Disk - Middle Swirl (Electric Cyan) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute w-[90%] h-[90%] rounded-full mix-blend-screen"
        style={{
          background: "conic-gradient(transparent 0deg, var(--accent-tertiary) 40deg, transparent 100deg, var(--accent-tertiary) 190deg, transparent 260deg, var(--accent-tertiary) 320deg, transparent 360deg)",
          filter: "blur(5px)",
        }}
      />

      {/* 4. Accretion Disk - Inner Plasma (White Hot) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        className="absolute w-[70%] h-[70%] rounded-full mix-blend-screen"
        style={{
          background: "conic-gradient(transparent 0deg, var(--app-text) 50deg, transparent 140deg, var(--app-text) 220deg, transparent 360deg)",
          filter: "blur(3px)",
          opacity: 0.6
        }}
      />

      {/* 5. The Event Horizon (The Black Void) */}
      <div
        className="relative w-28 h-28 bg-[var(--surface-input)] rounded-full z-10"
        style={{ boxShadow: "0 0 20px color-mix(in srgb, var(--accent-tertiary) 56%, transparent)" }}
      >
        {/* Photon Ring (The sharp bright edge) */}
        <div
          className="absolute inset-0 rounded-full border-[2px] blur-[1px]"
          style={{ borderColor: "color-mix(in srgb, var(--accent-tertiary) 56%, transparent)" }}
        />
        
        {/* Inner Shadow to give depth to the sphere */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, var(--app-bg) 90%, black 10%)",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.95)",
          }}
        />
      </div>

      {/* 6. Gravitational Lensing (Distortion waves) */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-32 h-32 rounded-full border blur-md z-20"
        style={{ borderColor: "color-mix(in srgb, var(--accent-secondary) 34%, transparent)" }}
      />

    </div>
  );
};

export default BlackHoleLoader;