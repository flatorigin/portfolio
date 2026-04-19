import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Badge, Button, Card, GhostButton, SymbolIcon } from "../ui";

function normalizeError(err, fallback) {
  const data = err?.response?.data;
  if (typeof data === "string") {
    if (/<html/i.test(data) || /server error/i.test(data)) {
      return fallback;
    }
    return data;
  }
  return data?.detail || data?.message || fallback;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LimitNotice({ meta }) {
  if (!meta || meta.can_create) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      You can keep up to 3 project plans at a time. Remove one to add another.
    </div>
  );
}

function AddPlanCard({ disabled = false, onClick, helper }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex min-h-[240px] w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition " +
        (disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-900 hover:text-slate-900")
      }
    >
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <SymbolIcon name="add" className="text-[30px]" />
      </span>
      <div className="text-lg font-semibold">
        {helper ? "Start planning a project" : "Add new plan"}
      </div>
      <div className="mt-2 max-w-xs text-sm text-slate-500">
        {helper || "Save photos, notes, links, and ideas before turning it into a job post."}
      </div>
    </button>
  );
}

export default function ProjectPlannerSection({ isVisible = false }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
      setPlans(Array.isArray(plansData) ? plansData : []);
      setMeta(metaData || null);
    } catch (err) {
      setError(normalizeError(err, "Could not load the project planner."));
      setPlans([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [isVisible]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
  }, [plans]);

  async function createPlan() {
    if (creating || meta?.can_create === false) return;
    setCreating(true);
    try {
      const { data } = await api.post("/project-plans/", {
        title: "Untitled issue",
        status: "planning",
      });
      navigate(`/dashboard/planner/${data.id}`);
    } catch (err) {
      window.alert(normalizeError(err, "Could not create a new plan."));
    } finally {
      setCreating(false);
    }
  }

  async function archivePlan(planId) {
    if (!planId || busyId) return;
    if (!window.confirm("Archive this plan? It will leave the active list and free up a slot.")) {
      return;
    }
    setBusyId(planId);
    try {
      await api.post(`/project-plans/${planId}/archive/`);
      await refresh();
    } catch (err) {
      window.alert(normalizeError(err, "Could not archive this plan."));
    } finally {
      setBusyId(null);
    }
  }

  if (!isVisible) return null;

  return (
    <Card className="border border-slate-200 p-5 shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">Plan a Project</div>
          <div className="mt-1 text-sm text-slate-500">
            Keep up to 3 private project plans. Contractors cannot see these until you turn one into a draft.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge>{meta?.active_count ?? plans.length}/3 active</Badge>
          {meta ? <Badge>{meta.ai_remaining_today} AI assists left today</Badge> : null}
        </div>
      </div>

      <div className="mt-4">
        <LimitNotice meta={meta} />
      </div>

      {loading ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          Loading project plans...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : sortedPlans.length === 0 ? (
        <div className="mt-4">
          <AddPlanCard
            disabled={creating || meta?.can_create === false}
            onClick={createPlan}
            helper="Save photos, notes, links, and ideas before turning it into a job post."
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sortedPlans.map((plan) => (
            <Card
              key={plan.id}
              className="overflow-hidden rounded-lg border border-slate-200 shadow-none"
            >
              {plan.cover_image_url ? (
                <img
                  src={plan.cover_image_url}
                  alt=""
                  className="h-40 w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-400">
                  <SymbolIcon name="home_repair_service" className="text-[36px]" />
                </div>
              )}
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">
                      {plan.title || "Untitled issue"}
                    </div>
                    <div className="truncate text-sm text-slate-500">
                      {plan.house_location || "No location yet"}
                    </div>
                  </div>
                  <Badge className="capitalize">{String(plan.status || "planning").replaceAll("_", " ")}</Badge>
                </div>

                <div className="min-h-[60px] text-sm text-slate-600">
                  {plan.issue_summary || plan.notes || "Add photos, notes, and possible fixes here."}
                </div>

                {Array.isArray(plan.contractor_types) && plan.contractor_types.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {plan.contractor_types.slice(0, 3).map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                ) : null}

                <div className="text-xs text-slate-400">Updated {formatDate(plan.updated_at) || "recently"}</div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => navigate(`/dashboard/planner/${plan.id}`)}
                  >
                    Open
                  </Button>
                  <GhostButton
                    type="button"
                    disabled={busyId === plan.id}
                    onClick={() => archivePlan(plan.id)}
                  >
                    Archive
                  </GhostButton>
                </div>
              </div>
            </Card>
          ))}

          {meta?.can_create ? (
            <AddPlanCard disabled={creating} onClick={createPlan} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              You can keep up to 3 project plans at a time. Remove one to add another.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
