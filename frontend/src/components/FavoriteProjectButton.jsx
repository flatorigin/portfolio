// ============================================================================
// file: frontend/src/components/FavoriteProjectButton.jsx
// Small reusable "Save project" / "Saved" toggle button
// Shows only when logged-in user is NOT the owner.
// Uses:
//   GET    /favorites/projects/          -> to determine initial saved state
//   POST   /projects/<id>/favorite/      -> save
//   DELETE /projects/<id>/favorite/      -> unsave
// ============================================================================

import { useEffect, useState, useMemo } from "react";
import api from "../api";
import { Button } from "../ui";

function extractProjectId(fav) {
  return (
    fav?.project?.id ??
    fav?.project_id ??
    (typeof fav?.project === "number" ? fav.project : null)
  );
}

export default function FavoriteProjectButton({
  projectId,
  ownerUsername,
  className = "",
  size = "sm",
}) {
  const authed = !!localStorage.getItem("access");
  const myUsername = (localStorage.getItem("username") || "").toLowerCase();

  const owner = (ownerUsername || "").toLowerCase();
  const isOwner = owner && myUsername && owner === myUsername;

  const canRender = authed && !isOwner && !!projectId;

  const [isSaved, setIsSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // initial saved state
  useEffect(() => {
    if (!canRender) {
      setIsSaved(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get("/favorites/projects/");
        if (!Array.isArray(data)) {
          if (!cancelled) setIsSaved(false);
          return;
        }
        const pid = String(projectId);
        const saved = data.some((fav) => {
          const fpid = extractProjectId(fav);
          return fpid != null && String(fpid) === pid;
        });
        if (!cancelled) setIsSaved(saved);
      } catch (err) {
        console.warn("[FavoriteProjectButton] failed to load favorites", err);
        if (!cancelled) setIsSaved(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canRender, projectId]);

  async function toggle() {
    if (!canRender || busy) return;
    setBusy(true);
    try {
      if (isSaved) {
        await api.delete(`/projects/${projectId}/favorite/`);
        setIsSaved(false);
      } else {
        await api.post(`/projects/${projectId}/favorite/`);
        setIsSaved(true);
      }
      // notify other views
      window.dispatchEvent(new CustomEvent("favorites:changed"));
    } catch (err) {
      console.error("[FavoriteProjectButton] toggle failed", err?.response || err);
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        err?.message ||
        "Failed to update saved state. Please try again.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  }

  if (!canRender) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={isSaved ? "outline" : "default"}
      disabled={busy}
      onClick={toggle}
      className={className}
    >
      {busy ? "Saving…" : isSaved ? "★ Saved" : "☆ Save project"}
    </Button>
  );
}

