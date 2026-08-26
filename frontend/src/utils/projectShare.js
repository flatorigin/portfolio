function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimText(value, maxLength) {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function isShareablePublicProject(project) {
  return Boolean(
    project?.id &&
      project?.is_public !== false &&
      !project?.is_private &&
      project?.post_privacy !== "private" &&
      project?._kind !== "homeowner_reference_gallery" &&
      !String(project.id).startsWith("sample-"),
  );
}

export function buildProjectShareData(project, origin) {
  const normalizedOrigin = String(origin || "").replace(/\/+$/, "");
  const url = `${normalizedOrigin}/projects/${encodeURIComponent(project?.id || "")}`;
  const title = cleanText(project?.title) || "FlatOrigin project";
  const location = cleanText(project?.location);
  const summary = trimText(project?.job_summary || project?.summary, 420);
  const heading = location ? `${title} in ${location}` : title;
  const message = [heading, summary, url].filter(Boolean).join("\n\n");
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message);

  return {
    url,
    title,
    message,
    nativePayload: {
      title,
      text: summary || `Take a look at ${heading} on FlatOrigin.`,
      url,
    },
    emailUrl: `mailto:?subject=${encodeURIComponent(`FlatOrigin: ${title}`)}&body=${encodedMessage}`,
    smsUrl: `sms:?body=${encodedMessage}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    nextdoorUrl: `https://nextdoor.com/sharekit/?source=flatorigin&body=${encodedMessage}`,
  };
}
