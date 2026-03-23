// ============================================================================
// file: frontend/src/pages/Dashboard.jsx
// ============================================================================
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

import CreateProjectCard from "../components/CreateProjectCard";
import ProjectEditorCard from "../components/ProjectEditorCard";
import { SectionTitle, Card, Button, GhostButton, Badge } from "../ui";
import SavedProfilesGrid from "../components/SavedProfilesGrid";
import SavedProjectsGrid from "../components/SavedProjectsGrid";

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

function buildProjectFormData(form, cover) {
  const fd = new FormData();

  const BOOL_KEYS = new Set([
    "is_public",
    "is_job_posting",
    "part_of_larger_project",
    "permit_required",
    "compliance_confirmed",
    "notify_by_email",
  ]);

  const JSON_KEYS = new Set([
    "service_categories",
    "tech_stack",
    "extra_links",
  ]);

  const INT_KEYS = new Set(["sqf"]);
  const DECIMAL_KEYS = new Set(["budget"]);

  Object.entries(form || {}).forEach(([k, v]) => {
    // booleans -> "true"/"false"
    if (BOOL_KEYS.has(k)) {
      fd.append(k, v ? "true" : "false");
      return;
    }

    // json -> stringify
    if (JSON_KEYS.has(k)) {
      const safe =
        v === null || v === undefined ? (k === "service_categories" ? [] : []) : v;
      fd.append(k, JSON.stringify(safe));
      return;
    }

    // integers -> omit if empty
    if (INT_KEYS.has(k)) {
      if (v === "" || v === null || v === undefined) return;
      const n = Number(String(v));
      if (Number.isFinite(n)) fd.append(k, String(Math.trunc(n)));
      return;
    }

    // decimals -> omit if empty
    if (DECIMAL_KEYS.has(k)) {
      if (v === "" || v === null || v === undefined) return;
      fd.append(k, String(v));
      return;
    }

    // default (strings etc.) -> omit ONLY if null/undefined
    if (v === null || v === undefined) return;
    fd.append(k, String(v));
  });

  if (cover) fd.append("cover_image", cover);

  return fd;
}

