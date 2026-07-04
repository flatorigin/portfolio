import { useMemo, useState } from "react";
import api from "../api";
import { Button, SymbolIcon } from "../ui";

const CATEGORY_OPTIONS = [
  ["general_feedback", "General Feedback"],
  ["technical_support", "Technical Support"],
  ["copyright_content_report", "Copyright & Content Report"],
  ["customer_service", "Customer Service"],
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "txt"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function emptyForm() {
  return {
    category: "general_feedback",
    subject: "",
    message: "",
    links: "",
    attachments: [],
  };
}

function fileExtension(name) {
  const parts = String(name || "").toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function validateLinks(raw) {
  const links = String(raw || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const link of links) {
    let parsed;
    try {
      parsed = new URL(link);
    } catch {
      return { error: "Links must be valid URLs, one per line.", links: [] };
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Links must start with http:// or https://.", links: [] };
    }
  }

  return { error: "", links };
}

function validateFiles(files) {
  if (files.length > MAX_FILES) {
    return `Upload up to ${MAX_FILES} files.`;
  }

  for (const file of files) {
    const ext = fileExtension(file.name);
    const type = String(file.type || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return `${file.name} is not an allowed file type.`;
    }
    if (type && !ALLOWED_MIME_TYPES.has(type)) {
      return `${file.name} has an unsupported file type.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is larger than 20MB.`;
    }
  }

  return "";
}

function extractServerError(error) {
  const data = error?.response?.data;
  if (!data) return "Could not submit feedback. Please try again.";
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  const firstKey = Object.keys(data)[0];
  const value = firstKey ? data[firstKey] : "";
  if (Array.isArray(value)) return `${firstKey}: ${value.join(" ")}`;
  if (value) return `${firstKey}: ${value}`;
  return "Could not submit feedback. Please try again.";
}

export default function FeedbackSupportModal({ open, onClose }) {
  const [form, setForm] = useState(() => emptyForm());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const selectedFiles = useMemo(() => Array.from(form.attachments || []), [form.attachments]);

  if (!open) return null;

  const updateField = (key) => (event) => {
    setSuccess("");
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleFiles = (event) => {
    setSuccess("");
    const files = Array.from(event.target.files || []);
    const fileError = validateFiles(files);
    setErrors((prev) => ({ ...prev, attachments: fileError }));
    setForm((prev) => ({ ...prev, attachments: fileError ? [] : files }));
    if (fileError) event.target.value = "";
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.category) nextErrors.category = "Choose a category.";
    if (!form.subject.trim()) nextErrors.subject = "Subject is required.";
    if (form.subject.trim().length > 200) nextErrors.subject = "Subject must be 200 characters or less.";
    if (!form.message.trim()) nextErrors.message = "Message is required.";

    const linkResult = validateLinks(form.links);
    if (linkResult.error) nextErrors.links = linkResult.error;

    const fileError = validateFiles(selectedFiles);
    if (fileError) nextErrors.attachments = fileError;

    setErrors(nextErrors);
    return { ok: Object.keys(nextErrors).length === 0, links: linkResult.links };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const result = validate();
    if (!result.ok) return;

    const payload = new FormData();
    payload.append("category", form.category);
    payload.append("subject", form.subject.trim());
    payload.append("message", form.message.trim());
    payload.append("links", JSON.stringify(result.links));
    selectedFiles.forEach((file) => payload.append("attachments", file));

    setSubmitting(true);
    setErrors({});
    setSuccess("");
    try {
      await api.post("/feedback/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm(emptyForm());
      setSuccess("Thank you. Your feedback has been submitted. We'll review it and follow up if needed.");
    } catch (error) {
      setErrors({ form: extractServerError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Feedback &amp; Support</h2>
            <p className="mt-1 text-sm text-slate-500">Send feedback, technical issues, service requests, or content reports.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close feedback form"
          >
            <SymbolIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-74px)] overflow-y-auto px-5 py-4">
          {success ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}
          {errors.form ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.form}
            </div>
          ) : null}

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
              <select
                value={form.category}
                onChange={updateField("category")}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                required
              >
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {errors.category ? <span className="mt-1 block text-xs text-rose-600">{errors.category}</span> : null}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Subject</span>
              <input
                value={form.subject}
                onChange={updateField("subject")}
                maxLength={200}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                required
              />
              <div className="mt-1 flex justify-between gap-3 text-xs">
                <span className="text-rose-600">{errors.subject || ""}</span>
                <span className="text-slate-400">{form.subject.length}/200</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Message / Description</span>
              <textarea
                value={form.message}
                onChange={updateField("message")}
                rows={6}
                className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                required
              />
              {errors.message ? <span className="mt-1 block text-xs text-rose-600">{errors.message}</span> : null}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Links</span>
              <textarea
                value={form.links}
                onChange={updateField("links")}
                rows={3}
                placeholder="https://example.com/page"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="mt-1 block text-xs text-slate-500">Optional. One http:// or https:// URL per line.</span>
              {errors.links ? <span className="mt-1 block text-xs text-rose-600">{errors.links}</span> : null}
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Attachments</span>
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center hover:bg-slate-100">
                <SymbolIcon name="upload_file" className="text-[24px] text-slate-500" />
                <span className="mt-2 text-sm font-medium text-slate-700">Choose files</span>
                <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, PDF, DOC, DOCX, TXT. Max 5 files, 20MB each.</span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleFiles}
                  className="hidden"
                />
              </label>
              {selectedFiles.length ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {selectedFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <SymbolIcon name="attach_file" className="text-[15px] text-slate-400" />
                      <span className="truncate">{file.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {errors.attachments ? <span className="mt-1 block text-xs text-rose-600">{errors.attachments}</span> : null}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Close
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
