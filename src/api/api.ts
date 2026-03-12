import axios from "axios";
import type {
  PromptRequest,
  TextResponse,
  CodeResponse,
  AskRequest,
  SearchRequest,
  Paper,
  UploadResponse,
  AnalysisResponse,
  StatsResponse
} from "../types/api";

const API = axios.create({
  baseURL: "https://multi-modal-agent-backend.onrender.com/ai",
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

export const generateCode = async (
  data: PromptRequest
): Promise<CodeResponse> => {
  const response = await API.post<CodeResponse>(
    "/generate-code",
    data
  );
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
) => {
  const response = await API.get(`/summary/${paperId}`);
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
