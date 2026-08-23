const LOCKED_ANNOTATION_OPACITY = 0.45;

export function lockedAnnotationGroupOpacity(item, locked) {
  return locked && item?.type !== "background_eraser" ? LOCKED_ANNOTATION_OPACITY : undefined;
}

export function eraserStrokeOpacity(item, locked) {
  return locked ? 1 : item?.strokeOpacity ?? 1;
}

export function enforceLockedEraserOpacity(item, locked) {
  if (!locked || item?.type !== "background_eraser" || item.strokeOpacity === 1) return item;
  return { ...item, strokeOpacity: 1 };
}
