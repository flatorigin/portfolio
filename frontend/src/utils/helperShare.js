function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimText(value, maxLength) {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function buildHelperShareData(helper, origin) {
  const normalizedOrigin = String(origin || "").replace(/\/+$/, "");
  const url = `${normalizedOrigin}/project-helpers/${encodeURIComponent(helper?.id || "")}`;
  const name = cleanText(helper?.full_name) || "Project helper";
  const location = [cleanText(helper?.city), cleanText(helper?.state)].filter(Boolean).join(", ");
  const skills = (helper?.skill_labels || []).map(cleanText).filter(Boolean).slice(0, 5).join(", ");
  const title = `${name} — Project Helper`;
  const summary = trimText(
    [skills && `Skills: ${skills}`, location && `Serving ${location}`, helper?.bio]
      .filter(Boolean)
      .join(". "),
    420,
  );
  const message = [title, summary, url].filter(Boolean).join("\n\n");
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message);

  return {
    url,
    title,
    message,
    nativePayload: {
      title,
      text: summary || `View ${name}'s helper card on FlatOrigin.`,
      url,
    },
    emailUrl: `mailto:?subject=${encodeURIComponent(`FlatOrigin: ${title}`)}&body=${encodedMessage}`,
    smsUrl: `sms:?body=${encodedMessage}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    nextdoorUrl: `https://nextdoor.com/sharekit/?source=flatorigin&body=${encodedMessage}`,
  };
}
