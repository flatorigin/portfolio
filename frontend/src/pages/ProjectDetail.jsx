// =======================================
// file: frontend/src/pages/ProjectDetail.jsx
// Project page + lightbox-style comments modal + project edit + extra links
// =======================================
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Badge, Card, Button, Textarea } from "../ui";

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

  // project + media
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);

  // edit project state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState("");
  const [heroBanner, setHeroBanner] = useState(null);

  // extra materials / links rows in the edit form
  const [extraLinks, setExtraLinks] = useState([]);

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

  // ─────────────────────────────
  // LOAD PROJECT + IMAGES + COMMENTS
  // ─────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [{ data: meta }, { data: imgs }, { data: cmts }] =
        await Promise.all([
          api.get(`/projects/${id}/`),
          api.get(`/projects/${id}/images/`),
          api.get(`/projects/${id}/comments/`).catch(() => ({ data: [] })),
        ]);

      setProject(meta || null);

      setImages(
        (imgs || [])
          .map((x) => ({
            url: toUrl(x.url || x.image || x.src || x.file),
            caption: x.caption || "",
          }))
          .filter((x) => !!x.url)
      );

      setComments(Array.isArray(cmts) ? cmts : []);

      // init editData + extraLinks from meta
      if (meta) {
        setEditData({
          title: meta.title || "",
          summary: meta.summary || "",
          location: meta.location || "",
          budget: meta.budget || "",
          sqf: meta.sqf || "",
          highlights: meta.highlights || "",
          material_label: meta.material_label || "",
          material_url: meta.material_url || "",
        });

        setHeroBanner(null);

        setExtraLinks(
          Array.isArray(meta.extra_links)
            ? meta.extra_links.map((row) => ({
                label: row.label || "",
                url: row.url || "",
              }))
            : []
        );
      } else {
        setEditData(null);
        setExtraLinks([]);
      }
    } catch (err) {
      console.error("[ProjectDetail] fetch failed:", err);
      setProject(null);
      setImages([]);
      setComments([]);
      setEditData(null);
      setExtraLinks([]);
      setHeroBanner(null);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const isOwnerUser =
    authed &&
    project &&
    meUser &&
    (project.owner_username || "").toLowerCase() ===
      (meUser.username || "").toLowerCase();

  const myUsername = meUser?.username || null;

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
        const favored =
          data?.is_favorited ??
          data?.favorited ??
          true;

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

  // save handler – Save button in the header
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
      console.error(
        "[ProjectDetail] save favorite failed",
        err?.response || err
      );
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
  // IMAGE NAVIGATION
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
  const roots = useMemo(
    () => comments.filter((c) => !c.in_reply_to),
    [comments]
  );

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
      if (replyingTo && isOwnerUser) {
        payload.in_reply_to = replyingTo.id;
      }

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
    setReplyingTo(comment);
    const handle = comment.author_username ? `@${comment.author_username} ` : "";
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
        prev.filter(
          (c) => c.id !== comment.id && c.in_reply_to !== comment.id
        )
      );
    } catch (err) {
      console.error("delete comment error:", err?.response || err);
      alert("Failed to delete comment.");
    }
  }

  // ─────────────────────────────
  // PROJECT EDIT SAVE HANDLER
  // ─────────────────────────────
  async function handleSaveEdits(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!editData || !project) return;

    setSavingEdits(true);
    setEditError("");

    const normalizeText = (val) => {
      if (val === undefined || val === null) return "";
      return String(val).trim();
    };

    const normalizeNumber = (val) => {
      if (val === undefined || val === null) return null;
      const s = String(val).trim();
      if (!s) return null;
      const cleaned = s.replace(/,/g, "");
      const n = Number(cleaned);
      return Number.isNaN(n) ? null : n;
    };

    try {
      const projectId = project.id;
      if (!projectId) throw new Error("Missing project id");

      const payload = {
        title: normalizeText(editData.title),
        summary: normalizeText(editData.summary),
        location: normalizeText(editData.location),
        budget: normalizeNumber(editData.budget),
        sqf: normalizeNumber(editData.sqf),
        highlights: normalizeText(editData.highlights),
        material_label: normalizeText(editData.material_label),
        material_url: normalizeText(editData.material_url),
        extra_links: extraLinks
          .filter((row) => row.label || row.url)
          .map((row) => ({
            label: row.label.trim(),
            url: row.url.trim(),
          })),
      };

      console.log("[handleSaveEdits] sending payload:", payload);

      const useFormData = !!heroBanner;
      const requestBody = useFormData ? new FormData() : payload;

      if (useFormData) {
        Object.entries(payload).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            requestBody.append(key, "");
          } else if (Array.isArray(value) || typeof value === "object") {
            requestBody.append(key, JSON.stringify(value));
          } else {
            requestBody.append(key, value);
          }
        });
        requestBody.append("cover_image", heroBanner);
      }

      const { data } = await api.patch(`/projects/${projectId}/`, requestBody, {
        headers: useFormData ? { "Content-Type": "multipart/form-data" } : undefined,
      });

      setProject(data);
      setEditData({
        title: data.title || "",
        summary: data.summary || "",
        location: data.location || "",
        budget: data.budget ?? "",
        sqf: data.sqf ?? "",
        highlights: data.highlights || "",
        material_label: data.material_label || "",
        material_url: data.material_url || "",
      });
      setExtraLinks(
        Array.isArray(data.extra_links)
          ? data.extra_links.map((row) => ({
              label: row.label || "",
              url: row.url || "",
            }))
          : []
      );

      setHeroBanner(null);

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

      if (typeof msg !== "string") {
        msg = JSON.stringify(msg, null, 2);
      }

      const full = `Save failed${status ? ` (status ${status})` : ""}: ${msg}`;
      setEditError(full);
      alert(full);
    } finally {
      setSavingEdits(false);
    }
  }

  function addLinkRow() {
    setExtraLinks((prev) => [...prev, { label: "", url: "" }]);
  }

  function updateLinkRow(index, field, value) {
    setExtraLinks((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function removeLinkRow(index) {
    setExtraLinks((prev) => prev.filter((_, i) => i !== index));
  }

  const mapSrc = buildMapSrc(project?.location || "");

  // ─────────────────────────────
  // RENDER HELPERS
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
          <span>
            {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
          </span>
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

  const currentImage =
    images.length && activeImageIdx >= 0
      ? images[Math.min(activeImageIdx, images.length - 1)]
      : null;

  // ─────────────────────────────
  // RENDER
  // ─────────────────────────────
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
        <Link
          to="/"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {/* Main project card */}
      <Card className="mb-4 overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        {/* header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* LEFT: title + meta */}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">
                {project?.title || `Project #${id}`}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-200/90">
                {project?.category && (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium">
                    {project.category}
                  </span>
                )}
                {project?.owner_username && (
                  <Link
                    to={{
                      pathname: `/profiles/${project.owner_username}`,
                      search:
                        project?.id || id
                          ? `?fromProjectId=${project?.id || id}`
                          : "",
                      state: { fromProjectId: project?.id || id },
                    }}
                    className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-white/10 hover:text-white"
                  >
                    by {project.owner_username}
                  </Link>
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
                  className="text-sm"
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

          {/* OWNER-ONLY PROJECT EDIT FORM */}
          {isOwnerUser && isEditing && editData && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Edit project
              </div>

              <form onSubmit={handleSaveEdits} className="space-y-3">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Title
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={editData.title}
                    onChange={(e) =>
                      setEditData((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Summary
                  </label>
                  <Textarea
                    rows={3}
                    value={editData.summary}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        summary: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Location / Budget / Sq Ft */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Location
                    </label>
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={editData.location}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Budget
                    </label>
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={editData.budget}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          budget: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Sq Ft
                    </label>
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={editData.sqf}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          sqf: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Hero banner (cover image) */}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Hero banner image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setHeroBanner(e.target.files?.[0] || null)}
                      className="block w-full text-sm"
                    />
                    {heroBanner ? (
                      <div className="mt-1 truncate text-xs text-slate-500">{heroBanner.name}</div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Upload a wide image to feature as the page hero.
                      </p>
                    )}
                  </div>

                  {project?.cover_image && (
                    <img
                      src={toUrl(project.cover_image)}
                      alt="Current hero banner"
                      className="h-24 w-full rounded-md object-cover ring-1 ring-slate-200"
                    />
                  )}
                </div>

                {/* Highlights */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Highlights
                  </label>
                  <Textarea
                    rows={2}
                    value={editData.highlights}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        highlights: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Materials / links */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-700">
                      Materials &amp; links
                    </div>
                    <button
                      type="button"
                      onClick={addLinkRow}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      title="Add another link"
                    >
                      +
                    </button>
                  </div>

                  {/* main label+url row */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Label
                      </label>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        placeholder="e.g. Deck boards – Trex"
                        value={editData.material_label}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            material_label: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Link
                      </label>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        placeholder="https://…"
                        value={editData.material_url}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            material_url: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* extra link rows */}
                  {extraLinks.length > 0 && (
                    <div className="space-y-2">
                      {extraLinks.map((row, index) => (
                        <div
                          key={index}
                          className="grid gap-2 sm:grid-cols-[1fr_minmax(0,1.4fr)_auto]"
                        >
                          <input
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Label"
                            value={row.label}
                            onChange={(e) =>
                              updateLinkRow(index, "label", e.target.value)
                            }
                          />
                          <input
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder="https://…"
                            value={row.url}
                            onChange={(e) =>
                              updateLinkRow(index, "url", e.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeLinkRow(index)}
                            className="self-center text-[11px] text-slate-500 hover:text-red-500"
                            title="Remove this link"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (project) {
                        setEditData({
                          title: project.title || "",
                          summary: project.summary || "",
                          location: project.location || "",
                          budget: project.budget || "",
                          sqf: project.sqf || "",
                          highlights: project.highlights || "",
                          material_label: project.material_label || "",
                          material_url: project.material_url || "",
                        });
                        setExtraLinks(
                          Array.isArray(project.extra_links)
                            ? project.extra_links.map((row) => ({
                                label: row.label || "",
                                url: row.url || "",
                              }))
                          : []
                        );
                      }
                      setHeroBanner(null);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingEdits}>
                    {savingEdits ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>

              {editError && (
                <p className="mt-2 text-xs text-red-600">{editError}</p>
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
                    <div className="text-lg font-semibold">
                      {project.location}
                    </div>
                  </div>
                )}

                {project?.budget && (
                  <div className="min-w-[140px] flex-wrap">
                    <div className="text-xs font-medium uppercase text-slate-500">
                      Budget
                    </div>
                    <div className="text-lg font-semibold">
                      {project.budget}
                    </div>
                  </div>
                )}

                {project?.sqf && (
                  <div className="min-w-[140px] flex-wrap ">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Sq Ft
                    </div>
                    <div className="text-lg font-semibold">
                      {project.sqf}
                    </div>
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

              {/* main / primary link + label */}
              {(project?.material_label || project?.material_url) && (
                <div className="flex items-center gap-3">
                  {project?.material_url && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                      <span className="text-xs text-slate-500">
                        {new URL(project.material_url).hostname
                          .replace(/^www\./, "")
                          .slice(0, 2)
                          .toUpperCase()}
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

              {/* extra links added via +, shown UNDER the main one */}
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
                          <div className="mt-[3px] flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-slate-500 border border-slate-200">
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
                These links point to products or materials used in this project
                (for example, tools, finishes, or suppliers).
              </p>
            </div>
          )}

          {/* Project media (hero-ish grid) */}
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.url + i}
                    onClick={() => {
                      setActiveImageIdx(i);
                      setCommentsOpen(true);
                    }}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left"
                  >
                    <img
                      src={img.url}
                      alt={img.caption || ""}
                      className="block h-[170px] w-full object-cover transition-transform group-hover:scale-[1.02]"
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
                    Centered on:{" "}
                    <span className="font-medium">{project.location}</span>
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
                    {comments.length || 0} comment
                    {comments.length === 1 ? "" : "s"}
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
                      <p className="text-[11px] text-red-600">
                        {commentError}
                      </p>
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
                    <span className="font-medium">Login</span> to add a
                    comment.
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
