const MESSAGE_DELETE_WINDOW_MS = 60 * 1000;

export function isWithinMessageDeleteWindow(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= MESSAGE_DELETE_WINDOW_MS;
}

export function canDeletePersistedMessage(message, isMineFallback = false) {
  const id = message?.id;
  if (!id || String(id).startsWith("tmp-")) return false;

  if (message?.can_delete != null) {
    return message.can_delete === true;
  }

  return (
    isMineFallback && isWithinMessageDeleteWindow(message?.created_at)
  );
}
