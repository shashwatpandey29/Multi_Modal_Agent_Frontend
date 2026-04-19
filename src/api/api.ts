import axios from "axios";
import type {
  PromptRequest,
  SessionMode,
  TextResponse,
  CodeResponse,
  CodeExecutionRequest,
  CodeExecutionResponse,
  OpenRouterModelsResponse,
  NovaMemorySnapshotResponse,
  NovaMemoryClearResponse,
  NovaMemoryModeResponse,
  NovaBridgeExportRequest,
  NovaBridgeExportResponse,
  NovaBridgeImportRequest,
  NovaBridgeImportResponse,
  AskRequest,
  SearchRequest,
  Paper,
  UploadResponse,
  AnalysisResponse,
  StatsResponse,
  SummaryResponse
} from "../types/api";

type TextStreamEvent =
  | { type: "chunk"; content: string }
  | { type: "done"; session_mode?: SessionMode | string }
  | { type: "error"; message: string };

type TextStreamHandlers = {
  onChunk?: (chunk: string) => void;
  onDone?: (sessionMode?: SessionMode | string) => void;
  onError?: (message: string) => void;
};

const trimSlash = (value: string) => value.replace(/\/+$/, "");

const resolveApiBaseUrl = (): string => {
  const explicit = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (explicit) {
    return trimSlash(explicit);
  }

  const localBase = trimSlash(
    ((import.meta.env.VITE_API_LOCAL_BASE_URL as string | undefined) || "http://127.0.0.1:8000/ai").trim()
  );
  const renderBase = trimSlash(
    ((import.meta.env.VITE_API_PROD_BASE_URL as string | undefined) ||
      "https://multi-modal-agent-backend.onrender.com/ai").trim()
  );

  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  return isLocalHost ? localBase : renderBase;
};

const API = axios.create({
  baseURL: resolveApiBaseUrl(),
});

/* ======================================================
   🤖 AI GENERATION
====================================================== */

export const generateText = async (
  data: PromptRequest
): Promise<TextResponse> => {
  const response = await API.post<TextResponse>(
    "/generate-text",
    data
  );
  return response.data;
};

export const getOpenRouterModels = async (): Promise<OpenRouterModelsResponse> => {
  const response = await API.get<OpenRouterModelsResponse>("/models/openrouter");
  return response.data;
};

export const getNovaMemory = async (sessionId: string): Promise<NovaMemorySnapshotResponse> => {
  const response = await API.get<NovaMemorySnapshotResponse>(`/memory/${encodeURIComponent(sessionId)}`);
  return response.data;
};

export const getNovaMemoryMode = async (sessionId: string): Promise<NovaMemoryModeResponse> => {
  const response = await API.get<NovaMemoryModeResponse>(`/memory/${encodeURIComponent(sessionId)}/mode`);
  return response.data;
};

export const setNovaMemoryMode = async (
  sessionId: string,
  mode: SessionMode | string
): Promise<NovaMemoryModeResponse> => {
  const response = await API.post<NovaMemoryModeResponse>(`/memory/${encodeURIComponent(sessionId)}/mode`, { mode });
  return response.data;
};

export const getNovaMemoryByMode = async (
  sessionId: string,
  mode?: SessionMode | string
): Promise<NovaMemorySnapshotResponse> => {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const response = await API.get<NovaMemorySnapshotResponse>(`/memory/${encodeURIComponent(sessionId)}${query}`);
  return response.data;
};

export const clearNovaMemory = async (
  sessionId: string,
  mode?: SessionMode | string
): Promise<NovaMemoryClearResponse> => {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const response = await API.delete<NovaMemoryClearResponse>(`/memory/${encodeURIComponent(sessionId)}${query}`);
  return response.data;
};

export const exportNovaKnowledgeBridge = async (
  data: NovaBridgeExportRequest
): Promise<NovaBridgeExportResponse> => {
  const response = await API.post<NovaBridgeExportResponse>("/memory/bridge/export", data);
  return response.data;
};

export const importNovaKnowledgeBridge = async (
  data: NovaBridgeImportRequest
): Promise<NovaBridgeImportResponse> => {
  const response = await API.post<NovaBridgeImportResponse>("/memory/bridge/import", data);
  return response.data;
};

export const generateTextStream = async (
  data: PromptRequest,
  handlers: TextStreamHandlers = {},
  signal?: AbortSignal
): Promise<void> => {
  const baseUrl = API.defaults.baseURL || resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/generate-text/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal,
  });

  if (!response.ok) {
    let detail = `Stream request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        detail = String(payload.detail);
      }
    } catch {
      // Keep default error detail.
    }

    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error("Streaming response body is not available");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneEventSeen = false;

  const handleEvent = (raw: string) => {
    const dataValue = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");

    if (!dataValue) {
      return;
    }

    let event: TextStreamEvent;
    try {
      event = JSON.parse(dataValue) as TextStreamEvent;
    } catch {
      return;
    }

    if (event.type === "chunk") {
      handlers.onChunk?.(event.content);
      return;
    }

    if (event.type === "error") {
      handlers.onError?.(event.message);
      throw new Error(event.message);
    }

    if (event.type === "done") {
      doneEventSeen = true;
      handlers.onDone?.(event.session_mode);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, "\n");

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex >= 0) {
      const eventBlock = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);

      if (eventBlock) {
        handleEvent(eventBlock);
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }

  if (!doneEventSeen) {
    handlers.onDone?.();
  }
};

export const generateCode = async (
  data: PromptRequest
): Promise<CodeResponse> => {
  const response = await API.post<CodeResponse>(
    "/generate-code",
    data
  );
  return response.data;
};

export const executeCode = async (
  data: CodeExecutionRequest
): Promise<CodeExecutionResponse> => {
  const response = await API.post<CodeExecutionResponse>("/execute", data);
  return response.data;
};

export const generateImage = async (
  data: PromptRequest
): Promise<Blob> => {
  const response = await API.post(
    "/generate-image",
    data,
    { responseType: "blob" }
  );
  return response.data;
};

/* ======================================================
   📄 RESEARCH PAPER ANALYZER
====================================================== */

// Upload Paper
export const uploadPaper = async (
  file: File
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await API.post<UploadResponse>(
    "/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

// List Papers
export const getPapers = async (): Promise<Paper[]> => {
  const response = await API.get<Paper[]>("/papers");
  return response.data;
};

// Ask Question
export const askPaper = async (
  data: AskRequest
) => {
  const response = await API.post("/ask", data);
  return response.data;
};

// Summary
export const getSummary = async (
  paperId: number
) : Promise<SummaryResponse> => {
  const response = await API.get<SummaryResponse>(`/summary/${paperId}`);
  return response.data;
};

// Teach Mode
export const teachPaper = async (
  paperId: number
) => {
  const response = await API.get(`/teach/${paperId}`);
  return response.data;
};

// Analysis
export const getAnalysis = async (
  paperId: number
): Promise<AnalysisResponse> => {
  const response = await API.get<AnalysisResponse>(
    `/analysis/${paperId}`
  );
  return response.data;
};

// Stats
export const getStats = async (
  paperId: number
): Promise<StatsResponse> => {
  const response = await API.get<StatsResponse>(
    `/stats/${paperId}`
  );
  return response.data;
};

// Search
export const searchPaper = async (
  data: SearchRequest
) => {
  const response = await API.post("/search", data);
  return response.data;
};
