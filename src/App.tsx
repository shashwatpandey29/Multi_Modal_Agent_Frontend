import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  Sun,
  Moon,
  Palette,
  Check,
  ChevronDown,
  Gauge,
  Layers3,
  MousePointer2,
} from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { gsap } from "gsap";
import Lenis from "lenis";
import { animate } from "animejs";

const TextGenerator = lazy(() => import("./components/TextGenerator"));
const CodeGenerator = lazy(() => import("./components/CodeGenerator"));
const ImageGenerator = lazy(() => import("./components/ImageGenerator"));
const DocumentSummarizer = lazy(() => import("./components/DocumentSummarizer"));

type TabId = "text" | "code" | "image" | "docs";
type DeviceType = "mobile" | "tablet" | "desktop";
type Theme = "midnight" | "aurora" | "solstice" | "light";
type PerformanceMode = "quality" | "balanced" | "smooth";
type TextureMode = "off" | "minimal" | "standard";
type UiPresetId = "battery" | "balanced" | "cinematic";
type MenuItem = { id: TabId; label: string; icon: ReactNode };
type ThemeMeta = {
  label: string;
  description: string;
  swatches: [string, string, string];
};
type UiSettings = {
  performanceMode: PerformanceMode;
  textureMode: TextureMode;
  interactiveTexture: boolean;
};
type UiPreset = {
  id: UiPresetId;
  label: string;
  description: string;
  settings: UiSettings;
};

const THEME_STORAGE_KEY = "nexus-theme";
const UI_SETTINGS_STORAGE_KEY = "nexus-ui-settings";
const THEME_ORDER: Theme[] = ["midnight", "aurora", "solstice", "light"];
const PERFORMANCE_MODE_ORDER: PerformanceMode[] = ["quality", "balanced", "smooth"];
const TEXTURE_MODE_ORDER: TextureMode[] = ["off", "minimal", "standard"];

const DEFAULT_UI_SETTINGS: UiSettings = {
  performanceMode: "balanced",
  textureMode: "standard",
  interactiveTexture: true,
};

const UI_PRESETS: UiPreset[] = [
  {
    id: "battery",
    label: "Battery Saver",
    description: "Lowest GPU and animation load",
    settings: {
      performanceMode: "smooth",
      textureMode: "off",
      interactiveTexture: false,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Smooth visuals with moderate detail",
    settings: {
      performanceMode: "balanced",
      textureMode: "minimal",
      interactiveTexture: true,
    },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Highest visual richness",
    settings: {
      performanceMode: "quality",
      textureMode: "standard",
      interactiveTexture: true,
    },
  },
];

const isSameUiSettings = (left: UiSettings, right: UiSettings): boolean => {
  return (
    left.performanceMode === right.performanceMode &&
    left.textureMode === right.textureMode &&
    left.interactiveTexture === right.interactiveTexture
  );
};

const PERFORMANCE_LABEL: Record<PerformanceMode, string> = {
  quality: "Quality",
  balanced: "Balanced",
  smooth: "Smooth",
};

const TEXTURE_LABEL: Record<TextureMode, string> = {
  off: "Off",
  minimal: "Minimal",
  standard: "Standard",
};

const PERFORMANCE_SCALE: Record<PerformanceMode, number> = {
  quality: 1,
  balanced: 0.8,
  smooth: 0.5,
};

const TEXTURE_SCALE: Record<TextureMode, number> = {
  off: 0,
  minimal: 0.52,
  standard: 1,
};

const THEME_META: Record<Theme, ThemeMeta> = {
  midnight: {
    label: "Midnight",
    description: "Stealthy neon cockpit",
    swatches: ["#6366f1", "#8b5cf6", "#22d3ee"],
  },
  aurora: {
    label: "Aurora",
    description: "Oceanic glow and glass",
    swatches: ["#22d3ee", "#2dd4bf", "#38bdf8"],
  },
  solstice: {
    label: "Solstice",
    description: "Warm ember atmosphere",
    swatches: ["#f97316", "#f43f5e", "#fb923c"],
  },
  light: {
    label: "Light",
    description: "Bright editorial workspace",
    swatches: ["#2563eb", "#0ea5e9", "#14b8a6"],
  },
};

const MENU_ITEMS: MenuItem[] = [
  { id: "text", label: "Text Chat", icon: <MessageSquare size={18} /> },
  { id: "code", label: "Code Assistant", icon: <Code size={18} /> },
  { id: "image", label: "Image Studio", icon: <ImageIcon size={18} /> },
  { id: "docs", label: "DocuMind", icon: <FileText size={18} /> },
];

const TAB_LOADING_LABEL: Record<TabId, string> = {
  text: "Loading Text Chat",
  code: "Loading Code Assistant",
  image: "Loading Image Studio",
  docs: "Loading DocuMind",
};

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "midnight";
  }

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "midnight" || savedTheme === "aurora" || savedTheme === "solstice" || savedTheme === "light") {
      return savedTheme;
    }
  } catch {
    return "midnight";
  }

  return "midnight";
};

