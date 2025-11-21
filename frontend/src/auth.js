// ============================================================================
// file: src/auth.js
// ============================================================================
import api from "./api";

export async function register({ username, email, password }) {
  await api.post("/auth/users/", { username, email, password }); // already correct (trailing slash)
  return login({ username, password });
}

export async function login({ username, password }) {
  // Djoser default (REQUIRES trailing slash)
  // Full call becomes: `${api.defaults.baseURL}/auth/jwt/create/`
  const { data } = await api.post("/auth/jwt/create/", { username, password });
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
}

export function logout() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}