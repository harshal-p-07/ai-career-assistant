import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const register = (data) => api.post("/auth/register", data);
export const login = (data) => api.post("/auth/login", data);
export const getMe = () => api.get("/auth/me");

// Resume
export const analyzeResume = (formData) => api.post("/resume/analyze", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const getHistory = () => api.get("/resume/history");
export const getAnalysis = (id) => api.get(`/resume/${id}`);

// Research
export const runResearch       = (data) => api.post("/research", data);
export const getResearchHistory = ()    => api.get("/research/history");
export const getResearchById    = (id)  => api.get(`/research/${id}`);

// Research Agent — SSE streaming
// onEvent(event) called for each step, returns Promise<researchId>
export function streamResearch({ query, type }, onEvent) {
  const baseURL = import.meta.env.VITE_API_URL || "";
  const token   = localStorage.getItem("token");

  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(`${baseURL}/research/stream`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ query, type }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Stream failed" }));
        return reject(new Error(err.message));
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   researchId = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop(); // keep incomplete chunk

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.replace(/^data:\s*/, ""));
            onEvent(event);
            if (event.phase === "saved") researchId = event.researchId;
            if (event.phase === "error")  reject(new Error(event.message));
          } catch (_) {}
        }
      }

      resolve(researchId);
    } catch (err) {
      reject(err);
    }
  });
}

// Interview
export const startInterview = (data) => api.post("/interview/start", data);
export const sendAnswer = (data) => api.post("/interview/answer", data);
export const getInterviews = () => api.get("/interview");
export const getInterview = (id) => api.get(`/interview/${id}`);

// Roadmap
export const generateRoadmap = (data) => api.post("/roadmap/generate", data);
export const getRoadmaps = () => api.get("/roadmap");
export const getRoadmap = (id) => api.get(`/roadmap/${id}`);

// Chat
export const sendMessage = (data) => api.post("/chat", data);
export const getChatHistory = () => api.get("/chat/history");
export const clearChat = () => api.delete("/chat/clear");

export default api;
