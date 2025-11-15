import axios from "axios";
const api = axios.create({ baseURL: "http://localhost:8000/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Log responses that fail so you can see them in DevTools console
api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("[API error]", err?.response?.status, err?.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default api;
