/* ======================================================
   🤖 AI GENERATION TYPES
====================================================== */

export interface PromptRequest {
  prompt: string;
}

export interface TextResponse {
  status: string;
  response: string;
}

export interface CodeResponse {
  status: string;
  generated_code: string;
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
