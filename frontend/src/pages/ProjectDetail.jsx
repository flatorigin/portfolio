// =======================================
// file: frontend/src/pages/ProjectDetail.jsx
// =======================================
import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Card, Button, Textarea } from "../ui";
import PrivateMessagingPanel from "../components/PrivateMessagingPanel";

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
  // Center map on ZIP / city; z=11 is a “regional” zoom
  return `https://www.google.com/maps?q=${q}&z=11&output=embed`;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState("");

  // current user (from API)
  const [meUser, setMeUser] = useState(null);

  // which comment the owner is replying to
  const [replyingTo, setReplyingTo] = useState(null);

  // edit state for comments
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const authed = !!localStorage.getItem("access");

  // fetch current user once (if logged in)
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

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: meta }, { data: imgs }] = await Promise.all([
        api.get(`/projects/${id}/`),
        api.get(`/projects/${id}/images/`),
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

      try {
        const { data: cmts } = await api.get(`/projects/${id}/comments/`);
        setComments(Array.isArray(cmts) ? cmts : []);
      } catch (err) {
        console.warn("[ProjectDetail] comments fetch failed:", err);
        setComments([]);
      }
    } catch (err) {
      console.error("[ProjectDetail] project/images fetch failed:", err);
      setProject(null);
      setImages([]);
      setComments([]);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const next = useCallback(
    () => setIdx((i) => (images.length ? (i + 1) % images.length : 0)),
    [images.length]
  );

  const prev = useCallback(
    () =>
      setIdx((i) =>
        images.length ? (i - 1 + images.length) % images.length : 0
      ),
    [images.length]
  );

  const isOwnerUser =
    authed &&
    project &&
    meUser &&
    (project.owner_username || "").toLowerCase() ===
      (meUser.username || "").toLowerCase();

  const myUsername = meUser?.username || null;

  async function submitComment(e) {
    e.preventDefault();
    setCommentError("");

    if (!authed) {
      setCommentError("You need to be logged in to comment.");
      return;
    }
    if (!commentText.trim()) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    setCommentBusy(true);
    try {
      const payload = { text: commentText.trim() };
      const { data } = await api.post(`/projects/${id}/comments/`, payload);

      let augmented = data;
      if (replyingTo && isOwnerUser) {
        augmented = { ...data, in_reply_to: replyingTo.id };
      }

      setComments((prev) => [augmented, ...prev]);
      setCommentText("");
      setReplyingTo(null);
    } catch (err) {
      console.error("comment post error:", err?.response || err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.text ||
        "Failed to post comment.";
      setCommentError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setCommentBusy(false);
    }
  }

  function replyAsOwnerTo(comment) {
    if (!isOwnerUser) return;
    setReplyingTo(comment);

    const handle = comment.author_username
      ? `@${comment.author_username} `
      : "";
    setCommentText((prev) => {
      if (prev.trim().startsWith(handle.trim())) return prev;
      return handle + prev;
    });

    const el = document.getElementById("project-comment-textarea");
    if (el) el.focus();
  }

  // ---- Editing comments ----
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

  // build simple client-side thread view:
  const roots = comments.filter((c) => !c.in_reply_to);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.in_reply_to) {
      if (!acc[c.in_reply_to]) acc[c.in_reply_to] = [];
      acc[c.in_reply_to].push(c);
    }
    return acc;
  }, {});

  const mapSrc = buildMapSrc(project?.location || "");

  return (
    <div>
      {/* ─────────────────────────────
          Breadcrumb (outside card)
      ───────────────────────────── */}
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

      {/* ─────────────────────────────
          Main project card
      ───────────────────────────── */}
      <Card className="mb-8 overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        {/* Card header: title, owner, meta pills */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">
                {project?.title || `Project #${id}`}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-200/90">
                {project?.category ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium">
                    {project.category}
                  </span>
                ) : null}
                {project?.owner_username && (
                  <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px]">
                    by {project.owner_username}
                  </span>
                )}
              </div>
            </div>

            {/* quick stats pill */}
            {(project?.sqf || project?.budget) && (
              <div className="flex flex-col items-end gap-1 text-right text-[11px] text-slate-100/90">
                {project?.sqf && (
                  <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5">
                    Sq Ft:{" "}
                    <span className="ml-1 font-semibold">{project.sqf}</span>
                  </span>
                )}
                {project?.budget && (
                  <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5">
                    Budget:{" "}
                    <span className="ml-1 font-semibold">
                      {project.budget}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card body: summary, meta grid, media, map */}
        <div className="space-y-6 p-4 sm:p-6">
          {/* Summary */}
          {project?.summary && (
            <p className="text-sm leading-relaxed text-slate-700 sm:text-[15px]">
              {project.summary}
            </p>
          )}

          {/* Meta grid */}
          {(project?.location ||
            project?.budget ||
            project?.sqf ||
            project?.highlights) && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project details
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-4">
                {project?.location ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Location
                    </div>
                    <div>{project.location}</div>
                  </div>
                ) : null}
                {project?.budget ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Budget
                    </div>
                    <div>{project.budget}</div>
                  </div>
                ) : null}
                {project?.sqf ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Sq Ft
                    </div>
                    <div>{project.sqf}</div>
                  </div>
                ) : null}
                {project?.highlights ? (
                  <div className="md:col-span-4">
                    <div className="text-xs font-medium text-slate-500">
                      Highlights
                    </div>
                    <div className="mt-0.5 whitespace-pre-line text-sm text-slate-700">
                      {project.highlights}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Media gallery */}
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
                  <figure
                    key={img.url + i}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIdx(i);
                        setOpen(true);
                      }}
                      className="block w-full"
                    >
                      <img
                        src={img.url}
                        alt={img.caption || ""}
                        className="block h-[170px] w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    </button>
                    {img.caption && (
                      <figcaption className="px-3 py-2 text-xs text-slate-700">
                        {img.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </div>

          {/* Map (if location present) */}
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

      {/* Lightbox */}
      {open && images[idx] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={prev}
              aria-label="Prev"
              className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 rounded-full border border-white/40 px-3 py-1 text-white/90"
            >
              ‹
            </button>

            <img
              src={images[idx].url}
              alt={images[idx].caption || ""}
              className="h-auto max-h-[80vh] w-auto max-w-[90vw] rounded-xl bg-black/40 object-contain shadow-2xl"
            />

            {images[idx].caption && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-sm text-white">
                {images[idx].caption}
              </div>
            )}

            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2 rounded-full border border-white/40 px-3 py-1 text-white/90"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -right-4 -top-4 rounded-full border border-white/40 px-2 py-1 text-white/90"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 5) COMMENTS + PRIVATE MESSAGES BELOW MAP */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 md:items-start">
        {/* PUBLIC COMMENTS COLUMN */}
        <div className="min-h-[100px] space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Public comments
          </h2>

          {/* form */}
          {authed ? (
            <Card className="space-y-3 p-4">
              {replyingTo && (
                <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <div>
                    <div className="mb-0.5 font-semibold">
                      Replying to {replyingTo.author_username || "user"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="ml-3 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}

              <form onSubmit={submitComment} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {isOwnerUser
                      ? "Reply or comment as owner"
                      : "Add a comment"}
                  </label>
                  <Textarea
                    id="project-comment-textarea"
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      isOwnerUser
                        ? "Write a reply or general comment as the project owner…"
                        : "Share your thoughts about this project…"
                    }
                    className="min-h-[100px]"
                  />
                </div>
                {commentError && (
                  <p className="text-xs text-red-600">{commentError}</p>
                )}
                <Button type="submit" disabled={commentBusy}>
                  {commentBusy ? "Posting…" : "Post comment"}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="min-h-[100px] p-4 text-sm text-slate-600">
              <span className="font-medium">Login</span> to add a comment.
            </Card>
          )}

          {/* list */}
          {roots.length === 0 ? (
            <p className="text-sm text-slate-600">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <div className="space-y-3">
              {roots.map((c) => {
                const replies = repliesByParent[c.id] || [];

                const isOwnerAuthor =
                  project &&
                  c.author_username &&
                  c.author_username.toLowerCase() ===
                    (project.owner_username || "").toLowerCase();

                const isMine =
                  myUsername &&
                  c.author_username &&
                  c.author_username.toLowerCase() ===
                    myUsername.toLowerCase();

                const isEditing = editingCommentId === c.id;

                return (
                  <Card key={c.id} className="p-3">
                    {/* root header */}
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">
                          {c.author_username || "Anonymous"}
                        </span>
                        {isOwnerAuthor && (
                          <span className="rounded-full bg-slate-900 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-white">
                            Owner
                          </span>
                        )}
                      </div>
                      <span>
                        {c.created_at
                          ? new Date(c.created_at).toLocaleString()
                          : ""}
                      </span>
                    </div>

                    {/* root body / edit mode */}
                    {isEditing ? (
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
                      <p className="whitespace-pre-line text-sm text-slate-800">
                        {c.text}
                      </p>
                    )}

                    {/* actions */}
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

                      {isMine && !isEditing && (
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

                    {/* replies */}
                    {replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
                        {replies.map((r) => {
                          const replyIsOwner =
                            project &&
                            r.author_username &&
                            r.author_username.toLowerCase() ===
                              (project.owner_username || "").toLowerCase();

                          const replyIsMine =
                            myUsername &&
                            r.author_username &&
                            r.author_username.toLowerCase() ===
                              myUsername.toLowerCase();

                          const replyEditing = editingCommentId === r.id;

                          return (
                            <div key={r.id} className="text-sm">
                              <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-500">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700">
                                    {r.author_username || "Anonymous"}
                                  </span>
                                  {replyIsOwner && (
                                    <span className="rounded-full bg-slate-900 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
                                      Owner reply
                                    </span>
                                  )}
                                </div>
                                <span>
                                  {r.created_at
                                    ? new Date(r.created_at).toLocaleString()
                                    : ""}
                                </span>
                              </div>

                              {replyEditing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    rows={2}
                                    value={editingText}
                                    onChange={(e) =>
                                      setEditingText(e.target.value)
                                    }
                                  />
                                  <div className="flex items-center gap-2 text-xs">
                                    <Button
                                      type="button"
                                      disabled={editBusy}
                                      onClick={() => saveEditComment(r)}
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
                                <p className="whitespace-pre-line text-sm text-slate-800">
                                  {r.text}
                                </p>
                              )}

                              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                                {isOwnerUser && !replyIsOwner && (
                                  <button
                                    type="button"
                                    onClick={() => replyAsOwnerTo(r)}
                                    className="font-medium hover:text-slate-700"
                                  >
                                    Reply as owner
                                  </button>
                                )}

                                {replyIsMine && !replyEditing && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditComment(r)}
                                      className="font-medium hover:text-slate-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteComment(r)}
                                      className="font-medium text-red-500 hover:text-red-700"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* PRIVATE MESSAGES COLUMN */}
        <div className="min-h-[100px]">
          <h2 className="text-lg font-semibold text-slate-900">
            Private inquiries
          </h2>
          <PrivateMessagingPanel
            projectId={id}
            projectOwner={project?.owner_username}
          />
        </div>
      </div>
    </div>
  );
}
