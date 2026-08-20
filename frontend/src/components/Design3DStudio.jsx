import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SymbolIcon } from "../ui";
import {
  buildDesignGeometry,
  clampDesignNumber,
  designChanges,
  formatFeet,
} from "../utils/designGeometry";

const VIEW_OPTIONS = [
  { key: "perspective", label: "3D", icon: "view_in_ar" },
  { key: "top", label: "Plan", icon: "floor_plan" },
  { key: "elevation", label: "Elevation", icon: "view_sidebar" },
];

function wallMaterialColor(kind, selected) {
  if (selected) return 0x2563eb;
  if (kind === "new") return 0x168a5b;
  if (kind === "half") return 0xd97706;
  return 0xd7dde5;
}

function addEdges(mesh, color = 0x475569) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.62 }),
  );
  mesh.add(edges);
}

function wallPointAt(wall, distance) {
  const ratio = wall.length ? distance / wall.length : 0;
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * ratio,
    z: wall.start.z + (wall.end.z - wall.start.z) * ratio,
  };
}

function createWallBlock(wall, startOffset, endOffset, baseHeight, height, material, targetId) {
  const width = Math.max(0.02, endOffset - startOffset);
  if (width < 0.04 || height < 0.04) return null;
  const centerOffset = (startOffset + endOffset) / 2;
  const center = wallPointAt(wall, centerOffset);
  const angle = Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, wall.thickness),
    material,
  );
  mesh.position.set(center.x, baseHeight + height / 2, center.z);
  mesh.rotation.y = -angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { targetId, targetType: "wall" };
  addEdges(mesh, material.color.getHex() === 0x2563eb ? 0x1d4ed8 : 0x64748b);
  return mesh;
}

function addWallToScene(group, wall, openings, selected) {
  const material = new THREE.MeshStandardMaterial({
    color: wallMaterialColor(wall.kind, selected),
    roughness: 0.86,
    metalness: 0,
  });
  const intervals = openings
    .map((opening) => ({
      opening,
      start: Math.max(0.08, opening.offset - opening.width / 2),
      end: Math.min(wall.length - 0.08, opening.offset + opening.width / 2),
    }))
    .filter((interval) => interval.end - interval.start > 0.1)
    .sort((a, b) => a.start - b.start);

  let cursor = 0;
  intervals.forEach(({ opening, start, end }) => {
    const before = createWallBlock(wall, cursor, start, 0, wall.height, material, wall.id);
    if (before) group.add(before);
    const openingTop = Math.min(wall.height, opening.sillHeight + opening.height);
    if (opening.sillHeight > 0) {
      const below = createWallBlock(wall, start, end, 0, opening.sillHeight, material, wall.id);
      if (below) group.add(below);
    }
    if (openingTop < wall.height) {
      const above = createWallBlock(wall, start, end, openingTop, wall.height - openingTop, material, wall.id);
      if (above) group.add(above);
    }
    cursor = Math.max(cursor, end);
  });
  const after = createWallBlock(wall, cursor, wall.length, 0, wall.height, material, wall.id);
  if (after) group.add(after);

  if (selected) {
    [
      { key: "start", point: wall.start },
      { key: "end", point: wall.end },
    ].forEach(({ key, point }) => {
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 20, 14),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2563eb, emissiveIntensity: 0.28 }),
      );
      handle.position.set(point.x, 0.24, point.z);
      handle.userData = { targetId: wall.id, targetType: "wall-handle", handle: key };
      group.add(handle);
    });
  }
}

function addOpeningMarker(group, opening, wall, selected) {
  const angle = Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x);
  const color = opening.type === "door" ? 0x0f766e : 0x0284c7;
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(opening.width, opening.height, wall.thickness + 0.08),
    new THREE.MeshStandardMaterial({
      color: selected ? 0x2563eb : color,
      transparent: true,
      opacity: opening.type === "window" ? 0.38 : 0.18,
      roughness: 0.3,
    }),
  );
  marker.position.set(opening.point.x, opening.sillHeight + opening.height / 2, opening.point.z);
  marker.rotation.y = -angle;
  marker.userData = { targetId: opening.id, targetType: "opening", wallId: wall.id };
  addEdges(marker, selected ? 0x1d4ed8 : color);
  group.add(marker);
}