const getInitialUiSettings = (): UiSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_UI_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_UI_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<UiSettings>;

    const performanceMode: PerformanceMode =
      parsed.performanceMode && PERFORMANCE_MODE_ORDER.includes(parsed.performanceMode)
        ? parsed.performanceMode
        : DEFAULT_UI_SETTINGS.performanceMode;

    const textureMode: TextureMode =
      parsed.textureMode && TEXTURE_MODE_ORDER.includes(parsed.textureMode)
        ? parsed.textureMode
        : DEFAULT_UI_SETTINGS.textureMode;

    const interactiveTexture =
      typeof parsed.interactiveTexture === "boolean"
        ? parsed.interactiveTexture
        : DEFAULT_UI_SETTINGS.interactiveTexture;

    return {
      performanceMode,
      textureMode,
      interactiveTexture,
    };
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
};

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
  uiSettings: UiSettings;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onUiSettingChange: (patch: Partial<UiSettings>) => void;
  onApplyPreset: (settings: UiSettings) => void;
  onResetUiSettings: () => void;
};

function TabLoadingState({ label }: { label: string }) {
  return (
    <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-4 text-[var(--muted-text)]">
      <NexusLoader />
      <p className="text-xs font-mono uppercase tracking-[0.2em]">{label}</p>
    </div>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "midnight") {
    return <Moon size={14} />;
  }

  if (theme === "aurora") {
    return <Sun size={14} />;
  }

  if (theme === "solstice") {
    return <Palette size={14} />;
  }

  return <Sparkles size={14} />;
}

