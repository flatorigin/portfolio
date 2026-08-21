import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api";
import { Design3DInspector, Design3DViewport } from "../components/Design3DStudio";
import { DEFAULT_DESIGN_SETTINGS, createDesignTransform } from "../utils/designGeometry";
import { SymbolIcon } from "../ui";

const CANVAS_W = 1200;
const CANVAS_H = 760;
const GRID_MARGIN = 4;
const GRID_PADDING = 82;

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  return data?.detail || data?.message || (data ? JSON.stringify(data) : "") || error?.message || fallback;
}

function planMeasurementGeometry(roughPlan = {}) {
  const widthUnits = Math.max(1, Number(roughPlan.width) || 20);
  const lengthUnits = Math.max(1, Number(roughPlan.length) || 30);
  const marginUnits = Math.max(0, Number(roughPlan.gridMarginUnits ?? GRID_MARGIN) || 0);
  const gridWidth = widthUnits + marginUnits * 2;
  const gridLength = lengthUnits + marginUnits * 2;
  const scale = Math.min((CANVAS_W - GRID_PADDING * 2) / gridWidth, (CANVAS_H - GRID_PADDING * 2) / gridLength);
  const widthPx = gridWidth * scale;
  const heightPx = gridLength * scale;
  return {
    scale,
    unit: roughPlan.unit || "ft",
    designX: (CANVAS_W - widthPx) / 2 + marginUnits * scale,
    designY: (CANVAS_H - heightPx) / 2 + marginUnits * scale,
  };
}

function calibrationGeometry(calibration = {}, roughPlan = {}) {
  const scale = Number(calibration.scale || 0);
  return scale > 0 ? { scale, unit: calibration.unit || "in" } : planMeasurementGeometry(roughPlan);
}

function baselineFor(annotation, settings) {
  return annotation?.designBaseline || {
    x: annotation?.x,
    y: annotation?.y,
    x2: annotation?.x2,
    y2: annotation?.y2,
    wallHeight: annotation?.wallHeight || settings.ceilingHeight,
    wallThickness: annotation?.wallThickness || settings.wallThickness,
    wallKind: annotation?.wallKind || "existing",
    openingWidth: annotation?.openingWidth || 3,
    openingHeight: annotation?.openingHeight || (annotation?.type === "door" ? 6.67 : 4),
    sillHeight: annotation?.sillHeight ?? (annotation?.type === "window" ? 3 : 0),
    stairWidth: annotation?.stairWidth || 3.5,
    stairRun: annotation?.stairRun || 5,
    stairRise: annotation?.stairRise || 3,
  };
}

function semanticUserAnnotations(annotations, includeDetectedFallback = false) {
  return (annotations || []).filter((item) =>
    item?.type === "corner" ||
    (item?.designRole === "wall" && (includeDetectedFallback || item.designOrigin === "proposed" || String(item.id || "").startsWith("mark-"))) ||
    (["door", "window", "steps"].includes(item?.type) && (includeDetectedFallback || String(item.id || "").startsWith("mark-"))),
  );
}

function wallSegment(source, start, end, index, settings) {
  if (Math.hypot((end.x || 0) - (start.x || 0), (end.y || 0) - (start.y || 0)) < 3) return null;
  const wall = {
    ...source,
    id: `${source.id || "detected"}-wall-${index}`,
    layer: `${source.id || "detected"}-wall-${index}`,
    type: "line",
    x: start.x,
    y: start.y,
    x2: end.x,
    y2: end.y,
    text: "",
    canvasMode: "rough_plan",
    designRole: "wall",
    designOrigin: "ai_trace",
    wallKind: "existing",
  };
  return { ...wall, designBaseline: baselineFor(wall, settings) };
}

function detectedGeometry(annotations, settings) {
  return (annotations || []).flatMap((item) => {
    if (item?.type === "line") {
      const wall = wallSegment(item, { x: item.x, y: item.y }, { x: item.x2, y: item.y2 }, 0, settings);
      return wall ? [wall] : [];
    }
    if (item?.type === "rect") {
      const x1 = Math.min(Number(item.x) || 0, Number(item.x2) || 0);
      const y1 = Math.min(Number(item.y) || 0, Number(item.y2) || 0);
      const x2 = Math.max(Number(item.x) || 0, Number(item.x2) || 0);
      const y2 = Math.max(Number(item.y) || 0, Number(item.y2) || 0);
      const corners = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
      return corners.map((point, index) => wallSegment(item, point, corners[(index + 1) % corners.length], index, settings)).filter(Boolean);
    }
    if (item?.type === "pen" && Array.isArray(item.points) && item.points.length > 1) {
      const points = item.closed ? [...item.points, item.points[0]] : item.points;
      return points.slice(0, -1).map((point, index) => wallSegment(item, point, points[index + 1], index, settings)).filter(Boolean);
    }
    return [{ ...item, designOrigin: "ai_trace" }];
  });
}

