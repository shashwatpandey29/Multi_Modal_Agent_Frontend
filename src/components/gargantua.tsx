import { motion } from "framer-motion";

const BlackHoleLoader = () => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      
      {/* 1. Distant Nebula Glow (Ambient Background) */}
      <div className="absolute inset-0 bg-blue-600/20 blur-[60px] rounded-full opacity-50" />

      {/* 2. Accretion Disk - Outer Swirl (Deep Blue) */}
      {/* We use a mask to fade the outer edges naturally */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full rounded-full mix-blend-screen opacity-80"
        style={{
          background: "conic-gradient(transparent 0deg, #0011ff 60deg, transparent 120deg, #0011ff 180deg, transparent 240deg, #0011ff 300deg, transparent 360deg)",
          filter: "blur(10px)",
        }}
      />

      {/* 3. Accretion Disk - Middle Swirl (Electric Cyan) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute w-[90%] h-[90%] rounded-full mix-blend-screen"
        style={{
          background: "conic-gradient(transparent 0deg, #00f0ff 40deg, transparent 100deg, #00f0ff 190deg, transparent 260deg, #00f0ff 320deg, transparent 360deg)",
          filter: "blur(5px)",
        }}
      />

      {/* 4. Accretion Disk - Inner Plasma (White Hot) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        className="absolute w-[70%] h-[70%] rounded-full mix-blend-screen"
        style={{
          background: "conic-gradient(transparent 0deg, #ffffff 50deg, transparent 140deg, #ffffff 220deg, transparent 360deg)",
          filter: "blur(3px)",
          opacity: 0.6
        }}
      />

      {/* 5. The Event Horizon (The Black Void) */}
      <div className="relative w-28 h-28 bg-black rounded-full z-10 shadow-[0_0_20px_rgba(0,240,255,0.6)]">
        {/* Photon Ring (The sharp bright edge) */}
        <div className="absolute inset-0 rounded-full border-[2px] border-cyan-300/50 blur-[1px]" />
        
        {/* Inner Shadow to give depth to the sphere */}
        <div className="absolute inset-0 rounded-full bg-black shadow-[inset_0_0_20px_rgba(0,0,0,1)]" />
      </div>

      {/* 6. Gravitational Lensing (Distortion waves) */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-32 h-32 rounded-full border border-cyan-500/30 blur-md z-20"
      />

    </div>
  );
};

export default BlackHoleLoader;