function addStairs(group, stair, selected) {
  const stepCount = 5;
  for (let index = 0; index < stepCount; index += 1) {
    const depth = stair.run / stepCount;
    const height = stair.rise * ((index + 1) / stepCount);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(stair.width, height, depth),
      new THREE.MeshStandardMaterial({ color: selected ? 0x2563eb : 0x9ca3af, roughness: 0.9 }),
    );
    mesh.position.set(
      stair.point.x,
      height / 2,
      stair.point.z + (index - (stepCount - 1) / 2) * depth,
    );
    mesh.userData = { targetId: stair.id, targetType: "stairs" };
    addEdges(mesh);
    group.add(mesh);
  }
}

function cameraPositionFor(view, geometry) {
  const size = Math.max(geometry.width, geometry.length, 14);
  const center = new THREE.Vector3(geometry.width / 2, 0, geometry.length / 2);
  if (view === "top") return { position: new THREE.Vector3(center.x, size * 1.35, center.z + 0.01), target: center };
  if (view === "elevation") return { position: new THREE.Vector3(center.x, Math.max(5, geometry.settings.ceilingHeight / 2), geometry.length + size * 0.9), target: new THREE.Vector3(center.x, geometry.settings.ceilingHeight / 2, center.z) };
  return {
    position: new THREE.Vector3(geometry.width + size * 0.45, size * 0.72, geometry.length + size * 0.5),
    target: new THREE.Vector3(center.x, geometry.settings.ceilingHeight * 0.35, center.z),
  };
}