function SidebarPanel({
  mobile = false,
  deviceType,
  activeTab,
  onTabClick,
  uiSettings,
  settingsOpen,
  onToggleSettings,
  onUiSettingChange,
  onApplyPreset,
  onResetUiSettings,
}: SidebarPanelProps) {
  const activePreset = UI_PRESETS.find((preset) => isSameUiSettings(uiSettings, preset.settings));

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-6 mb-2">
            <div
              className="relative flex items-center justify-center w-10 h-10 bg-[var(--surface-chip)] rounded-xl border border-[var(--border-subtle)]"
              style={{ boxShadow: "inset 0 0 10px color-mix(in srgb, var(--accent-primary) 20%, transparent)" }}
            >
          <NexusLoader />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[var(--app-text)] leading-none font-mono">NEXUS</h1>
          <p className="text-[10px] text-[var(--text-soft)] font-medium mt-1 tracking-widest uppercase">
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
              activeTab === item.id ? "text-[var(--app-text)]" : "text-[var(--text-muted)] hover:text-[var(--app-text)]"
            }`}
          >
            {activeTab === item.id && (
              <motion.div
                layoutId={mobile ? "activeTabMobile" : "activeTabDesktop"}
                   className="absolute inset-0 bg-[var(--surface-chip)] border border-[var(--border-subtle)] rounded-lg"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            <span className="relative z-10 group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
            <span className="relative z-10 text-sm font-medium tracking-wide">{item.label}</span>

            {activeTab === item.id && (
              <motion.div
                layoutId={mobile ? "activeIndicatorMobile" : "activeIndicatorDesktop"}
                className="absolute right-3 w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  boxShadow: "0 0 8px var(--accent-primary)",
                }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-[var(--border-subtle)]">
        <button
          onClick={onToggleSettings}
             className="flex items-center gap-3 w-full p-2 hover:bg-[var(--surface-chip-hover)] rounded-lg transition-colors group"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[var(--selection-text)] border border-[var(--border-subtle)]"
            style={{
              background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              boxShadow: "0 8px 18px color-mix(in srgb, var(--accent-primary) 35%, transparent)",
            }}
          >
            SP
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-medium text-[var(--app-text)] transition-colors">Shashwat Pandey</p>
            <p className="text-[10px] text-[var(--text-soft)] uppercase tracking-wider">ADAM</p>
          </div>
          <Settings
            size={16}
            className={`text-[var(--text-muted)] transition-all duration-300 ${settingsOpen ? "rotate-90 text-[var(--accent-primary)]" : "group-hover:rotate-90"}`}
          />
        </button>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 backdrop-blur-xl p-3 space-y-4 max-h-[min(56vh,460px)] overflow-y-auto overscroll-y-contain no-scrollbar"
            >
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">Preset Profiles</p>
                <div className="grid grid-cols-1 gap-2">
                  {UI_PRESETS.map((preset) => {
                    const active = activePreset?.id === preset.id;

                    return (
                      <button
                        key={preset.id}
                        onClick={() => onApplyPreset(preset.settings)}
                        className={`rounded-lg px-2 py-2 text-left border transition-colors ${
                          active
                            ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)]"
                            : "border-transparent text-[var(--text-muted)] bg-[var(--surface-chip)] hover:border-[var(--border-subtle)]"
                        }`}
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${active ? "text-[var(--app-text)]" : "text-[var(--text-muted)]"}`}>
                          {preset.label}
                        </p>
                        <p className="text-[10px] text-[var(--text-soft)] mt-0.5">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">Performance</p>
                <div className="grid grid-cols-3 gap-2">
                  {PERFORMANCE_MODE_ORDER.map((mode) => {
                    const active = uiSettings.performanceMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => onUiSettingChange({ performanceMode: mode })}
                        className={`rounded-lg px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide border transition-colors ${
                          active
                            ? "border-[var(--accent-primary)] text-[var(--app-text)] bg-[var(--surface-chip-hover)]"
                            : "border-transparent text-[var(--text-muted)] bg-[var(--surface-chip)] hover:border-[var(--border-subtle)]"
                        }`}
                      >
                        {PERFORMANCE_LABEL[mode]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[var(--text-soft)] flex items-center gap-1.5">
                  <Gauge size={11} />
                  {uiSettings.performanceMode === "smooth"
                    ? "Lowest animation load for weaker devices"
                    : uiSettings.performanceMode === "quality"
                      ? "Maximum visual richness"
                      : "Balanced smoothness and visuals"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">Texture Detail</p>
                <div className="grid grid-cols-3 gap-2">
                  {TEXTURE_MODE_ORDER.map((mode) => {
                    const active = uiSettings.textureMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => onUiSettingChange({ textureMode: mode })}
                        className={`rounded-lg px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide border transition-colors ${
                          active
                            ? "border-[var(--accent-secondary)] text-[var(--app-text)] bg-[var(--surface-chip-hover)]"
                            : "border-transparent text-[var(--text-muted)] bg-[var(--surface-chip)] hover:border-[var(--border-subtle)]"
                        }`}
                      >
                        {TEXTURE_LABEL[mode]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[var(--text-soft)] flex items-center gap-1.5">
                  <Layers3 size={11} />
                  Controls grid, lines, and depth texture strength
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-3 py-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--app-text)]">Interactive Texture</p>
                  <p className="text-[10px] text-[var(--text-soft)] flex items-center gap-1">
                    <MousePointer2 size={10} />
                    Subtle cursor parallax in background
                  </p>
                </div>
                <button
                  onClick={() => onUiSettingChange({ interactiveTexture: !uiSettings.interactiveTexture })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${uiSettings.interactiveTexture ? "bg-[var(--accent-primary)]" : "bg-[var(--surface-chip-hover)]"}`}
                  aria-label="Toggle interactive texture"
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${uiSettings.interactiveTexture ? "translate-x-[22px]" : "translate-x-[2px]"}`}
                  />
                </button>
              </div>

              <button
                onClick={onResetUiSettings}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] hover:bg-[var(--surface-chip-hover)] transition-colors"
              >
                Reset Performance Settings
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [uiSettings, setUiSettings] = useState<UiSettings>(getInitialUiSettings);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const pointerTargetRef = useRef({ x: 0.5, y: 0.5 });
  const lenisRef = useRef<Lenis | null>(null);
  const mainScrollWrapperRef = useRef<HTMLDivElement | null>(null);
  const mainScrollContentRef = useRef<HTMLDivElement | null>(null);
  const activePaneRef = useRef<HTMLDivElement | null>(null);
  const meshLayerRef = useRef<HTMLDivElement | null>(null);
  const onlineDotRef = useRef<HTMLSpanElement | null>(null);

  const isMobile = deviceType === "mobile";
  const activeLabel = useMemo(() => MENU_ITEMS.find((item) => item.id === activeTab)?.label ?? "Workspace", [activeTab]);
  const currentThemeLabel = THEME_META[theme].label;
  const performanceScale = PERFORMANCE_SCALE[uiSettings.performanceMode];
  const textureScale = TEXTURE_SCALE[uiSettings.textureMode];
  const interactiveScale = uiSettings.interactiveTexture ? performanceScale * textureScale : 0;

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings));
    } catch {
      // Ignore storage failures.
    }
  }, [uiSettings]);

  useEffect(() => {
    const root = document.documentElement;
    const styles = window.getComputedStyle(root);

    const gridBase = Number.parseFloat(styles.getPropertyValue("--texture-grid-opacity-base")) || 0.24;
    const linesBase = Number.parseFloat(styles.getPropertyValue("--texture-lines-opacity-base")) || 0.22;
    const noiseBase = Number.parseFloat(styles.getPropertyValue("--noise-opacity-base")) || 0.03;
    const interactiveBase = Number.parseFloat(styles.getPropertyValue("--interactive-opacity-base")) || 0.16;

    root.style.setProperty("--ui-grid-opacity", (gridBase * textureScale).toFixed(3));
    root.style.setProperty("--ui-lines-opacity", (linesBase * textureScale).toFixed(3));
    root.style.setProperty("--ui-noise-opacity", (noiseBase * (textureScale === 0 ? 0.45 : 1)).toFixed(3));
    root.style.setProperty("--ui-interactive-opacity", (interactiveBase * interactiveScale).toFixed(3));
  }, [theme, textureScale, interactiveScale]);

  useEffect(() => {
    const wrapper = mainScrollWrapperRef.current;
    const content = mainScrollContentRef.current;

    if (!wrapper || !content) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || uiSettings.performanceMode === "smooth") {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      return;
    }

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.06,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
      lerp: 0.1,
    });

    lenisRef.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };

    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      if (lenisRef.current === lenis) {
        lenisRef.current = null;
      }
    };
  }, [uiSettings.performanceMode]);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(0, { immediate: true });
      return;
    }

    mainScrollWrapperRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  useEffect(() => {
    const target = meshLayerRef.current;
    if (!target) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || uiSettings.performanceMode === "smooth") {
      return;
    }

    const tween = gsap.to(target, {
      opacity: 0.64,
      duration: 5.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    return () => {
      tween.kill();
      target.style.opacity = "0.52";
    };
  }, [theme, uiSettings.performanceMode]);

  useEffect(() => {
    const target = activePaneRef.current;
    if (!target) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || uiSettings.performanceMode === "smooth") {
      return;
    }

    const tween = gsap.fromTo(
      target,
      { y: 16, autoAlpha: 0, clipPath: "inset(0 0 6% 0 round 14px)" },
      {
        y: 0,
        autoAlpha: 1,
        clipPath: "inset(0 0 0% 0 round 14px)",
        duration: 0.45,
        ease: "power2.out",
      }
    );

    return () => {
      tween.kill();
      target.style.removeProperty("transform");
      target.style.removeProperty("opacity");
      target.style.removeProperty("visibility");
      target.style.removeProperty("clip-path");
    };
  }, [activeTab, uiSettings.performanceMode]);

  useEffect(() => {
    const target = onlineDotRef.current;
    if (!target) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || uiSettings.performanceMode === "smooth") {
      return;
    }

    const pulse = animate(target, {
      scale: [1, 1.35, 1],
      opacity: [0.84, 1, 0.84],
      duration: 1900,
      ease: "inOutSine",
      loop: true,
    });

    return () => {
      pulse.pause();
      target.style.removeProperty("transform");
      target.style.removeProperty("opacity");
    };
  }, [uiSettings.performanceMode]);

  useEffect(() => {
    const applyPointerVars = (x: number, y: number) => {
      const dx = x - 0.5;
      const dy = y - 0.5;

      document.documentElement.style.setProperty("--pointer-x", `${(x * 100).toFixed(2)}%`);
      document.documentElement.style.setProperty("--pointer-y", `${(y * 100).toFixed(2)}%`);
      document.documentElement.style.setProperty("--parallax-x", `${(dx * 8).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-y", `${(dy * 8).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-grid-x", `${(dx * 4).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-grid-y", `${(dy * 4).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-lines-x", `${(-dx * 3).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-lines-y", `${(-dy * 3).toFixed(2)}px`);
    };

    applyPointerVars(0.5, 0.5);

    return () => {
      if (pointerRafRef.current !== null) {
        window.cancelAnimationFrame(pointerRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!themeMenuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThemeMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [themeMenuOpen]);

  const handleTabClick = (tab: TabId) => {
    setActiveTab(tab);
    if (isMobile) {
      setSidebarOpen(false);
      setSettingsPanelOpen(false);
    }
  };

  const updateUiSetting = (patch: Partial<UiSettings>) => {
    setUiSettings((prev) => ({ ...prev, ...patch }));
  };

  const applyUiPreset = (settings: UiSettings) => {
    setUiSettings({ ...settings });
  };

  const resetUiSettings = () => {
    setUiSettings(DEFAULT_UI_SETTINGS);
  };

  const setThemeFromMenu = (value: Theme) => {
    setTheme(value);
    setThemeMenuOpen(false);
  };

  const schedulePointerUpdate = () => {
    if (pointerRafRef.current !== null) {
      return;
    }

    pointerRafRef.current = window.requestAnimationFrame(() => {
      pointerRafRef.current = null;

      const x = pointerTargetRef.current.x;
      const y = pointerTargetRef.current.y;
      const dx = x - 0.5;
      const dy = y - 0.5;

      const parallaxBase = 8 * interactiveScale;
      const gridBase = 4 * interactiveScale;
      const linesBase = 3 * interactiveScale;

      document.documentElement.style.setProperty("--pointer-x", `${(x * 100).toFixed(2)}%`);
      document.documentElement.style.setProperty("--pointer-y", `${(y * 100).toFixed(2)}%`);
      document.documentElement.style.setProperty("--parallax-x", `${(dx * parallaxBase).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-y", `${(dy * parallaxBase).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-grid-x", `${(dx * gridBase).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-grid-y", `${(dy * gridBase).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-lines-x", `${(-dx * linesBase).toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-lines-y", `${(-dy * linesBase).toFixed(2)}px`);
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      return;
    }

    if (interactiveScale <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    pointerTargetRef.current = { x, y };
    schedulePointerUpdate();
  };

  const handlePointerLeave = () => {
    pointerTargetRef.current = { x: 0.5, y: 0.5 };
    schedulePointerUpdate();
  };

  const tabFallback = <TabLoadingState label={TAB_LOADING_LABEL[activeTab]} />;

  return (
    <MotionConfig reducedMotion={uiSettings.performanceMode === "smooth" ? "always" : "never"}>
      <div
        className="flex h-[var(--app-height,100dvh)] w-full bg-[var(--app-bg)] text-[var(--app-text)] font-sans overflow-hidden relative"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
      
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div
           className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full blur-[150px] transition-transform duration-300 ease-out"
           style={{
             background: "var(--bg-orb-primary)",
             transform: "translate3d(calc(var(--parallax-x) * -0.4), calc(var(--parallax-y) * -0.4), 0)",
           }}
         />
         <div
           className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] transition-transform duration-300 ease-out"
           style={{
             background: "var(--bg-orb-secondary)",
             transform: "translate3d(calc(var(--parallax-x) * 0.35), calc(var(--parallax-y) * 0.35), 0)",
           }}
         />
         <div
           className="absolute top-[25%] left-[35%] w-[460px] h-[460px] rounded-full blur-[130px] transition-transform duration-300 ease-out"
           style={{
             background: "var(--bg-orb-tertiary)",
             transform: "translate3d(calc(var(--parallax-x) * 0.2), calc(var(--parallax-y) * 0.2), 0)",
           }}
         />
         <div
           className="absolute inset-0 transition-transform duration-300 ease-out"
           ref={meshLayerRef}
           style={{
             background: "var(--bg-gradient-mesh)",
             opacity: 0.52,
             transform: "translate3d(calc(var(--parallax-x) * 0.15), calc(var(--parallax-y) * 0.15), 0)",
           }}
         />
         <div
           className="absolute inset-0 transition-transform duration-300 ease-out"
           style={{
             background: "var(--interactive-highlight)",
             opacity: "var(--ui-interactive-opacity)",
             transform: "translate3d(var(--parallax-x), var(--parallax-y), 0)",
           }}
         ></div>
         <div
           className="absolute inset-0"
           style={{
             backgroundImage: "var(--texture-grid)",
             opacity: "var(--ui-grid-opacity)",
             backgroundPosition: "var(--parallax-grid-x) var(--parallax-grid-y)",
           }}
         ></div>
         <div
           className="absolute inset-0"
           style={{
             backgroundImage: "var(--texture-lines)",
             opacity: "var(--ui-lines-opacity)",
             backgroundPosition: "var(--parallax-lines-x) var(--parallax-lines-y)",
           }}
         ></div>
         <div className="absolute inset-0" style={{ background: "var(--vignette)" }}></div>
         <div className="absolute inset-0" style={{ opacity: "var(--ui-noise-opacity)", backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      </div>

      {!isMobile && (
        <aside className="w-72 relative z-10 bg-[var(--surface-elevated)] backdrop-blur-2xl border-r border-[var(--border-subtle)] flex flex-col p-4 shadow-2xl min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar">
          <SidebarPanel
            deviceType={deviceType}
            activeTab={activeTab}
            onTabClick={handleTabClick}
            uiSettings={uiSettings}
            settingsOpen={settingsPanelOpen}
            onToggleSettings={() => setSettingsPanelOpen((prev) => !prev)}
            onUiSettingChange={updateUiSetting}
            onApplyPreset={applyUiPreset}
            onResetUiSettings={resetUiSettings}
          />
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
                className="fixed inset-0 z-30 bg-[var(--surface-overlay)] backdrop-blur-sm"
                aria-label="Close menu overlay"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="fixed top-0 left-0 z-40 h-[var(--app-height,100dvh)] w-[85vw] max-w-[320px] bg-[var(--surface-elevated)] backdrop-blur-2xl border-r border-[var(--border-subtle)] flex flex-col p-4 shadow-2xl overflow-y-auto overscroll-y-contain no-scrollbar"
              >
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-[var(--surface-chip-hover)] text-[var(--text-muted)]"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>
                <SidebarPanel
                  mobile
                  deviceType={deviceType}
                  activeTab={activeTab}
                  onTabClick={handleTabClick}
                  uiSettings={uiSettings}
                  settingsOpen={settingsPanelOpen}
                  onToggleSettings={() => setSettingsPanelOpen((prev) => !prev)}
                  onUiSettingChange={updateUiSetting}
                  onApplyPreset={applyUiPreset}
                  onResetUiSettings={resetUiSettings}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      <main className="flex-1 min-h-0 overflow-hidden relative z-10 flex flex-col">
        <header className="sticky top-0 z-20 px-4 sm:px-8 py-3 sm:py-4 flex justify-between items-center bg-[var(--surface-overlay)] backdrop-blur-md border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-soft)] uppercase tracking-widest font-semibold font-mono">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="mr-2 p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--app-text)]"
                aria-label="Open navigation menu"
              >
                <Menu size={16} />
              </button>
            )}
            <Sparkles size={12} style={{ color: "var(--accent-primary)" }} />
            <span>Workspace</span>
            <span className="text-[var(--text-soft)]">/</span>
            <span className="text-[var(--app-text)] truncate max-w-[110px] sm:max-w-none">{activeLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setThemeMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-3 py-2 text-[10px] sm:text-xs uppercase tracking-wider text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors"
                aria-label="Open theme menu"
                title="Open theme menu"
              >
                <ThemeIcon theme={theme} />
                <span className="hidden sm:inline">{currentThemeLabel}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${themeMenuOpen ? "rotate-180" : "rotate-0"}`}
                />
              </button>

              <AnimatePresence>
                {themeMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[290px] rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-panel)]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-chip)]/60">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-soft)]">Theme Studio</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Choose the visual mood of your workspace.</p>
                    </div>

                    <div className="p-2">
                      {THEME_ORDER.map((themeOption) => {
                        const themeMeta = THEME_META[themeOption];
                        const isActive = theme === themeOption;

                        return (
                          <button
                            key={themeOption}
                            onClick={() => setThemeFromMenu(themeOption)}
                            className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-all border ${
                              isActive
                                ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)]"
                                : "border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-chip)]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--surface-chip)] text-[var(--app-text)] shrink-0">
                                <ThemeIcon theme={themeOption} />
                              </span>
                              <div className="text-left min-w-0">
                                <p className="text-sm font-semibold text-[var(--app-text)] truncate">{themeMeta.label}</p>
                                <p className="text-[11px] text-[var(--text-soft)] truncate">{themeMeta.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                {themeMeta.swatches.map((swatch) => (
                                  <span
                                    key={`${themeOption}-${swatch}`}
                                    className="w-2.5 h-2.5 rounded-full border border-[var(--border-strong)]"
                                    style={{ backgroundColor: swatch }}
                                  />
                                ))}
                              </div>
                              {isActive && <Check size={14} className="text-[var(--accent-primary)]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span ref={onlineDotRef} className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono text-emerald-500 tracking-wider">ONLINE</span>
          </div>
        </header>

        <div ref={mainScrollWrapperRef} className="w-full p-0 flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div ref={mainScrollContentRef} className="min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="w-full h-full min-h-0"
              >
                <div ref={activePaneRef} className="w-full h-full min-h-0">
                  {activeTab === "text" && (
                    <div className="p-3 sm:p-8 pb-20 max-w-5xl mx-auto h-full min-h-0">
                      <Suspense fallback={tabFallback}>
                        <TextGenerator />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === "code" && (
                    <div className="p-3 sm:p-8 pb-20 max-w-5xl mx-auto h-full min-h-0">
                      <Suspense fallback={tabFallback}>
                        <CodeGenerator />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === "image" && (
                    <div className="p-3 sm:p-8 pb-20 max-w-6xl mx-auto h-full min-h-0">
                      <Suspense fallback={tabFallback}>
                        <ImageGenerator />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === "docs" && (
                    <Suspense fallback={tabFallback}>
                      <DocumentSummarizer />
                    </Suspense>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
      </div>
    </MotionConfig>
  );
}

export default App;