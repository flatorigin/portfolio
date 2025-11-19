// ======================================
// file: frontend/src/lib/localGallery.js
// ======================================

// Key per project
const KEY = (id) => `localProjectImages::${id}`;

// Config
export const MAX_LOCAL_BYTES = 5 * 1024 * 1024; // 5 MB budget

// ---- Helpers ----
export function getLocalImages(projectId) {
  try {
    const raw = localStorage.getItem(KEY(projectId));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.url === "string")
      .map((x) => ({ url: x.url, caption: x.caption || "" }));
  } catch { return []; }
}

export function setLocalImages(projectId, images) {
  try { localStorage.setItem(KEY(projectId), JSON.stringify(images || [])); } catch {}
}

export async function filesToDataURLs(files) {
  const list = Array.from(files || []);
  const tasks = list.map(
    (f) =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, url: r.result });
        r.onerror = reject;
        r.readAsDataURL(f);
      })
  );
  return Promise.all(tasks);
}

// Rough size of a data URL in bytes
export function dataURLBytes(dataURL) {
  if (typeof dataURL !== "string") return 0;
  const idx = dataURL.indexOf(";base64,");
  if (idx === -1) return dataURL.length;
  const b64 = dataURL.slice(idx + 8);
  const padding = (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  return (b64.length * 3) / 4 - padding;
}

export function getLocalUsageBytes(projectId) {
  try {
    const imgs = getLocalImages(projectId);
    return imgs.reduce((sum, it) => sum + dataURLBytes(it.url), 0);
  } catch { return 0; }
}

export function willExceed(projectId, newDataURLs /* array of strings */) {
  const current = getLocalUsageBytes(projectId);
  const incoming = (newDataURLs || []).reduce((s, u) => s + dataURLBytes(u), 0);
  return current + incoming > MAX_LOCAL_BYTES;
}

// Append items if budget allows; return {ok, message}
export function addLocalImages(projectId, items /* [{url, caption}] */) {
  const cur = getLocalImages(projectId);
  const incomingUrls = (items || []).map((x) => x.url);
  if (willExceed(projectId, incomingUrls)) {
    return { ok: false, message: `Adding these exceeds ${Math.round(MAX_LOCAL_BYTES/1024/1024)}MB local limit.` };
  }
  setLocalImages(projectId, [...cur, ...items.map((x) => ({ url: x.url, caption: x.caption || "" }))]);
  return { ok: true };
}

export function removeLocalImage(projectId, url) {
  const cur = getLocalImages(projectId);
  setLocalImages(projectId, cur.filter((x) => x.url !== url));
}

// Convert dataURL to Blob (for upload)
export function dataURLToBlob(dataURL) {
  const arr = dataURL.split(",");
  const mime = (arr[0].match(/:(.*?);/) || [])[1] || "application/octet-stream";
  const bstr = atob(arr[1] || "");
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}
