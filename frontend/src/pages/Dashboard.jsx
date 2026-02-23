// ============================================================================
// file: frontend/src/pages/Dashboard.jsx
// ============================================================================
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

import CreateProjectCard from "../components/CreateProjectCard";
import ProjectEditorCard from "../components/ProjectEditorCard";
import { SectionTitle, Card, Button, GhostButton, Badge } from "../ui";

// normalize media
function toUrl(raw) {
  if (!raw) return "";
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

export default function Dashboard() {
  const navigate = useNavigate();

  // ---- Profile header (live) ----
  const [meLite, setMeLite] = useState({
    display_name: localStorage.getItem("profile_display_name") || "",
    logo: localStorage.getItem("profile_logo") || "",
    service_location: "",
    coverage_radius_miles: "",
    bio: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/me/");
        const next = {
          display_name: data?.display_name || data?.name || "",
          logo: data?.logo || data?.logo_url || "",
          service_location: data?.service_location || "",
          coverage_radius_miles: data?.coverage_radius_miles ?? "",
          bio: data?.bio || "",
        };
        setMeLite(next);
        localStorage.setItem("profile_display_name", next.display_name || "");
        localStorage.setItem("profile_logo", next.logo || "");
      } catch {
        /* non-blocking */
      }
    })();
  }, []);

  useEffect(() => {
    const onUpdating = () => setProfileSaving(true);
    const onUpdated = (e) => {
      const d = e?.detail || {};
      setProfileSaving(false);
      if (
        d.display_name ||
        d.logo ||
        d.service_location ||
        d.coverage_radius_miles ||
        d.bio
      ) {
        setMeLite((prev) => ({
          ...prev,
          ...(d.display_name !== undefined ? { display_name: d.display_name } : {}),
          ...(d.logo !== undefined ? { logo: d.logo } : {}),
          ...(d.service_location !== undefined
            ? { service_location: d.service_location }
            : {}),
          ...(d.coverage_radius_miles !== undefined
            ? { coverage_radius_miles: d.coverage_radius_miles }
            : {}),
          ...(d.bio !== undefined ? { bio: d.bio } : {}),
        }));
      }
    };
    window.addEventListener("profile:updating", onUpdating);
    window.addEventListener("profile:updated", onUpdated);
    return () => {
      window.removeEventListener("profile:updating", onUpdating);
      window.removeEventListener("profile:updated", onUpdated);
    };
  }, []);

  const logoUrl = toUrl(meLite.logo);

  // ---- Saved projects (favorites) ----
  const [savedProjects, setSavedProjects] = useState([]);
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [removingFavoriteId, setRemovingFavoriteId] = useState(null);

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
      console.warn("[Dashboard] failed to load saved projects", err);
      setSavedProjects([]);
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
      console.warn("[Dashboard] handleRemoveFavorite: missing project id", fav);
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
      console.error("[Dashboard] failed to remove favorite", err?.response || err);
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

  // ---- Projects & editor ----
  const [projects, setProjects] = useState([]);
  const [busy, setBusy] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title: "",
    summary: "",
    category: "",
    is_public: true,
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
    material_url: "",
    material_label: "",
    is_job_posting: false,
  });
  const [cover, setCover] = useState(null);

  // Editor
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    category: "",
    is_public: true,
    is_job_posting: false,
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
    material_url: "",
    material_label: "",
    cover_image_id: null,
  });
  const [editImgs, setEditImgs] = useState([]);
  const editorRef = useRef(null);

  // ✅ feedback + collapse control
  const [saveToast, setSaveToast] = useState("");
  const saveToastTimerRef = useRef(null);
  const collapseTimerRef = useRef(null);

  // current user (ownership)
  const [meUser, setMeUser] = useState({
    username: localStorage.getItem("username") || "",
  });

  // myThumbs[projectId] = { cover: string|null }
  const [myThumbs, setMyThumbs] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/users/me/");
        if (data?.username) setMeUser({ username: data.username });
      } catch {
        try {
          const { data } = await api.get("/users/me/");
          if (data?.username) setMeUser({ username: data.username });
        } catch {
          /* fallback */
        }
      }
    })();
  }, []);

  const [createErr, setCreateErr] = useState("");
  const [createOk, setCreateOk] = useState(false);

  // ✅ define refreshMyThumbs BEFORE refreshProjects (avoids TDZ crash)
  const refreshMyThumbs = useCallback(async (projList) => {
    const list = Array.isArray(projList) ? projList : [];

    const entries = await Promise.all(
      list.map(async (p) => {
        try {
          const { data } = await api
            .get(`/projects/${p.id}/images/`)
            .catch(() => ({ data: [] }));
          const imgs = Array.isArray(data) ? data : [];

          const mapped = imgs
            .map((it) => ({
              url: toUrl(it.url || it.image || it.src || it.file || ""),
              order: it.order ?? it.sort_order ?? null,
            }))
            .filter((x) => !!x.url);

          const cover =
            mapped.find((x) => Number(x.order) === 0)?.url ||
            mapped[0]?.url ||
            null;

          return [p.id, { cover }];
        } catch {
          return [p.id, { cover: null }];
        }
      })
    );

    setMyThumbs(Object.fromEntries(entries));
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const { data } = await api.get("/projects/");
      const mine = Array.isArray(data)
        ? data.filter(
            (p) =>
              (p.owner_username || "").toLowerCase() ===
              (meUser.username || "").toLowerCase()
          )
        : [];

      setProjects(mine);
      await refreshMyThumbs(mine);
    } catch (err) {
      console.warn("[Dashboard] failed to load my projects", err);
      setProjects([]);
      setMyThumbs({});
    }
  }, [meUser.username, refreshMyThumbs]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const list = projects;

  // ✅ Stable refreshImages (preserve UI order; do not allow backend ordering to reshuffle)
  const refreshImages = useCallback(async (pid) => {
    const { data } = await api.get(`/projects/${pid}/images/`);

    const incoming = (Array.isArray(data) ? data : [])
      .map((x) => ({
        id: x.id,
        url: x.url || x.image || x.src || x.file,
        caption: x.caption || "",
        order: x.order ?? x.sort_order ?? null, // used for cover radio only
        _localCaption: x.caption || "",
        _saving: false,
      }))
      .filter((x) => !!x.url);

    setEditImgs((prev) => {
      const byId = new Map(incoming.map((it) => [String(it.id), it]));
      const mergedInPrevOrder = prev
        .filter((p) => byId.has(String(p.id)))
        .map((p) => {
          const next = byId.get(String(p.id));
          const localCaption = p._saving
            ? p._localCaption
            : next?._localCaption ?? next?.caption ?? "";
          return {
            ...p,
            ...next,
            _localCaption: localCaption,
            _saving: !!p._saving && next?.caption !== p._localCaption,
          };
        });

      const prevIds = new Set(prev.map((p) => String(p.id)));
      const newOnes = incoming.filter((it) => !prevIds.has(String(it.id)));

      return [...mergedInPrevOrder, ...newOnes];
    });
  }, []);

  const loadEditor = useCallback(
    async (id) => {
      const pid = String(id);
      setEditingId(pid);

      const { data: meta } = await api.get(`/projects/${pid}/`);
      setEditForm({
        title: meta?.title || "",
        summary: meta?.summary || "",
        category: meta?.category || "",
        is_public: !!meta?.is_public,
        is_job_posting: !!meta?.is_job_posting,
        location: meta?.location || "",
        budget: meta?.budget ?? "",
        sqf: meta?.sqf ?? "",
        highlights: meta?.highlights || "",
        material_url: meta?.material_url || "",
        material_label: meta?.material_label || "",
        cover_image_id:
          meta?.cover_image_id ??
          meta?.cover_image?.id ??
          meta?.cover_image ??
          null,
      });

      await refreshImages(pid);

      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [refreshImages]
  );

  useEffect(() => {
    if (!editingId) return;
    let attempts = 0;
    function tryScroll() {
      if (editorRef.current) {
        const top =
          editorRef.current.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      if (attempts < 10) {
        attempts++;
        setTimeout(tryScroll, 50);
      }
    }
    tryScroll();
  }, [editingId]);

  // ✅ cover = order 0 (backend). UI does NOT reorder due to refreshImages merge.
  async function makeCoverImage(imageId) {
    if (!editingId || !imageId) return;

    const currentCover = editImgs.find((img) => Number(img.order) === 0);

    // update "active cover" locally, but DO NOT reorder the array
    setEditImgs((prev) =>
      prev.map((img) => {
        if (img.id === imageId) return { ...img, order: 0 };
        if (img.id === currentCover?.id && currentCover.id !== imageId)
          return { ...img, order: 1 };
        return img;
      })
    );

    try {
      if (currentCover?.id && currentCover.id !== imageId) {
        await api.patch(`/projects/${editingId}/images/${currentCover.id}/`, {
          order: 1,
        });
      }
      await api.patch(`/projects/${editingId}/images/${imageId}/`, { order: 0 });

      await refreshImages(editingId);
      await refreshProjects();
    } catch (err) {
      console.error("[Dashboard] makeCoverImage failed", err?.response || err);
      await refreshImages(editingId);
      const data = err?.response?.data;
      alert(
        data?.detail ||
          data?.message ||
          (data ? JSON.stringify(data) : "") ||
          err?.message ||
          "Failed to set cover image."
      );
    }
  }

  async function createProject(e, images = []) {
    e.preventDefault();
    setCreateErr("");
    setCreateOk(false);
    setBusy(true);
    try {
      const token = localStorage.getItem("access");
      if (!token) {
        setCreateErr("You must be logged in to create a project.");
        return;
      }

      if (!form.title.trim()) {
        setCreateErr("Title is required.");
        return;
      }

      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === "is_public" || k === "is_job_posting") {
          fd.append(k, v ? "true" : "false");
        } else {
          fd.append(k, v ?? "");
        }
      });
      if (cover) fd.append("cover_image", cover);

      const { data } = await api.post("/projects/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (Array.isArray(images) && data?.id) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (!img?._file) continue;

          const imgFd = new FormData();
          imgFd.append("image", img._file);
          imgFd.append("caption", img.caption || "");
          imgFd.append("order", String(i));

          await api.post(`/projects/${data.id}/images/`, imgFd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      }

      await refreshProjects();

      setForm({
        title: "",
        summary: "",
        category: "",
        is_public: true,
        is_job_posting: false,
        location: "",
        budget: "",
        sqf: "",
        highlights: "",
        material_url: "",
        material_label: "",
      });
      setCover(null);
      setCreateOk(true);

      if (data?.id) await loadEditor(data.id);
    } catch (err) {
      const msg = err?.response?.data
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message || String(err);
      setCreateErr(msg);
      console.error("[createProject] failed:", err);
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectInfo(e) {
    e?.preventDefault?.();
    if (!editingId) return;

    setBusy(true);
    try {
      const payload = { ...editForm };
      payload.is_public = !!payload.is_public;
      payload.is_job_posting = !!payload.is_job_posting;

      // cover image selection is handled via image order=0 (not cover_image file upload)
      if (payload.cover_image_id == null || payload.cover_image_id === "") {
        delete payload.cover_image_id;
      } else {
        payload.cover_image_id = Number(payload.cover_image_id);
      }

      await api.patch(`/projects/${editingId}/`, payload);

      await refreshProjects();

      // ✅ CREATIVE FEEDBACK + AUTO COLLAPSE
      const title = (payload.title || "").trim();
      setSaveToast(title ? `Saved ✓  “${title}”` : "Saved ✓  Your changes are live");

      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);

      saveToastTimerRef.current = setTimeout(() => setSaveToast(""), 1600);

      // collapse editor back to previous state
      collapseTimerRef.current = setTimeout(() => {
        setEditingId("");
      }, 550);
    } catch (err) {
      console.error("[Dashboard] save failed", err?.response || err);
      const data = err?.response?.data;
      alert(
        data?.detail ||
          data?.message ||
          (data ? JSON.stringify(data) : "") ||
          err?.message ||
          "Save failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveImageCaption(img) {
    if (!editingId || !img?.id) return;
    if (img._localCaption === img.caption) return;

    setEditImgs((prev) =>
      prev.map((x) => (x.id === img.id ? { ...x, _saving: true } : x))
    );

    try {
      await api.patch(`/projects/${editingId}/images/${img.id}/`, {
        caption: img._localCaption,
      });
      await refreshImages(editingId);
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
      setEditImgs((prev) =>
        prev.map((x) => (x.id === img.id ? { ...x, _saving: false } : x))
      );
    }
  }

  async function deleteImage(img) {
    if (!editingId || !img?.id) return;
    if (!window.confirm("Delete this image? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.delete(`/projects/${editingId}/images/${img.id}/`);
      await refreshImages(editingId);
      await refreshProjects();
    } finally {
      setBusy(false);
    }
  }

  const handleEditorSubmit = useCallback(
    (e) => saveProjectInfo(e),
    [editingId, editForm] // keep aligned with your current flow
  );

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Simple header: Dashboard only */}
      <header className="mb-1">
        <SectionTitle>Dashboard</SectionTitle>
      </header>

      {/* Profile summary card with logo inside */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="relative h-10 w-10 flex-shrink-0">
              {logoUrl ? (
                <img
                  src={toUrl(localStorage.getItem("profile_logo"))}
                  alt="Logo"
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
                  onError={(e) => {
                      e.currentTarget.src = "/placeholder.png"; // or hide it
                  }}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm text-slate-600">
                  {meLite.display_name
                    ? meLite.display_name.slice(0, 1).toUpperCase()
                    : "•"}
                </div>
              )}
              {profileSaving && (
                <div className="absolute inset-0 grid place-items-center rounded-full bg-white/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Profile
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {meLite.display_name || "Add your name in Edit Profile"}
              </div>

              {(meLite.service_location || meLite.coverage_radius_miles) && (
                <div className="mt-1 text-xs text-slate-600">
                  {meLite.service_location || "Location not set"}
                  {meLite.coverage_radius_miles !== "" && (
                    <> · {meLite.coverage_radius_miles} mile radius</>
                  )}
                </div>
              )}

              {meLite.bio && (
                <p className="mt-2 text-xs text-slate-600">{meLite.bio}</p>
              )}

              {!meLite.service_location && !meLite.bio && (
                <p className="mt-2 text-xs text-slate-500">
                  Add your service area and a short bio so clients know who you are.
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full max-w-[140px] flex-col items-end gap-2">
            <Button type="button" onClick={() => navigate("/profile/edit")}>
              Edit Profile
            </Button>
          </div>
        </div>
      </Card>

      {/* SAVED PROJECTS (favorites) */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Saved projects</h2>
          <span className="text-[11px] text-slate-500">
            {savedProjects.length} saved
          </span>
        </div>

        {savedProjects.length === 0 ? (
          <p className="text-xs text-slate-500">
            You haven’t saved any projects yet. Hit “Save” on any interesting project
            to keep it here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {(showAllSaved ? savedProjects : savedProjects.slice(0, 3)).map(
                (fav) => {
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

                  const owner =
                    fav.project_owner_username || fav.project?.owner_username;

                  const category = fav.project_category || fav.project?.category;
                  const summary = fav.project_summary || fav.project?.summary;
                  const location = fav.project_location || fav.project?.location;
                  const budget = fav.project_budget || fav.project?.budget;
                  const sqf = fav.project_sqf || fav.project?.sqf;
                  const highlights =
                    fav.project_highlights || fav.project?.highlights;

                  const removing = removingFavoriteId === projectId;

                  return (
                    <Card
                      key={fav.id ?? `p-${projectId ?? "unknown"}`}
                      className="overflow-hidden"
                    >
                      {coverSrc ? (
                        <img
                          src={coverSrc}
                          alt=""
                          className="block h-36 w-full object-cover"
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
                              <div className="text-[11px] text-slate-500">
                                by {owner}
                              </div>
                            )}
                          </div>

                          {category && (
                            <Badge className="shrink-0">{category}</Badge>
                          )}
                        </div>

                        <div className="line-clamp-2 text-sm text-slate-700">
                          {summary || (
                            <span className="opacity-60">No summary</span>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                          {location && (
                            <div>
                              <span className="opacity-60">Location:</span>{" "}
                              {location}
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
                              <span className="opacity-60">Highlights:</span>{" "}
                              {highlights}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex w-full flex-nowrap gap-2">
                          <GhostButton
                            className="w-1/2 min-w-0"
                            onClick={() =>
                              window.open(`/projects/${projectId}`, "_self")
                            }
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
                }
              )}
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

      {/* 1) CREATE PROJECT — now collapsible reusable card */}
      <CreateProjectCard
        ownedCount={projects.length}
        form={form}
        setForm={setForm}
        cover={cover}
        setCover={setCover}
        busy={busy}
        error={createErr}
        success={createOk}
        onSubmit={createProject}
      />

      {/* 2) YOUR PROJECTS */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Your Projects</div>
          <Badge>{list.length} shown</Badge>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            You don’t have any projects yet.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {list.map((p) => {
              const coverFromImgs = myThumbs?.[p.id]?.cover || "";
              const coverSrc = coverFromImgs || (p.cover_image ? toUrl(p.cover_image) : "");

              return (
                <Card key={p.id} className="overflow-hidden">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt=""
                      className="block h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-slate-100 text-sm text-slate-500">
                      No cover
                    </div>
                  )}

                  <div className="p-4">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{p.title}</div>
                      </div>

                      {p.category ? (
                        <Badge className="shrink-0">{p.category}</Badge>
                      ) : null}
                    </div>

                    <div className="line-clamp-2 text-sm text-slate-700">
                      {p.summary || <span className="opacity-60">No summary</span>}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      {p.location ? (
                        <div>
                          <span className="opacity-60">Location:</span> {p.location}
                        </div>
                      ) : null}

                      {p.budget ? (
                        <div>
                          <span className="opacity-60">Budget:</span> {p.budget}
                        </div>
                      ) : null}

                      {p.sqf ? (
                        <div>
                          <span className="opacity-60">Sq Ft:</span> {p.sqf}
                        </div>
                      ) : null}

                      {p.highlights ? (
                        <div className="col-span-2 truncate">
                          <span className="opacity-60">Highlights:</span>{" "}
                          {p.highlights}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex w-full flex-nowrap gap-2">
                      <GhostButton
                        className="w-1/2 min-w-0"
                        onClick={() => window.open(`/projects/${p.id}`, "_self")}
                      >
                        Open
                      </GhostButton>

                      <Button
                        className="w-1/2 min-w-0"
                        onClick={() => loadEditor(p.id)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* ✅ Save feedback (creative) */}
      {saveToast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
              ✓
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{saveToast}</div>
              <div className="text-[11px] text-emerald-800/80">
                Nice — updates are saved and live on your project card.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3) EDITOR — ProjectEditorCard */}
      {editingId && (
        <div ref={editorRef}>
          <ProjectEditorCard
            mode="edit"
            projectId={editingId}
            form={editForm}
            setForm={setEditForm}
            busy={busy}
            images={editImgs}
            setImages={setEditImgs}
            onMakeCover={makeCoverImage}
            onSaveImageCaption={saveImageCaption}
            onDeleteImage={deleteImage}
            onSubmit={handleEditorSubmit}
            onClose={() => setEditingId("")}
            onView={() => window.open(`/projects/${editingId}`, "_self")}
            onAfterUpload={async () => {
              await refreshImages(editingId);
              await refreshProjects();
            }}
          />
        </div>
      )}
    </div>
  );
}
