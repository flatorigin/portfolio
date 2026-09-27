import { MarkupCanvasPreview, getMarkupVersion } from "./MarkupPresetOverlay";

function pathOf(url) {
  try { return new URL(url, window.location.origin).pathname; } catch { return url; }
}

export default function ProjectCardCover({ project, src, alt = "", ...props }) {
  const images = project?.images || project?.reference_gallery || [];
  const cover = images.find((image) =>
    [image.url, image.image_url, image.image].some((url) => url && pathOf(url) === pathOf(src)),
  );
  const version = getMarkupVersion(cover);
  if (version?.annotations?.length && version.version_type !== "rough_plan") {
    return <MarkupCanvasPreview cardCover version={version} backgroundUrl={version.background_url || src} className={props.className} ariaLabel={alt || "Project cover with saved markup"} />;
  }
  return <img src={src} alt={alt} {...props} />;
}
