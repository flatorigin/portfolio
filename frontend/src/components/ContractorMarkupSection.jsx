import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Badge, Button, Card, SymbolIcon } from "../ui";

const CONTRACTOR_WORKSPACE_KIND = "contractor_floorplan_markup";

function normalizeError(err, fallback) {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.detail || data?.message || fallback;
}

function formatDate(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function workspaceRoute(planId, intent = "") {
  const query = intent === "floor_plan"
    ? "?mode=rough_plan&sketch=1"
    : intent === "image_markup"
      ? "?mode=photo&background=1"
      : "";
  return `/dashboard/floor-plans/${planId}/markup${query}`;
}

export default function ContractorMarkupSection({ isVisible = false }) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingIntent, setCreatingIntent] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isVisible) return;
    setLoading(true);
    setError("");
    try {
      const [{ data: plansData }, { data: metaData }] = await Promise.all([
        api.get("/project-plans/", { params: { scope: "active" } }),
        api.get("/project-plans/meta/"),
      ]);
      setWorkspaces(Array.isArray(plansData) ? plansData : []);
      setMeta(metaData || null);
    } catch (err) {
      setError(normalizeError(err, "Could not load floor-plan workspaces."));
      setWorkspaces([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [isVisible]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sortedWorkspaces = useMemo(
    () => [...workspaces].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)),
    [workspaces],
  );

  async function createWorkspace(intent) {
    if (creatingIntent || meta?.can_create === false) return;
    setCreatingIntent(intent);
    try {
      const { data } = await api.post("/project-plans/", {
        title: intent === "floor_plan"
          ? "Untitled floor plan"
          : intent === "image_markup"
            ? "Untitled image markup"
            : "Untitled visual workspace",
        status: "planning",
        markup_data: {
          workspace_kind: CONTRACTOR_WORKSPACE_KIND,
          intent,
        },
      });
      navigate(workspaceRoute(data.id, intent));
    } catch (err) {
      window.alert(normalizeError(err, "Could not create a new workspace."));
    } finally {
      setCreatingIntent("");
    }
  }

  async function renameWorkspace(workspace) {
    if (!workspace?.id || busyId) return;
    const title = window.prompt("Workspace name", workspace.title || "Untitled workspace");
    if (title === null || !title.trim() || title.trim() === workspace.title) return;
    setBusyId(workspace.id);
    try {
      await api.patch(`/project-plans/${workspace.id}/`, { title: title.trim() });
      await refresh();
    } catch (err) {
      window.alert(normalizeError(err, "Could not rename this workspace."));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteWorkspace(workspace) {
    if (!workspace?.id || busyId) return;
    if (!window.confirm(`Delete "${workspace.title || "this workspace"}" and all of its saved images and markup?`)) return;
    setBusyId(workspace.id);
    try {
      await api.delete(`/project-plans/${workspace.id}/`);
      await refresh();
    } catch (err) {
      window.alert(normalizeError(err, "Could not delete this workspace."));
    } finally {
      setBusyId(null);
    }
  }

  if (!isVisible) return null;

  const atLimit = meta?.can_create === false;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Floor Plans &amp; Visual Markups</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Create a floor-plan image or overlay measurements, notes, walls, and visual changes on an existing image.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge>{meta?.active_count ?? workspaces.length}/{meta?.max_active_plans ?? 3} workspaces</Badge>
          {meta ? <Badge>{meta.ai_remaining_today} AI assists left today</Badge> : null}
        </div>
      </div>

      {atLimit ? (
        <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Delete an unused workspace before creating another one.
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Loading saved workspaces...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,260px))]">
          {sortedWorkspaces.map((workspace) => {
            const intent = workspace?.markup_data?.intent || "";
            const openRoute = workspaceRoute(
              workspace.id,
              workspace?.markup_data?.canvas_mode ? "" : intent,
            );
            const annotationCount = Array.isArray(workspace?.markup_data?.annotations)
              ? workspace.markup_data.annotations.length
              : 0;
            return (
              <Card key={workspace.id} className="flex min-h-[320px] flex-col overflow-hidden border border-slate-200 p-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => navigate(openRoute)}
                  className="block w-full flex-1 text-left"
                >
                  {workspace.cover_image_url ? (
                    <img
                      src={workspace.cover_image_url}
                      alt=""
                      className="h-44 w-full bg-slate-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-slate-400">
                      <SymbolIcon name={intent === "image_markup" ? "draw" : "architecture"} className="text-[36px]" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="truncate font-semibold text-slate-900">{workspace.title || "Untitled workspace"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{annotationCount} markup{annotationCount === 1 ? "" : "s"}</span>
                      <span>Updated {formatDate(workspace.updated_at)}</span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
                  <Button type="button" className="flex-1 whitespace-nowrap px-2 text-xs" onClick={() => navigate(openRoute)}>
                    Open markup
                  </Button>
                  <button
                    type="button"
                    onClick={() => renameWorkspace(workspace)}
                    disabled={busyId === workspace.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                    aria-label={`Rename ${workspace.title || "workspace"}`}
                    title="Rename workspace"
                  >
                    <SymbolIcon name="edit" className="text-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWorkspace(workspace)}
                    disabled={busyId === workspace.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    aria-label={`Delete ${workspace.title || "workspace"}`}
                    title="Delete workspace"
                  >
                    <SymbolIcon name="delete" className="text-[18px]" />
                  </button>
                </div>
              </Card>
            );
          })}

          <button
            type="button"
            onClick={() => createWorkspace("visual_workspace")}
            disabled={Boolean(creatingIntent) || atLimit}
            className={`flex min-h-[320px] w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition focus:outline-none focus:ring-4 focus:ring-slate-200 ${
              atLimit
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-900 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <SymbolIcon name="add" className="text-[30px]" />
            </span>
            <span className="text-lg font-semibold">
              {creatingIntent === "visual_workspace" ? "Opening workspace..." : "Add visual workspace"}
            </span>
            <span className="mt-2 max-w-xs text-sm leading-5 text-slate-500">
              Create a floor plan from a sketch or add editable markup over an image.
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
