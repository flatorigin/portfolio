// ============================================================================
// file: src/api.js
// ============================================================================
import axios from "axios";

// Pick ONE base:
//   A) If your backend exposes everything under `/api/...`:
//      const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
//   B) If your backend exposes endpoints at the site root (no `/api` prefix):
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
// const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api"; // <-- choose correctly

const api = axios.create({
  baseURL: BASE.replace(/\/+$/,""), // no trailing slash
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

if (import.meta.env.MODE !== "production") {
  api.interceptors.response.use(
    r => r,
    err => {
      const u = `${api.defaults.baseURL}${err?.config?.url || ""}`;
      if (!/favicon\.ico$/.test(u)) console.debug("[API ERROR]", err?.config?.method, u, "->", err?.response?.status, err?.response?.data);
      return Promise.reject(err);
    }
  );
}

export default api;
export function setAuthToken(t){ t ? api.defaults.headers.Authorization = `Bearer ${t}` : delete api.defaults.headers.Authorization; }