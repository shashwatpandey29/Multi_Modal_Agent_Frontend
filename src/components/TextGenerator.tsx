import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { generateText, generateTextStream, getOpenRouterModels, setNovaMemoryMode } from "../api/api";
import { Send, User, Bot, Sparkles, Copy, Check, BrainCircuit, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NexusLoader from "./NexusLoader"; 
import AuraOrb from "./AuraOrb"; 
import type { OpenRouterModel, SessionMode, NovaMemorySnapshotResponse, ResponseLength } from "../types/api";
import type { MemoryGraphSelection } from "./NovaMemoryGraph";

const NovaMemoryGraph = lazy(() => import("./NovaMemoryGraph"));
const KnowledgeBridgePanel = lazy(() => import("./KnowledgeBridgePanel"));

type Message = {
    role: "user" | "ai";
    content: string;
};

const OPENROUTER_MODEL_STORAGE_KEY = "nexus-openrouter-model";
const CHAT_SESSION_STORAGE_KEY = "nova-chat-session-id";
const CHAT_SESSION_MODE_STORAGE_KEY = "nova-chat-session-mode";
const CHAT_RESPONSE_LENGTH_STORAGE_KEY = "nova-chat-response-length";

const getOrCreateChatSessionId = (): string => {
    if (typeof window === "undefined") {
        return "nova-default-session";
    }

    try {
        const existing = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
        if (existing) {
            return existing;
        }

        const generated =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `nova-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, generated);
        return generated;
    } catch {
        return "nova-default-session";
    }
};

const TextGenerator = () => {
    const [prompt, setPrompt] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [openRouterEnabled, setOpenRouterEnabled] = useState<boolean>(false);
    const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [modelLoading, setModelLoading] = useState<boolean>(false);
    const [modelError, setModelError] = useState<string>("");
    const [responseLength, setResponseLength] = useState<ResponseLength>(() => {
        if (typeof window === "undefined") {
            return "short";
        }

        try {
            const saved = (window.localStorage.getItem(CHAT_RESPONSE_LENGTH_STORAGE_KEY) || "").toLowerCase();
            if (saved === "long") {
                return "long";
            }
        } catch {
            // Ignore storage errors.
        }

        return "short";
    });
    const [sessionId] = useState<string>(getOrCreateChatSessionId);
    const [sessionMode, setSessionMode] = useState<SessionMode>(() => {
        if (typeof window === "undefined") {
            return "persistent";
        }

        try {
            const saved = (window.localStorage.getItem(CHAT_SESSION_MODE_STORAGE_KEY) || "").toLowerCase();
            if (saved === "volatile") {
                return "volatile";
            }
        } catch {
            // Ignore storage errors.
        }

        return "persistent";
    });
    const [memoryPanelOpen, setMemoryPanelOpen] = useState<boolean>(true);
    const [memorySnapshot, setMemorySnapshot] = useState<NovaMemorySnapshotResponse | null>(null);
    const [graphSelection, setGraphSelection] = useState<MemoryGraphSelection>({ nodeIds: [], edgeIds: [] });
    const [memoryRefreshSignal, setMemoryRefreshSignal] = useState<number>(0);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const streamAbortRef = useRef<AbortController | null>(null);
    const copyResetTimerRef = useRef<number | null>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        return () => {
            if (streamAbortRef.current) {
                streamAbortRef.current.abort();
            }

            if (copyResetTimerRef.current !== null) {
                window.clearTimeout(copyResetTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(CHAT_SESSION_MODE_STORAGE_KEY, sessionMode);
        } catch {
            // Ignore storage failures.
        }
    }, [sessionMode]);

    useEffect(() => {
        try {
            window.localStorage.setItem(CHAT_RESPONSE_LENGTH_STORAGE_KEY, responseLength);
        } catch {
            // Ignore storage failures.
        }
    }, [responseLength]);

    useEffect(() => {
        let active = true;

        const syncMode = async () => {
            try {
                await setNovaMemoryMode(sessionId, sessionMode);
            } catch {
                // Best-effort mode sync; request payload still carries session mode.
            }
        };

        if (active) {
            void syncMode();
        }

        return () => {
            active = false;
        };
    }, [sessionId, sessionMode]);

    const handleCopyMessage = async (content: string, index: number) => {
        if (!content.trim()) {
            return;
        }

        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageIndex(index);

            if (copyResetTimerRef.current !== null) {
                window.clearTimeout(copyResetTimerRef.current);
            }

            copyResetTimerRef.current = window.setTimeout(() => {
                setCopiedMessageIndex(null);
            }, 1600);
        } catch {
            // Clipboard may be blocked; fail silently.
        }
    };

    const updateLatestAiMessage = (content: string) => {
        setMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === "ai") {
                    next[i] = { ...next[i], content };
                    break;
                }
            }
            return next;
        });
    };

    const appendLatestAiMessage = (chunk: string) => {
        if (!chunk) {
            return;
        }

        setMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === "ai") {
                    next[i] = { ...next[i], content: `${next[i].content}${chunk}` };
                    break;
                }
            }
            return next;
        });
    };

    useEffect(() => {
        let active = true;

        const fetchOpenRouterModels = async () => {
            setModelLoading(true);
            setModelError("");

            try {
                const response = await getOpenRouterModels();

                if (!active) {
                    return;
                }

                const models = response.models || [];
                setOpenRouterEnabled(response.enabled);
                setAvailableModels(models);

                if (!response.enabled || models.length === 0) {
                    setSelectedModel("");
                    return;
                }

                let savedModel = "";
                try {
                    savedModel = window.localStorage.getItem(OPENROUTER_MODEL_STORAGE_KEY) || "";
                } catch {
                    savedModel = "";
                }

                const initialModel =
                    models.find((model) => model.id === savedModel)?.id ||
                    models.find((model) => model.id === response.default_model)?.id ||
                    models[0].id;

                setSelectedModel(initialModel);
            } catch (error) {
                if (!active) {
                    return;
                }

                const message = error instanceof Error ? error.message : "OpenRouter model list unavailable";
                setModelError(message);
                setOpenRouterEnabled(false);
                setAvailableModels([]);
                setSelectedModel("");
            } finally {
                if (active) {
                    setModelLoading(false);
                }
            }
        };

        fetchOpenRouterModels();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedModel || !openRouterEnabled) {
            return;
        }

        try {
            window.localStorage.setItem(OPENROUTER_MODEL_STORAGE_KEY, selectedModel);
        } catch {
            // Ignore storage failures.
        }
    }, [selectedModel, openRouterEnabled]);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        
        const userMessage = prompt;
        setPrompt(""); 
        
        if (textareaRef.current) {
            textareaRef.current.style.height = "56px";
        }

        setMessages((prev) => [
            ...prev,
            { role: "user", content: userMessage },
            { role: "ai", content: "" },
        ]);
        setLoading(true);

        const controller = new AbortController();
        streamAbortRef.current = controller;

        try {
            await generateTextStream(
                {
                    prompt: userMessage,
                    model: openRouterEnabled && selectedModel ? selectedModel : undefined,
                    session_id: sessionId,
                    session_mode: sessionMode,
                    response_length: responseLength,
                },
                {
                    onChunk: appendLatestAiMessage,
                    onError: (message) => {
                        throw new Error(message);
                    },
                },
                controller.signal
            );
        } catch {
            if (!controller.signal.aborted) {
                try {
                    const fallback = await generateText({
                        prompt: userMessage,
                        model: openRouterEnabled && selectedModel ? selectedModel : undefined,
                        session_id: sessionId,
                        session_mode: sessionMode,
                        response_length: responseLength,
                    });
                    updateLatestAiMessage(fallback.response || "Sorry, I encountered an error.");
                } catch {
                    updateLatestAiMessage("Sorry, I encountered an error.");
                }
            }
        } finally {
            if (streamAbortRef.current === controller) {
                streamAbortRef.current = null;
            }
            setLoading(false);
        }
    };

    const selectedModelLabel = availableModels.find((model) => model.id === selectedModel)?.name || selectedModel;
    const latestAiMessage = [...messages].reverse().find((message) => message.role === "ai");
    const showThinkingIndicator = loading && (!latestAiMessage || latestAiMessage.content.trim().length === 0);
    const compactSessionId = sessionId.length > 14 ? `${sessionId.slice(0, 6)}...${sessionId.slice(-4)}` : sessionId;
    const sessionModeLabel = sessionMode === "volatile" ? "Incognito" : "Persistent";

    return (
        <div className="flex flex-col h-full min-h-0 max-w-4xl mx-auto">
            {/* Empty State / Welcome Screen */}
            {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 px-3 sm:px-0">
                    <div className="mb-4 flex justify-center scale-125">
                        <AuraOrb />
                    </div>
                    <div className="space-y-2">
                        <h2
                            className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text"
                            style={{
                                backgroundImage:
                                    "linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 76%, var(--app-text) 24%), color-mix(in srgb, var(--accent-secondary) 76%, var(--app-text) 24%))",
                            }}
                        >
                            How can I help you today master?
                        </h2>
                        <p className="text-[var(--text-muted)] font-medium">Powered by NOVA</p>
                        {openRouterEnabled && selectedModelLabel && (
                            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">
                                Model: <span className="text-[var(--app-text)]">{selectedModelLabel}</span>
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="mb-2 sm:mb-3 px-1 sm:px-2">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/65 backdrop-blur-xl p-2 sm:p-3">
                    <button
                        onClick={() => setMemoryPanelOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between gap-2 px-1 py-1.5 text-left"
                        type="button"
                    >
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">NOVA Brain</p>
                            <p className="text-sm font-semibold text-[var(--app-text)] flex items-center gap-2 mt-1">
                                <BrainCircuit size={15} className="text-[var(--accent-primary)]" />
                                Animated Graph Memory
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="hidden sm:inline-flex text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)] bg-[var(--surface-chip)] border border-[var(--border-subtle)] rounded-md px-2 py-1">
                                Session {compactSessionId} • {sessionModeLabel}
                            </span>
                            <ChevronDown
                                size={14}
                                className={`text-[var(--text-muted)] transition-transform duration-200 ${memoryPanelOpen ? "rotate-180" : "rotate-0"}`}
                            />
                        </div>
                    </button>

                    <AnimatePresence initial={false}>
                        {memoryPanelOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -4, height: 0 }}
                                transition={{ duration: 0.24, ease: "easeOut" }}
                                className="overflow-hidden"
                            >
                                <div className="pt-2">
                                    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Session mode</p>
                                        <div className="ml-auto inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setSessionMode("persistent")}
                                                className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                                                    sessionMode === "persistent"
                                                        ? "bg-[var(--accent-primary)] text-white"
                                                        : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                                                }`}
                                            >
                                                Persistent
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSessionMode("volatile")}
                                                className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                                                    sessionMode === "volatile"
                                                        ? "bg-[var(--accent-primary)] text-white"
                                                        : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                                                }`}
                                            >
                                                Incognito
                                            </button>
                                        </div>
                                    </div>

                                    <Suspense
                                        fallback={
                                            <div className="h-32 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                                                Initializing NOVA 3D memory graph...
                                            </div>
                                        }
                                    >
                                        <NovaMemoryGraph
                                            sessionId={sessionId}
                                            sessionMode={sessionMode}
                                            refreshSignal={memoryRefreshSignal}
                                            onSelectionChange={setGraphSelection}
                                            onSnapshotLoaded={setMemorySnapshot}
                                        />
                                    </Suspense>

                                    <Suspense
                                        fallback={
                                            <div className="h-24 mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                                                Preparing bridge workflow...
                                            </div>
                                        }
                                    >
                                        <KnowledgeBridgePanel
                                            sessionId={sessionId}
                                            sessionMode={sessionMode}
                                            snapshot={memorySnapshot}
                                            graphSelection={graphSelection}
                                            onBridgeImported={() => setMemoryRefreshSignal((previous) => previous + 1)}
                                        />
                                    </Suspense>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Chat History */}
            <div className={`flex-1 overflow-y-auto space-y-4 sm:space-y-6 py-4 sm:py-6 px-1 sm:px-2 ${messages.length > 0 ? "block" : "hidden"}`}>
                <AnimatePresence>
                    {messages.map((msg, index) => (
                        <motion.div 
                            key={index}
                            initial={{ opacity: 0, y: msg.role === "user" ? 16 : 10, scale: 0.985, filter: "blur(6px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            transition={{ type: "spring", stiffness: 230, damping: 24, mass: 0.7 }}
                            className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            {/* AI Icon */}
                            {msg.role === "ai" && (
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1"
                                    style={{ backgroundColor: "var(--accent-primary)" }}
                                >
                                    <Bot size={18} className="text-white" />
                                </div>
                            )}

                            {/* Message Bubble */}
                            {msg.role === "ai" ? (
                                <div className="relative max-w-[92%] sm:max-w-[85%] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-3 sm:p-4 leading-relaxed overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-md">
                                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--surface-chip-hover)] via-transparent to-transparent opacity-80" />

                                    <div className="relative">
                                        <div className="mb-3 pb-2 border-b border-[var(--border-subtle)]/80 flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">
                                                <Sparkles size={12} className="text-[var(--accent-primary)]" />
                                                {openRouterEnabled && selectedModelLabel ? selectedModelLabel : "NOVA response"}
                                            </span>

                                            <button
                                                onClick={() => handleCopyMessage(msg.content, index)}
                                                disabled={!msg.content.trim()}
                                                className="p-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={copiedMessageIndex === index ? "Copied" : "Copy response"}
                                                aria-label="Copy response text"
                                            >
                                                {copiedMessageIndex === index ? <Check size={13} /> : <Copy size={13} />}
                                            </button>
                                        </div>

                                        <div className="markdown-container max-w-none text-sm sm:text-[15px] leading-7 text-[var(--app-text)] space-y-4">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: (props) => <p className="my-3 first:mt-0 last:mb-0 text-[var(--app-text)]/95" {...props} />,
                                                    a: (props) => (
                                                        <a
                                                            className="text-[var(--accent-tertiary)] underline decoration-dotted underline-offset-4 hover:decoration-solid"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            {...props}
                                                        />
                                                    ),
                                                    table: (props) => (
                                                        <div className="overflow-x-auto my-4 border border-[var(--border-subtle)] rounded-lg">
                                                            <table className="min-w-full divide-y divide-[var(--border-subtle)] bg-[var(--surface-chip)]" {...props} />
                                                        </div>
                                                    ),
                                                    th: (props) => (
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-[var(--accent-tertiary)] uppercase tracking-wider bg-[var(--surface-chip-hover)] border-b border-[var(--border-subtle)]" {...props} />
                                                    ),
                                                    td: (props) => (
                                                        <td className="px-4 py-3 text-sm text-[var(--text-muted)] border-b border-[var(--border-subtle)] last:border-0" {...props} />
                                                    ),
                                                    h1: (props) => <h1 className="text-2xl font-bold text-[var(--app-text)] mt-6 mb-4 pb-2 border-b border-[var(--border-subtle)]" {...props} />,
                                                    h2: (props) => <h2 className="text-xl font-bold text-[var(--app-text)] mt-6 mb-3" {...props} />,
                                                    h3: (props) => <h3 className="text-lg font-bold text-[var(--accent-tertiary)] mt-4 mb-2" {...props} />,
                                                    strong: (props) => <strong className="font-semibold text-[var(--app-text)]" {...props} />,
                                                    blockquote: (props) => (
                                                        <blockquote className="border-l-4 border-[var(--accent-primary)] pl-4 italic text-[var(--text-muted)] my-4 bg-[var(--surface-chip)]/75 py-2 pr-2 rounded-r" {...props} />
                                                    ),
                                                    ul: (props) => <ul className="list-disc list-inside space-y-1 my-2 marker:text-[var(--accent-primary)]" {...props} />,
                                                    ol: (props) => <ol className="list-decimal list-inside space-y-1 my-2 marker:text-[var(--accent-primary)]" {...props} />,
                                                    li: (props) => <li className="leading-7" {...props} />,
                                                    hr: (props) => <hr className="my-4 border-[var(--border-subtle)]" {...props} />,
                                                    pre: (props) => (
                                                        <pre
                                                            className="my-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] p-3 text-xs leading-6"
                                                            {...props}
                                                        />
                                                    ),
                                                    code: (props) => (
                                                        <code className="bg-[var(--surface-chip)] px-1.5 py-0.5 rounded text-[var(--accent-secondary)] font-mono text-xs" {...props} />
                                                    ),
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>

                                            {loading && index === messages.length - 1 && (
                                                <span className="inline-block h-4 w-[2px] rounded-full bg-[var(--accent-primary)] align-middle animate-pulse" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-white bg-[var(--surface-user-bubble)] border border-[var(--border-subtle)] shadow-sm">
                                    <p className="whitespace-pre-wrap text-sm sm:text-[15px] leading-7">{msg.content}</p>
                                </div>
                            )}

                            {/* User Icon */}
                            {msg.role === "user" && (
                                <div className="w-8 h-8 rounded-lg bg-[var(--surface-user-bubble)] flex items-center justify-center shrink-0 mt-1 border border-[var(--border-subtle)]">
                                    <User size={18} className="text-white" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {/* Thinking State */}
                {showThinkingIndicator && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex w-fit gap-3 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/65 px-3 py-2"
                    >
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                             <NexusLoader />
                        </div>
                        <span className="text-[var(--text-muted)] text-sm font-medium animate-pulse">
                            Thinking...
                        </span>
                    </motion.div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* --- UPGRADED INPUT BAR --- */}
            <div className="sticky bottom-0 bg-[var(--surface-overlay)] pt-3 sm:pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:pb-6 px-1 sm:px-4">
                {openRouterEnabled && (
                    <div className="max-w-4xl mx-auto mb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 px-3 py-2 text-[10px] sm:text-xs backdrop-blur-md">
                            <span className="uppercase tracking-[0.14em] text-[var(--text-soft)] shrink-0">OpenRouter Free Model</span>
                            <div className="relative w-full sm:ml-auto sm:w-auto sm:min-w-[260px]">
                                <select
                                    value={selectedModel}
                                    onChange={(event) => setSelectedModel(event.target.value)}
                                    disabled={modelLoading || loading || availableModels.length === 0}
                                    className="nova-select w-full bg-[var(--surface-chip)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5 pr-8 text-[var(--app-text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-60"
                                >
                                    {availableModels.length === 0 ? (
                                        <option value="">{modelLoading ? "Loading models..." : "No models available"}</option>
                                    ) : (
                                        availableModels.map((model) => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                                {model.context_length ? ` (${Math.round(model.context_length / 1000)}k)` : ""}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <ChevronDown
                                    size={13}
                                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {modelError && (
                    <p className="max-w-4xl mx-auto mb-2 px-1 text-[11px] text-red-300/90">
                        OpenRouter models unavailable right now: {modelError}
                    </p>
                )}

                <div className="max-w-4xl mx-auto mb-2">
                    <div className="inline-flex w-full sm:w-auto items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 backdrop-blur-md overflow-hidden">
                        <span className="px-3 py-2 text-[10px] sm:text-xs uppercase tracking-[0.14em] text-[var(--text-soft)] border-r border-[var(--border-subtle)]">
                            Response Depth
                        </span>
                        <button
                            type="button"
                            onClick={() => setResponseLength("short")}
                            className={`px-3 py-2 text-[10px] sm:text-xs uppercase tracking-[0.12em] transition-colors ${
                                responseLength === "short"
                                    ? "bg-[var(--accent-primary)] text-white"
                                    : "bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                            }`}
                        >
                            Short
                        </button>
                        <button
                            type="button"
                            onClick={() => setResponseLength("long")}
                            className={`px-3 py-2 text-[10px] sm:text-xs uppercase tracking-[0.12em] transition-colors border-l border-[var(--border-subtle)] ${
                                responseLength === "long"
                                    ? "bg-[var(--accent-primary)] text-white"
                                    : "bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                            }`}
                        >
                            Long
                        </button>
                    </div>
                    <p className="mt-1 px-1 text-[10px] text-[var(--text-soft)] uppercase tracking-[0.08em]">
                        {responseLength === "long" ? "Detailed and comprehensive answers enabled" : "Concise answers enabled"}
                    </p>
                </div>

                <div className="max-w-4xl mx-auto relative group">
                    
                    {/* 1. The Gradient Glow Effect (Visible on Focus) */}
                    <div
                        className="absolute -inset-0.5 rounded-2xl opacity-0 group-focus-within:opacity-30 transition duration-500 blur-lg"
                        style={{ background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))" }}
                    ></div>
                    
                    {/* 2. Main Input Container */}
                    <div className="relative bg-[var(--surface-panel)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl flex items-end shadow-2xl transition-all">

                        <textarea
                            ref={textareaRef}
                            rows={1}
                            className="w-full px-4 py-4 bg-transparent resize-none focus:outline-none placeholder-[var(--placeholder)] text-[var(--app-text)] max-h-48 overflow-y-auto leading-relaxed scrollbar-hide"
                            placeholder={sessionMode === "volatile" ? "Ask privately in incognito mode..." : "Message NOVA AI..."}
                            value={prompt}
                            onChange={(e) => {
                                setPrompt(e.target.value);
                                // Auto-grow height logic
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                            style={{ minHeight: '56px' }}
                        />

                        {/* Send Button with Animation */}
                        <div className="p-2">
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !prompt.trim()}
                                className={`
                                    p-3 rounded-xl transition-all duration-300 flex items-center justify-center
                                    ${prompt.trim() 
                                        ? "bg-[var(--accent-primary)] hover:brightness-110 text-white shadow-lg rotate-0 scale-100" 
                                        : "bg-[var(--surface-chip)] text-[var(--text-soft)] cursor-not-allowed rotate-90 scale-90 opacity-50"
                                    }
                                `}
                            >
                                <Send size={18} className={prompt.trim() ? "translate-x-0.5 translate-y-0.5" : ""} />
                            </button>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--text-soft)] px-1">
                        <span>{sessionMode === "volatile" ? "Incognito mode active" : "Persistent memory active"}</span>
                        <span>Enter to send • Shift+Enter for newline</span>
                    </div>
                </div>
            </div>
            {/* --------------------------- */}
        </div>
    );
};

export default TextGenerator;