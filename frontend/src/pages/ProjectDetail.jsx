// =======================================
// file: frontend/src/pages/ProjectDetail.jsx
// Project page + lightbox-style comments modal + project edit + extra links
// + Comments: optional rating, disclaimer, stars placeholder, lock edit/delete when testimonial_published
// + Bids: compact owner-side bid cards + full bid modal, send/revise/withdraw/accept/decline flow
// + Safety/UI: safer URL handling, loading state, async cleanup guards
// =======================================
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Badge, Card, Button, Textarea, Input, SymbolIcon } from "../ui";
import ProjectEditorCard from "../components/ProjectEditorCard";
import BidModule from "../components/bids/BidModule";
import QuickMessageDrawer from "../components/QuickMessageDrawer";

const COMMENT_CHAR_LIMIT = 280;
const COMMENT_LINK_PATTERN = /(https?:\/\/|www\.)/i;

function toUrl(raw) {
  if (!raw) return "";

  const value = String(raw).trim();

  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  const isAllowedProtocol = /^(https?:|data:|mailto:)/i.test(value);

  if (hasProtocol && !isAllowedProtocol) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");

  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function buildMapSrc(location) {
  if (!location) return null;
  const q = encodeURIComponent(location);
  return `https://www.google.com/maps?q=${q}&z=11&output=embed`;
}

function formatPostedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stars({ value = 0, onChange, disabled = false, titlePrefix = "Rate" }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = Number(value || 0) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!onChange) return;
              onChange((prev) => (prev === n ? null : n));
            }}
            className={
              "text-lg leading-none " +
              (disabled ? "cursor-default" : "cursor-pointer")
            }
            aria-label={`${titlePrefix} ${n} stars`}
            title={`${titlePrefix} ${n} stars`}
          >
            <SymbolIcon
              name="star"
              fill={filled ? 1 : 0}
              className={filled ? "text-[22px] text-amber-500" : "text-[22px] text-slate-300"}
            />
          </button>
        );
      })}
    </div>
  );
}

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function LikeCircleIcon({ active = false, className = "" }) {
  return (
    <SymbolIcon
      name="favorite"
      fill={active ? 1 : 0}
      className={"text-[30px] " + className}
    />
  );
}

