import api from "../api";
export function toUrl(raw) {
  if (!raw) return "";
  const s = typeof raw === "string" ? raw : raw.url || raw.image || raw.src || raw.file || "";
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/,""); // http://127.0.0.1:8000/api
  const origin = base.replace(/\/api\/?$/,"");                    // http://127.0.0.1:8000
  return s.startsWith("/") ? `${origin}${s}` : `${origin}/${s}`;
}
