// =======================================
// file: frontend/src/api.js
// Axios instance + JWT attach + refresh on 401/403
// =======================================
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

let refreshPromise = null;
let redirectingToLogin = false;

function clearAuthAndRedirect() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  window.dispatchEvent(new CustomEvent("auth:changed"));

  if (!redirectingToLogin && window.location.pathname !== "/login") {
    redirectingToLogin = true;
    window.location.href = "/login";
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    // keep Bearer (your backend accepts it in SIMPLE_JWT)
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    const status = error.response?.status;
    const url = String(original?.url || "");
    const isRefreshRequest = url.includes("/auth/jwt/refresh");

    if ((status === 401 || status === 403) && isRefreshRequest) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // ✅ Some endpoints return 403 instead of 401 when auth fails/expired.
    // So treat 401 OR 403 as "refreshable" IF we have a refresh token.
    if (
      (status === 401 || status === 403) &&
      !original?._retry &&
      localStorage.getItem("refresh")
    ) {
      original._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${api.defaults.baseURL}/auth/jwt/refresh/`, {
              refresh: localStorage.getItem("refresh"),
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const { data } = await refreshPromise;

        if (data?.access) {
          localStorage.setItem("access", data.access);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        }
      } catch {
        clearAuthAndRedirect();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
