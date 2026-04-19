import { memo, type CSSProperties } from "react";
import { motion } from "framer-motion";

const WAVE_INDICES = [0, 1, 2] as const;

const PARTICLE_CONFIG = [
  { size: 4, top: "10%", color: "var(--accent-tertiary)", duration: 10, delay: 0 },
  { size: 3, top: "15%", color: "var(--accent-secondary)", duration: 15, delay: 2 },
  { size: 4, top: "20%", color: "var(--accent-primary)", duration: 20, delay: 4 },
  { size: 3, top: "25%", color: "var(--accent-secondary)", duration: 25, delay: 6 },
] as const;

const ROOT_STYLE: CSSProperties = {
  contain: "layout style",
  isolation: "isolate",
};

const TRANSFORM_HINT_STYLE: CSSProperties = {
  willChange: "transform",
};

const PULSE_HINT_STYLE: CSSProperties = {
  willChange: "opacity, transform",
};

const RING_A_STYLE: CSSProperties = {
  ...TRANSFORM_HINT_STYLE,
  borderStyle: "dashed",
  borderWidth: "1px",
};

const RING_B_STYLE: CSSProperties = {
  ...TRANSFORM_HINT_STYLE,
  borderTopColor: "transparent",
  borderLeftColor: "transparent",
};

const VORTEX_STYLE: CSSProperties = {
  ...TRANSFORM_HINT_STYLE,
  background: "conic-gradient(from 0deg, transparent 0%, var(--accent-tertiary) 40%, var(--accent-secondary) 80%, transparent 100%)",
  filter: "blur(8px)",
  opacity: 0.8,
};

const AuraOrb = memo(function AuraOrb() {
  return (
    <div
      className="relative w-40 h-40 flex items-center justify-center perspective-[500px] pointer-events-none"
      style={ROOT_STYLE}
      aria-hidden="true"
    >
      
      {/* 1. Ambient Background Glow (The "Presence") */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 blur-[50px] rounded-full"
        style={{
          ...PULSE_HINT_STYLE,
          backgroundColor: "color-mix(in srgb, var(--accent-primary) 28%, transparent)",
        }}
      />

      {/* 2. The Shockwaves - Non-linear expansion */}
      {WAVE_INDICES.map((i) => (
        <motion.div
          key={`wave-${i}`}
          className="absolute inset-0 rounded-full border"
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
          style={{
            ...TRANSFORM_HINT_STYLE,
            borderColor: "color-mix(in srgb, var(--accent-primary) 26%, transparent)",
          }}
        >
           {/* Subtle texture on waves */}
           <div
             className="w-full h-full rounded-full border-t rotate-45"
             style={{ borderTopColor: "color-mix(in srgb, var(--accent-tertiary) 34%, transparent)" }}
           />
        </motion.div>
      ))}

      {/* 3. Gyroscopic Rings (The "Tech" feel) */}
      {/* Ring A: Tilted X */}
      <motion.div
        animate={{ rotateX: 360, rotateY: 180, rotateZ: 90 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute w-32 h-32 border rounded-full"
        style={{ ...RING_A_STYLE, borderColor: "color-mix(in srgb, var(--accent-tertiary) 38%, transparent)" }}
      />
      
      {/* Ring B: Tilted Y */}
      <motion.div
        animate={{ rotateY: 360, rotateX: 45 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute w-28 h-28 border rounded-full"
        style={{ ...RING_B_STYLE, borderColor: "color-mix(in srgb, var(--accent-secondary) 38%, transparent)" }}
      />

      {/* 4. The Main Vortex (Swirling Gradients) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-24 h-24 rounded-full mix-blend-screen"
        style={VORTEX_STYLE}
      />

      {/* 5. The Singularity Core (Dense & Bright) */}
      <div
        className="relative w-14 h-14 bg-[var(--surface-input)] rounded-full flex items-center justify-center z-10 border"
        style={{
          boxShadow: "0 0 32px color-mix(in srgb, var(--accent-secondary) 55%, transparent)",
          borderColor: "color-mix(in srgb, var(--accent-primary) 36%, transparent)",
        }}
      >
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1], 
            backgroundColor: ["var(--accent-primary)", "var(--accent-secondary)", "var(--accent-primary)"] 
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full rounded-full blur-md opacity-80"
          style={PULSE_HINT_STYLE}
        />
        {/* The White-Hot Center */}
        <div
          className="absolute w-6 h-6 bg-[var(--app-text)] rounded-full blur-[2px]"
          style={{ boxShadow: "0 0 15px color-mix(in srgb, var(--app-text) 80%, transparent)" }}
        />
      </div>

      {/* 6. Orbiting Satellites (Particles) */}
      {PARTICLE_CONFIG.map((particle, i) => (
        <motion.div
          key={`part-${i}`}
          className="absolute w-full h-full"
          animate={{ rotate: 360 }}
          transition={{ duration: particle.duration, repeat: Infinity, ease: "linear", delay: particle.delay }}
          style={TRANSFORM_HINT_STYLE}
        >
          <div 
            className="absolute rounded-full"
            style={{ 
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              top: particle.top,
              left: "50%",
              backgroundColor: particle.color,
              boxShadow: `0 0 10px ${particle.color}`,
            }}
          />
        </motion.div>
      ))}

    </div>
  );
});

AuraOrb.displayName = "AuraOrb";

export default AuraOrb;