// treat "true", "1", 1, true as truthy
function isJobPostingFlag(value) {
  if (value === true) return true;
  if (value === 1) return true;
  if (value === "1") return true;
  if (typeof value === "string" && value.toLowerCase() === "true") return true;
  return false;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 768);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---- Saved projects (favorites) ----
  const [savedProjects, setSavedProjects] = useState([]);
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [removingFavoriteId, setRemovingFavoriteId] = useState(null);
  const [createCloseSignal, setCreateCloseSignal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

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

  // ✅ Standardized: same contract as editor uploader -> "images" + "captions[]"
  async function uploadProjectImages(projectId, images) {
    const list = Array.isArray(images) ? images : [];
    const files = list.filter((img) => img?._file);

    if (!projectId || files.length === 0) return;

    const fd = new FormData();
    for (const img of files) {
      fd.append("images", img._file);
      fd.append("captions[]", img.caption || "");
    }

    await api.post(`/projects/${projectId}/images/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  async function deleteProject(projectId) {
    if (!projectId) return;

    const ok = window.confirm(
      "Are you sure?\n\nBy removing the project all the images and info about the project will be lost and the process is not retrievable."
    );
    if (!ok) return;

    setBusy(true);
    try {
      await api.delete(`/projects/${projectId}/`);
      setEditingId("");
      await refreshProjects();
      await refreshMyJobPosts();
      setSaveToast("Deleted ✓  Project removed");
    } catch (err) {
      const data = err?.response?.data;
      alert(
        data?.detail ||
          data?.message ||
          (data ? JSON.stringify(data) : "") ||
          err?.message ||
          "Failed to delete project."
      );
    } finally {
      setBusy(false);
    }
  }

  // --- Job post edit gate (published -> require unpublish) ---
  const [unpublishModal, setUnpublishModal] = useState({
    open: false,
    project: null,
  });

  function requestEditProject(p) {
    if (!p?.id) return;

    // If it's a published job posting, require unpublish first
    if (p.is_job_posting && p.is_public) {
      setUnpublishModal({ open: true, project: p });
      return;
    }

    // otherwise edit normally
    loadEditor(p.id);
  }

  function openEditProject(p) {
    if (!p?.id) return;

    if (window.innerWidth < 768) {
      navigate(`/dashboard/projects/${p.id}/edit`);
      return;
    }

    requestEditProject(p);
  }

  async function unpublishAndEdit() {
    const p = unpublishModal.project;
    if (!p?.id) return;

    setBusy(true);
    try {
      await api.patch(`/projects/${p.id}/`, { is_public: false });
      setUnpublishModal({ open: false, project: null });

      await refreshProjects();
      await refreshMyJobPosts();

      // Now allow editing
      await loadEditor(p.id);
    } catch (err) {
      console.error("[Dashboard] unpublish failed", err?.response || err);
      const data = err?.response?.data;
      alert(
        data?.detail ||
          data?.message ||
          (data ? JSON.stringify(data) : "") ||
          err?.message ||
          "Failed to unpublish."
      );
    } finally {
      setBusy(false);
    }
  }

  // ---- Projects & editor ----
  const [projects, setProjects] = useState([]);
  const [busy, setBusy] = useState(false);

  // Create form state (includes job-posting fields)
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

    // job-posting extensions
    job_summary: "",
    service_categories: [],
    part_of_larger_project: false,
    larger_project_details: "",
    required_expertise: "",
    permit_required: false,
    permit_responsible_party: "",
    compliance_confirmed: false,
    post_privacy: "public",
    private_contractor_username: "",
    notify_by_email: false,
  });
  const [cover, setCover] = useState(null);

  // Editor
  const [editingId, setEditingId] = useState("");

  useEffect(() => {
    const hasEditModal = editingId && isDesktop;
    const hasCreateModal = createOpen;

    if (!hasEditModal && !hasCreateModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingId, createOpen, isDesktop]);

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

    // job-posting extensions
    job_summary: "",
    service_categories: [],
    part_of_larger_project: false,
    larger_project_details: "",
    required_expertise: "",
    permit_required: false,
    permit_responsible_party: "",
    compliance_confirmed: false,
    post_privacy: "public",
    private_contractor_username: "",
    notify_by_email: false,
  });
  const [editImgs, setEditImgs] = useState([]);

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

  // ---- Job posts for current user (job postings only) ----
  const [myJobPosts, setMyJobPosts] = useState([]);

  const refreshMyJobPosts = useCallback(async () => {
    try {
      const { data } = await api.get("/projects/");
      const mineJobs = Array.isArray(data)
        ? data.filter(
            (p) =>
              (p.owner_username || "").toLowerCase() ===
                (meUser.username || "").toLowerCase() &&
              isJobPostingFlag(p.is_job_posting)
          )
        : [];
      setMyJobPosts(mineJobs);
    } catch {
      setMyJobPosts([]);
    }
  }, [meUser.username]);

  // ---- Refresh my projects (all types) ----
  const refreshProjects = useCallback(async () => {
    try {
      const { data } = await api.get("/projects/");
      const all = Array.isArray(data) ? data : [];

      const me = (meUser.username || "").toLowerCase();

      // ✅ All owned items (projects + job posts)
      const mineAll = all.filter((p) => {
        const owner = (p.owner_username || p.owner?.username || "").toLowerCase();
        return owner === me;
      });

      // =========================
      // CHANGED: robust split for UI
      // =========================
      const mineProjects = mineAll.filter((p) => !isJobPostingFlag(p?.is_job_posting));
      const mineJobPosts = mineAll.filter((p) => isJobPostingFlag(p?.is_job_posting));
      // =========================
      // END CHANGED
      // =========================

      setProjects(mineProjects);
      setMyJobPosts(mineJobPosts);

      // ✅ thumbs for BOTH lists
      await refreshMyThumbs(mineAll);
    } catch (err) {
      console.warn("[Dashboard] failed to load my projects", err);
      setProjects([]);
      setMyJobPosts([]);
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
        order: x.order ?? x.sort_order ?? null,
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

        job_summary: meta?.job_summary || "",
        service_categories: Array.isArray(meta?.service_categories)
          ? meta.service_categories
          : [],
        part_of_larger_project: !!meta?.part_of_larger_project,
        larger_project_details: meta?.larger_project_details || "",
        required_expertise: meta?.required_expertise || "",
        permit_required: !!meta?.permit_required,
        permit_responsible_party: meta?.permit_responsible_party || "",
        compliance_confirmed: !!meta?.compliance_confirmed,
        post_privacy: meta?.post_privacy || "public",
        private_contractor_username: meta?.private_contractor_username || "",
        notify_by_email: !!meta?.notify_by_email,
      });

      await refreshImages(pid);
    },
    [refreshImages]
  );

  // ✅ cover = order 0 (backend). UI does NOT reorder due to refreshImages merge.
  async function makeCoverImage(imageId) {
    if (!editingId || !imageId) return;

    const currentCover = editImgs.find((img) => Number(img.order) === 0);

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

      const fd = buildProjectFormData(form, cover);

      const { data } = await api.post("/projects/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.id) {
        await uploadProjectImages(data.id, images);
      }

      await refreshProjects();
      await refreshMyJobPosts();

      // reset create form (include ALL fields you use)
      setForm({
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

        job_summary: "",
        service_categories: [],
        part_of_larger_project: false,
        larger_project_details: "",
        required_expertise: "",
        permit_required: false,
        permit_responsible_party: "",
        compliance_confirmed: false,
        post_privacy: "public",
        private_contractor_username: "",
        notify_by_email: false,

        tech_stack: null,
        extra_links: [],
      });

      setCover(null);
      setCreateOk(true);
      setCreateCloseSignal((n) => n + 1);
      setCreateOpen(false);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        (typeof data === "string" ? data : data ? JSON.stringify(data) : "") ||
        err?.message ||
        "Create failed";
      setCreateErr(msg);
      console.error("[createProject] failed:", err?.response || err);
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

      // normalize booleans for backend consistency
      payload.part_of_larger_project = !!payload.part_of_larger_project;
      payload.permit_required = !!payload.permit_required;
      payload.compliance_confirmed = !!payload.compliance_confirmed;
      payload.notify_by_email = !!payload.notify_by_email;

      if (!Array.isArray(payload.service_categories)) payload.service_categories = [];

      if (payload.cover_image_id == null || payload.cover_image_id === "") {
        delete payload.cover_image_id;
      } else {
        payload.cover_image_id = Number(payload.cover_image_id);
      }

      await api.patch(`/projects/${editingId}/`, payload);

      await refreshProjects();
      await refreshMyJobPosts();

      const title = (payload.title || "").trim();
      setSaveToast(title ? `Saved ✓  “${title}”` : "Saved ✓  Your changes are live");

      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);

      saveToastTimerRef.current = setTimeout(() => setSaveToast(""), 1600);

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

  const handleEditorSubmit = useCallback((e) => saveProjectInfo(e), [editingId, editForm]);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) clearTimeout(saveToastTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // =========================
  // CHANGED: prefer already-available project payload first
  // This helps dashboard cards render faster without waiting for thumbs
  // =========================
  function getProjectCover(p) {
    const fromUrl = p?.cover_image_url ? toUrl(p.cover_image_url) : "";
    const fromFile = p?.cover_image ? toUrl(p.cover_image) : "";
    const fromThumbs = myThumbs?.[p?.id]?.cover || "";
    return fromUrl || fromFile || fromThumbs || "";
  }

  return (
    <div className="space-y-8">
      <header className="mb-1">
        <SectionTitle>Dashboard</SectionTitle>
      </header>

      {/* 1) Create Project */}
      <Card className="rounded-2xl border border-slate-200 bg-white p-0 shadow-none">
        <div className="flex min-h-[250px] flex-col items-center justify-center px-6 py-6 text-center">
          <div className="mb-5 text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="h-12 w-12"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5v9.75A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25V6.75A2.25 2.25 0 0 1 6 4.5h4.19a2.25 2.25 0 0 1 1.59.66l.87.88a2.25 2.25 0 0 0 1.6.66H18A2.25 2.25 0 0 1 20.25 7.5Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v4.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 12h4.5" />
            </svg>
          </div>

          <div className="text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-900">
            {projects.length === 0 ? "No Project" : "Add another project"}
          </div>

          <p className="mt-3 max-w-xl text-[1.05rem] text-slate-500">
            {projects.length === 0
              ? "Get started by creating a new project."
              : "Create another project or switch to job posting."}
          </p>

          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-8 inline-flex h-14 items-center gap-3 rounded-xl !bg-indigo-600 px-8 text-[1.05rem] font-semibold !text-white shadow-sm hover:!bg-indigo-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            {projects.length === 0 ? "New Project" : "Add Project"}
          </Button>
        </div>
      </Card>

      {/* Saved projects */}
      <SavedProjectsGrid />

      {/* SAVED PROFILES (liked public profiles) */}
      <SavedProfilesGrid />

      {/* 1.5) YOUR JOB POSTS (distinct) */}
      <Card className="p-5 border border-sky-200 bg-sky-50/40">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Your Job Posts</div>
            <div className="text-xs text-slate-600">
              Drafts are editable. Published posts require unpublishing to edit.
            </div>
          </div>
          <Badge className="bg-white-600 text-slate-700">{myJobPosts.length} posts</Badge>
        </div>

        {myJobPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sky-200 bg-white p-4 text-sm text-slate-600">
            No job posts yet. Turn on <span className="font-medium">Job Posting</span> when creating a project.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {myJobPosts
              .slice()
              .sort((a, b) => Number(b.is_public) - Number(a.is_public))
              .map((p) => {
                const coverSrc = getProjectCover(p);
                const isPublished = !!p.is_public;

                return (
                  <Card
                    key={`job-${p.id}`}
                    className="overflow-hidden border border-sky-200 bg-white"
                  >
                    <div className="relative">
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

                      <div className="absolute left-3 top-3 flex gap-2">
                        <Badge className="bg-slate-900 text-white">Job post</Badge>
                        {isPublished ? (
                          <Badge className="bg-slate-900 text-white">Published</Badge>
                        ) : (
                          <Badge className="bg-slate-200 text-slate-800">Draft</Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{p.title || "Untitled job post"}</div>
                          {p.location ? (
                            <div className="text-[11px] text-slate-500">{p.location}</div>
                          ) : null}
                        </div>
                        {p.category ? <Badge className="shrink-0">{p.category}</Badge> : null}
                      </div>

                      <div className="line-clamp-2 text-sm text-slate-700">
                        {p.job_summary || p.summary || <span className="opacity-60">No summary</span>}
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
                          type="button"
                          onClick={() => openEditProject(p)}
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

      {/* 3) Your Projects */}
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
              const coverSrc = getProjectCover(p);

              return (
                <Card key={p.id} className="overflow-hidden">
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
                        <div className="truncate font-semibold">{p.title}</div>
                      </div>

                      {p.category ? <Badge className="shrink-0">{p.category}</Badge> : null}
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
                          <span className="opacity-60">Highlights:</span> {p.highlights}
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

                      <Button className="w-1/2 min-w-0" onClick={() => openEditProject(p)}>
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

      {/* ✅ Save feedback */}
      {saveToast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
              ✓
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{saveToast}</div>
              <div className="text-[11px] text-emerald-800/80">
                Nice — updates are saved and live on your project card.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingId && isDesktop ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Edit Project</div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingId("")}
              >
                Close
              </Button>
            </div>

            <div className="p-4">
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
                onDeleteProject={() => deleteProject(editingId)}
                onClose={() => setEditingId("")}
                onView={() => window.open(`/projects/${editingId}`, "_self")}
                onAfterUpload={async () => {
                  await refreshImages(editingId);
                  await refreshProjects();
                  await refreshMyJobPosts();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Create Project</div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="p-4">
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
                closeSignal={createCloseSignal}
                defaultOpen
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Unpublish modal */}
      {unpublishModal?.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="text-sm font-semibold text-slate-900">
              Unpublish this post to enable editing
            </div>
            <div className="mt-2 text-sm text-slate-700">
              Warning: Current post data may be lost. You can re-publish after editing.
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnpublishModal({ open: false, project: null })}
                disabled={busy}
              >
                Keep it published
              </Button>

              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={unpublishAndEdit}
                disabled={busy}
              >
                {busy ? "Unpublishing…" : "Unpublish & Edit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}