function SaveCircleIcon({ active = false, className = "" }) {
  return (
    <SymbolIcon
      name="bookmark"
      fill={active ? 1 : 0}
      className={"text-[30px] " + className}
    />
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const isMountedRef = useRef(false);

  const [pageLoading, setPageLoading] = useState(true);

  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);

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
    cover_image_id: null,
  });

  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editImages, setEditImages] = useState([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState("");
  const [editCoverImageId, setEditCoverImageId] = useState(null);
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false);

  const [meUser, setMeUser] = useState(null);
  const authed = !!localStorage.getItem("access");

  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareFeedback, setShareFeedback] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [commentRating, setCommentRating] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editingRating, setEditingRating] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const [bidOpen, setBidOpen] = useState(false);
  const [bidBusy, setBidBusy] = useState(false);
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState("");
  const [editingBidId, setEditingBidId] = useState(null);
  const [bids, setBids] = useState([]);
  const [loadingBids, setLoadingBids] = useState(false);
  const [bidActionBusyId, setBidActionBusyId] = useState(null);
  const [activeBid, setActiveBid] = useState(null);

  const [bidForm, setBidForm] = useState({
    price_type: "fixed",
    amount: "",
    amount_min: "",
    amount_max: "",
    timeline_text: "",
    proposal_text: "",
    included_text: "",
    excluded_text: "",
    payment_terms: "",
    valid_until: "",
    attachment: null,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setMeUser(null);
      return;
    }

    let active = true;

    (async () => {
      try {
        const { data } = await api.get("/auth/users/me/");
        if (active && isMountedRef.current) setMeUser(data);
      } catch {
        try {
          const { data } = await api.get("/users/me/");
          if (active && isMountedRef.current) setMeUser(data);
        } catch (err) {
          console.warn("[ProjectDetail] failed to fetch meUser", err);
          if (active && isMountedRef.current) setMeUser(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [authed]);

  const isOwnerUser =
    authed &&
    project &&
    meUser &&
    (project.owner_username || "").toLowerCase() ===
      (meUser.username || "").toLowerCase();

  const myUsername = meUser?.username || null;

  const isMine =
    authed &&
    project &&
    meUser &&
    (project.owner_username || "").toLowerCase() ===
      (meUser.username || "").toLowerCase();

  const canSharePublicJob = !!(
    project?.is_job_posting &&
    project?.is_public &&
    !project?.is_private &&
    project?.id
  );
  const publicProjectUrl =
    typeof window !== "undefined" && project?.id
      ? `${window.location.origin}/projects/${project.id}`
      : "";
  const jobSummaryText = (project?.job_summary || project?.summary || "").trim();
  const serviceCategoryList = Array.isArray(project?.service_categories)
    ? project.service_categories.filter((item) => String(item || "").trim())
    : [];

  async function shareProject() {
    if (!canSharePublicJob || !publicProjectUrl) return;
    setShareFeedback("");

    const payload = {
      title: project?.title || "Job posting",
      text: jobSummaryText || "Take a look at this job posting.",
      url: publicProjectUrl,
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        setShareFeedback("Shared.");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicProjectUrl);
        setShareFeedback("Link copied.");
        return;
      }

      setShareFeedback(publicProjectUrl);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setShareFeedback("Could not share right now.");
    }
  }

  function requestEditProject() {
    if (!project?.id) return;

    if (project.is_job_posting && project.is_public) {
      setUnpublishModalOpen(true);
      return;
    }

    setIsEditing(true);
  }

  async function unpublishAndEdit() {
    if (!project?.id) return;

    setSavingEdits(true);
    try {
      const { data } = await api.patch(`/projects/${project.id}/`, { is_public: false });
      if (!isMountedRef.current) return;
      setProject((prev) => ({ ...(prev || {}), ...(data || {}), is_public: false }));
      setEditForm((prev) => ({ ...prev, is_public: false }));
      setUnpublishModalOpen(false);
      setIsEditing(true);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        data?.non_field_errors ||
        err?.message ||
        "Failed to unpublish.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
    } finally {
      if (isMountedRef.current) setSavingEdits(false);
    }
  }

  async function setCoverOnBackend(projectId, imgId) {
    const normalized = imgId == null ? null : Number(imgId);
    if (!projectId || normalized == null) return;

    const attempts = [{ is_cover: true }, { is_cover_image: true }, { is_cover_photo: true }];

    for (const body of attempts) {
      try {
        await api.patch(`/projects/${projectId}/images/${normalized}/`, body);
        return;
      } catch {
        // try next
      }
    }

    try {
      await api.patch(`/projects/${projectId}/images/${normalized}/`, { order: 0 });
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
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
    }
  }

  const refreshImages = useCallback(async () => {
    if (!id) return;

    try {
      const { data } = await api.get(`/projects/${id}/images/`);
      if (!isMountedRef.current) return;

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

      const flagged = raw.find((img) => img?.is_cover || img?.is_cover_image || img?.is_cover_photo);
      const flaggedIdRaw = flagged?.id ?? flagged?.pk ?? flagged?.image_id ?? null;
      const flaggedId = flaggedIdRaw == null ? null : Number(flaggedIdRaw);

      if (flaggedId != null) {
        const exists = editableImages.some((it) => Number(it.id) === flaggedId);
        if (exists) {
          setEditCoverImageId((prev) => (prev == null ? flaggedId : prev));
          setEditForm((prev) => ({
            ...prev,
            cover_image_id: prev?.cover_image_id == null ? flaggedId : prev.cover_image_id,
          }));
        }
      }
      window.dispatchEvent(new CustomEvent("projects:liked_changed"));
    } catch (err) {
      console.error("[ProjectDetail] refreshImages failed:", err);
      if (!isMountedRef.current) return;
      setImages([]);
      setEditImages([]);
    }
  }, [id]);

  const fetchBids = useCallback(async () => {
    if (!id || !authed) {
      if (isMountedRef.current) setBids([]);
      return;
    }

    setLoadingBids(true);
    try {
      const { data } = await api.get(`/projects/${id}/bids/`);
      if (!isMountedRef.current) return;
      setBids(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[ProjectDetail] fetchBids failed:", err?.response || err);
      if (!isMountedRef.current) return;
      setBids([]);
    } finally {
      if (isMountedRef.current) setLoadingBids(false);
    }
  }, [id, authed]);

  const fetchAll = useCallback(async () => {
    if (!id) return;

    setPageLoading(true);

    try {
      const [{ data: meta }, { data: cmts }] = await Promise.all([
        api.get(`/projects/${id}/`),
        api.get(`/projects/${id}/comments/`).catch(() => ({ data: [] })),
      ]);

      if (!isMountedRef.current) return;

      setProject(meta || null);
      setComments(Array.isArray(cmts) ? cmts : []);

      if (meta) {
        const coverFromMetaRaw =
          meta.cover_image_id ?? (meta.cover_image && meta.cover_image.id) ?? meta.cover_image_pk ?? null;

        const coverFromMeta = coverFromMetaRaw == null ? null : Number(coverFromMetaRaw);

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
          compliance_confirmed: !!meta.compliance_confirmed,
          post_privacy: meta.post_privacy || "public",
          private_contractor_username: meta.private_contractor_username || "",
          notify_by_email: !!meta.notify_by_email,
          job_summary: meta.job_summary || "",
          service_categories: Array.isArray(meta.service_categories) ? meta.service_categories : [],
          part_of_larger_project: !!meta.part_of_larger_project,
          larger_project_details: meta.larger_project_details || "",
          required_expertise: meta.required_expertise || "",
          permit_required: !!meta.permit_required,
          permit_responsible_party: meta.permit_responsible_party || "",
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
    compliance_confirmed: false,
    post_privacy: "public",
    private_contractor_username: "",
    notify_by_email: false,
    job_summary: "",
    service_categories: [],
    part_of_larger_project: false,
    larger_project_details: "",
    required_expertise: "",
    permit_required: false,
    permit_responsible_party: "",
  });

        setEditCoverFile(null);
        setEditCoverImageId(null);
      }

      await refreshImages();
    } catch (err) {
      console.error("[ProjectDetail] fetchAll failed:", err);
      if (!isMountedRef.current) return;
      setProject(null);
      setImages([]);
      setComments([]);
      setEditImages([]);
      setEditCoverImageId(null);
    } finally {
      if (isMountedRef.current) setPageLoading(false);
    }
  }, [id, refreshImages]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  useEffect(() => {
    setLikeCount(Number(project?.like_count || 0));
  }, [project?.like_count]);

  useEffect(() => {
    if (!authed || !project || !meUser) {
      setIsSaved(false);
      return;
    }

    const isOwner =
      (project.owner_username || "").toLowerCase() === (meUser.username || "").toLowerCase();

    if (isOwner) {
      setIsSaved(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/projects/${project.id}/favorite/`);
        const favored = !!(data?.is_favorited ?? data?.favorited ?? data?.saved ?? data?.is_saved ?? false);
        if (!cancelled && isMountedRef.current) setIsSaved(favored);
      } catch {
        if (cancelled || !isMountedRef.current) return;
        setIsSaved(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, project, meUser]);

  useEffect(() => {
    if (!authed || !project || !meUser) {
      setIsLiked(false);
      return;
    }

    const isOwner =
      (project.owner_username || "").toLowerCase() === (meUser.username || "").toLowerCase();

    if (isOwner) {
      setIsLiked(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/projects/${project.id}/like/`);
        if (cancelled || !isMountedRef.current) return;
        setIsLiked(!!data?.liked);
        if (data?.like_count !== undefined) {
          setLikeCount(Number(data.like_count || 0));
        }
      } catch {
        if (cancelled || !isMountedRef.current) return;
        setIsLiked(false);
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
      if (isSaved) {
        try {
          await api.delete(`/projects/${projectId}/favorite/`);
        } catch (err) {
          if (err?.response?.status !== 404) throw err;
        }
        if (isMountedRef.current) setIsSaved(false);
      } else {
        try {
          await api.post(`/projects/${projectId}/favorite/`);
          if (isMountedRef.current) setIsSaved(true);
        } catch (err) {
          const status = err?.response?.status;
          if (status === 404 || status === 409 || status === 400) {
            if (isMountedRef.current) setIsSaved(true);
          } else {
            throw err;
          }
        }
      }
      window.dispatchEvent(new CustomEvent("favorites:changed"));
    } catch (err) {
      console.error("[ProjectDetail] toggle favorite failed", err?.response || err);
      const data = err?.response?.data;
      const msg = data?.detail || data?.message || err?.message || "Failed to update saved state.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      if (isMountedRef.current) setSaveBusy(false);
    }
  }

  async function toggleLike() {
    if (!authed || !project || likeBusy || isOwnerUser) return;
    const projectId = project.id;
    if (!projectId) return;

    setLikeBusy(true);
    try {
      if (isLiked) {
        const { data } = await api.delete(`/projects/${projectId}/like/`);
        if (isMountedRef.current) {
          setIsLiked(false);
          if (data?.like_count !== undefined) {
            setLikeCount(Number(data.like_count || 0));
          }
        }
      } else {
        const { data } = await api.post(`/projects/${projectId}/like/`);
        if (isMountedRef.current) {
          setIsLiked(true);
          if (data?.like_count !== undefined) {
            setLikeCount(Number(data.like_count || 0));
          }
        }
      }
    } catch (err) {
      console.error("[ProjectDetail] toggle like failed", err?.response || err);
      const data = err?.response?.data;
      const msg = data?.detail || data?.message || err?.message || "Failed to update like.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      if (isMountedRef.current) setLikeBusy(false);
    }
  }

  const nextImage = useCallback(() => {
    if (!images.length) return;
    setActiveImageIdx((idx) => (idx + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (!images.length) return;
    setActiveImageIdx((idx) => (idx - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!imageLightboxOpen) return;
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
  }, [imageLightboxOpen, nextImage, prevImage]);

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

  const myBid = useMemo(() => {
    if (!myUsername) return null;
    return (
      bids.find(
        (b) =>
          (b.contractor_username || "").toLowerCase() === myUsername.toLowerCase()
      ) || null
    );
  }, [bids, myUsername]);

  const incomingBids = useMemo(() => {
    return isOwnerUser ? bids : [];
  }, [bids, isOwnerUser]);

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
    if (trimmed.length > COMMENT_CHAR_LIMIT) {
      setCommentError(`Comments must be ${COMMENT_CHAR_LIMIT} characters or fewer.`);
      return;
    }
    if (COMMENT_LINK_PATTERN.test(trimmed)) {
      setCommentError("Public comments cannot include links.");
      return;
    }

    const payload = { text: trimmed };
    if (commentRating) payload.rating = commentRating;
    if (replyingTo && isOwnerUser) payload.in_reply_to = replyingTo.id;

    setCommentBusy(true);

    try {
      await api.post(`/projects/${id}/comments/`, payload);
      const { data: fresh } = await api.get(`/projects/${id}/comments/`);
      if (!isMountedRef.current) return;

      setComments(Array.isArray(fresh) ? fresh : []);
      setCommentText("");
      setCommentRating(null);
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

      if (isMountedRef.current) {
        setCommentError(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
      }
    } finally {
      if (isMountedRef.current) setCommentBusy(false);
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
    if (comment?.testimonial_published) return;
    setEditingCommentId(comment.id);
    setEditingText(comment.text || "");
    setEditingRating(comment.rating || null);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingText("");
    setEditingRating(null);
  }

  async function saveEditComment(comment) {
    if (!editingText.trim()) return;
    if (comment?.testimonial_published) return;
    setEditBusy(true);
    try {
      const patch = { text: editingText.trim(), rating: editingRating || null };

      const { data } = await api.patch(`/projects/${id}/comments/${comment.id}/`, patch);
      if (!isMountedRef.current) return;

      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? { ...c, text: data.text, rating: data.rating ?? null, testimonial_published: data.testimonial_published }
            : c
        )
      );
      cancelEditComment();
    } catch (err) {
      console.error("edit comment error:", err?.response || err);
      alert(err?.response?.data?.detail || "Failed to update comment.");
    } finally {
      if (isMountedRef.current) setEditBusy(false);
    }
  }

  async function deleteComment(comment) {
    if (comment?.testimonial_published) {
      alert("This comment is published as a testimonial and cannot be deleted.");
      return;
    }
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${id}/comments/${comment.id}/`);
      if (!isMountedRef.current) return;
      setComments((prev) => prev.filter((c) => c.id !== comment.id && c.in_reply_to !== comment.id));
    } catch (err) {
      console.error("delete comment error:", err?.response || err);
      alert(err?.response?.data?.detail || "Failed to delete comment.");
    }
  }

  async function handleSaveEdits(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!project) return;

    setSavingEdits(true);
    setEditError("");

    try {
      const projectId = project.id;
      if (!projectId) throw new Error("Missing project id");

      const normalizedCoverId = editCoverImageId ?? editForm.cover_image_id ?? null;

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
        compliance_confirmed: !!editForm.compliance_confirmed,
        post_privacy: editForm.post_privacy || "public",
        private_contractor_username: editForm.private_contractor_username || "",
        notify_by_email: !!editForm.notify_by_email,
        job_summary: editForm.job_summary || "",
        service_categories: Array.isArray(editForm.service_categories) ? editForm.service_categories : [],
        part_of_larger_project: !!editForm.part_of_larger_project,
        larger_project_details: editForm.larger_project_details || "",
        required_expertise: editForm.required_expertise || "",
        permit_required: !!editForm.permit_required,
        permit_responsible_party: editForm.permit_responsible_party || "",
      };

      let data;

      if (editCoverFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v == null ? "" : String(v)));
        fd.append("cover_image", editCoverFile);

        const resp = await api.patch(`/projects/${projectId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        data = resp.data;
      } else {
        const resp = await api.patch(`/projects/${projectId}/`, payload);
        data = resp.data;
      }

      if (normalizedCoverId != null) {
        try {
          await setCoverOnBackend(projectId, normalizedCoverId);
        } catch (coverErr) {
          console.warn("[cover] failed to set cover:", coverErr);
          alert(`Cover update failed: ${coverErr?.message || coverErr}`);
        }
      }

      if (!isMountedRef.current) return;

      setProject(data);

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
        compliance_confirmed: !!(data?.compliance_confirmed ?? prev.compliance_confirmed),
        post_privacy: data?.post_privacy ?? prev.post_privacy,
        private_contractor_username: data?.private_contractor_username ?? prev.private_contractor_username,
        notify_by_email: !!(data?.notify_by_email ?? prev.notify_by_email),
        job_summary: data?.job_summary ?? prev.job_summary,
        service_categories: Array.isArray(data?.service_categories) ? data.service_categories : prev.service_categories,
        part_of_larger_project: !!(data?.part_of_larger_project ?? prev.part_of_larger_project),
        larger_project_details: data?.larger_project_details ?? prev.larger_project_details,
        required_expertise: data?.required_expertise ?? prev.required_expertise,
        permit_required: !!(data?.permit_required ?? prev.permit_required),
        permit_responsible_party: data?.permit_responsible_party ?? prev.permit_responsible_party,
        cover_image_id:
          normalizedCoverId != null ? Number(normalizedCoverId) : prev.cover_image_id,
      }));

      setEditCoverFile(null);
      if (normalizedCoverId != null) setEditCoverImageId(Number(normalizedCoverId));

      await refreshImages();
      if (isMountedRef.current) setIsEditing(false);
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
      if (isMountedRef.current) setEditError(full);
      alert(full);
    } finally {
      if (isMountedRef.current) setSavingEdits(false);
    }
  }

  async function handleSaveImageCaption(img) {
    if (!project || !img?.id) return;
    setEditImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, _saving: true } : x)));
    try {
      await api.patch(`/projects/${project.id}/images/${img.id}/`, {
        caption: img._localCaption,
      });
      await refreshImages();
    } catch (e) {
      alert(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
      if (!isMountedRef.current) return;
      setEditImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, _saving: false } : x)));
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

  function resetBidForm() {
    setEditingBidId(null);
    setBidForm({
      price_type: "fixed",
      amount: "",
      amount_min: "",
      amount_max: "",
      timeline_text: "",
      proposal_text: "",
      included_text: "",
      excluded_text: "",
      payment_terms: "",
      valid_until: "",
      attachment: null,
    });
    setBidError("");
    setBidSuccess("");
  }

  function updateBidField(key) {
    return (e) => {
      const value = e.target.value;
      setBidForm((prev) => ({ ...prev, [key]: value }));
    };
  }

  function handleBidAttachmentChange(e) {
    const file = e.target.files?.[0] || null;
    setBidForm((prev) => ({ ...prev, attachment: file }));
    e.target.value = "";
  }

  function reviseBid(bid) {
    if (!bid?.id || !bid?.latest_version) return;

    const latest = bid.latest_version;

    setEditingBidId(bid.id);
    setBidForm({
      price_type: latest.price_type || "fixed",
      amount: latest.amount ?? "",
      amount_min: latest.amount_min ?? "",
      amount_max: latest.amount_max ?? "",
      timeline_text: latest.timeline_text || "",
      proposal_text: latest.proposal_text || "",
      included_text: latest.included_text || "",
      excluded_text: latest.excluded_text || "",
      payment_terms: latest.payment_terms || "",
      valid_until: latest.valid_until || "",
      attachment: null,
    });

    setBidError("");
    setBidSuccess("");
    setBidOpen(true);
  }

  async function runBidAction(bidId, action) {
    setBidActionBusyId(bidId);
    try {
      await api.post(`/bids/${bidId}/${action}/`);
      await fetchBids();

      if (action === "accept" || action === "decline") {
        const refreshed = await api.get(`/projects/${id}/bids/`).catch(() => null);
        if (refreshed?.data && isMountedRef.current) {
          const nextBids = Array.isArray(refreshed.data) ? refreshed.data : [];
          setBids(nextBids);

          if (activeBid?.id === bidId) {
            const updatedActive = nextBids.find((b) => b.id === bidId) || null;
            setActiveBid(updatedActive);
          }
        }
      }
    } catch (err) {
      console.error(`[ProjectDetail] ${action} bid failed:`, err?.response || err);
      alert(err?.response?.data?.detail || `Failed to ${action} bid.`);
    } finally {
      if (isMountedRef.current) setBidActionBusyId(null);
    }
  }

  async function submitBid(e) {
    e.preventDefault();

    if (!authed) {
      setBidError("You need to be logged in to submit a bid.");
      return;
    }

    if (!project?.id) {
      setBidError("Missing project.");
      return;
    }

    setBidBusy(true);
    setBidError("");
    setBidSuccess("");

    try {
      const fd = new FormData();

      fd.append("price_type", bidForm.price_type);

      if (bidForm.price_type === "fixed") {
        fd.append("amount", bidForm.amount || "");
      } else {
        fd.append("amount_min", bidForm.amount_min || "");
        fd.append("amount_max", bidForm.amount_max || "");
      }

      fd.append("timeline_text", bidForm.timeline_text || "");
      fd.append("proposal_text", bidForm.proposal_text || "");
      fd.append("included_text", bidForm.included_text || "");
      fd.append("excluded_text", bidForm.excluded_text || "");
      fd.append("payment_terms", bidForm.payment_terms || "");
      fd.append("valid_until", bidForm.valid_until || "");

      if (bidForm.attachment) {
        fd.append("attachment", bidForm.attachment);
      }

      const wasEditingBid = !!editingBidId;

      if (editingBidId) {
        await api.post(`/bids/${editingBidId}/revise/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post(`/projects/${project.id}/bids/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      await fetchBids();
      if (!isMountedRef.current) return;

      resetBidForm();
      setBidSuccess(wasEditingBid ? "Bid revised." : "Bid submitted.");
      setBidOpen(false);
    } catch (err) {
      console.error("[ProjectDetail] submitBid failed:", err?.response || err);
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.message ||
        data?.non_field_errors ||
        (typeof data === "string" ? data : null) ||
        "Could not submit bid.";
      if (isMountedRef.current) {
        setBidError(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
      }
    } finally {
      if (isMountedRef.current) setBidBusy(false);
    }
  }

  const mapSrc = buildMapSrc(project?.location || "");

  const currentImage =
    images.length && activeImageIdx >= 0 ? images[Math.min(activeImageIdx, images.length - 1)] : null;

  const coverUrl = useMemo(() => {
    const selectedId = editCoverImageId ?? editForm.cover_image_id ?? null;

    if (selectedId != null) {
      const match = editImages.find((im) => Number(im.id) === Number(selectedId));
      if (match?.url) return match.url;
    }
    return images?.[0]?.url || null;
  }, [editCoverImageId, editForm.cover_image_id, editImages, images]);

  function getBidContractorMeta(bid) {
    const displayName =
      bid?.contractor_display_name ||
      bid?.contractor_name ||
      bid?.contractor_full_name ||
      bid?.contractor_profile?.display_name ||
      bid?.contractor_username ||
      "Contractor";

    const avatarUrl = toUrl(
      bid?.contractor_avatar_url ||
        bid?.contractor_logo_url ||
        bid?.contractor_profile?.logo_url ||
        bid?.contractor_profile?.avatar_url ||
        bid?.contractor_profile?.logo ||
        bid?.contractor_profile?.avatar ||
        ""
    );

    return { displayName, avatarUrl };
  }

  function renderBidCard(bid, { ownerView = false, compact = false } = {}) {
    const latest = bid?.latest_version;
    if (!latest) return null;

    const isRange = latest.price_type === "range";

    const priceLabel = isRange
      ? `${latest.amount_min ?? "—"} – ${latest.amount_max ?? "—"}`
      : `${latest.amount ?? "—"}`;

    const statusValue = latest.status || bid.status || "submitted";
    const busy = bidActionBusyId === bid.id;
    const contractor = getBidContractorMeta(bid);

    if (compact && ownerView) {
      return (
        <button
          key={bid.id}
          type="button"
          onClick={() => setActiveBid(bid)}
          className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              {contractor.avatarUrl ? (
                <img
                  src={contractor.avatarUrl}
                  alt={contractor.displayName}
                  className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
                  {getInitials(contractor.displayName)}
                </div>
              )}

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {contractor.displayName}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500 capitalize">
                  {statusValue}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold text-slate-900">{priceLabel}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {latest.valid_until || "No expiry"}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Timeline
              </div>
              <div className="mt-1 text-sm text-slate-800">
                {latest.timeline_text || "—"}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Price type
              </div>
              <div className="mt-1 text-sm text-slate-800">
                {isRange ? "Estimate range" : "Fixed price"}
              </div>
            </div>
          </div>

          {latest.proposal_text ? (
            <div className="mt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Proposal
              </div>
              <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">
                {latest.proposal_text}
              </div>
            </div>
          ) : null}
        </button>
      );
    }

    return (
      <div
        key={bid.id}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            {ownerView ? (
              contractor.avatarUrl ? (
                <img
                  src={contractor.avatarUrl}
                  alt={contractor.displayName}
                  className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
                  {getInitials(contractor.displayName)}
                </div>
              )
            ) : null}

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {ownerView ? contractor.displayName : "Your Bid"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Status: <span className="font-medium capitalize">{statusValue}</span>
              </div>
            </div>
          </div>

          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {isRange ? "Estimate range" : "Fixed price"}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Timeline
            </div>
            <div className="mt-1 text-sm text-slate-800">
              {latest.timeline_text || "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Valid until
            </div>
            <div className="mt-1 text-sm text-slate-800">
              {latest.valid_until || "—"}
            </div>
          </div>
        </div>

        {latest.proposal_text ? (
          <div className="mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Proposal
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {latest.proposal_text}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Included
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {latest.included_text || "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Excluded
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {latest.excluded_text || "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Payment terms
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {latest.payment_terms || "—"}
            </div>
          </div>
        </div>

        {latest.attachment_url ? (
          <div className="mt-4">
            <a
              href={latest.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View attachment
            </a>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!ownerView && statusValue !== "accepted" && statusValue !== "withdrawn" ? (
            <>
              <button
                type="button"
                onClick={() => reviseBid(bid)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Revise
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => runBidAction(bid.id, "withdraw")}
                className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {busy ? "Working…" : "Withdraw"}
              </button>
            </>
          ) : null}

          {ownerView && statusValue !== "accepted" && statusValue !== "declined" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => runBidAction(bid.id, "accept")}
                className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {busy ? "Working…" : "Accept"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => runBidAction(bid.id, "decline")}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy ? "Working…" : "Decline"}
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-4 flex items-end justify-end border-t border-slate-200 pt-4">
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Price
            </div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {priceLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderCommentBlock = (c, isReply = false) => {
    const replies = repliesByParent[c.id] || [];

    const isOwnerAuthor =
      project &&
      c.author_username &&
      c.author_username.toLowerCase() === (project.owner_username || "").toLowerCase();

    const isMyComment =
      myUsername && c.author_username && c.author_username.toLowerCase() === myUsername.toLowerCase();

    const isEditingComment = editingCommentId === c.id;

    const locked = !!c.testimonial_published;

    return (
      <div
        key={c.id}
        className={"rounded-lg border border-slate-200 bg-white p-3 text-sm " + (isReply ? "ml-3" : "")}
      >
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{c.author_username || "Anonymous"}</span>
            {isOwnerAuthor && (
              <span className="rounded-full bg-slate-900 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
                Owner
              </span>
            )}
            {locked && (
              <span className="rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                Testimonial
              </span>
            )}
          </div>
          <span>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
        </div>

        <div className="mb-1 flex items-center gap-1 text-[12px]">
          {[1, 2, 3, 4, 5].map((n) => (
            <SymbolIcon
              key={n}
              name="star"
              fill={(c.rating || 0) >= n ? 1 : 0}
              className={(c.rating || 0) >= n ? "text-[15px] text-amber-500" : "text-[15px] text-slate-300"}
            />
          ))}
        </div>

        {isEditingComment ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-slate-600">Rating (optional)</div>
              <Stars value={editingRating || 0} onChange={setEditingRating} disabled={locked || editBusy} />
            </div>

            <Textarea rows={2} value={editingText} onChange={(e) => setEditingText(e.target.value)} />

            <div className="flex items-center gap-2 text-xs">
              <Button type="button" disabled={editBusy || locked} onClick={() => saveEditComment(c)}>
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

            {locked ? (
              <div className="text-[11px] text-emerald-700">
                This comment is published as a testimonial and can’t be edited.
              </div>
            ) : null}
          </div>
        ) : (
          <p className="whitespace-pre-line text-slate-800">{c.text}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {isOwnerUser && !isOwnerAuthor && (
            <button type="button" onClick={() => replyAsOwnerTo(c)} className="font-medium hover:text-slate-700">
              Reply as owner
            </button>
          )}

          {isMyComment && !isEditingComment && !locked && (
            <>
              <button type="button" onClick={() => startEditComment(c)} className="font-medium hover:text-slate-700">
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

          {isMyComment && locked ? (
            <span className="text-[11px] text-slate-500">
              Published testimonials can’t be edited or deleted.
            </span>
          ) : null}
        </div>

        {replies.length > 0 && (
          <div className="mt-2 space-y-2 border-l border-slate-200 pl-3">
            {replies.map((r) => renderCommentBlock(r, true))}
          </div>
        )}
      </div>
    );
  };

  if (pageLoading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <div className="text-sm text-slate-500">Loading project…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-0 flex items-center min-h-14 justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <span className="mx-1">/</span>
            <span className="text-slate-700">Project</span>
          </div>
        </div>
        <Link to="/explore" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back
        </Link>
      </div>

      <Card className="mb-4 overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        {coverUrl && (
          <div className="relative h-[200px] w-full bg-slate-200">
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </div>
        )}

        <div
          className={
            "border-b border-slate-100 px-5 py-4 text-white sm:px-6 " +
            (project?.is_job_posting
              ? "bg-[#CB633A]/95"
              : "bg-slate-900/95")
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">{project?.title || `Project #${id}`}</h1>
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
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[10px] font-semibold tracking-wide text-[#7D351C]">
                    JOB POSTING
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start sm:self-end">
              {project?.id ? (
                <Link
                  to={`/projects/${project.id}/print`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/18"
                >
                  Printable job post
                </Link>
              ) : null}

              {isOwnerUser ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      return;
                    }
                    requestEditProject();
                  }}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/18"
                >
                  {isEditing
                    ? "Close editor"
                    : project?.is_job_posting
                    ? "Edit job post"
                    : "Edit project"}
                </button>
              ) : null}

              {canSharePublicJob ? (
                <button
                  type="button"
                  onClick={shareProject}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/18"
                >
                  Share job
                </button>
              ) : null}

              {project?.owner_username ? (
                <Link
                  to={`/profiles/${project.owner_username}`}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 bg-white/10 px-6 text-base font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/18"
                >
                  Public Profile
                </Link>
              ) : null}

              {project?.owner_username && authed && !isOwnerUser ? (
                <button
                  type="button"
                  onClick={() => setMsgOpen(true)}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 bg-white/10 px-6 text-base font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/18"
                >
                  Message
                </button>
              ) : null}

              <div className="flex items-center gap-3 text-white">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-[1ch] text-[18px] font-medium text-white/92">
                    {Number.isFinite(likeCount) ? likeCount : 0}
                  </span>
                  {authed && project && !isOwnerUser ? (
                    <button
                      type="button"
                      onClick={toggleLike}
                      disabled={likeBusy}
                      aria-label={isLiked ? "Unlike project" : "Like project"}
                      title={isLiked ? "Unlike project" : "Like project"}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-60"
                    >
                      <LikeCircleIcon active={isLiked} className="h-[20px] w-[30px]" />
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white/90"
                    >
                      <LikeCircleIcon className="h-[30px] w-[30px]" />
                    </span>
                  )}
                </div>

                {authed && project && !isOwnerUser ? (
                  <button
                    type="button"
                    onClick={toggleSave}
                    disabled={saveBusy}
                    aria-label={isSaved ? "Unsave project" : "Save project"}
                    title={isSaved ? "Unsave project" : "Save project"}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    <SaveCircleIcon active={isSaved} className="h-[20px] w-[30px]" />
                  </button>
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white/90"
                  >
                    <SaveCircleIcon className="h-[30px] w-[30px]" />
                  </span>
                )}
              </div>
            </div>
          </div>
          {shareFeedback ? <div className="mt-3 text-xs text-white/80">{shareFeedback}</div> : null}
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {project?.is_job_posting ? (
            <div className="rounded-2xl border border-slate-200 bg-[#FCFBF8] p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job overview</div>
              <div className="mt-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
                {jobSummaryText || "Project requirements will appear here."}
              </div>

              <div className="mt-6 grid gap-y-5 border-t border-slate-200 pt-5 sm:grid-cols-2 xl:grid-cols-6 xl:gap-x-0">
                {[
                  ["Location", project?.location || "—"],
                  ["Budget", project?.budget ?? "—"],
                  ["Sq Ft", project?.sqf ?? "—"],
                  ["Posting type", project?.is_private ? "Private invite-only job" : "Public job posting"],
                  [
                    "Permits",
                    project?.permit_required
                      ? `Required${project?.permit_responsible_party ? ` · ${project.permit_responsible_party}` : ""}`
                      : "Not specified",
                  ],
                  ["Posted", formatPostedDate(project?.created_at)],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={
                      "min-w-0 xl:px-5 " +
                      (index > 0 ? "xl:border-l xl:border-slate-200" : "")
                    }
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
                    {label === "Location" && mapSrc ? (
                      <button
                        type="button"
                        onClick={() => setMapOpen(true)}
                        className="mt-1 inline-flex text-xs font-medium text-sky-700 hover:underline"
                      >
                        Show map
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {(serviceCategoryList.length > 0 ||
                project?.required_expertise ||
                project?.highlights ||
                project?.larger_project_details) ? (
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Requirements
                  </div>

                  {serviceCategoryList.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {serviceCategoryList.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 text-sm text-slate-700 lg:grid-cols-2">
                    {project?.required_expertise ? (
                      <div>
                        <span className="font-semibold text-slate-900">Required expertise:</span> {project.required_expertise}
                      </div>
                    ) : null}

                    {project?.highlights ? (
                      <div>
                        <span className="font-semibold text-slate-900">Highlights:</span> {project.highlights}
                      </div>
                    ) : null}

                    {project?.larger_project_details ? (
                      <div className="lg:col-span-2">
                        <span className="font-semibold text-slate-900">Context:</span> {project.larger_project_details}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : project?.summary ? (
            <p className="text-sm leading-relaxed text-slate-700 sm:text-[15px]">{project.summary}</p>
          ) : null}

          {project?.is_job_posting && project?.id ? (
            <BidModule projectId={project.id} ownerUsername={project.owner_username} />
          ) : null}
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
              {editError && <p className="px-5 pb-3 pt-1 text-xs text-red-600">{editError}</p>}
            </div>
          )}

          {(project?.material_url ||
            project?.material_label ||
            (Array.isArray(project?.extra_links) && project.extra_links.length > 0)) && (
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

              {Array.isArray(project?.extra_links) && project.extra_links.length > 0 && (
                <div className="mt-3 space-y-2">
                  {project.extra_links.map((row, index) => {
                    const label = row?.label || "";
                    const url = row?.url || "";
                    if (!label && !url) return null;

                    return (
                      <div key={`${url || label || index}`} className="flex items-start gap-2">
                        <div className="mt-[3px] flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-500">
                          +
                        </div>
                        <div className="min-w-0">
                          {label && <div className="text-xs font-semibold text-slate-800">{label}</div>}
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
                These links point to products or materials used in this project (for example, tools, finishes, or
                suppliers).
              </p>
            </div>
          )}

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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.url + i}
                    onClick={() => {
                      setActiveImageIdx(i);
                      setImageLightboxOpen(true);
                    }}
                    className="group w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:shadow-md"
                  >
                    <img
                      src={img.url}
                      alt={img.caption || ""}
                      className="block h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    {img.caption && <div className="px-3 py-2 text-xs text-slate-700">{img.caption}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Comments
              </div>
              <div className="text-[11px] text-slate-500">
                {comments.length || 0} comment{comments.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="space-y-3">
              {roots.length === 0 ? (
                <p className="text-xs text-slate-500">No comments yet. Be the first to comment.</p>
              ) : (
                roots.map((c) => renderCommentBlock(c))
              )}
            </div>

            <div className="border-t border-slate-200 pt-3">
              {authed ? (
                <form onSubmit={submitComment} className="space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                    Public comments are text-only. No links or media. Emoji is okay.
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-medium text-slate-600">Rating (optional)</div>
                    <Stars value={commentRating || 0} onChange={setCommentRating} disabled={commentBusy} />
                  </div>

                  {replyingTo && (
                    <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
                      <div>
                        Replying to <span className="font-semibold">{replyingTo.author_username || "user"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="ml-2 inline-flex items-center text-slate-500 hover:text-slate-700"
                      >
                        <SymbolIcon name="close" className="text-[16px]" />
                      </button>
                    </div>
                  )}

                  <Textarea
                    rows={3}
                    maxLength={COMMENT_CHAR_LIMIT}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a public comment…"
                    className="min-h-[88px] bg-white"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500">
                      {commentText.trim().length}/{COMMENT_CHAR_LIMIT}
                    </div>
                    <div className="flex items-center gap-3">
                      {commentError && <p className="text-[11px] text-red-600">{commentError}</p>}
                      <Button type="submit" disabled={commentBusy || !commentText.trim() || commentText.trim().length > COMMENT_CHAR_LIMIT}>
                        {commentBusy ? "Posting…" : "Post"}
                      </Button>
                    </div>
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
      </Card>

      {unpublishModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="text-sm font-semibold text-slate-900">
              Unpublish this post to enable editing
            </div>
            <div className="mt-2 text-sm text-slate-700">
              Warning: current post data may change while you edit. You can re-publish after reviewing the updates.
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnpublishModalOpen(false)}
                disabled={savingEdits}
              >
                Keep it published
              </Button>

              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={unpublishAndEdit}
                disabled={savingEdits}
              >
                {savingEdits ? "Unpublishing…" : "Unpublish & Edit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {imageLightboxOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-2 sm:p-4">
          <div className="flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-[#f4f4f1] shadow-2xl md:h-[92vh]">
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
              <div className="min-w-0 pr-4">
                <div className="truncate text-sm font-medium text-slate-900">
                  {project?.title || `Project #${id}`}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {currentImage?.caption || "Project gallery"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {images.length > 0 ? (
                  <div className="rounded-full bg-slate-500 px-3 py-1 text-xs font-semibold text-white">
                    {activeImageIdx + 1}/{images.length}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setImageLightboxOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-2 text-slate-700 shadow-sm hover:bg-slate-50"
                  aria-label="Close image gallery"
                >
                  <SymbolIcon name="close" className="text-[20px]" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 bg-[#f4f4f1]">
              {currentImage ? (
                <>
                  <div className="flex h-full flex-col">
                    <div className="flex h-[72vh] min-h-[440px] w-full items-center justify-center overflow-hidden bg-[#f4f4f1] px-4 py-4 md:px-12">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden">
                        <img
                          src={currentImage.url}
                          alt={currentImage.caption || ""}
                          className="block h-full w-full object-contain"
                        />
                      </div>
                    </div>

                    {images.length > 1 && (
                      <div className="flex items-center justify-center gap-1 border-t border-black/5 bg-[#efefeb] px-3 py-2 text-[11px] text-slate-600">
                        <button
                          type="button"
                          onClick={prevImage}
                          className="mr-1 inline-flex items-center justify-center rounded-full bg-white px-2 py-0.5 text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          <SymbolIcon name="chevron_left" className="text-[18px]" />
                        </button>
                        {images.map((img, i) => (
                          <button
                            key={img.url + i}
                            type="button"
                            onClick={() => setActiveImageIdx(i)}
                            className={
                              "mx-[2px] rounded-full px-2 py-0.5 " +
                              (i === activeImageIdx
                                ? "bg-slate-700 text-white"
                                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50")
                            }
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={nextImage}
                          className="ml-1 inline-flex items-center justify-center rounded-full bg-white px-2 py-0.5 text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          <SymbolIcon name="chevron_right" className="text-[18px]" />
                        </button>
                      </div>
                    )}
                  </div>

                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-3 text-slate-700 shadow-md hover:bg-white"
                      >
                        <SymbolIcon name="chevron_left" className="text-[36px]" />
                      </button>
                      <button
                        type="button"
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-3 text-slate-700 shadow-md hover:bg-white"
                      >
                        <SymbolIcon name="chevron_right" className="text-[36px]" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No media</div>
              )}
            </div>

          </div>
        </div>
      )}

      {mapOpen && mapSrc ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setMapOpen(false)}>
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Project map</div>
                {project?.location ? <div className="text-[11px] text-slate-500">{project.location}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"
              >
                <SymbolIcon name="close" className="text-[16px]" />
              </button>
            </div>
            <iframe
              title="Project location map"
              src={mapSrc}
              className="h-[420px] w-full border-0 md:h-[520px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      ) : null}

      {bidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {editingBidId ? "Revise Bid" : "Send Bid"}
                </div>
                <div className="text-xs text-slate-500">
                  Submit a project-specific bid for this job
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBidOpen(false);
                  setBidError("");
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"
              >
                <SymbolIcon name="close" className="text-[16px]" />
              </button>
            </div>

            <form onSubmit={submitBid} className="space-y-4 px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Price type
                  </label>
                  <select
                    value={bidForm.price_type}
                    onChange={updateBidField("price_type")}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="fixed">Fixed price</option>
                    <option value="range">Estimate range</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Valid until
                  </label>
                  <Input
                    type="date"
                    value={bidForm.valid_until}
                    onChange={updateBidField("valid_until")}
                  />
                </div>
              </div>

              {bidForm.price_type === "fixed" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Amount
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bidForm.amount}
                    onChange={updateBidField("amount")}
                    placeholder="e.g. 4500"
                    required
                  />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Minimum amount
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bidForm.amount_min}
                      onChange={updateBidField("amount_min")}
                      placeholder="e.g. 5000"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Maximum amount
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bidForm.amount_max}
                      onChange={updateBidField("amount_max")}
                      placeholder="e.g. 6500"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Estimated timeline
                </label>
                <Input
                  value={bidForm.timeline_text}
                  onChange={updateBidField("timeline_text")}
                  placeholder="e.g. 2–3 weeks"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Proposal
                </label>
                <Textarea
                  rows={4}
                  value={bidForm.proposal_text}
                  onChange={updateBidField("proposal_text")}
                  placeholder="Describe your approach, scope understanding, and what the client should know."
                  className="min-h-[110px]"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Included
                  </label>
                  <Textarea
                    rows={4}
                    value={bidForm.included_text}
                    onChange={updateBidField("included_text")}
                    placeholder="Labor, installation, cleanup, standard materials..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Excluded
                  </label>
                  <Textarea
                    rows={4}
                    value={bidForm.excluded_text}
                    onChange={updateBidField("excluded_text")}
                    placeholder="Permit fees, specialty finishes, hidden damage..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Payment terms
                </label>
                <Textarea
                  rows={3}
                  value={bidForm.payment_terms}
                  onChange={updateBidField("payment_terms")}
                  placeholder="30% deposit, 40% mid-project, 30% on completion"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Attachment (optional)
                </label>
                <input
                  type="file"
                  onChange={handleBidAttachmentChange}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
                />
                {bidForm.attachment ? (
                  <div className="mt-1 text-xs text-slate-500">{bidForm.attachment.name}</div>
                ) : null}
              </div>

              {bidError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {bidError}
                </div>
              )}

              {bidSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {bidSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBidOpen(false);
                    setBidError("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <Button type="submit" disabled={bidBusy}>
                  {bidBusy ? "Submitting…" : editingBidId ? "Save Revision" : "Submit Bid"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeBid ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Bid Details</div>
                <div className="text-xs text-slate-500">
                  Full estimate and decision controls
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveBid(null)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"
              >
                <SymbolIcon name="close" className="text-[16px]" />
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-5">
              {renderBidCard(activeBid, { ownerView: true, compact: false })}
            </div>
          </div>
        </div>
      ) : null}

      {msgOpen ? (
        <QuickMessageDrawer
          open={msgOpen}
          onClose={() => setMsgOpen(false)}
          recipientUsername={project?.owner_username}
          recipientDisplayName={project?.owner_username}
          originProjectId={project?.id}
          originProjectTitle={project?.title || `Project #${project?.id}`}
        />
      ) : null}
    </div>
  );
}
