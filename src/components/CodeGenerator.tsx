import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { executeCode, generateText } from "../api/api";
import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  TerminalSquare,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CodeExecutionResponse } from "../types/api";

type CompilerLanguage = "javascript" | "python" | "sql" | "java" | "c" | "cpp" | "rust" | "go";
type MobileView = "editor" | "output" | "assistant";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type LanguageOption = {
  id: CompilerLanguage;
  label: string;
  judge0Id: number;
  extension: string;
  starter: string;
};

const MONACO_LANGUAGE_BY_COMPILER_LANGUAGE: Record<CompilerLanguage, string> = {
  javascript: "javascript",
  python: "python",
  sql: "sql",
  java: "java",
  c: "c",
  cpp: "cpp",
  rust: "rust",
  go: "go",
};

const CODE_STORAGE_PREFIX = "nova-compiler-code";

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: "javascript",
    label: "JavaScript",
    judge0Id: 63,
    extension: "js",
    starter: "const nums = [1, 2, 3, 4];\nconst squared = nums.map((n) => n * n);\nconsole.log(squared.join(', '));",
  },
  {
    id: "python",
    label: "Python",
    judge0Id: 71,
    extension: "py",
    starter: "nums = [1, 2, 3, 4]\nsquared = [n * n for n in nums]\nprint(', '.join(str(n) for n in squared))",
  },
  {
    id: "sql",
    label: "SQL",
    judge0Id: 82,
    extension: "sql",
    starter: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO users (name) VALUES ('Alice'), ('Bob');\nSELECT * FROM users;",
  },
  {
    id: "java",
    label: "Java",
    judge0Id: 62,
    extension: "java",
    starter: "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from Java\");\n  }\n}",
  },
  {
    id: "c",
    label: "C",
    judge0Id: 50,
    extension: "c",
    starter: "#include <stdio.h>\n\nint main(void) {\n  printf(\"Hello from C\\n\");\n  return 0;\n}",
  },
  {
    id: "cpp",
    label: "C++",
    judge0Id: 54,
    extension: "cpp",
    starter: "#include <iostream>\n\nint main() {\n  std::cout << \"Hello from C++\\n\";\n  return 0;\n}",
  },
  {
    id: "rust",
    label: "Rust",
    judge0Id: 73,
    extension: "rs",
    starter: "fn main() {\n    println!(\"Hello from Rust\");\n}",
  },
  {
    id: "go",
    label: "Go",
    judge0Id: 60,
    extension: "go",
    starter: "package main\n\nimport \"fmt\"\n\nfunc main() {\n  fmt.Println(\"Hello from Go\")\n}",
  },
];

const QUICK_ACTIONS = [
  "Explain this code in simple terms and suggest one practical improvement.",
  "Fix issues in this code and return the full corrected code.",
  "Optimize this code for readability and performance and return full code.",
  "Generate test cases for this code and include how to run them.",
];

const createId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const encodeBase64Utf8 = (value: string): string => {
  try {
    return window.btoa(unescape(encodeURIComponent(value)));
  } catch {
    return window.btoa(value);
  }
};

const extractCodeBlock = (content: string): string | null => {
  const match = content.match(/```[a-zA-Z0-9+]*\n([\s\S]*?)```/);
  if (!match || !match[1]) {
    return null;
  }
  return match[1].trim();
};

const trimCodeForPrompt = (code: string): string => {
  if (code.length <= 7000) {
    return code;
  }
  return `${code.slice(0, 3600)}\n\n/* ... truncated for token budget ... */\n\n${code.slice(-2600)}`;
};

