// =======================================
// file: frontend/src/components/SavedProjectsGrid.jsx
// Dashboard section: Saved Projects (favorites)
// - owns its own fetch + remove
// - listens to "favorites:changed"
// =======================================
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { Card, Button, GhostButton, Badge } from "../ui";

// normalize media
function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

// robust extraction of project id from favorite payload
function extractProjectId(fav) {
  return (
    fav?.project?.id ??
    fav?.project_id ??
    (typeof fav?.project === "number" ? fav.project : null)
  );
}

export default function SavedProjectsGrid() {
  const [savedProjects, setSavedProjects] = useState([]);
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [removingFavoriteId, setRemovingFavoriteId] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSaved = useCallback(async () => {
    try {
      const { data } = await api.get("/favorites/projects/");
      const sorted = Array.isArray(data)
        ? [...data].sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
          )
        : [];
      setSavedProjects(sorted);
    } catch (err) {
      console.warn("[SavedProjectsGrid] failed to load saved projects", err);
      setSavedProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    const handler = () => refreshSaved();
    window.addEventListener("favorites:changed", handler);
    return () => window.removeEventListener("favorites:changed", handler);
  }, [refreshSaved]);

  async function handleRemoveFavorite(fav) {
    if (!fav) return;

    const projectId = extractProjectId(fav);
    if (!projectId) {
      console.warn("[SavedProjectsGrid] missing project id", fav);
      alert("Cannot remove this favorite because its project id is missing.");
      return;
    }

    if (!window.confirm("Remove this project from your saved list?")) return;

    setRemovingFavoriteId(projectId);
    try {
      await api.delete(`/projects/${projectId}/favorite/`);
      setSavedProjects((prev) =>
        prev.filter((f) => extractProjectId(f) !== projectId)
      );
      window.dispatchEvent(new CustomEvent("favorites:changed"));
    } catch (err) {
      console.error("[SavedProjectsGrid] failed to remove favorite", err?.response || err);
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        err?.message ||
        "Failed to remove favorite. Please try again.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setRemovingFavoriteId(null);
    }
  }

  const visible = useMemo(
    () => (showAllSaved ? savedProjects : savedProjects.slice(0, 3)),
    [showAllSaved, savedProjects]
  );

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Saved projects</h2>
        <Badge className="text-[11px] text-slate-500">
          {savedProjects.length} saved
        </Badge>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : savedProjects.length === 0 ? (
        <p className="text-xs text-slate-500">
          You haven’t saved any projects yet. Hit “Save” on any interesting project
          to keep it here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {visible.map((fav) => {
              const projectId = extractProjectId(fav);

              const coverSrcRaw =
                fav.project_cover_image_url ||
                fav.project_cover_image ||
                fav.project_cover ||
                fav.project?.cover_image_url ||
                fav.project?.cover_image ||
                fav.project?.cover ||
                "";

              const coverSrc = coverSrcRaw ? toUrl(coverSrcRaw) : "";

              const title =
                fav.project_title ||
                fav.project?.title ||
                (projectId ? `Project #${projectId}` : "Project");

              const owner = fav.project_owner_username || fav.project?.owner_username;

              const category = fav.project_category || fav.project?.category;
              const summary = fav.project_summary || fav.project?.summary;
              const location = fav.project_location || fav.project?.location;
              const budget = fav.project_budget || fav.project?.budget;
              const sqf = fav.project_sqf || fav.project?.sqf;
              const highlights = fav.project_highlights || fav.project?.highlights;

              const removing = removingFavoriteId === projectId;

              return (
                <Card
                  key={fav.id ?? `p-${projectId ?? "unknown"}`}
                  className={
                    "overflow-hidden border " +
                    ((fav?.project?.is_job_posting || fav?.is_job_posting)
                      ? "border-[#49D7FF]"
                      : "border-slate-200")
                  }
                >
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt=""
                      className="block h-36 w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-slate-100 text-sm text-slate-500">
                      No cover
                    </div>
                  )}

                  <div className="p-4">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{title}</div>
                        {owner && (
                          <div className="text-[11px] text-slate-500">by {owner}</div>
                        )}
                      </div>

                      {category && <Badge className="shrink-0">{category}</Badge>}
                    </div>

                    <div className="line-clamp-2 text-sm text-slate-700">
                      {summary || <span className="opacity-60">No summary</span>}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      {location && (
                        <div>
                          <span className="opacity-60">Location:</span> {location}
                        </div>
                      )}
                      {budget && (
                        <div>
                          <span className="opacity-60">Budget:</span> {budget}
                        </div>
                      )}
                      {sqf && (
                        <div>
                          <span className="opacity-60">Sq Ft:</span> {sqf}
                        </div>
                      )}
                      {highlights && (
                        <div className="col-span-2 truncate">
                          <span className="opacity-60">Highlights:</span> {highlights}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex w-full flex-nowrap gap-2">
                      <GhostButton
                        className="w-1/2 min-w-0"
                        onClick={() => window.open(`/projects/${projectId}`, "_self")}
                        disabled={!projectId || removing}
                      >
                        Open
                      </GhostButton>

                      <Button
                        className="w-1/2 min-w-0"
                        type="button"
                        variant="outline"
                        onClick={() => handleRemoveFavorite(fav)}
                        disabled={removing}
                      >
                        {removing ? "Removing…" : "Remove"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {savedProjects.length > 3 && (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSaved((v) => !v)}
              >
                {showAllSaved ? "Show fewer" : `Show all ${savedProjects.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

console.log("[SavedProfilesGrid] mounted", {
  authed: !!localStorage.getItem("access"),
});