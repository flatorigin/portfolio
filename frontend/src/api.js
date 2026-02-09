import axios from "axios";
console.log("VITE_API_BASE =", import.meta.env.VITE_API_BASE);
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api", });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("access");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
export default api;