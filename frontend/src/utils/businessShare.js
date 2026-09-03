function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isShareableBusinessListing(listing) {
  return /^\d+$/.test(String(listing?.id || ""));
}

export function buildBusinessShareData(listing, origin) {
  const normalizedOrigin = String(origin || "").replace(/\/+$/, "");
  const url = `${normalizedOrigin}/business-directory/${encodeURIComponent(listing?.id || "")}`;
  const name = cleanText(listing?.business_name) || "Local business";
  const location = cleanText(listing?.location);
  const specialties = (listing?.specialties || []).map(cleanText).filter(Boolean).slice(0, 5).join(", ");
  const summary = [specialties && `Services: ${specialties}`, location && `Serving ${location}`]
    .filter(Boolean)
    .join(". ");
  const message = [name, summary, url].filter(Boolean).join("\n\n");
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message);

  return {
    url,
    title: name,
    nativePayload: {
      title: name,
      text: summary || `View ${name} in the FlatOrigin contractor directory.`,
      url,
    },
    emailUrl: `mailto:?subject=${encodeURIComponent(`FlatOrigin: ${name}`)}&body=${encodedMessage}`,
    smsUrl: `sms:?body=${encodedMessage}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    nextdoorUrl: `https://nextdoor.com/sharekit/?source=flatorigin&body=${encodedMessage}`,
  };
}