function mergeFloorPlanAnalysis(detected, saved, settings) {
  const traced = detectedGeometry(detected, settings);
  const hasDetectedWalls = traced.some((item) => item.type === "line" && item.designRole === "wall");
  const overrides = semanticUserAnnotations(saved, !hasDetectedWalls);
  return [...traced, ...overrides].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
}

function reusableImageWalls(annotations) {
  return (annotations || []).filter((item) =>
    item?.type === "line" &&
    item.designRole === "wall" &&
    (item.designOrigin === "ai_trace" || item.source === "ai_clean_plan_trace" || String(item.id || "").startsWith("ai-sketch-")),
  );
}

function readWorkspaceSource(data, isProjectImageMode) {
  if (isProjectImageMode) {
    const extraData = safeObject(data?.extra_data);
    const markup = safeObject(extraData.markup_version);
    return { root: extraData, markup, version: markup };
  }
  const markup = safeObject(data?.markup_data);
  const versions = Array.isArray(markup.versions) ? markup.versions : [];
  return { root: markup, markup, version: safeObject(versions[0]) };
}

export default function ProjectDesign3DWorkspace() {
  const { planId, projectId, imageId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isProjectImageMode = Boolean(projectId && imageId);
  const conversionStartedRef = useRef(false);
  const [sourceRecord, setSourceRecord] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [roughPlan, setRoughPlan] = useState({ width: "20", length: "30", unit: "ft", snap: true, grid_visible: true });
  const [measurementCalibration, setMeasurementCalibration] = useState({});
  const [settings, setSettings] = useState(DEFAULT_DESIGN_SETTINGS);
  const [selectedId, setSelectedId] = useState("");
  const [viewMode, setViewMode] = useState("perspective");
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(() => searchParams.get("analyze") === "1");
  const [saving, setSaving] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertaintyNotes, setUncertaintyNotes] = useState([]);

  const measurementGeometry = useMemo(
    () => calibrationGeometry(measurementCalibration, roughPlan),
    [measurementCalibration, roughPlan],
  );
  const source = useMemo(() => readWorkspaceSource(sourceRecord, isProjectImageMode), [isProjectImageMode, sourceRecord]);
  const sourceSnapshotId = source.version?.snapshot_image_id || source.markup?.snapshot_image_id || null;
  const hasImmediateWallGeometry = useMemo(
    () => annotations.some((item) => item?.type === "line" && item.designRole === "wall"),
    [annotations],
  );
  const backPath = isProjectImageMode
    ? `/dashboard/projects/${projectId}/images/${imageId}/markup`
    : `/dashboard/planner/${planId}/markup`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const url = isProjectImageMode ? `/projects/${projectId}/images/` : `/project-plans/${planId}/`;
        const { data: responseData } = await api.get(url);
        const data = isProjectImageMode
          ? (Array.isArray(responseData) ? responseData.find((image) => String(image.id) === String(imageId)) : null)
          : responseData;
        if (!data) throw new Error("Could not find the selected project image.");
        if (cancelled) return;
        const nextSource = readWorkspaceSource(data, isProjectImageMode);
        const conversion = safeObject(nextSource.markup?.design_3d?.conversion);
        const conversionCurrent = conversion.source_snapshot_image_id && String(conversion.source_snapshot_image_id) === String(nextSource.version?.snapshot_image_id || nextSource.markup?.snapshot_image_id || "");
        const nextAnnotations = conversionCurrent && Array.isArray(conversion.annotations)
          ? conversion.annotations
          : Array.isArray(nextSource.markup.annotations) ? nextSource.markup.annotations : [];
        const nextRoughPlan = conversionCurrent && conversion.rough_plan
          ? conversion.rough_plan
          : nextSource.markup.rough_plan || nextSource.version?.rough_plan || { width: "20", length: "30", unit: "ft" };
        const nextSettings = {
          ...DEFAULT_DESIGN_SETTINGS,
          ...safeObject(nextSource.markup?.design_3d?.settings || nextSource.version?.design_3d?.settings),
        };
        setSourceRecord(data);
        setAnnotations(nextAnnotations);
        setRoughPlan(nextRoughPlan);
        setMeasurementCalibration(nextSource.markup.measurement_calibration || nextSource.version?.measurement_calibration || {});
        setSettings(nextSettings);
        setUncertaintyNotes(Array.isArray(conversion.uncertainty_notes) ? conversion.uncertainty_notes : []);
        if (conversionCurrent && searchParams.get("analyze") === "1") {
          setSearchParams({}, { replace: true });
          setMessage("Loaded the saved 3D reading for this floor-plan snapshot.");
        }
      } catch (error) {
        if (!cancelled) {
          setAnalyzing(false);
          setMessage(errorMessage(error, "Could not load this floor plan."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [imageId, isProjectImageMode, planId, projectId]);

  async function persistWorkspace(nextAnnotations = annotations, nextRoughPlan = roughPlan, nextSettings = settings, conversionPatch = null) {
    if (!sourceRecord) return null;
    const now = new Date().toISOString();
    if (isProjectImageMode) {
      const extraData = safeObject(sourceRecord.extra_data);
      const markup = safeObject(extraData.markup_version);
      const design3d = { ...safeObject(markup.design_3d), schema_version: 1, settings: nextSettings };
      if (conversionPatch) design3d.conversion = conversionPatch;
      const nextMarkup = { ...markup, annotations: nextAnnotations, rough_plan: nextRoughPlan, design_3d: design3d, updated_at: now };
      const { data } = await api.patch(`/projects/${projectId}/images/${imageId}/`, {
        extra_data: { ...extraData, markup_version: nextMarkup },
      });
      setSourceRecord(data);
      return data;
    }

    const markup = safeObject(sourceRecord.markup_data);
    const versions = Array.isArray(markup.versions) ? markup.versions : [];
    const design3d = { ...safeObject(markup.design_3d), schema_version: 1, settings: nextSettings };
    if (conversionPatch) design3d.conversion = conversionPatch;
    const nextVersions = versions.map((version, index) => index === 0 ? {
      ...version,
      annotations: nextAnnotations,
      rough_plan: nextRoughPlan,
      design_3d: { ...safeObject(version.design_3d), schema_version: 1, settings: nextSettings, ...(conversionPatch ? { conversion: conversionPatch } : {}) },
    } : version);
    const nextMarkup = { ...markup, annotations: nextAnnotations, rough_plan: nextRoughPlan, design_3d: design3d, updated_at: now, versions: nextVersions };
    const { data } = await api.patch(`/project-plans/${planId}/`, { markup_data: nextMarkup });
    setSourceRecord(data);
    return data;
  }

  useEffect(() => {
    if (loading || !sourceRecord || conversionStartedRef.current || searchParams.get("analyze") !== "1") return;
    conversionStartedRef.current = true;
    const existingConversion = safeObject(source.markup?.design_3d?.conversion);
    if (existingConversion.source_snapshot_image_id && String(existingConversion.source_snapshot_image_id) === String(sourceSnapshotId || "")) {
      setSearchParams({}, { replace: true });
      return;
    }
    const reusableWalls = reusableImageWalls(annotations);
    if (reusableWalls.length >= 2) {
      const conversion = {
        schema_version: 1,
        source_snapshot_image_id: sourceSnapshotId,
        generated_at: new Date().toISOString(),
        annotations,
        rough_plan: roughPlan,
        uncertainty_notes: [],
        source: "existing_floor_plan_geometry",
      };
      persistWorkspace(annotations, roughPlan, settings, conversion)
        .then(() => setMessage("3D created immediately from the existing floor-plan geometry."))
        .catch((error) => setMessage(errorMessage(error, "The 3D model is ready, but its conversion data could not be cached.")))
        .finally(() => {
          setAnalyzing(false);
          setSearchParams({}, { replace: true });
        });
      return;
    }
    if (!sourceSnapshotId) {
      setAnalyzing(false);
      setMessage("The saved floor-plan image could not be read for automatic elevation.");
      setSearchParams({}, { replace: true });
      return;
    }

    async function analyze() {
      setAnalyzing(true);
      setMessage("Reading the floor-plan image and wall markup automatically...");
      try {
        const formData = new FormData();
        formData.append("source_image_id", String(sourceSnapshotId));
        formData.append("width", String(roughPlan.width || 20));
        formData.append("length", String(roughPlan.length || 30));
        formData.append("unit", roughPlan.unit || "ft");
        formData.append("overlay_mode", "trace_clean_floor_plan");
        const endpoint = isProjectImageMode
          ? `/projects/${projectId}/images/${imageId}/sketch-to-rough-plan/`
          : `/project-plans/${planId}/sketch-to-rough-plan/`;
        const { data } = await api.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });
        const analyzedRoughPlan = { ...roughPlan, ...safeObject(data.rough_plan) };
        const merged = mergeFloorPlanAnalysis(data.annotations, annotations, settings);
        if (!merged.some((item) => item.type === "line" && item.designRole === "wall")) {
          throw new Error("No wall geometry could be identified in this floor-plan image.");
        }
        const conversion = {
          schema_version: 1,
          source_snapshot_image_id: sourceSnapshotId,
          generated_at: new Date().toISOString(),
          annotations: merged,
          rough_plan: analyzedRoughPlan,
          uncertainty_notes: Array.isArray(data.uncertainty_notes) ? data.uncertainty_notes : [],
        };
        setAnnotations(merged);
        setRoughPlan(analyzedRoughPlan);
        setUncertaintyNotes(conversion.uncertainty_notes);
        await persistWorkspace(merged, analyzedRoughPlan, settings, conversion);
        setMessage("3D reading complete. Review the walls and openings before relying on dimensions.");
      } catch (error) {
        setMessage(errorMessage(error, "Automatic floor-plan elevation could not finish."));
      } finally {
        setAnalyzing(false);
        setSearchParams({}, { replace: true });
      }
    }
    analyze();
  }, [loading, sourceRecord, sourceSnapshotId]);

  function beginEdit() {}

  function updateAnnotation(annotationId, patch) {
    setAnnotations((items) => items.map((item) => item.id === annotationId
      ? { ...item, ...(["line", "door", "window", "steps"].includes(item.type) ? { designBaseline: baselineFor(item, settings) } : {}), ...patch }
      : item));
  }

  function updateSettings(patch) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateRoughPlan(patch) {
    setSettings((current) => ({
      ...current,
      baseFloorWidth: current.baseFloorWidth ?? Number(roughPlan.width),
      baseFloorLength: current.baseFloorLength ?? Number(roughPlan.length),
      baseFloorUnit: current.baseFloorUnit || roughPlan.unit || "ft",
    }));
    setRoughPlan((current) => ({ ...current, ...patch }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const previousConversion = safeObject(source.markup?.design_3d?.conversion);
      const conversion = { ...previousConversion, annotations, rough_plan: roughPlan, updated_at: new Date().toISOString() };
      await persistWorkspace(annotations, roughPlan, settings, conversion);
      setMessage("3D design changes saved to this floor plan.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not save the 3D design changes."));
    } finally {
      setSaving(false);
    }
  }

  async function requestProposal() {
    if (!planId) {
      setMessage("AI change previews are available after this design is saved in a project planner.");
      return;
    }
    setPromptBusy(true);
    setProposal(null);
    try {
      const selected = annotations.find((item) => item.id === selectedId) || null;
      const { data } = await api.post(`/project-plans/${planId}/design-proposal/`, {
        prompt,
        selected_id: selectedId || "floor",
        selected_element: selected,
        design: { settings, rough_plan: roughPlan, annotations: annotations.filter((item) => item.designRole === "wall" || ["door", "window", "steps"].includes(item.type)).slice(0, 100) },
      });
      setProposal(data);
    } catch (error) {
      setMessage(errorMessage(error, "Could not prepare the proposed design changes."));
    } finally {
      setPromptBusy(false);
    }
  }

  function applyProposal() {
    const changes = Array.isArray(proposal?.changes) ? proposal.changes : [];
    let nextSettings = { ...settings };
    let nextAnnotations = [...annotations];
    const transform = createDesignTransform(annotations, measurementGeometry, roughPlan);
    const propertyMap = {
      wall_height: "wallHeight", wall_thickness: "wallThickness", wall_kind: "wallKind",
      opening_width: "openingWidth", opening_height: "openingHeight", sill_height: "sillHeight",
      stair_width: "stairWidth", stair_run: "stairRun", stair_rise: "stairRise",
    };
    changes.forEach((change) => {
      if (change.property === "ceiling_height") nextSettings.ceilingHeight = Math.max(4, Math.min(30, Number(change.value) || 8));
      else if (change.property === "exterior") nextSettings.exterior = Boolean(change.value);
      else {
        const targetId = change.target_id || selectedId;
        nextAnnotations = nextAnnotations.map((item) => {
          if (item.id !== targetId) return item;
          const baseline = baselineFor(item, settings);
          if (propertyMap[change.property]) return { ...item, designBaseline: baseline, [propertyMap[change.property]]: change.value };
          if (["translate_x", "translate_y"].includes(change.property)) {
            const axis = change.property === "translate_x" ? "x" : "z";
            const amount = Number(change.value) || 0;
            const start = transform.toWorld({ x: item.x, y: item.y });
            const end = transform.toWorld({ x: item.x2, y: item.y2 });
            const nextStart = transform.toCanvas({ ...start, [axis]: start[axis] + amount });
            const nextEnd = transform.toCanvas({ ...end, [axis]: end[axis] + amount });
            return { ...item, designBaseline: baseline, x: nextStart.x, y: nextStart.y, x2: nextEnd.x, y2: nextEnd.y };
          }
          return item;
        });
      }
    });
    setAnnotations(nextAnnotations);
    setSettings(nextSettings);
    setProposal(null);
    setPrompt("");
    setMessage("Proposed changes applied. Review them in 3D, then save.");
  }

  if (loading) {
    return <div className="fixed inset-0 z-40 grid place-items-center bg-slate-100 text-sm text-slate-600">Loading 3D workspace...</div>;
  }

  return (
    <div className="fixed inset-0 z-40 flex min-h-0 flex-col bg-slate-100">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link to={backPath} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Back to floor plan">
            <SymbolIcon name="arrow_back" className="text-[21px]" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-950 sm:text-base">3D floor-plan elevation</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Interactive concept view from the saved floor plan</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setInspectorOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden" aria-label="Open design controls">
            <SymbolIcon name="tune" className="text-[20px]" />
          </button>
          <button type="button" onClick={save} disabled={saving || analyzing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            <SymbolIcon name="save" className="text-[18px]" />
            <span className="hidden sm:inline">{saving ? "Saving..." : "Save 3D"}</span>
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1 bg-[#eef1f4]">
          <Design3DViewport
            annotations={annotations}
            measurementGeometry={measurementGeometry}
            roughPlan={roughPlan}
            settings={settings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onBeginEdit={beginEdit}
            onAnnotationPreview={updateAnnotation}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          {analyzing && !hasImmediateWallGeometry ? (
            <div className="absolute inset-0 z-30 grid place-items-center bg-white/80 px-4 backdrop-blur-sm">
              <div className="max-w-sm text-center">
                <SymbolIcon name="progress_activity" className="mx-auto animate-spin text-[30px] text-sky-700" />
                <div className="mt-3 text-sm font-semibold text-slate-950">Reading floor-plan geometry</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">Detecting wall centerlines, connected corners, openings, stairs, and wall markup automatically.</p>
              </div>
            </div>
          ) : null}
          {analyzing && hasImmediateWallGeometry ? (
            <div className="absolute right-3 top-16 z-20 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
              <SymbolIcon name="progress_activity" className="animate-spin text-[17px] text-sky-700" />
              Refining walls from image...
            </div>
          ) : null}
          {message ? <div className="absolute bottom-3 left-3 right-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg sm:right-auto sm:max-w-lg">{message}</div> : null}
        </section>

        <aside className="hidden w-[330px] shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 p-3 lg:block">
          {uncertaintyNotes.length ? (
            <section className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h2 className="text-xs font-semibold text-amber-950">Review these readings</h2>
              {uncertaintyNotes.slice(0, 4).map((note) => <p key={note} className="mt-1 text-[11px] leading-4 text-amber-900">{note}</p>)}
            </section>
          ) : null}
          <Design3DInspector
            annotations={annotations}
            measurementGeometry={measurementGeometry}
            roughPlan={roughPlan}
            settings={settings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSettingsChange={updateSettings}
            onRoughPlanChange={updateRoughPlan}
            onAnnotationChange={updateAnnotation}
            prompt={prompt}
            onPromptChange={setPrompt}
            proposal={proposal}
            promptBusy={promptBusy}
            onRequestProposal={requestProposal}
            onApplyProposal={applyProposal}
            onDiscardProposal={() => setProposal(null)}
          />
        </aside>

        {inspectorOpen ? (
          <>
            <button type="button" className="absolute inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setInspectorOpen(false)} aria-label="Close design controls" />
            <aside className="absolute inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto rounded-t-xl bg-slate-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl lg:hidden">
              <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
                <span className="text-sm font-semibold text-slate-950">Design controls</span>
                <button type="button" onClick={() => setInspectorOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Close design controls"><SymbolIcon name="close" className="text-[21px]" /></button>
              </div>
              <Design3DInspector
                annotations={annotations}
                measurementGeometry={measurementGeometry}
                roughPlan={roughPlan}
                settings={settings}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onSettingsChange={updateSettings}
                onRoughPlanChange={updateRoughPlan}
                onAnnotationChange={updateAnnotation}
                prompt={prompt}
                onPromptChange={setPrompt}
                proposal={proposal}
                promptBusy={promptBusy}
                onRequestProposal={requestProposal}
                onApplyProposal={applyProposal}
                onDiscardProposal={() => setProposal(null)}
              />
            </aside>
          </>
        ) : null}
      </main>
    </div>
  );
}
