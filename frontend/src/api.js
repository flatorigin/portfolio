import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

// Attach token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle expired token automatically
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      localStorage.getItem("refresh")
    ) {
      original._retry = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE || "/api"}/auth/jwt/refresh/`,
          {
            refresh: localStorage.getItem("refresh"),
          }
        );

        localStorage.setItem("access", data.access);

        original.headers.Authorization = `Bearer ${data.access}`;

        return api(original);
      } catch (err) {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;