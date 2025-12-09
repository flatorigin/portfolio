// ============================================================================
// file: frontend/src/hooks/useFavoriteProject.js
// Reusable toggle hook for saving/removing a project as favorite
// ============================================================================
import { useEffect, useState, useCallback } from "react";
import api from "../api";

export default function useFavoriteProject(projectId, ownerUsername) {
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const username = (localStorage.getItem("username") || "").toLowerCase();
  const isLoggedIn = !!localStorage.getItem("access");
  const isOwner =
    !!ownerUsername &&
    typeof ownerUsername === "string" &&
    ownerUsername.toLowerCase() === username;

  const canSave = isLoggedIn && !isOwner && !!projectId;

  // Initial check: is this project already saved?
  useEffect(() => {
    if (!canSave) {
      setIsSaved(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get("/favorites/projects/");
        if (!Array.isArray(data)) {
          setIsSaved(false);
          return;
        }
        const saved = data.some((fav) => {
          const favProjectId =
            (fav.project && fav.project.id) ??
            fav.project_id ??
            fav.project ??
            null;
          return String(favProjectId) === String(projectId);
        });
        if (!cancelled) setIsSaved(saved);
      } catch {
        if (!cancelled) setIsSaved(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, canSave]);

  const toggleSave = useCallback(async () => {
    if (!canSave || !projectId || loading) return;
    setLoading(true);
    try {
      // Toggle endpoint: same as Dashboard remove logic
      await api.post("/favorites/projects/", { project: projectId });
      setIsSaved((prev) => !prev);
    } catch (err) {
      console.error("[useFavoriteProject] toggle failed", err?.response || err);
      const msg =
        err?.response?.data ??
        err?.message ??
        "Failed to update saved state. Please try again.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [canSave, projectId, loading]);

  return {
    canSave,
    isSaved,
    loading,
    toggleSave,
  };
}