export function Design3DViewport({
  annotations,
  measurementGeometry,
  roughPlan,
  settings,
  selectedId,
  onSelect,
  onBeginEdit,
  onAnnotationPreview,
  viewMode = "perspective",
  onViewModeChange,
}) {
  const hostRef = useRef(null);
  const sceneStateRef = useRef(null);
  const dragRef = useRef(null);
  const interactionRef = useRef({});
  const geometry = useMemo(
    () => buildDesignGeometry(annotations, measurementGeometry, roughPlan, settings),
    [annotations, measurementGeometry, roughPlan, settings],
  );

  useEffect(() => {
    interactionRef.current = {
      annotations,
      geometry,
      onAnnotationPreview,
      onBeginEdit,
      onSelect,
    };
  }, [annotations, geometry, onAnnotationPreview, onBeginEdit, onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f6f8);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("data-design-3d-canvas", "true");
    renderer.domElement.className = "block h-full w-full touch-none";
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.minDistance = 3;
    controls.maxDistance = 240;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(18, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const building = new THREE.Group();
    scene.add(building);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let animationFrame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    sceneStateRef.current = { scene, camera, renderer, controls, building, raycaster, pointer, groundPlane };
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      sceneStateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;
    const { scene, building } = state;
    while (building.children.length) {
      const child = building.children.pop();
      child.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
    }
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(geometry.width, geometry.settings.floorThickness, geometry.length),
      new THREE.MeshStandardMaterial({ color: geometry.settings.exterior ? 0xb7c7aa : 0xe8ebef, roughness: 0.92 }),
    );
    floor.position.set(geometry.width / 2, -geometry.settings.floorThickness / 2, geometry.length / 2);
    floor.receiveShadow = true;
    building.add(floor);
    addEdges(floor, 0x94a3b8);

    const grid = new THREE.GridHelper(Math.max(geometry.width, geometry.length) + 12, Math.ceil(Math.max(geometry.width, geometry.length) + 12), 0x64748b, 0xcbd5e1);
    grid.position.set(geometry.width / 2, 0.012, geometry.length / 2);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);
    state.grid?.removeFromParent();
    state.grid?.geometry?.dispose?.();
    state.grid?.material?.dispose?.();
    state.grid = grid;

    geometry.walls.filter((wall) => wall.kind !== "remove").forEach((wall) => {
      addWallToScene(building, wall, geometry.openings.filter((opening) => opening.wallId === wall.id), selectedId === wall.id);
    });
    geometry.openings.forEach((opening) => {
      const wall = geometry.walls.find((item) => item.id === opening.wallId);
      if (wall) addOpeningMarker(building, opening, wall, selectedId === opening.id);
    });
    geometry.stairs.forEach((stair) => addStairs(building, stair, selectedId === stair.id));
  }, [geometry, selectedId]);

  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;
    const next = cameraPositionFor(viewMode, geometry);
    state.camera.position.copy(next.position);
    state.controls.target.copy(next.target);
    state.controls.update();
  }, [geometry.length, geometry.settings.ceilingHeight, geometry.width, viewMode]);

  useEffect(() => {
    const state = sceneStateRef.current;
    const canvas = state?.renderer?.domElement;
    if (!state || !canvas) return undefined;

    const setPointer = (event) => {
      const rect = canvas.getBoundingClientRect();
      state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      state.raycaster.setFromCamera(state.pointer, state.camera);
    };
    const groundPoint = (event) => {
      setPointer(event);
      return state.raycaster.ray.intersectPlane(state.groundPlane, new THREE.Vector3());
    };
    const onPointerDown = (event) => {
      setPointer(event);
      const hits = state.raycaster.intersectObjects(state.building.children, true);
      const hit = hits.find((item) => item.object.userData?.targetId);
      if (!hit) {
        interactionRef.current.onSelect?.("");
        return;
      }
      const { targetId, targetType, handle } = hit.object.userData;
      interactionRef.current.onSelect?.(targetId);
      const annotation = interactionRef.current.annotations?.find((item) => item.id === targetId);
      if (!annotation || !["wall", "wall-handle", "opening", "stairs"].includes(targetType)) return;
      const point = groundPoint(event);
      if (!point) return;
      const snap = interactionRef.current.geometry?.settings?.snapIncrement || 0.25;
      interactionRef.current.onBeginEdit?.();
      state.controls.enabled = false;
      dragRef.current = {
        targetId,
        targetType,
        handle,
        startPoint: new THREE.Vector3(
          Math.round(point.x / snap) * snap,
          0,
          Math.round(point.z / snap) * snap,
        ),
        annotation: { ...annotation },
      };
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    const onPointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = groundPoint(event);
      if (!point) return;
      const activeGeometry = interactionRef.current.geometry;
      if (!activeGeometry) return;
      const snap = activeGeometry.settings.snapIncrement || 0.25;
      const snapped = {
        x: Math.round(point.x / snap) * snap,
        z: Math.round(point.z / snap) * snap,
      };
      if (drag.targetType === "wall-handle") {
        const canvasPoint = activeGeometry.transform.toCanvas(snapped);
        interactionRef.current.onAnnotationPreview?.(drag.targetId, drag.handle === "start"
          ? { x: canvasPoint.x, y: canvasPoint.y }
          : { x2: canvasPoint.x, y2: canvasPoint.y });
        return;
      }
      const dx = snapped.x - drag.startPoint.x;
      const dz = snapped.z - drag.startPoint.z;
      if (drag.targetType === "wall") {
        const start = activeGeometry.transform.toWorld({ x: drag.annotation.x, y: drag.annotation.y });
        const end = activeGeometry.transform.toWorld({ x: drag.annotation.x2, y: drag.annotation.y2 });
        const nextStart = activeGeometry.transform.toCanvas({ x: start.x + dx, z: start.z + dz });
        const nextEnd = activeGeometry.transform.toCanvas({ x: end.x + dx, z: end.z + dz });
        interactionRef.current.onAnnotationPreview?.(drag.targetId, { x: nextStart.x, y: nextStart.y, x2: nextEnd.x, y2: nextEnd.y });
        return;
      }
      const canvasPoint = activeGeometry.transform.toCanvas(snapped);
      interactionRef.current.onAnnotationPreview?.(drag.targetId, { x: canvasPoint.x, y: canvasPoint.y, x2: canvasPoint.x, y2: canvasPoint.y });
    };
    const onPointerUp = (event) => {
      dragRef.current = null;
      state.controls.enabled = true;
      canvas.releasePointerCapture?.(event.pointerId);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const resetCameraPosition = () => {
    const state = sceneStateRef.current;
    if (!state) return;
    const next = cameraPositionFor(viewMode, geometry);
    state.camera.position.copy(next.position);
    state.controls.target.copy(next.target);
    state.controls.update();
  };

  return (
    <div className="relative h-full min-h-[560px] w-full overflow-hidden bg-slate-100 max-lg:min-h-0">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-lg">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onViewModeChange?.(option.key)}
              className={`inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold ${
                viewMode === option.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SymbolIcon name={option.icon} className="text-[17px]" />
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetCameraPosition}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-lg hover:bg-slate-50 hover:text-slate-950"
          aria-label="Reset camera position"
          title="Reset camera position"
        >
          <SymbolIcon name="restart_alt" className="text-[19px]" />
        </button>
      </div>
      {!geometry.walls.length ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="max-w-sm rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-xl">
            <div className="text-sm font-semibold text-slate-900">No wall geometry yet</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">Return to 2D and use the Wall tool, or create an editable floor plan from a sketch.</div>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-slate-950/80 px-3 py-2 text-[11px] text-white/85">
        Drag empty space to orbit. Scroll to zoom.
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 0.25, min = 0, max = 500 }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
      />
    </label>
  );
}

export function Design3DInspector({
  annotations,
  measurementGeometry,
  roughPlan,
  settings,
  selectedId,
  onSelect,
  onSettingsChange,
  onRoughPlanChange,
  onAnnotationChange,
  prompt,
  onPromptChange,
  proposal,
  promptBusy,
  onRequestProposal,
  onApplyProposal,
  onDiscardProposal,
}) {
  const geometry = useMemo(
    () => buildDesignGeometry(annotations, measurementGeometry, roughPlan, settings),
    [annotations, measurementGeometry, roughPlan, settings],
  );
  const changes = useMemo(() => designChanges(geometry), [geometry]);
  const wall = geometry.walls.find((item) => item.id === selectedId);
  const opening = geometry.openings.find((item) => item.id === selectedId);
  const stair = geometry.stairs.find((item) => item.id === selectedId);

  const baselinePatch = (annotation) => annotation.designBaseline || {
    x: annotation.x,
    y: annotation.y,
    x2: annotation.x2,
    y2: annotation.y2,
    wallHeight: annotation.wallHeight || settings.ceilingHeight,
    wallThickness: annotation.wallThickness || settings.wallThickness,
    wallKind: annotation.wallKind || "existing",
  };
  const patchWall = (patch) => {
    if (!wall) return;
    onAnnotationChange(wall.id, { designBaseline: baselinePatch(wall.annotation), ...patch });
  };
  const setWallPoint = (pointKey, axis, value) => {
    if (!wall) return;
    const current = pointKey === "start" ? wall.start : wall.end;
    const canvas = geometry.transform.toCanvas({ ...current, [axis]: value });
    patchWall(pointKey === "start" ? { x: canvas.x, y: canvas.y } : { x2: canvas.x, y2: canvas.y });
  };
  const nudgeWall = (axis, amount) => {
    if (!wall) return;
    const start = geometry.transform.toCanvas({ ...wall.start, [axis]: wall.start[axis] + amount });
    const end = geometry.transform.toCanvas({ ...wall.end, [axis]: wall.end[axis] + amount });
    patchWall({ x: start.x, y: start.y, x2: end.x, y2: end.y });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Design defaults</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">One-floor proposed design</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">Proposed</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="Ceiling height (ft)"
            value={settings.ceilingHeight}
            min={4}
            max={30}
            onChange={(value) => onSettingsChange({ ceilingHeight: clampDesignNumber(value, 4, 30, 8) })}
          />
          <NumberField
            label="Wall thickness (ft)"
            value={settings.wallThickness}
            min={0.2}
            max={2}
            onChange={(value) => onSettingsChange({ wallThickness: clampDesignNumber(value, 0.2, 2, 0.5) })}
          />
          <NumberField
            label={`Floor width (${roughPlan.unit || "ft"})`}
            value={roughPlan.width}
            min={1}
            max={500}
            step={1}
            onChange={(value) => onRoughPlanChange({ width: value })}
          />
          <NumberField
            label={`Floor length (${roughPlan.unit || "ft"})`}
            value={roughPlan.length}
            min={1}
            max={500}
            step={1}
            onChange={(value) => onRoughPlanChange({ length: value })}
          />
        </div>
        <label className="mt-3 flex min-h-10 items-center justify-between rounded-lg border border-slate-200 px-3 text-xs text-slate-600">
          <span>Exterior area</span>
          <input type="checkbox" checked={Boolean(settings.exterior)} onChange={(event) => onSettingsChange({ exterior: event.target.checked })} className="h-4 w-4 accent-blue-600" />
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-900">Selected element</h3>
        {wall ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700">{wall.label}</span>
              <span className="text-slate-500">{formatFeet(wall.length)}</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Wall type</span>
              <select value={wall.kind} onChange={(event) => patchWall({ wallKind: event.target.value, designRole: "wall" })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                <option value="existing">Existing wall</option>
                <option value="new">New wall</option>
                <option value="half">Half wall</option>
                <option value="remove">Remove wall</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Top Z / height (ft)" value={wall.height} min={0.5} max={30} onChange={(value) => patchWall({ wallHeight: value })} />
              <NumberField label="Thickness (ft)" value={wall.thickness} min={0.2} max={2} onChange={(value) => patchWall({ wallThickness: value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Start X (ft)" value={wall.start.x} onChange={(value) => setWallPoint("start", "x", value)} />
              <NumberField label="Start Y (ft)" value={wall.start.z} onChange={(value) => setWallPoint("start", "z", value)} />
              <NumberField label="End X (ft)" value={wall.end.x} onChange={(value) => setWallPoint("end", "x", value)} />
              <NumberField label="End Y (ft)" value={wall.end.z} onChange={(value) => setWallPoint("end", "z", value)} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500">Move by 3 in</div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  ["x", -0.25, "west"],
                  ["z", -0.25, "north"],
                  ["z", 0.25, "south"],
                  ["x", 0.25, "east"],
                ].map(([axis, amount, icon]) => (
                  <button key={`${axis}-${amount}`} type="button" onClick={() => nudgeWall(axis, amount)} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Move ${icon}`}>
                    <SymbolIcon name={`arrow_${icon}`} className="text-[18px]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : opening ? (
          <div className="mt-3 space-y-3">
            <div className="text-xs font-medium capitalize text-slate-700">{opening.type}</div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Width (ft)" value={opening.width} min={1} max={12} onChange={(value) => onAnnotationChange(opening.id, { openingWidth: value })} />
              <NumberField label="Height (ft)" value={opening.height} min={1} max={12} onChange={(value) => onAnnotationChange(opening.id, { openingHeight: value })} />
            </div>
            {opening.type === "window" ? <NumberField label="Sill height (ft)" value={opening.sillHeight} min={0} max={10} onChange={(value) => onAnnotationChange(opening.id, { sillHeight: value })} /> : null}
          </div>
        ) : stair ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberField label="Width (ft)" value={stair.width} min={2} max={12} onChange={(value) => onAnnotationChange(stair.id, { stairWidth: value })} />
            <NumberField label="Rise (ft)" value={stair.rise} min={0.5} max={15} onChange={(value) => onAnnotationChange(stair.id, { stairRise: value })} />
            <NumberField label="Run (ft)" value={stair.run} min={2} max={20} onChange={(value) => onAnnotationChange(stair.id, { stairRun: value })} />
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-500">Select a wall, endpoint, door, window, or stair in the 3D view.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-900">Explain a change</h3>
        <textarea value={prompt} onChange={(event) => onPromptChange(event.target.value)} rows={3} placeholder="Raise the ceiling to 9 ft 3 in and make the selected wall a half wall." className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-5 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15" />
        <button type="button" onClick={onRequestProposal} disabled={promptBusy || !prompt.trim()} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          <SymbolIcon name="auto_awesome" className="text-[17px]" />
          {promptBusy ? "Preparing preview..." : "Preview proposed changes"}
        </button>
        {proposal ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-950">{proposal.summary || "Proposed changes"}</div>
            <div className="mt-2 space-y-1">
              {(proposal.changes || []).map((change, index) => (
                <div key={`${change.property}-${index}`} className="text-[11px] leading-4 text-blue-900">{change.label || change.property}: {String(change.display_value || change.value)}</div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={onDiscardProposal} className="h-8 rounded-lg border border-blue-200 bg-white text-xs font-semibold text-blue-800">Discard</button>
              <button type="button" onClick={onApplyProposal} className="h-8 rounded-lg bg-blue-700 text-xs font-semibold text-white">Apply</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Design changes</h3>
          <span className="text-xs font-semibold text-slate-500">{changes.length}</span>
        </div>
        {changes.length ? (
          <div className="mt-2 divide-y divide-slate-100">
            {changes.map((change) => (
              <button key={change.id} type="button" onClick={() => onSelect(change.targetId)} className="block w-full py-2 text-left">
                <span className="block text-xs font-medium text-slate-700">{change.label}</span>
                <span className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                  <span>Before<br /><b className="text-slate-700">{change.before}</b></span>
                  <span>Now<br /><b className="text-slate-700">{change.current}</b></span>
                  <span>Change<br /><b className="text-blue-700">{change.delta}</b></span>
                </span>
              </button>
            ))}
          </div>
        ) : <p className="mt-2 text-xs text-slate-500">No proposed geometry changes yet.</p>}
      </section>
    </div>
  );
}
