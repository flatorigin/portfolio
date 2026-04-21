import api from "./api";

export async function register({ username, email, password, profile_type }) {
  await api.post("/auth/users/", { username, email, password, profile_type });
}
export async function login({ username, password }) {
  const { data } = await api.post("/auth/jwt/create", { username, password });
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
}
export function logout() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("username");
}
