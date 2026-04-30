// ============================================================================
// file: frontend/src/components/CreateProjectCard.jsx
// Create Project + Job Posting form fields (Public vs Private draft)
// Action menu: Save Draft / Publish / Send to Contractor
// ============================================================================

import { useMemo, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import api from "../api";
import AiWriteButton from "./AiWriteButton";
import { Card, Input, Textarea, Button, Badge, SymbolIcon } from "../ui";

const PROJECT_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm";
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(?:$|[?#])/i;

function mediaTypeFor(item) {
  const fileType = item?.file?.type || item?._file?.type || "";
  const fileName = item?.file?.name || item?._file?.name || item?.name || "";
  const url = item?.url || "";
  if (
    item?.media_type === "video" ||
    item?.mediaType === "video" ||
    fileType.startsWith("video/") ||
    VIDEO_EXTENSIONS.test(String(fileName)) ||
    VIDEO_EXTENSIONS.test(String(url))
  ) {
    return "video";
  }
  return "image";
}

function toggleInArray(arr, value) {
  const list = Array.isArray(arr) ? arr : [];
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function JobPostingHelp({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-50"
        aria-label="Help"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-80 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
          <div className="font-semibold text-slate-900">Private posting</div>
          <div className="mt-1 whitespace-pre-line">{text}</div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200"
              onClick={() => setOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

function ComplianceNotice({ checked, onChange, publishLabel = "publish" }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Before You {publishLabel}
      </div>
      <div className="mt-2 text-sm leading-6 text-amber-950">
        You are responsible for the accuracy, legality, and rights related to anything you publish on Portfolio, including text, photos, project details, and job requirements.
      </div>
      <label className="mt-3 flex items-start gap-3 text-sm text-amber-950">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          I understand that I am liable for the content I post and confirm it complies with Portfolio terms and applicable laws.
        </span>
      </label>
    </div>
  );
}

function ServiceCategoryDropdown({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const options = ["Plumbing", "Carpentry", "Electrical", "General", "Masonry"];
  const selected = Array.isArray(value) ? value : [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-5 py-3 text-left text-base text-slate-800 shadow-sm transition hover:border-slate-400"
      >
        <span className={selected.length ? "font-medium text-slate-900" : "text-slate-400"}>
          {selected.length ? selected.join(", ") : "Select service categories"}
        </span>
        <span className="ml-4 text-lg text-slate-500">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-base text-slate-800 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-slate-950"
                  checked={selected.includes(option)}
                  onChange={() => onChange?.(toggleInArray(selected, option))}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectReadinessGuide({ show = false }) {
  if (!show) return null;

  const items = [
    {
      label: "Active registration or license",
      detail: "Useful when permits or regulated work may be involved.",
    },
    {
      label: "Insurance confirmation",
      detail: "Helps both sides understand coverage before work starts.",
    },
    {
      label: "Written scope and timeline",
      detail: "Keeps pricing, milestones, and responsibilities clear.",
    },
  ];

  return (
    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
      <div className="text-sm font-semibold uppercase tracking-wide text-blue-900">
        Project Readiness Guide
      </div>
      <p className="mt-2 text-sm leading-6 text-blue-950">
        For licensed or permitted work, it is reasonable to ask for standard project paperwork
        before the job begins. This is not a platform investigation or a background check. It is a
        simple safety step that helps homeowners and contractors stay aligned.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-blue-100 bg-white/75 p-4">
            <div className="text-sm font-semibold text-slate-950">{item.label}</div>
            <div className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-blue-900/80">
        FlatOrigin helps organize project information, but final verification, agreements, permits,
        and legal obligations remain between the homeowner and contractor.
      </p>
    </div>
  );
}

const CONTRACTOR_SEARCH_MODES = [
  { value: "all", label: "All", placeholder: "Search contractors, project titles, categories..." },
  { value: "username", label: "Username", placeholder: "Search by contractor username or name..." },
  { value: "job_title", label: "Job title", placeholder: "Search by project title, e.g. deck, kitchen..." },
  { value: "project_type", label: "Project type", placeholder: "Search by work type, e.g. pergola, painting..." },
  { value: "category", label: "Category", placeholder: "Search by category, e.g. carpentry, renovation..." },
];

function ContractorInvitePicker({ selected = [], onChange }) {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const selectedList = Array.isArray(selected) ? selected : [];
  const selectedSet = new Set(selectedList.map((username) => String(username).toLowerCase()));
  const availableResults = results.filter(
    (profile) => !selectedSet.has(String(profile.username || "").toLowerCase()),
  );
  const activeMode =
    CONTRACTOR_SEARCH_MODES.find((mode) => mode.value === searchMode) || CONTRACTOR_SEARCH_MODES[0];

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/profiles/contractors/search/", {
          params: {
            ...(query.trim() ? { q: query.trim() } : {}),
            search_by: searchMode,
          },
        });
        if (active) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, searchMode]);

  const addContractor = (username) => {
    const value = String(username || "").trim();
    if (!value || selectedSet.has(value.toLowerCase()) || selectedList.length >= 6) return;
    onChange?.([...selectedList, value]);
  };

  const removeContractor = (username) => {
    const key = String(username || "").toLowerCase();
    onChange?.(selectedList.filter((item) => String(item).toLowerCase() !== key));
  };

  return (
    <div className="mt-3 rounded-2xl border border-sky-100 bg-white p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label className="block text-sm font-semibold text-sky-950">
            Invite contractors
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Pick what you want to search, then type in one box. Results can match contractor profiles or their posted portfolio project work. Invite up to 6.
          </p>
        </div>
        <Badge>{selectedList.length}/6 selected</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {CONTRACTOR_SEARCH_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => setSearchMode(mode.value)}
            className={
              "rounded-full border px-3 py-1 text-xs font-semibold transition " +
              (searchMode === mode.value
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-950")
            }
          >
            {mode.label}
          </button>
        ))}
      </div>

      <Input
        className="mt-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={activeMode.placeholder}
      />

      <p className="mt-2 text-xs text-slate-500">
        Use <span className="font-semibold text-slate-700">Job title</span> for examples like
        {" "}“deck” or “bathroom”, <span className="font-semibold text-slate-700">Category</span>
        {" "}for trades, or <span className="font-semibold text-slate-700">All</span> when you are not sure.
      </p>

      {selectedList.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedList.map((username) => (
            <button
              key={username}
              type="button"
              onClick={() => removeContractor(username)}
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
              title="Remove invite"
            >
              @{username} ×
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {loading ? (
          <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-500">
            Searching contractors...
          </div>
        ) : availableResults.length === 0 ? (
          <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-500">
            {selectedList.length > 0 ? "No more matching contractors found." : "No contractors found."}
          </div>
        ) : (
          availableResults.map((profile) => {
            const username = profile.username || "";
            const image = profile.avatar_url || profile.logo_url || "";
            return (
              <div
                key={username}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (profile.display_name || username || "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {profile.display_name || username}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    @{username}
                    {profile.service_location ? ` · ${profile.service_location}` : ""}
                  </div>
                  {profile.hero_headline || profile.bio ? (
                    <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {profile.hero_headline || profile.bio}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  disabled={selectedList.length >= 6}
                  onClick={() => addContractor(username)}
                >
                  Invite
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CreateProjectCard({
  ownedCount = 0,
  form,
  setForm,
  cover,
  setCover,
  busy = false,
  error,
  success,
  onSubmit, // (event, images) => void
  onSendPrivate, // OPTIONAL: (username, payload) => void (later)
  defaultOpen = false,
  hideLauncher = false,
  closeSignal = 0, // optional: increments when Dashboard wants this card to close + reset
  forceJobPosting = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [images, setImages] = useState([]);

  const jobOn = forceJobPosting || !!form.is_job_posting;

  const privateHelpText = useMemo(
    () =>
      [
        "Private posts are visible only to the owner and the invited contractor.",
        "When ready, search and invite contractors so they can review it and bid.",
        "Private jobs do not appear in public listings or search.",
        "Optional: enable email notifications to get alerted when there’s activity on this post.",
      ].join("\n"),
    []
  );

  const ensureJobDefaults = () => {
    setForm((prev) => ({
      ...prev,
      job_summary: prev.job_summary || "",
      service_categories: Array.isArray(prev.service_categories)
        ? prev.service_categories
        : [],
      part_of_larger_project: !!prev.part_of_larger_project,
      larger_project_details: prev.larger_project_details || "",
      required_expertise: prev.required_expertise || "",
      permit_required: !!prev.permit_required,
      permit_responsible_party: prev.permit_responsible_party || "",
      compliance_confirmed: !!prev.compliance_confirmed,
      post_privacy: prev.post_privacy || "public",
      private_contractor_username: prev.private_contractor_username || "",
      private_contractor_usernames: Array.isArray(prev.private_contractor_usernames)
        ? prev.private_contractor_usernames
        : prev.private_contractor_username
          ? [prev.private_contractor_username]
          : [],
      notify_by_email: !!prev.notify_by_email,
    }));
  };

  const validatePublish = () => {
    if (!form.compliance_confirmed) {
      return { ok: false, msg: "Please confirm compliance before publishing." };
    }

    if (jobOn && (form.post_privacy || "public") !== "public") {
      return {
        ok: false,
        msg: "Private posts are not published. Use Send to Contractor.",
      };
    }

    return { ok: true };
  };

  const validateSendPrivate = () => {
    if (!jobOn) return { ok: false, msg: "Turn on Job Posting first." };
    if ((form.post_privacy || "public") !== "private") {
      return { ok: false, msg: "Set Post Privacy to Private to send to a contractor." };
    }
    const selected = Array.isArray(form.private_contractor_usernames)
      ? form.private_contractor_usernames.filter(Boolean)
      : [];
    const legacy = (form.private_contractor_username || "").trim();
    const invites = selected.length > 0 ? selected : legacy ? [legacy] : [];
    if (invites.length === 0) return { ok: false, msg: "Select at least one contractor to invite." };
    if (!form.compliance_confirmed) {
      return { ok: false, msg: "Please confirm compliance before sending." };
    }
    return { ok: true, username: invites[0], usernames: invites };
  };

  const resetLocalImages = () => {
    // revoke blob urls to avoid leaks
    setImages((prev) => {
      prev.forEach((img) => {
        if (img?.url && typeof img.url === "string" && img.url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(img.url);
          } catch {
            // ignore
          }
        }
      });
      return [];
    });
  };

  // Close + reset when Dashboard signals
  useEffect(() => {
    if (!closeSignal) return;
    setIsOpen(false);
    resetLocalImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);

  // Respect defaultOpen when the component is used in modal flows
  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  useEffect(() => {
    if (!forceJobPosting) return;
    setForm((prev) => {
      if (prev.is_job_posting && prev.post_privacy) return prev;
      return {
        ...prev,
        is_job_posting: true,
        post_privacy: prev.is_public === false ? "private" : "public",
      };
    });
  }, [forceJobPosting, setForm]);

  const setPublicPosting = (isPublic) => {
    setForm((p) => ({
      ...p,
      is_public: isPublic,
      post_privacy: isPublic ? "public" : "private",
      private_contractor_username: isPublic ? "" : p.private_contractor_username || "",
      private_contractor_usernames: isPublic ? [] : p.private_contractor_usernames || [],
    }));
  };

  const toggleJobPosting = () => {
    if (forceJobPosting) return;
    // single state update to avoid weird batching interactions
    setForm((prev) => {
      const next = { ...prev, is_job_posting: !prev.is_job_posting };
      return {
        ...next,
        job_summary: next.job_summary || "",
        service_categories: Array.isArray(next.service_categories)
          ? next.service_categories
          : [],
        part_of_larger_project: !!next.part_of_larger_project,
        larger_project_details: next.larger_project_details || "",
        required_expertise: next.required_expertise || "",
        permit_required: !!next.permit_required,
        permit_responsible_party: next.permit_responsible_party || "",
        compliance_confirmed: !!next.compliance_confirmed,
        post_privacy: next.post_privacy || "public",
        private_contractor_username: next.private_contractor_username || "",
        private_contractor_usernames: Array.isArray(next.private_contractor_usernames)
          ? next.private_contractor_usernames
          : next.private_contractor_username
            ? [next.private_contractor_username]
            : [],
        notify_by_email: !!next.notify_by_email,
      };
    });
  };

  const toggleOpen = () => {
    setIsOpen((v) => {
      const next = !v;
      if (!next) resetLocalImages();
      return next;
    });
  };

  const handleAddImages = (files) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);

    const newImages = arr.map((file) => ({
      id: Math.random().toString(36).slice(2),
      url: URL.createObjectURL(file),
      media_type: mediaTypeFor({ _file: file }),
      caption: "",
      _file: file,
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleAddImages(e.dataTransfer?.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageCaptionChange = (id, caption) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const handleDeleteImage = (image) => {
    if (image?.url && typeof image.url === "string" && image.url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(image.url);
      } catch {
        // ignore
      }
    }
    setImages((prev) => prev.filter((img) => img.id !== image.id));
  };

  // IMPORTANT: we use flushSync so is_public/post_privacy changes are applied
  // before Dashboard reads `form` to create FormData.
  const saveDraft = async (e) => {
    e.preventDefault();
    flushSync(() => {
      ensureJobDefaults();
      setForm((p) => ({ ...p, is_public: false }));
    });
    await onSubmit?.(e, images);
    setIsOpen(false);
    resetLocalImages();
  };

  const publishProject = async (e) => {
    e.preventDefault();

    const v = validatePublish();
    if (!v.ok) return alert(v.msg);

    flushSync(() => {
      ensureJobDefaults();
      setForm((p) => ({ ...p, is_public: true, post_privacy: "public" }));
    });

    await onSubmit?.(e, images);
    setIsOpen(false);
    resetLocalImages();
  };

  const sendToContractor = async (e) => {
    e.preventDefault();

    const v = validateSendPrivate();
    if (!v.ok) return alert(v.msg);

    flushSync(() => {
      ensureJobDefaults();
      setForm((p) => ({
        ...p,
        is_public: false,
        post_privacy: "private",
        private_contractor_username: v.usernames[0] || "",
        private_contractor_usernames: v.usernames,
      }));
    });

    const result = await onSubmit?.(e, images);

    if (onSendPrivate) {
      onSendPrivate(v.username, {
        ...form,
        is_public: false,
        post_privacy: "private",
        projectId: result?.id || null,
      });
    }

    setIsOpen(false);
    resetLocalImages();
  };

  const showForm = hideLauncher || isOpen;

  return (
    <Card className="p-5">
      {/*<div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">Create Project</div>
        <Badge>{ownedCount} owned</Badge>
      </div>

      {!hideLauncher ? (
        <Button type="button" className="mb-3" onClick={toggleOpen}>
          {isOpen ? "Hide form" : "Create new project"}
        </Button>
      ) : null}*/}

      {showForm && (
        <>
          {/* Job Posting header (blue) + Public toggle on right */}
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* LEFT: Job Posting toggle + title */}
              <div className="flex items-center gap-3">
                {forceJobPosting ? (
                  <span className="inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={toggleJobPosting}
                    aria-pressed={jobOn}
                    className={
                      "relative inline-flex h-6 w-11 items-center rounded-full border transition " +
                      (jobOn ? "bg-sky-500 border-sky-500" : "bg-slate-200 border-slate-300")
                    }
                  >
                    <span
                      className={
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition " +
                        (jobOn ? "translate-x-5" : "translate-x-1")
                      }
                    />
                  </button>
                )}

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/80">
                    Job Posting
                  </div>
                  <div className="mt-0.5 text-[11px] text-sky-800">
                    {jobOn
                      ? forceJobPosting
                        ? "Homeowner projects are posted as job posts for contractors to review."
                        : "This project will be treated as a job post (homeowners posting jobs for pros)."
                      : "Turn this on when a homeowner is posting work for contractors."}
                  </div>
                </div>
              </div>

              {/* RIGHT: Public toggle */}
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-sky-900/80">Public</div>
                <button
                  type="button"
                  onClick={() => setPublicPosting(!form.is_public)}
                  aria-pressed={!!form.is_public}
                  className={
                    "relative inline-flex h-6 w-11 items-center rounded-full border transition " +
                    (form.is_public ? "bg-sky-500 border-sky-500" : "bg-slate-200 border-slate-300")
                  }
                >
                  <span
                    className={
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition " +
                      (form.is_public ? "translate-x-5" : "translate-x-1")
                    }
                  />
                </button>
              </div>
            </div>

            {jobOn && form.post_privacy === "private" ? (
              <div className="mt-3 border-t border-sky-200 pt-3">
                <div className="mb-1 text-sm font-medium text-sky-950">
                  Private contractor search
                  <JobPostingHelp text={privateHelpText} />
                </div>
                <ContractorInvitePicker
                  selected={
                    Array.isArray(form.private_contractor_usernames)
                      ? form.private_contractor_usernames
                      : form.private_contractor_username
                        ? [form.private_contractor_username]
                        : []
                  }
                  onChange={(usernames) =>
                    setForm((p) => ({
                      ...p,
                      private_contractor_usernames: usernames,
                      private_contractor_username: usernames[0] || "",
                    }))
                  }
                />
              </div>
            ) : null}

          </div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Project Info (Draft)
          </div>

          <form onSubmit={(e) => onSubmit?.(e, images)} className="space-y-6">
            <ComplianceNotice
              checked={!!form.compliance_confirmed}
              onChange={(checked) => setForm((p) => ({ ...p, compliance_confirmed: checked }))}
              publishLabel={jobOn ? "publish this post" : "publish this project"}
            />

            {/* Basics */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Project Name</label>
                <Input
                  placeholder="e.g. Kitchen remodel"
                  value={form.title || ""}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Category</label>
                <Input
                  placeholder="e.g. Renovation"
                  value={form.category || ""}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
            </div>

            {!jobOn ? (
              <div>
                <label className="mb-1 block text-sm text-slate-600">Summary</label>
                <Textarea
                  placeholder="One or two sentences…"
                  value={form.summary || ""}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                />
              </div>
            ) : null}

            {/* Location / Budget / Sq Ft */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-600">Location</label>
                <Input
                  placeholder="City, State"
                  value={form.location || ""}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-600">Budget</label>
                <Input
                  placeholder="e.g. 25000"
                  inputMode="numeric"
                  value={form.budget ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-600">Square Feet</label>
                <Input
                  placeholder="e.g. 1800"
                  inputMode="numeric"
                  value={form.sqf ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      sqf: (e.target.value || "").replace(/[^\d]/g, ""),
                    }))
                  }
                />
              </div>
            </div>

            {/* Job Posting Extensions */}
            {jobOn && (
              <Card className="border border-slate-200 p-6 sm:p-8">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Job Posting Details
                </div>

                {/* 1. Project Overview */}
                <div className="mt-8">
                  <div className="text-lg font-semibold text-slate-900">1. Project Overview</div>

                  <div className="mt-5">
                    <label className="mb-2 block text-lg text-slate-700">Project Summary</label>
                    <Textarea
                      className="min-h-44 rounded-2xl px-5 py-4 text-base"
                      placeholder="e.g., Full kitchen remodel including custom cabinetry and island installation."
                      value={form.job_summary || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          job_summary: e.target.value,
                          summary: jobOn ? e.target.value : p.summary,
                        }))
                      }
                    />
                    <AiWriteButton
                      className="mt-3"
                      feature="project_summary"
                      payload={{
                        title: form.title || "",
                        category: form.category || "",
                        location: form.location || "",
                        budget: String(form.budget || ""),
                        notes: form.summary || "",
                        current_text: form.job_summary || "",
                      }}
                      label="Draft summary with AI"
                      onApply={(text) =>
                        setForm((p) => ({
                          ...p,
                          job_summary: text,
                          summary: jobOn ? text : p.summary,
                        }))
                      }
                    />
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 text-lg text-slate-700">Service Category</div>
                    <ServiceCategoryDropdown
                      value={form.service_categories}
                      onChange={(service_categories) =>
                        setForm((p) => ({ ...p, service_categories }))
                      }
                    />
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 text-lg text-slate-700">Part of Larger Project</div>
                    <div className="flex items-center gap-6 text-base text-slate-800">
                      <label className="flex items-center gap-3">
                        <input
                          className="h-5 w-5 accent-slate-950"
                          type="radio"
                          name="larger_project"
                          checked={!!form.part_of_larger_project}
                          onChange={() => setForm((p) => ({ ...p, part_of_larger_project: true }))}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          className="h-5 w-5 accent-slate-950"
                          type="radio"
                          name="larger_project"
                          checked={!form.part_of_larger_project}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              part_of_larger_project: false,
                              larger_project_details: "",
                            }))
                          }
                        />
                        No
                      </label>
                    </div>

                    {form.part_of_larger_project && (
                      <div className="mt-4">
                        <label className="mb-2 block text-base text-slate-700">If yes, specify</label>
                        <Input
                          className="min-h-14 rounded-2xl px-5 text-base"
                          value={form.larger_project_details || ""}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, larger_project_details: e.target.value }))
                          }
                          placeholder="Describe the larger project context"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Professional & Legal Requirements */}
                <div className="mt-10">
                  <div className="text-lg font-semibold text-slate-900">
                    2. Professional &amp; Legal Requirements
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 text-lg text-slate-700">Required Expertise</div>
                    <div className="flex flex-col gap-4 text-base text-slate-800">
                      <label className="flex items-start gap-3">
                        <input
                          className="mt-1 h-5 w-5 accent-slate-950"
                          type="radio"
                          name="expertise"
                          checked={form.required_expertise === "licensed_pro"}
                          onChange={() => setForm((p) => ({ ...p, required_expertise: "licensed_pro" }))}
                        />
                        <span>
                          <span className="font-medium">Licensed Professional</span>{" "}
                          <span className="text-sm text-slate-500">
                            (requires verified credentials/insurance)
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3">
                        <input
                          className="mt-1 h-5 w-5 accent-slate-950"
                          type="radio"
                          name="expertise"
                          checked={form.required_expertise === "handyman"}
                          onChange={() => setForm((p) => ({ ...p, required_expertise: "handyman" }))}
                        />
                        <span>
                          <span className="font-medium">Handyman / Expert Help</span>{" "}
                          <span className="text-sm text-slate-500">
                            (general labor/skilled assistance)
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 text-lg text-slate-700">Permitting</div>
                    <label className="flex items-center gap-3 text-base text-slate-800">
                      <input
                        className="h-5 w-5 accent-slate-950"
                        type="checkbox"
                        checked={!!form.permit_required}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            permit_required: e.target.checked,
                            permit_responsible_party: e.target.checked
                              ? p.permit_responsible_party || "contractor"
                              : "",
                          }))
                        }
                      />
                      Permit Required
                    </label>

                    {form.permit_required && (
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-3 text-base text-slate-800">
                          <input
                            className="h-5 w-5 accent-slate-950"
                            type="radio"
                            name="permit_party"
                            checked={form.permit_responsible_party === "contractor"}
                            onChange={() => setForm((p) => ({ ...p, permit_responsible_party: "contractor" }))}
                          />
                          Contractor handles filing
                        </label>
                        <label className="flex items-center gap-3 text-base text-slate-800">
                          <input
                            className="h-5 w-5 accent-slate-950"
                            type="radio"
                            name="permit_party"
                            checked={form.permit_responsible_party === "homeowner"}
                            onChange={() => setForm((p) => ({ ...p, permit_responsible_party: "homeowner" }))}
                          />
                          Homeowner handles filing
                        </label>
                      </div>
                    )}
                  </div>

                  <ProjectReadinessGuide
                    show={form.required_expertise === "licensed_pro" || !!form.permit_required}
                  />
                </div>
              </Card>
            )}

            {/* Images */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Media</span>
                {images.length > 0 && (
                  <span className="text-xs text-slate-500">{images.length} total</span>
                )}
              </div>

              {images.length > 0 ? (
                <div className="space-y-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center"
                    >
                      <div className="h-32 w-full overflow-hidden rounded-md bg-slate-100 md:w-56">
                        {mediaTypeFor(image) === "video" ? (
                          <div className="relative h-full w-full">
                            <video src={image.url} className="h-full w-full object-cover" muted playsInline />
                            <span className="absolute inset-0 flex items-center justify-center text-white">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60">
                                <SymbolIcon name="play_arrow" fill={1} className="text-[24px]" />
                              </span>
                            </span>
                          </div>
                        ) : (
                          <img
                            src={image.url}
                            alt={image.caption || "Project image"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder.png";
                            }}
                          />
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                        <input
                          type="text"
                          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Caption..."
                          value={image.caption || ""}
                          onChange={(e) => handleImageCaptionChange(image.id, e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteImage(image)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No media yet.</p>
              )}
            </div>

            {/* Add images */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Add Media</div>
              <div className="text-xs text-slate-500">
                Drag &amp; drop or click; add captions; upload.
              </div>

              <div
                className="mt-1 flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-slate-400 hover:bg-white"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() =>
                  document.getElementById("create-project-add-images-input")?.click()
                }
              >
                <input
                  type="file"
                  accept={PROJECT_MEDIA_ACCEPT}
                  multiple
                  className="hidden"
                  id="create-project-add-images-input"
                  onChange={(e) => handleAddImages(e.target.files)}
                />
                <label
                  htmlFor="create-project-add-images-input"
                  className="flex cursor-pointer flex-col items-center text-center"
                >
                  <SymbolIcon
                    name="add_photo_alternate"
                    className="mb-4 text-[42px] text-slate-400"
                    weight={300}
                  />
                  <div className="text-base font-semibold text-slate-900">Add project images</div>
                  <div className="mt-2 max-w-lg text-sm text-slate-600">
                    Upload project images, add captions, and organize the work you want shown on your project card.
                  </div>
                  <div className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    Browse images
                  </div>
                </label>
              </div>
            </div>

            {/* Action Menu */}
            <div className="space-y-2">
              {error && <div className="text-sm text-red-700">{error}</div>}
              {success && !error && <div className="text-sm text-green-700">Saved.</div>}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>
                  Save as Draft
                </Button>

                {jobOn && form.post_privacy === "private" ? (
                  <Button type="button" disabled={busy} onClick={sendToContractor}>
                    Send Invites
                  </Button>
                ) : (
                  <Button type="button" disabled={busy} onClick={publishProject}>
                    Publish Project
                  </Button>
                )}
              </div>
            </div>
          </form>
        </>
      )}
    </Card>
  );
}
