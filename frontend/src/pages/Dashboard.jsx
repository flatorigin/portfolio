// ============================================================================
// file: frontend/src/pages/Dashboard.jsx
// ============================================================================
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import ImageUploader from "../components/ImageUploader";
import {
  SectionTitle,
  Card,
  Input,
  Textarea,
  Button,
  GhostButton,
  Badge,
} from "../ui";

// normalize media
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

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
          ...(d.display_name !== undefined
            ? { display_name: d.display_name }
            : {}),
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
      // Backend contract: DELETE /api/projects/<pk>/favorite/
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

  // Create form
  const [form, setForm] = useState({
    title: "",
    summary: "",
    category: "",
    is_public: true,
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
  });
  const [cover, setCover] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Editor
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    category: "",
    is_public: true,
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
  });
  const [editCover, setEditCover] = useState(null);
  const [editImgs, setEditImgs] = useState([]);
  const editorRef = useRef(null);

  // current user (ownership)
  const [meUser, setMeUser] = useState({
    username: localStorage.getItem("username") || "",
  });

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

  const refreshProjects = useCallback(async () => {
    const { data } = await api.get("/projects/");
    setProjects(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const owned = useMemo(() => {
    const ls = (localStorage.getItem("username") || "").toLowerCase();
    const me = (meUser.username || "").toLowerCase();
    return (projects || []).filter((p) => {
      if (typeof p.is_owner === "boolean" && p.is_owner) return true;
      const owner = (p.owner_username || "").toLowerCase();
      return owner && (owner === me || owner === ls);
    });
  }, [projects, meUser.username]);

  const list = owned.length ? owned : projects;

  const refreshImages = useCallback(async (pid) => {
    const { data } = await api.get(`/projects/${pid}/images/`);
    const arr = (data || [])
      .map((x) => ({
        id: x.id,
        url: x.url || x.image || x.src || x.file,
        caption: x.caption || "",
        _localCaption: x.caption || "",
        _saving: false,
      }))
      .filter((x) => !!x.url);
    setEditImgs(arr);
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
        location: meta?.location || "",
        budget: meta?.budget ?? "",
        sqf: meta?.sqf ?? "",
        highlights: meta?.highlights || "",
      });
      setEditCover(null);
      await refreshImages(pid);
      setTimeout(() => {
        editorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
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
          editorRef.current.getBoundingClientRect().top +
          window.scrollY -
          80;
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

  async function createProject(e) {
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
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ""));
      if (cover) fd.append("cover_image", cover);

      const { data } = await api.post("/projects/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProjects((prev) => [data, ...prev]);
      await refreshProjects();
      setForm({
        title: "",
        summary: "",
        category: "",
        is_public: true,
        location: "",
        budget: "",
        sqf: "",
        highlights: "",
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
      if (editCover) {
        const fd = new FormData();
        Object.entries(editForm).forEach(([k, v]) => fd.append(k, v ?? ""));
        fd.append("cover_image", editCover);
        await api.patch(`/projects/${editingId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.patch(`/projects/${editingId}/`, editForm);
      }
      await refreshProjects();
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
      alert(
        e?.response?.data ? JSON.stringify(e.response.data) : String(e)
      );
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
    } finally {
      setBusy(false);
    }
  }

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
                    e.currentTarget.style.display = "none";
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

              {(meLite.service_location ||
                meLite.coverage_radius_miles) && (
                <div className="mt-1 text-xs text-slate-600">
                  {meLite.service_location || "Location not set"}
                  {meLite.coverage_radius_miles !== "" && (
                    <> · {meLite.coverage_radius_miles} mile radius</>
                  )}
                </div>
              )}

              {meLite.bio && (
                <p className="mt-2 text-xs text-slate-600">
                  {meLite.bio}
                </p>
              )}

              {!meLite.service_location && !meLite.bio && (
                <p className="mt-2 text-xs text-slate-500">
                  Add your service area and a short bio so clients know
                  who you are.
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
          <h2 className="text-sm font-semibold text-slate-800">
            Saved projects
          </h2>
          <span className="text-[11px] text-slate-500">
            {savedProjects.length} saved
          </span>
        </div>

        {savedProjects.length === 0 ? (
          <p className="text-xs text-slate-500">
            You haven’t saved any projects yet. Hit “Save” on any
            interesting project to keep it here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {(showAllSaved
                ? savedProjects
                : savedProjects.slice(0, 3)
              ).map((fav) => {
                const coverSrc = toUrl(
                  fav.project_cover_image ||
                    fav.project_cover ||
                    (fav.project &&
                      (fav.project.cover_image || fav.project.cover)) ||
                    ""
                );

                const projectId = extractProjectId(fav);

                const title =
                  fav.project_title ||
                  fav.project?.title ||
                  (projectId ? `Project #${projectId}` : "Project");

                const owner =
                  fav.project_owner_username ||
                  fav.project?.owner_username;

                const category =
                  fav.project_category || fav.project?.category;

                const summary =
                  fav.project_summary || fav.project?.summary;

                const location =
                  fav.project_location || fav.project?.location;

                const budget =
                  fav.project_budget || fav.project?.budget;

                const sqf =
                  fav.project_sqf || fav.project?.sqf;

                const highlights =
                  fav.project_highlights ||
                  fav.project?.highlights;

                const removing = removingFavoriteId === projectId;

                return (
                  <Card
                    key={fav.id ?? `p-${projectId}`}
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
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {title}
                          </div>
                          {owner && (
                            <div className="text-[11px] text-slate-500">
                              by {owner}
                            </div>
                          )}
                        </div>
                        {category && <Badge>{category}</Badge>}
                      </div>

                      <div className="line-clamp-2 text-sm text-slate-700">
                        {summary || (
                          <span className="opacity-60">No summary</span>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        {location && (
                          <div>
                            <span className="opacity-60">
                              Location:
                            </span>{" "}
                            {location}
                          </div>
                        )}
                        {budget && (
                          <div>
                            <span className="opacity-60">
                              Budget:
                            </span>{" "}
                            {budget}
                          </div>
                        )}
                        {sqf && (
                          <div>
                            <span className="opacity-60">Sq Ft:</span>{" "}
                            {sqf}
                          </div>
                        )}
                        {highlights && (
                          <div className="col-span-2 truncate">
                            <span className="opacity-60">
                              Highlights:
                            </span>{" "}
                            {highlights}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <GhostButton
                          onClick={() =>
                            window.open(
                              `/projects/${projectId}`,
                              "_self"
                            )
                          }
                          disabled={!projectId || removing}
                        >
                          Open
                        </GhostButton>
                        <Button
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
                  {showAllSaved
                    ? "Show fewer"
                    : `Show all ${savedProjects.length}`}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 1) CREATE PROJECT — collapsible */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">
            Create Project
          </div>
          <div className="flex items-center gap-2">
            <Badge>{owned.length} owned</Badge>
          </div>
        </div>

        <Button
          type="button"
          className="mb-3"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Hide project form" : "Create new project"}
        </Button>

        {showCreate && (
          <>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Project Info (Draft)
            </div>

            <form
              onSubmit={createProject}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Project Name
                </label>
                <Input
                  placeholder="e.g. Lake House Revamp"
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Category
                </label>
                <Input
                  placeholder="e.g. Residential"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">
                  Summary
                </label>
                <Textarea
                  placeholder="One or two sentences…"
                  value={form.summary}
                  onChange={(e) =>
                    setForm({ ...form, summary: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Location (not address)
                </label>
                <Input
                  placeholder="City, State (optional)"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Budget
                </label>
                <Input
                  placeholder="e.g. 250000"
                  inputMode="numeric"
                  value={form.budget}
                  onChange={(e) =>
                    setForm({ ...form, budget: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Square Feet
                </label>
                <Input
                  placeholder="e.g. 1800"
                  inputMode="numeric"
                  value={form.sqf}
                  onChange={(e) =>
                    setForm({ ...form, sqf: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Highlights (tags / text)
                </label>
                <Input
                  placeholder="comma-separated: modern, lake-view"
                  value={form.highlights}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      highlights: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Cover (optional)
                </label>
                <input
                  type="file"
                  onChange={(e) =>
                    setCover(e.target.files?.[0] || null)
                  }
                />
                {cover && (
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {cover.name}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={form.is_public}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        is_public: e.target.checked,
                      })
                    }
                  />
                  Public
                </label>
              </div>
              <div className="md:col-span-2">
                {createErr && (
                  <div className="md:col-span-2 text-sm text-red-700">
                    {createErr}
                  </div>
                )}
                {createOk && !createErr && (
                  <div className="md:col-span-2 text-sm text-green-700">
                    Project created.
                  </div>
                )}
                <Button disabled={busy}>Create Project</Button>
              </div>
            </form>
          </>
        )}
      </Card>

      {/* 2) YOUR PROJECTS */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">
            Your Projects
          </div>
          <Badge>{list.length} shown</Badge>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            You don’t have any projects yet.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {list.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                {p.cover_image ? (
                  <img
                    src={p.cover_image}
                    alt=""
                    className="block h-36 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-slate-100 text-sm text-slate-500">
                    No cover
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="truncate font-semibold">
                      {p.title}
                    </div>
                    {p.category ? <Badge>{p.category}</Badge> : null}
                  </div>
                  <div className="line-clamp-2 text-sm text-slate-700">
                    {p.summary || (
                      <span className="opacity-60">No summary</span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    {p.location ? (
                      <div>
                        <span className="opacity-60">Location:</span>{" "}
                        {p.location}
                      </div>
                    ) : null}
                    {p.budget ? (
                      <div>
                        <span className="opacity-60">Budget:</span>{" "}
                        {p.budget}
                      </div>
                    ) : null}
                    {p.sqf ? (
                      <div>
                        <span className="opacity-60">Sq Ft:</span>{" "}
                        {p.sqf}
                      </div>
                    ) : null}
                    {p.highlights ? (
                      <div className="col-span-2 truncate">
                        <span className="opacity-60">
                          Highlights:
                        </span>{" "}
                        {p.highlights}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <GhostButton
                      onClick={() =>
                        window.open(`/projects/${p.id}`, "_self")
                      }
                    >
                      Open
                    </GhostButton>
                    <Button onClick={() => loadEditor(p.id)}>Edit</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* 3) EDITOR */}
      {editingId && (
        <div ref={editorRef}>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">
                Editing Project #{editingId}
              </div>
              <div className="flex items-center gap-2">
                <GhostButton
                  onClick={() =>
                    window.open(`/projects/${editingId}`, "_self")
                  }
                >
                  View
                </GhostButton>
                <GhostButton onClick={() => setEditingId("")}>
                  Close
                </GhostButton>
              </div>
            </div>

            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Project Info (Draft)
            </div>

            <form
              onSubmit={saveProjectInfo}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Project Name
                </label>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  placeholder="Project name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Category
                </label>
                <Input
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      category: e.target.value,
                    })
                  }
                  placeholder="Category"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">
                  Summary
                </label>
                <Textarea
                  value={editForm.summary}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      summary: e.target.value,
                    })
                  }
                  placeholder="Short description..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Location (not address)
                </label>
                <Input
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      location: e.target.value,
                    })
                  }
                  placeholder="City, State"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Budget
                </label>
                <Input
                  value={editForm.budget}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      budget: e.target.value,
                    })
                  }
                  inputMode="numeric"
                  placeholder="e.g. 250000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Square Feet
                </label>
                <Input
                  value={editForm.sqf}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      sqf: e.target.value,
                    })
                  }
                  inputMode="numeric"
                  placeholder="e.g. 1800"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Highlights (tags / text)
                </label>
                <Input
                  value={editForm.highlights}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      highlights: e.target.value,
                    })
                  }
                  placeholder="comma-separated tags"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  Cover (replace)
                </label>
                <input
                  type="file"
                  onChange={(e) =>
                    setEditCover(e.target.files?.[0] || null)
                  }
                />
                {editCover && (
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {editCover.name}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={!!editForm.is_public}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        is_public: e.target.checked,
                      })
                    }
                  />
                  Public
                </label>
              </div>

              <div className="md:col-span-2">
                <Button disabled={busy}>Save Changes</Button>
              </div>
            </form>

            {/* Images */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm text-slate-600">Images</div>
                <Badge>{editImgs.length} total</Badge>
              </div>
              {editImgs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No images yet.
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                  {editImgs.map((it) => (
                    <figure
                      key={it.id ?? it.url}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <img
                        src={it.url}
                        alt=""
                        className="mb-2 h-36 w-full rounded-md object-cover"
                      />
                      <input
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        placeholder="Caption…"
                        value={it._localCaption}
                        onChange={(e) =>
                          setEditImgs((prev) =>
                            prev.map((x) =>
                              x.id === it.id
                                ? {
                                    ...x,
                                    _localCaption: e.target.value,
                                  }
                                : x
                            )
                          )
                        }
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <GhostButton
                          onClick={() => {
                            if (it.id) deleteImage(it);
                          }}
                          disabled={!it.id || busy}
                          title={
                            it.id
                              ? "Delete this image"
                              : "This API response has no image id — delete is disabled"
                          }
                        >
                          Delete
                        </GhostButton>
                        <Button
                          onClick={() => saveImageCaption(it)}
                          disabled={
                            it._saving ||
                            it._localCaption === it.caption
                          }
                        >
                          {it._saving ? "Saving…" : "Save caption"}
                        </Button>
                      </div>
                    </figure>
                  ))}
                </div>
              )}
            </div>

            {/* Uploader */}
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold text-slate-800">
                Add Images
              </div>
              <div className="mb-2 text-xs text-slate-600">
                Drag & drop or click; add captions; upload.
              </div>
              <ImageUploader
                projectId={editingId}
                onUploaded={async () => {
                  await refreshImages(editingId);
                  await refreshProjects();
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