const isLikelyMarkdown = (value: string): boolean => {
  const text = value || "";
  return /```|`[^`]+`|^\s*[-*+]\s+|^\s*\d+\.\s+|^\s*>\s+|^\s*#{1,6}\s+|\|[^\n]+\|/m.test(text);
};

const CodeGenerator = () => {
  const [activeLanguage, setActiveLanguage] = useState<CompilerLanguage>("javascript");
  const [code, setCode] = useState<string>(LANGUAGE_OPTIONS[0].starter);
  const [stdin, setStdin] = useState<string>("");
  const [runResult, setRunResult] = useState<CodeExecutionResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [assistantPrompt, setAssistantPrompt] = useState<string>("");
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const [assistantLoading, setAssistantLoading] = useState<boolean>(false);
  const [assistantStatus, setAssistantStatus] = useState<string>("");
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null);

  const [mobileView, setMobileView] = useState<MobileView>("editor");

  const monacoEditorRef = useRef<{ focus: () => void } | null>(null);
  const assistantBottomRef = useRef<HTMLDivElement>(null);

  const selectedLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.id === activeLanguage) || LANGUAGE_OPTIONS[0],
    [activeLanguage]
  );
  const monacoLanguage = useMemo(() => MONACO_LANGUAGE_BY_COMPILER_LANGUAGE[activeLanguage], [activeLanguage]);

  const storageKey = useMemo(() => `${CODE_STORAGE_PREFIX}-${activeLanguage}`, [activeLanguage]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        setCode(saved);
        return;
      }
    } catch {
      // Ignore storage read failures.
    }

    setCode(selectedLanguage.starter);
  }, [selectedLanguage.starter, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, code);
    } catch {
      // Ignore storage write failures.
    }
  }, [code, storageKey]);

  useEffect(() => {
    assistantBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantLoading, assistantMessages]);

  const handleRun = async () => {
    if (!code.trim()) {
      return;
    }

    setIsRunning(true);

    try {
      const response = await executeCode({
        language_id: selectedLanguage.judge0Id,
        source_code: encodeBase64Utf8(code),
        stdin,
        cpu_time_limit: 10,
        memory_limit: 128000,
      });

      setRunResult(response);
      setMobileView("output");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed. Please try again.";
      setRunResult({
        provider: "local",
        stdout: "",
        stderr: message,
        exitCode: 1,
        timeMs: 0,
      });
      setMobileView("output");
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(selectedLanguage.starter);
    setRunResult(null);
    setAssistantStatus("Restored starter template.");
    setAppliedMessageId(null);
    monacoEditorRef.current?.focus();
  };

  const copyCode = async () => {
    if (!code.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  };

  const askAssistant = async (incomingPrompt?: string) => {
    const finalPrompt = (incomingPrompt ?? assistantPrompt).trim();
    if (!finalPrompt || assistantLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: finalPrompt,
    };

    setAssistantMessages((prev) => [...prev, userMessage]);
    setAssistantPrompt("");
    setAssistantLoading(true);
    setAssistantStatus("");

    const contextualError = runResult?.stderr?.trim()
      ? `Latest compiler/runtime error:\n${runResult.stderr.slice(0, 2000)}\n\n`
      : "";

    const compiledPrompt = [
      `You are an expert ${selectedLanguage.label} coding assistant in a multi-language web compiler.`,
      "Return concise markdown.",
      "When code changes are needed, include exactly one fenced code block with the full updated code.",
      "",
      `User request: ${finalPrompt}`,
      "",
      contextualError,
      `Current ${selectedLanguage.label} code:`,
      trimCodeForPrompt(code),
    ].join("\n");

    try {
      const response = await generateText({
        prompt: compiledPrompt,
        session_id: "nova-code-assistant",
        session_mode: "volatile",
      });
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: response.response || "No response returned.",
      };

      setAssistantMessages((prev) => [...prev, assistantMessage]);
      setAssistantStatus("AI response ready.");
      setMobileView("assistant");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI assistant unavailable right now.";
      setAssistantMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: `Error: ${message}`,
        },
      ]);
      setAssistantStatus(message);
    } finally {
      setAssistantLoading(false);
    }
  };

  const applyAssistantCode = (message: ChatMessage) => {
    const extracted = extractCodeBlock(message.content);
    if (!extracted) {
      setAssistantStatus("No fenced code block found in this response.");
      return;
    }

    setCode(extracted);
    setAppliedMessageId(message.id);
    setAssistantStatus("Applied AI code to editor.");
    setMobileView("editor");
  };

  const resultSummary = runResult
    ? `Exit ${runResult.exitCode} • ${Math.round(runResult.timeMs)}ms${runResult.memoryKb ? ` • ${runResult.memoryKb}kb` : ""}`
    : "";

  const inputRelatedRuntimeError = runResult?.stderr
    ? /(eoferror|nosuchelementexception|inputmismatchexception|scanner|end of file|stdin)/i.test(runResult.stderr)
    : false;

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/90 p-3 sm:p-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-1.5 min-w-[220px]">
            <Code2 size={14} className="text-[var(--accent-tertiary)]" />
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Language</span>
            <div className="relative flex-1 min-w-[130px]">
              <select
                value={activeLanguage}
                onChange={(event) => {
                  setActiveLanguage(event.target.value as CompilerLanguage);
                  setRunResult(null);
                }}
                className="nova-select w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-1 text-xs sm:text-sm text-[var(--app-text)] pr-7 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs sm:text-sm font-medium text-white disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? "Running" : "Run"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-3 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--app-text)]"
          >
            <RefreshCw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={() => void copyCode()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-3 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--app-text)]"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">
          {selectedLanguage.label} compiler
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("editor")}
          className={`rounded-lg px-2.5 py-2 text-xs uppercase tracking-[0.1em] border ${
            mobileView === "editor"
              ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
              : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileView("output")}
          className={`rounded-lg px-2.5 py-2 text-xs uppercase tracking-[0.1em] border ${
            mobileView === "output"
              ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
              : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
          }`}
        >
          Output
        </button>
        <button
          type="button"
          onClick={() => setMobileView("assistant")}
          className={`rounded-lg px-2.5 py-2 text-xs uppercase tracking-[0.1em] border ${
            mobileView === "assistant"
              ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
              : "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-soft)]"
          }`}
        >
          AI Help
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6 min-h-0">
        <div className="space-y-4 sm:space-y-5 min-h-0">
          <section
            className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 shadow-xl overflow-hidden ${
              mobileView === "editor" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-chip)]/70">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]">editor.{selectedLanguage.extension}</span>
              <span className="text-[11px] text-[var(--text-soft)]">{code.split("\n").length} lines</span>
            </div>

            <div className="h-[320px] sm:h-[420px] lg:h-[440px] bg-[var(--surface-input)]">
              <Editor
                height="100%"
                language={monacoLanguage}
                value={code}
                onChange={(value) => setCode(value ?? "")}
                onMount={(editor) => {
                  monacoEditorRef.current = editor;
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  wordWrap: "off",
                  smoothScrolling: true,
                  padding: { top: 14, bottom: 14 },
                }}
              />
            </div>
          </section>

          <section
            className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 shadow-xl overflow-hidden ${
              mobileView === "output" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-chip)]/70">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]">
                <TerminalSquare size={13} />
                Runtime Output
              </span>
              <span className="text-[11px] text-[var(--text-soft)]">{resultSummary || "Idle"}</span>
            </div>

            <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-chip)]/35 space-y-2.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Program Input (stdin)</label>
              <textarea
                value={stdin}
                onChange={(event) => setStdin(event.target.value)}
                className="w-full h-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-xs sm:text-sm font-mono text-[var(--app-text)] outline-none"
                placeholder="Enter input values used by your code (example: 5 7 or one value per line)"
              />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-[11px] text-[var(--text-soft)]">
                  Works for Python input(), Java Scanner, C/C++ stdin, and similar runtime input.
                </p>

                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning || !code.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs sm:text-sm font-medium text-white disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {isRunning ? "Running" : "Run With Input"}
                </button>
              </div>

              <p className="text-[11px] text-[var(--text-soft)]">
                Enter all input values before running. This runtime executes in one shot and does not support live prompt-by-prompt typing.
              </p>

              {inputRelatedRuntimeError ? (
                <p className="text-[11px] text-amber-300">
                  Your last run looks input-related. Update stdin above and run again.
                </p>
              ) : null}
            </div>

            {runResult ? (
              <div className="p-3 sm:p-4 space-y-3">
                {runResult.stdout ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-300 mb-1">stdout</p>
                    <pre className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] p-3 text-xs sm:text-sm text-[var(--app-text)] whitespace-pre-wrap break-words">{runResult.stdout}</pre>
                  </div>
                ) : null}

                {runResult.stderr ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-rose-300 mb-1">stderr</p>
                    <pre className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs sm:text-sm text-rose-100 whitespace-pre-wrap break-words">{runResult.stderr}</pre>
                  </div>
                ) : null}

                {!runResult.stdout && !runResult.stderr ? (
                  <p className="text-sm text-[var(--text-muted)]">Execution finished with no output.</p>
                ) : null}
              </div>
            ) : (
              <div className="p-5 sm:p-6 text-sm text-[var(--text-muted)]">Add optional stdin above, then run your code to see compiler/runtime output.</div>
            )}
          </section>
        </div>

        <aside
          className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/90 shadow-xl overflow-hidden min-h-[420px] flex-col ${
            mobileView === "assistant" ? "flex" : "hidden"
          } lg:flex`}
        >
          <div className="px-3 sm:px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-chip)]/70">
            <p className="text-sm font-semibold text-[var(--app-text)] inline-flex items-center gap-2">
              <Bot size={15} className="text-[var(--accent-primary)]" />
              AI Coding Assistant
            </p>
            <p className="text-[11px] text-[var(--text-soft)] mt-1">Language-aware helper for {selectedLanguage.label}</p>
          </div>

          <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-chip)]/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => void askAssistant(action)}
                disabled={assistantLoading}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2.5 py-2 text-[11px] text-left text-[var(--text-muted)] hover:text-[var(--app-text)] disabled:opacity-55"
              >
                {action}
              </button>
            ))}
          </div>

          {assistantStatus ? (
            <p className="px-3 sm:px-4 py-2 text-[11px] text-[var(--accent-tertiary)] border-b border-[var(--border-subtle)]">{assistantStatus}</p>
          ) : null}

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[var(--surface-input)]/50">
            <AnimatePresence>
              {assistantMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" ? (
                    <span className="mt-1 h-7 w-7 shrink-0 rounded-md bg-[var(--accent-primary)]/20 border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center">
                      <Bot size={13} />
                    </span>
                  ) : null}

                  <div
                    className={`max-w-[88%] rounded-xl border px-3 py-2 text-xs sm:text-sm ${
                      message.role === "assistant"
                        ? "border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--app-text)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-user-bubble)] text-white"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-2">
                        {isLikelyMarkdown(message.content) ? (
                          <div className="max-w-none text-[var(--app-text)] text-xs sm:text-sm space-y-2 break-words">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: (props) => <p className="whitespace-pre-wrap leading-6" {...props} />,
                                ul: (props) => <ul className="list-disc list-inside space-y-1 marker:text-[var(--accent-primary)]" {...props} />,
                                ol: (props) => <ol className="list-decimal list-inside space-y-1 marker:text-[var(--accent-primary)]" {...props} />,
                                li: (props) => <li className="leading-6" {...props} />,
                                pre: (props) => (
                                  <pre
                                    className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-input)] p-2.5 text-[11px] leading-6 whitespace-pre-wrap"
                                    {...props}
                                  />
                                ),
                                code: (props) => (
                                  <code
                                    className="rounded bg-[var(--surface-chip)] px-1 py-0.5 text-[var(--accent-secondary)] font-mono text-[11px]"
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-6 text-[var(--app-text)]">
                            {message.content}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => applyAssistantCode(message)}
                          className={`text-[10px] uppercase tracking-[0.12em] rounded-md px-2 py-1 border ${
                            appliedMessageId === message.id
                              ? "border-emerald-400/60 text-emerald-300"
                              : "border-[var(--border-subtle)] text-[var(--text-soft)] hover:text-[var(--app-text)]"
                          }`}
                        >
                          {appliedMessageId === message.id ? "Applied" : "Apply Code Block"}
                        </button>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {message.role === "user" ? (
                    <span className="mt-1 h-7 w-7 shrink-0 rounded-md bg-[var(--surface-user-bubble)] border border-[var(--border-subtle)] text-white flex items-center justify-center">
                      <User size={13} />
                    </span>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>

            {assistantLoading ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-xs text-[var(--text-muted)]">
                <Loader2 size={13} className="animate-spin" />
                Thinking...
              </div>
            ) : null}

            <div ref={assistantBottomRef} />
          </div>

          <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--surface-panel)]">
            <div className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] flex items-end">
              <button
                type="button"
                onClick={() => void askAssistant("Suggest one practical improvement for this code.")}
                disabled={assistantLoading}
                className="p-3 text-[var(--text-soft)] hover:text-[var(--accent-primary)] disabled:opacity-50"
                title="Quick improve"
              >
                <Sparkles size={15} />
              </button>

              <textarea
                rows={1}
                value={assistantPrompt}
                onChange={(event) => setAssistantPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void askAssistant();
                  }
                }}
                className="w-full max-h-36 py-3 pr-2 bg-transparent resize-none text-xs sm:text-sm text-[var(--app-text)] placeholder-[var(--placeholder)] outline-none"
                placeholder="Ask AI to explain, debug, optimize, or rewrite code"
              />

              <button
                type="button"
                onClick={() => void askAssistant()}
                disabled={assistantLoading || !assistantPrompt.trim()}
                className="m-2 h-9 w-9 rounded-lg bg-[var(--accent-primary)] text-white flex items-center justify-center disabled:opacity-45"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CodeGenerator;
