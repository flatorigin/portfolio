import axios from "axios";

// Read base from env; fallback to localhost. MUST end with /api
const RAW = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";
const BASE = RAW.replace(/\/+$/,"") + "/"; // normalize single trailing /
const instance = axios.create({
  baseURL: BASE, // e.g. http://127.0.0.1:8000/api/
});

// why: make sure Authorization is attached for every request
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default instance;