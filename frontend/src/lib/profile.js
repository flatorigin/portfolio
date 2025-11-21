// ============================================================================
// file: frontend/src/lib/profile.js  (NEW small compatibility layer)
// ============================================================================
import api from "../api";

// most common backends in this starter
const ME_ENDPOINTS = ["/users/me/", "/me/", "/profiles/me/", "/profile/me/"];

// GET me: try endpoints in order; return {data, _url}
export async function getMe() {
  let lastErr;
  for (const url of ME_ENDPOINTS) {
    try {
      const res = await api.get(url);
      res._url = url;
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// PATCH me: try endpoints in order; return {data, _url}
export async function patchMe(payload) {
  let lastErr;
  for (const url of ME_ENDPOINTS) {
    try {
      const res = await api.patch(url, payload);
      res._url = url;
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// normalize any server shape to "City, State, Country" or plain string
export function normalizeLocationFrom(me) {
  if (!me) return "";
  if (typeof me.location === "string" && me.location.trim()) return me.location.trim();
  const locObj =
    (me.location && typeof me.location === "object" && me.location) ||
    (me.profile?.location && typeof me.profile.location === "object" && me.profile.location) ||
    null;

  const parts = [
    me.city ?? locObj?.city,
    me.state ?? me.region ?? locObj?.state ?? locObj?.region,
    me.country ?? locObj?.country,
  ].filter(Boolean);

  if (parts.length) return parts.join(", ");
  if (typeof me.profile?.location === "string") return me.profile.location.trim();
  return "";
}

// Try common payloads until readback shows a non-empty value; return normalized string
export async function saveLocationSmart(raw) {
  const location = String(raw || "").trim();
  if (!location) return "";

  const [cityPart = "", rest = ""] = location.split(",");
  const city = cityPart.trim();
  const state = (rest || "").trim();

  const attempts = [
    { payload: { location }, pick: (d) => d?.location },
    { payload: { profile: { location } }, pick: (d) => d?.profile?.location },
    { payload: { ...(city ? { city } : {}), ...(state ? { state } : {}) },
      pick: (d) => [d?.city || d?.profile?.city, d?.state || d?.profile?.state || d?.region || d?.profile?.region, d?.country || d?.profile?.country]
        .filter(Boolean).join(", ") },
  ];

  for (const t of attempts) {
    try {
      await patchMe(t.payload);
      const { data } = await getMe();
      const got = t.pick(data);
      if (got && String(got).trim()) {
        return normalizeLocationFrom(data);
      }
    } catch {
      // try next shape
    }
  }
  throw new Error("Location save failed (no accepted payloads).");
}