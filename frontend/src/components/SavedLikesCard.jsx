import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Card, Button, GhostButton, Badge } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

const TABS = [
  { key: "saved-projects", label: "Saved Projects", empty: "No saved projects yet" },
  { key: "liked-projects", label: "Liked Projects", empty: "No liked projects yet" },
  { key: "saved-profiles", label: "Saved Profiles", empty: "No saved profiles yet" },
  { key: "liked-profiles", label: "Liked Profiles", empty: "No liked profiles yet" },
];

export default function SavedLikesCard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("saved-projects");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState({
    "saved-projects": [],
    "liked-projects": [],
    "saved-profiles": [],
    "liked-profiles": [],
  });

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        savedProjectsRes,
        likedProjectsRes,
        savedProfilesRes,
        likedProfilesRes,
      ] = await Promise.all([
        api.get("/favorites/projects/"),
        api.get("/likes/projects/"),
        api.get("/profiles/saved/"),
        api.get("/profiles/liked/"),
      ]);

      setItems({
        "saved-projects": Array.isArray(savedProjectsRes.data) ? savedProjectsRes.data : [],
        "liked-projects": Array.isArray(likedProjectsRes.data) ? likedProjectsRes.data : [],
        "saved-profiles": Array.isArray(savedProfilesRes.data) ? savedProfilesRes.data : [],
        "liked-profiles": Array.isArray(likedProfilesRes.data) ? likedProfilesRes.data : [],
      });
    } catch (err) {
      console.warn("[SavedLikesCard] refresh failed", err);
      setItems({
        "saved-projects": [],
        "liked-projects": [],
        "saved-profiles": [],
        "liked-profiles": [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const handler = () => refreshAll();
    window.addEventListener("favorites:changed", handler);
    window.addEventListener("projects:liked_changed", handler);
    window.addEventListener("profiles:saved_changed", handler);
    window.addEventListener("profiles:liked_changed", handler);
    return () => {
      window.removeEventListener("favorites:changed", handler);
      window.removeEventListener("projects:liked_changed", handler);
      window.removeEventListener("profiles:saved_changed", handler);
      window.removeEventListener("profiles:liked_changed", handler);
    };
  }, [refreshAll]);

  const activeItems = items[activeTab] || [];
  const activeMeta = TABS.find((tab) => tab.key === activeTab) || TABS[0];

  const totalCount = useMemo(
    () => Object.values(items).reduce((sum, arr) => sum + arr.length, 0),
    [items]
  );

  async function removeItem(item) {
    if (activeTab === "saved-projects") {
      await api.delete(`/projects/${item.project_id}/favorite/`);
      window.dispatchEvent(new CustomEvent("favorites:changed"));
      return;
    }
    if (activeTab === "liked-projects") {
      await api.delete(`/projects/${item.project_id}/like/`);
      window.dispatchEvent(new CustomEvent("projects:liked_changed"));
      return;
    }
    if (activeTab === "saved-profiles") {
      await api.delete(`/profiles/${item.username}/save/`);
      window.dispatchEvent(new CustomEvent("profiles:saved_changed"));
      return;
    }
    if (activeTab === "liked-profiles") {
      await api.delete(`/profiles/${item.username}/like/`);
      window.dispatchEvent(new CustomEvent("profiles:liked_changed"));
    }
  }

  return (
    <Card className="border border-slate-200 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Saved &amp; Likes</div>
          <div className="text-xs text-slate-500">
            Keep projects and profiles separated by intent.
          </div>
        </div>
        <Badge className="text-[11px] text-slate-500">{totalCount} items</Badge>
      </div>

      <div className="mb-4 flex flex-wrap gap-5 border-b border-slate-200">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                "relative -mb-px border-b-2 px-1 pb-3 text-sm font-medium transition " +
                (active
                  ? "border-indigo-600 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800")
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : activeItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          {activeMeta.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => {
            const isProject = activeTab.includes("projects");

            if (isProject) {
              const coverSrc = toUrl(item.project_cover_image || "");
              return (
                <div
                  key={`${activeTab}-${item.id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center"
                >
                  <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 md:w-32">
                    {coverSrc ? (
                      <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        No cover
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-slate-900">
                      {item.project_title || "Project"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      by {item.project_owner_username || "Unknown owner"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {item.project_location || "No location"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <GhostButton type="button" onClick={() => navigate(`/projects/${item.project_id}`)}>
                      View Project
                    </GhostButton>
                    <GhostButton
                      type="button"
                      onClick={() => navigate(`/profiles/${item.project_owner_username}`)}
                      disabled={!item.project_owner_username}
                    >
                      Visit Profile
                    </GhostButton>
                    <Button type="button" variant="outline" onClick={() => removeItem(item)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            }

            const avatarSrc = toUrl(item.avatar_url || "");
            return (
              <div
                key={`${activeTab}-${item.id || item.username}`}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                      {(item.display_name || item.username || "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {item.display_name || item.username}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{item.tag || "No location"}</div>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <GhostButton type="button" onClick={() => navigate(`/profiles/${item.username}`)}>
                    View Profile
                  </GhostButton>
                  <Button type="button" variant="outline" onClick={() => removeItem(item)}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
