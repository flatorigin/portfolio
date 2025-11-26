// =======================================
// file: frontend/src/pages/ProjectDetail.jsx
// =======================================
import { useEffect, useState, useCallback } from "react";
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
  // which root comment the owner is replying to
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
    () => setIdx((i) =>
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

  return (
    <div>
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm text-slate-500">
            <Link to="/" className="hover:underline">
              Explore
            </Link>{" "}
            <span className="mx-1">/</span> Project
          </div>
          <h1 className="truncate text-2xl font-bold text-slate-900">
            {project?.title || `Project #${id}`}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {project?.category ? <Badge>{project.category}</Badge> : null}
            {project?.owner_username && (
              <span>by {project.owner_username}</span>
            )}
          </div>
        </div>
        <Link
          to="/"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {project?.summary && (
        <p className="mb-4 text-slate-700">{project.summary}</p>
      )}

      {/* meta */}
      {(project?.location ||
        project?.budget ||
        project?.sqf ||
        project?.highlights) && (
        <Card className="mb-5 p-4">
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-4">
            {project?.location ? (
              <div>
                <span className="opacity-60">Location:</span>{" "}
                {project.location}
              </div>
            ) : null}
            {project?.budget ? (
              <div>
                <span className="opacity-60">Budget:</span>{" "}
                {project.budget}
              </div>
            ) : null}
            {project?.sqf ? (
              <div>
                <span className="opacity-60">Sq Ft:</span> {project.sqf}
              </div>
            ) : null}
            {project?.highlights ? (
              <div className="md:col-span-4">
                <span className="opacity-60">Highlights:</span>{" "}
                {project.highlights}
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {/* images */}
      {images.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-600">
          No media found.
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
                  alt=""
                  className="block h-[160px] w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              </button>
              {img.caption && (
                <figcaption className="px-3 py-2 text-sm text-slate-700">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {/* lightbox */}
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
              className="max-h-[80vh] max-w-[90vw] h-auto w-auto rounded-xl bg-black/40 shadow-2xl object-contain"
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

      {/* comments */}
      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Comments</h2>

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
                  {isOwnerUser ? "Reply or comment as owner" : "Add a comment"}
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
          <Card className="p-4 text-sm text-slate-600">
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

              const isMine = myUsername &&
                c.author_username &&
                c.author_username.toLowerCase() === myUsername.toLowerCase();

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
                        ↩ Reply as owner
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

                        const replyIsMine = myUsername &&
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
                              <p className="whitespace-pre-line text-slate-800">
                                {r.text}
                              </p>
                            )}

                            {replyIsMine && !replyEditing && (
                              <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
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
                              </div>
                            )}
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
    </div>
  );
}
