/* ======================================================
   🤖 AI GENERATION TYPES
====================================================== */

export type SessionMode = "persistent" | "volatile";
export type ResponseLength = "short" | "long";

export interface PromptRequest {
  prompt: string;
  model?: string;
  session_id?: string;
  session_mode?: SessionMode | string;
  response_length?: ResponseLength | string;
}

export interface TextResponse {
  status: string;
  response: string;
  session_id?: string;
  session_mode?: SessionMode | string;
}

export interface CodeResponse {
  status: string;
  generated_code: string;
}

export interface CodeExecutionRequest {
  language_id: number;
  source_code: string;
  stdin?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

export interface CodeExecutionResponse {
  provider?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  memoryKb?: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
}

export interface OpenRouterModelsResponse {
  provider: string;
  enabled: boolean;
  default_model: string;
  models: OpenRouterModel[];
}

export interface NovaMemoryNode {
  id: number;
  label: string;
  type: string;
  weight: number;
  updated_at: string;
}

export interface NovaMemoryEdge {
  id: number;
  source: number;
  target: number;
  source_label?: string;
  target_label?: string;
  relation: string;
  weight: number;
  updated_at: string;
}

export interface NovaMemoryFact {
  id?: number;
  content: string;
  source_role: string;
  score: number;
  created_at: string;
}

export interface NovaMemoryMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface NovaMemorySnapshotResponse {
  session_id: string;
  mode?: SessionMode | string;
  nodes: NovaMemoryNode[];
  edges: NovaMemoryEdge[];
  facts: NovaMemoryFact[];
  messages?: NovaMemoryMessage[];
}

export interface NovaMemoryClearResponse {
  session_id: string;
  mode?: SessionMode | string;
  deleted: {
    messages: number;
    facts: number;
    edges: number;
    nodes: number;
  };
}

export interface NovaMemoryModeResponse {
  session_id: string;
  mode: SessionMode | string;
}

export interface NovaBridgeExportRequest {
  source_session_id: string;
  source_mode?: SessionMode | string;
  fact_ids?: number[];
  node_ids?: number[];
  edge_ids?: number[];
  message_ids?: number[];
}

export interface NovaBridgeExportResponse {
  bridge_id: string;
  exported_at: string;
  source_session_id: string;
  source_mode: SessionMode | string;
  counts: {
    facts: number;
    nodes: number;
    edges: number;
    messages: number;
  };
  payload: {
    source_session_id: string;
    source_mode: SessionMode | string;
    facts: NovaMemoryFact[];
    nodes: NovaMemoryNode[];
    edges: NovaMemoryEdge[];
    messages: NovaMemoryMessage[];
  };
}

export interface NovaBridgeImportRequest {
  target_session_id: string;
  target_mode?: SessionMode | string;
  payload: {
    source_session_id?: string;
    source_mode?: SessionMode | string;
    facts?: NovaMemoryFact[];
    nodes?: NovaMemoryNode[];
    edges?: NovaMemoryEdge[];
    messages?: NovaMemoryMessage[];
  };
  include_messages?: boolean;
  include_facts?: boolean;
  include_graph?: boolean;
}

export interface NovaBridgeImportResponse {
  target_session_id: string;
  target_mode: SessionMode | string;
  imported: {
    messages: number;
    facts: number;
    nodes: number;
    edges: number;
  };
}

/* ======================================================
   📄 PAPER UPLOAD + LISTING
====================================================== */

export interface UploadResponse {
  message: string;
  paper_id: number;
  analysis_time_sec: number;
  cached: boolean;
  filename: string;
}

export interface Paper {
  paper_id: number;
  filename: string;
  created_at: string;
}

/* ======================================================
   ❓ ASK PAPER
====================================================== */

export interface AskRequest {
  paper_id: number;
  question: string;
}

export interface AskResponse {
  answer: string;
  sources?: string[];
}

/* ======================================================
   📚 SUMMARY / TEACH
====================================================== */

export interface SummaryResponse {
  summary: string;
  fact_points?: string[];
  analysis_time_sec?: number;
  precomputed?: boolean;
}

export interface TeachResponse {
  teaching: string;
}

/* ======================================================
   📊 ANALYSIS
====================================================== */

export interface AnalysisResponse {
  summary: string;
  key_learnings: string[];
  limitations: string[];
  contributions: string[];
  analysis_time_sec: number;
}

/* ======================================================
   📈 STATS
====================================================== */

export interface StatsResponse {
  total_chunks: number;
  total_questions: number;
}

/* ======================================================
   🔍 SEARCH
====================================================== */

export interface SearchRequest {
  paper_id: number;
  query: string;
}

export interface SearchResult {
  content: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
}
