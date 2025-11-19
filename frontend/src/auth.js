import api from "./api";

export async function register({ username, email, password }) {
  await api.post("/auth/users/", { username, email, password });
  return login({ username, password });
}
export async function login({ username, password }) {
  const { data } = await api.post("/auth/jwt/create", { username, password });
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
}
export function logout() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}
