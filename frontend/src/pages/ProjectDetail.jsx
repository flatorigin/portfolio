// =======================================
// file: frontend/src/pages/ProjectDetail.jsx
// Project page + lightbox-style comments modal + project edit + extra links
// =======================================
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Badge, Card, Button, Textarea } from "../ui";
import ProjectEditorCard from "../components/ProjectEditorCard";

function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function buildMapSrc(location) {
  if (!location) return null;
  const q = encodeURIComponent(location);
  return `https://www.google.com/maps?q=${q}&z=11&output=embed`;
}

export default function ProjectDetail() {
  const { id } = useParams();

  // project + media (public view)
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);

  // edit project state (for ProjectEditorCard)
  const [isEditing, setIsEditing] = useState(false);
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
    // safe extra (used elsewhere)
    cover_image_id: null,
  });

  const [editCoverFile, setEditCoverFile] = useState(null); // kept for backwards-compatibility
  const [editImages, setEditImages] = useState([]); // [{id,url,caption,_localCaption,_saving}]
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState("");

  // cover image selected from images list
  const [editCoverImageId, setEditCoverImageId] = useState(null);

  // current user
  const [meUser, setMeUser] = useState(null);
  const authed = !!localStorage.getItem("access");

  // favorite state
  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  // comments state
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);

  // editing state for comments
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // modal state (project + comments)
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // ─────────────────────────────
  // FETCH CURRENT USER
  // ─────────────────────────────
  useEffect(() => {
    if (!authed) {
      setMeUser(null);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get("/auth/users/me/");
        setMeUser(data);
      } catch {
        try {
          const { data } = await api.get("/users/me/");
          setMeUser(data);
        } catch (err) {
          console.warn("[ProjectDetail] failed to fetch meUser", err);
          setMeUser(null);
        }
      }
    })();
  }, [authed]);

  const isOwnerUser =
    authed &&
    project &&
    meUser &&
    (project.owner_username || "").toLowerCase() ===
      (meUser.username || "").toLowerCase();

  const myUsername = meUser?.username || null;

  // ─────────────────────────────
  // COVER SETTER (backend-friendly)
  // Tries multiple common field names on the image endpoint.
  // ─────────────────────────────
  async function setCoverOnBackend(projectId, imgId) {
    const normalized = imgId == null ? null : Number(imgId);
    if (!projectId || normalized == null) return;

    const attempts = [
      { is_cover: true },
      { is_cover_image: true },
      { is_cover_photo: true },
    ];

    for (const body of attempts) {
      try {
        await api.patch(`/projects/${projectId}/images/${normalized}/`, body);
        return;
      } catch {
        // try next
      }
    }

    // fallback: some APIs use order=0 as "cover"
    try {
      await api.patch(`/projects/${projectId}/images/${normalized}/`, {
        order: 0,
      });
      return;
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        data?.non_field_errors ||
        (typeof data === "string" ? data : null) ||
        e?.message ||
        "Failed to set cover image.";
      throw new Error(
        typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)
      );
    }
  }

  // ─────────────────────────────
  // IMAGES (for both public view + editor card)
  // ─────────────────────────────
  const refreshImages = useCallback(async () => {
    if (!id) return;

    try {
      const { data } = await api.get(`/projects/${id}/images/`);
      const raw = Array.isArray(data) ? data : [];

      const publicImages = raw
        .map((x) => ({
          url: toUrl(x.url || x.image || x.src || x.file),
          caption: x.caption || "",
        }))
        .filter((x) => !!x.url);

      const editableImages = raw
        .map((x) => {
          const imgId = x.id ?? x.pk ?? x.image_id ?? null;
          return {
            id: imgId,
            url: toUrl(x.url || x.image || x.src || x.file),
            caption: x.caption || "",
            _localCaption: x.caption || "",
            _saving: false,
          };
        })
        .filter((x) => !!x.url);

      setImages(publicImages);
      setEditImages(editableImages);

      // Determine backend-selected cover id (if any)
      const flagged = raw.find(
        (img) => img?.is_cover || img?.is_cover_image || img?.is_cover_photo
      );

      const flaggedIdRaw =
        flagged?.id ?? flagged?.pk ?? flagged?.image_id ?? null;

      const flaggedId = flaggedIdRaw == null ? null : Number(flaggedIdRaw);

      // Only apply backend cover if user hasn't chosen one in this session
      if (flaggedId != null) {
        const exists = editableImages.some((it) => Number(it.id) === flaggedId);
        if (exists) {
          setEditCoverImageId((prev) => (prev == null ? flaggedId : prev));
          setEditForm((prev) => ({
            ...prev,
            cover_image_id:
              prev?.cover_image_id == null ? flaggedId : prev.cover_image_id,
          }));
        }
      }
    } catch (err) {
      console.error("[ProjectDetail] refreshImages failed:", err);
      setImages([]);
      setEditImages([]);
    }
  }, [id]);

  // ─────────────────────────────
  // LOAD PROJECT + COMMENTS (+ IMAGES via refreshImages)
  // ─────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!id) return;

    try {
      const [{ data: meta }, { data: cmts }] = await Promise.all([
        api.get(`/projects/${id}/`),
        api.get(`/projects/${id}/comments/`).catch(() => ({ data: [] })),
      ]);

      setProject(meta || null);
      setComments(Array.isArray(cmts) ? cmts : []);

      if (meta) {
        const coverFromMetaRaw =
          meta.cover_image_id ??
          (meta.cover_image && meta.cover_image.id) ??
          meta.cover_image_pk ??
          null;

        const coverFromMeta =
          coverFromMetaRaw == null ? null : Number(coverFromMetaRaw);

        setEditForm({
          title: meta.title || "",
          summary: meta.summary || "",
          category: meta.category || "",
          is_public: meta.is_public ?? true,
          is_job_posting: !!meta.is_job_posting,
          location: meta.location || "",
          budget: meta.budget ?? "",
          sqf: meta.sqf ?? "",
          highlights: meta.highlights || "",
          material_url: meta.material_url || "",
          material_label: meta.material_label || "",
          cover_image_id: coverFromMeta,
        });

        setEditCoverFile(null);
        setEditCoverImageId(coverFromMeta);
      } else {
        setEditForm({
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

        setEditCoverFile(null);
        setEditCoverImageId(null);
      }

      await refreshImages();
    } catch (err) {
      console.error("[ProjectDetail] fetchAll failed:", err);
      setProject(null);
      setImages([]);
      setComments([]);
      setEditImages([]);
      setEditCoverImageId(null);
    }
  }, [id, refreshImages]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─────────────────────────────
  // INITIAL SAVED STATE
  // ─────────────────────────────
  useEffect(() => {
    if (!authed || !project || !meUser) {
      setIsSaved(false);
      return;
    }

    const isOwner =
      (project.owner_username || "").toLowerCase() ===
      (meUser.username || "").toLowerCase();

    if (isOwner) {
      setIsSaved(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/projects/${project.id}/favorite/`);
        const favored = data?.is_favorited ?? data?.favorited ?? true;
        if (!cancelled) setIsSaved(!!favored);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setIsSaved(false);
        } else {
          console.warn(
            "[ProjectDetail] failed to check favorite state",
            err?.response || err
          );
          setIsSaved(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, project, meUser]);

  async function toggleSave() {
    if (!authed || !project || saveBusy || isOwnerUser) return;

    const projectId = project.id;
    if (!projectId) return;

    setSaveBusy(true);
    try {
      await api.post(`/projects/${projectId}/favorite/`);
      setIsSaved(true);
      window.dispatchEvent(new CustomEvent("favorites:changed"));
    } catch (err) {
      console.error("[ProjectDetail] save favorite failed", err?.response || err);
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        err?.message ||
        "Failed to save project. Please try again.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaveBusy(false);
    }
  }

  // ─────────────────────────────
  // IMAGE NAVIGATION (for modal)
  // ─────────────────────────────
  const nextImage = useCallback(() => {
    if (!images.length) return;
    setActiveImageIdx((idx) => (idx + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (!images.length) return;
    setActiveImageIdx((idx) => (idx - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!commentsOpen) return;
    const handler = (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextImage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevImage();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commentsOpen, nextImage, prevImage]);

  // ─────────────────────────────
  // COMMENTS HELPERS
  // ─────────────────────────────
  const roots = useMemo(() => comments.filter((c) => !c.in_reply_to), [comments]);

  const repliesByParent = useMemo(
    () =>
      comments.reduce((acc, c) => {
        if (c.in_reply_to) {
          if (!acc[c.in_reply_to]) acc[c.in_reply_to] = [];
          acc[c.in_reply_to].push(c);
        }
        return acc;
      }, {}),
    [comments]
  );

  async function submitComment(e) {
    e.preventDefault();
    setCommentError("");

    if (!authed) {
      setCommentError("You need to be logged in to comment.");
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    setCommentBusy(true);

    try {
      const payload = { text: trimmed };
      if (replyingTo && isOwnerUser) payload.in_reply_to = replyingTo.id;

      await api.post(`/projects/${id}/comments/`, payload);
      const { data: fresh } = await api.get(`/projects/${id}/comments/`);
      setComments(Array.isArray(fresh) ? fresh : []);

      setCommentText("");
      setReplyingTo(null);
      setCommentError("");
    } catch (err) {
      console.error("[Comment] error:", err);

      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.text ||
        data?.non_field_errors ||
        data?.message ||
        "Failed to post comment.";

      setCommentError(
        typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)
      );
    } finally {
      setCommentBusy(false);
    }
  }

  function replyAsOwnerTo(comment) {
    if (!isOwnerUser) return;
    const handle = comment.author_username ? `@${comment.author_username} ` : "";
    setReplyingTo(comment);
    setCommentText((prev) => {
      if (prev.trim().startsWith(handle.trim())) return prev;
      return handle + prev;
    });
  }

  function startEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditingText(comment.text || "");
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingText("");
  }

  async function saveEditComment(comment) {
    if (!editingText.trim()) return;
    setEditBusy(true);
    try {
      const { data } = await api.patch(
        `/projects/${id}/comments/${comment.id}/`,
        { text: editingText.trim() }
      );
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, text: data.text } : c))
      );
      cancelEditComment();
    } catch (err) {
      console.error("edit comment error:", err?.response || err);
      alert("Failed to update comment.");
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteComment(comment) {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${id}/comments/${comment.id}/`);
      setComments((prev) =>
        prev.filter((c) => c.id !== comment.id && c.in_reply_to !== comment.id)
      );
    } catch (err) {
      console.error("delete comment error:", err?.response || err);
      alert("Failed to delete comment.");
    }
  }

  // ─────────────────────────────
  // PROJECT EDIT SAVE HANDLERS (for ProjectEditorCard)
  // ─────────────────────────────
  async function handleSaveEdits(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!project) return;

    setSavingEdits(true);
    setEditError("");

    try {
      const projectId = project.id;
      if (!projectId) throw new Error("Missing project id");

      // Normalize cover id from state OR form
      const normalizedCoverId =
        editCoverImageId ?? editForm.cover_image_id ?? null;

      // Do NOT send cover_* fields to project endpoint (your backend 400s on that).
      const payload = {
        title: editForm.title || "",
        summary: editForm.summary || "",
        category: editForm.category || "",
        is_public: !!editForm.is_public,
        is_job_posting: !!editForm.is_job_posting,
        location: editForm.location || "",
        budget: editForm.budget ?? "",
        sqf: editForm.sqf ?? "",
        highlights: editForm.highlights || "",
        material_url: editForm.material_url || "",
        material_label: editForm.material_label || "",
      };

      let data;

      if (editCoverFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) =>
          fd.append(k, v == null ? "" : String(v))
        );
        fd.append("cover_image", editCoverFile);

        const resp = await api.patch(`/projects/${projectId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        data = resp.data;
      } else {
        const resp = await api.patch(`/projects/${projectId}/`, payload);
        data = resp.data;
      }

      // After project saves, set cover via image endpoint
      if (normalizedCoverId != null) {
        try {
          await setCoverOnBackend(projectId, normalizedCoverId);
        } catch (coverErr) {
          console.warn("[cover] failed to set cover:", coverErr);
          alert(`Cover update failed: ${coverErr?.message || coverErr}`);
        }
      }

      setProject(data);

      // Keep form stable; preserve selected cover id
      setEditForm((prev) => ({
        ...prev,
        title: data?.title ?? prev.title,
        summary: data?.summary ?? prev.summary,
        category: data?.category ?? prev.category,
        is_public: data?.is_public ?? prev.is_public,
        is_job_posting: !!(data?.is_job_posting ?? prev.is_job_posting),
        location: data?.location ?? prev.location,
        budget: data?.budget ?? prev.budget,
        sqf: data?.sqf ?? prev.sqf,
        highlights: data?.highlights ?? prev.highlights,
        material_url: data?.material_url ?? prev.material_url,
        material_label: data?.material_label ?? prev.material_label,
        cover_image_id:
          normalizedCoverId != null ? Number(normalizedCoverId) : prev.cover_image_id,
      }));

      setEditCoverFile(null);

      if (normalizedCoverId != null) {
        setEditCoverImageId(Number(normalizedCoverId));
      }

      await refreshImages();
      setIsEditing(false);
    } catch (err) {
      console.error("[handleSaveEdits] error:", err?.response || err);

      const status = err?.response?.status;
      const data = err?.response?.data;

      let msg =
        data?.detail ||
        data?.message ||
        data?.non_field_errors ||
        err?.message ||
        data ||
        "Could not save changes. Please try again.";

      if (typeof msg !== "string") msg = JSON.stringify(msg, null, 2);

      const full = `Save failed${status ? ` (status ${status})` : ""}: ${msg}`;
      setEditError(full);
      alert(full);
    } finally {
      setSavingEdits(false);
    }
  }

  async function handleSaveImageCaption(img) {
    if (!project || !img?.id) return;
    setEditImages((prev) =>
      prev.map((x) => (x.id === img.id ? { ...x, _saving: true } : x))
    );
    try {
      await api.patch(`/projects/${project.id}/images/${img.id}/`, {
        caption: img._localCaption,
      });
      await refreshImages();
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
      setEditImages((prev) =>
        prev.map((x) => (x.id === img.id ? { ...x, _saving: false } : x))
      );
    }
  }

  async function handleDeleteImage(img) {
    if (!project || !img?.id) return;
    if (!window.confirm("Delete this image? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${project.id}/images/${img.id}/`);
      await refreshImages();
    } catch (e) {
      console.error("delete image error:", e?.response || e);
      alert("Failed to delete image.");
    }
  }

  const mapSrc = buildMapSrc(project?.location || "");

  const currentImage =
    images.length && activeImageIdx >= 0
      ? images[Math.min(activeImageIdx, images.length - 1)]
      : null;

  // Cover URL used for the banner on the project card
  const coverUrl = useMemo(() => {
    const selectedId = editCoverImageId ?? editForm.cover_image_id ?? null;

    if (selectedId != null) {
      const match = editImages.find(
        (im) => Number(im.id) === Number(selectedId)
      );
      if (match?.url) return match.url;
    }

    // fallback: first image
    return images?.[0]?.url || null;
  }, [editCoverImageId, editForm.cover_image_id, editImages, images]);

  // ─────────────────────────────
  // RENDER
  // ─────────────────────────────
  const renderCommentBlock = (c, isReply = false) => {
    const replies = repliesByParent[c.id] || [];

    const isOwnerAuthor =
      project &&
      c.author_username &&
      c.author_username.toLowerCase() ===
        (project.owner_username || "").toLowerCase();

    const isMine =
      myUsername &&
      c.author_username &&
      c.author_username.toLowerCase() === myUsername.toLowerCase();

    const isEditingComment = editingCommentId === c.id;

    return (
      <div
        key={c.id}
        className={
          "rounded-lg border border-slate-200 bg-white p-3 text-sm " +
          (isReply ? "ml-3" : "")
        }
      >
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">
              {c.author_username || "Anonymous"}
            </span>
            {isOwnerAuthor && (
              <span className="rounded-full bg-slate-900 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
                Owner
              </span>
            )}
          </div>
          <span>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
        </div>

        {isEditingComment ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
            />
            <div className="flex items-center gap-2 text-xs">
              <Button
                type="button"
                disabled={editBusy}
                onClick={() => saveEditComment(c)}
              >
                {editBusy ? "Saving…" : "Save"}
              </Button>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={cancelEditComment}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-slate-800">{c.text}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {isOwnerUser && !isOwnerAuthor && (
            <button
              type="button"
              onClick={() => replyAsOwnerTo(c)}
              className="font-medium hover:text-slate-700"
            >
              Reply as owner
            </button>
          )}
          {isMine && !isEditingComment && (
            <>
              <button
                type="button"
                onClick={() => startEditComment(c)}
                className="font-medium hover:text-slate-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteComment(c)}
                className="font-medium text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </>
          )}
        </div>

        {replies.length > 0 && (
          <div className="mt-2 space-y-2 border-l border-slate-200 pl-3">
            {replies.map((r) => renderCommentBlock(r, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link to="/" className="hover:underline">
              Explore
            </Link>
            <span className="mx-1">/</span>
            <span className="text-slate-700">Project</span>
          </div>
        </div>
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back
        </Link>
      </div>

      {/* Main project card */}
      <Card className="mb-4 overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        {/* Cover banner */}
        {coverUrl && (
          <div className="relative h-[200px] w-full bg-slate-200">
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </div>
        )}

        {/* header */}
        <div
          className={
            "border-b border-slate-100 px-5 py-4 text-white sm:px-6 " +
            (project?.is_job_posting
              ? "bg-[#37C5F0]"
              : "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900")
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* LEFT: title + meta */}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">
                {project?.title || `Project #${id}`}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/90">
                {project?.category && (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium">
                    {project.category}
                  </span>
                )}
                {project?.owner_username && (
                  <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px]">
                    by {project.owner_username}
                  </span>
                )}

                {project?.is_job_posting && (
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[10px] font-semibold tracking-wide text-[#0A3443]">
                    JOB POSTING
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT: owner edit button OR Save button */}
            <div className="flex items-start gap-2">
              {authed && project && isOwnerUser && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing((prev) => !prev)}
                  className="border-white/70 bg-white/10 text-white hover:bg-white/20"
                >
                  {isEditing ? "Close edit" : "Edit project"}
                </Button>
              )}

              {authed && project && !isOwnerUser && (
                <Button
                  type="button"
                  variant={isSaved ? "outline" : "default"}
                  onClick={toggleSave}
                  disabled={saveBusy || isSaved}
                  className={
                    "text-sm " +
                    (isSaved
                      ? "bg-white text-[#0A3443] hover:bg-white"
                      : "bg-white text-[#0A3443] hover:bg-sky-50")
                  }
                >
                  {saveBusy ? "Saving…" : isSaved ? "Saved" : "Save"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* body */}
        <div className="space-y-6 p-4 sm:p-6">
          {project?.summary && (
            <p className="text-sm leading-relaxed text-slate-700 sm:text-[15px]">
              {project.summary}
            </p>
          )}

          {/* OWNER-ONLY PROJECT EDIT CARD */}
          {isOwnerUser && isEditing && project && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-0">
              <ProjectEditorCard
                mode="edit"
                projectId={project.id}
                form={editForm}
                setForm={setEditForm}
                coverFile={editCoverFile}
                setCoverFile={setEditCoverFile}
                busy={savingEdits}
                images={editImages}
                setImages={setEditImages}
                onSaveImageCaption={handleSaveImageCaption}
                onDeleteImage={handleDeleteImage}
                onSubmit={handleSaveEdits}
                onClose={() => setIsEditing(false)}
                onView={() => window.open(`/projects/${project.id}`, "_self")}
                onAfterUpload={async () => {
                  await refreshImages();
                }}
                // Keep cover selection in sync so banner updates immediately
                coverImageId={editCoverImageId}
                onCoverImageChange={(val) => {
                  const normalized = val == null ? null : Number(val);
                  setEditCoverImageId(normalized);
                  setEditForm((prev) => ({ ...prev, cover_image_id: normalized }));
                }}
                setCoverImageId={(val) => {
                  const normalized = val == null ? null : Number(val);
                  setEditCoverImageId(normalized);
                  setEditForm((prev) => ({ ...prev, cover_image_id: normalized }));
                }}
              />
              {editError && (
                <p className="px-5 pb-3 pt-1 text-xs text-red-600">{editError}</p>
              )}
            </div>
          )}

          {/* Meta / Project details */}
          {(project?.location ||
            project?.budget ||
            project?.sqf ||
            project?.highlights) && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project details
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-700">
                {project?.location && (
                  <div className="min-w-[140px] flex-wrap">
                    <div className="text-xs font-medium uppercase text-slate-500">
                      Location
                    </div>
                    <div className="text-lg font-semibold">{project.location}</div>
                  </div>
                )}

                {project?.budget && (
                  <div className="min-w-[140px] flex-wrap">
                    <div className="text-xs font-medium uppercase text-slate-500">
                      Budget
                    </div>
                    <div className="text-lg font-semibold">{project.budget}</div>
                  </div>
                )}

                {project?.sqf && (
                  <div className="min-w-[140px] flex-wrap ">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Sq Ft
                    </div>
                    <div className="text-lg font-semibold">{project.sqf}</div>
                  </div>
                )}

                {project?.highlights && (
                  <div className="min-w-[140px] flex-wrap">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Highlights
                    </div>
                    <div className="mt-0.5 whitespace-pre-line text-lg font-semibold">
                      {project.highlights}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Materials / tools used */}
          {(project?.material_url ||
            project?.material_label ||
            (Array.isArray(project?.extra_links) &&
              project.extra_links.length > 0)) && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Materials &amp; tools used
              </div>

              {(project?.material_label || project?.material_url) && (
                <div className="flex items-center gap-3">
                  {project?.material_url && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                      <span className="text-xs text-slate-500">
                        {(() => {
                          try {
                            return new URL(project.material_url).hostname
                              .replace(/^www\./, "")
                              .slice(0, 2)
                              .toUpperCase();
                          } catch {
                            return "LK";
                          }
                        })()}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0">
                    {project?.material_label && (
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {project.material_label}
                      </div>
                    )}
                    {project?.material_url && (
                      <a
                        href={project.material_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-blue-600 hover:underline"
                      >
                        {project.material_url}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(project?.extra_links) &&
                project.extra_links.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {project.extra_links.map((row, index) => {
                      const label = row?.label || "";
                      const url = row?.url || "";
                      if (!label && !url) return null;

                      return (
                        <div
                          key={`${url || label || index}`}
                          className="flex items-start gap-2"
                        >
                          <div className="mt-[3px] flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-500">
                            +
                          </div>
                          <div className="min-w-0">
                            {label && (
                              <div className="text-xs font-semibold text-slate-800">
                                {label}
                              </div>
                            )}
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-[11px] text-blue-600 hover:underline"
                              >
                                {url}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              <p className="mt-2 text-[11px] text-slate-500">
                These links point to products or materials used in this project (for
                example, tools, finishes, or suppliers).
              </p>
            </div>
          )}

          {/* Project media – BLOCK CARD layout */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project media
              </div>
              {images.length > 0 && (
                <div className="text-[11px] text-slate-500">
                  {images.length} photo{images.length === 1 ? "" : "s"}
                </div>
              )}
            </div>

            {images.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                No media uploaded for this project.
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.url + i}
                    onClick={() => {
                      setActiveImageIdx(i);
                      setCommentsOpen(true);
                    }}
                    className="group w-full max-w-xs overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:shadow-md"
                  >
                    <img
                      src={img.url}
                      alt={img.caption || ""}
                      className="block h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    {img.caption && (
                      <div className="px-3 py-2 text-xs text-slate-700">
                        {img.caption}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* map */}
          {mapSrc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service area map
                </div>
                {project?.location && (
                  <div className="text-[11px] text-slate-500">
                    Centered on: <span className="font-medium">{project.location}</span>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <iframe
                  title="Project location map"
                  src={mapSrc}
                  className="h-64 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* comment trigger under project */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
        >
          <span aria-hidden>💬</span>
          <span>{comments.length || 0} comments</span>
        </button>
      </div>

      {/* FULLSCREEN MODAL: images + comments */}
      {commentsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 sm:p-4">
          <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:h-[90vh] md:flex-row">
            {/* Left: image area */}
            <div className="relative flex-1 bg-black md:min-w-[60%]">
              {currentImage ? (
                <>
                  <div className="flex h-full flex-col">
                    <div className="flex-1 bg-black">
                      <img
                        src={currentImage.url}
                        alt={currentImage.caption || ""}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    {images.length > 1 && (
                      <div className="flex items-center justify-center gap-1 bg-black/80 px-3 py-2 text-[11px] text-slate-100">
                        <button
                          type="button"
                          onClick={prevImage}
                          className="mr-1 rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        >
                          ‹
                        </button>
                        {images.map((img, i) => (
                          <button
                            key={img.url + i}
                            type="button"
                            onClick={() => setActiveImageIdx(i)}
                            className={
                              "mx-[2px] rounded-full px-2 py-0.5 " +
                              (i === activeImageIdx
                                ? "bg-white text-black"
                                : "bg-white/10 text-slate-100 hover:bg-white/20")
                            }
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={nextImage}
                          className="ml-1 rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>

                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-lg leading-none text-white hover:bg-black/80"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-lg leading-none text-white hover:bg-black/80"
                      >
                        ›
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-200">
                  No media
                </div>
              )}
            </div>

            {/* Right: comments column */}
            <div className="flex w-full max-w-sm flex-col border-t border-slate-200 bg-slate-50 md:h-full md:border-l md:border-t-0">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {project?.title || `Project #${id}`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {comments.length || 0} comment{comments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCommentsOpen(false)}
                  className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3 text-sm">
                {roots.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No comments yet. Be the first to comment.
                  </p>
                ) : (
                  roots.map((c) => renderCommentBlock(c))
                )}
              </div>

              <div className="border-t border-slate-200 bg-white px-3 py-3">
                {authed ? (
                  <form onSubmit={submitComment} className="space-y-2">
                    {replyingTo && (
                      <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                        <div>
                          Replying to{" "}
                          <span className="font-semibold">
                            {replyingTo.author_username || "user"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="ml-2 text-xs text-slate-500 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <Textarea
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a public comment…"
                      className="min-h-[60px]"
                    />
                    {commentError && (
                      <p className="text-[11px] text-red-600">{commentError}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={commentBusy || !commentText.trim()}
                      >
                        {commentBusy ? "Posting…" : "Post"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-slate-600">
                    <span className="font-medium">Login</span> to add a comment.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
