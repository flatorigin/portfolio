import { Link } from "react-router-dom";
import { Badge, Card, SymbolIcon } from "../../ui";

export default function ExploreProjectCard({
  project,
  pack,
  to,
  isReferenceGallery = false,
  canSave = false,
  saved = false,
  liked = false,
  likeCount = 0,
  likeBusy = false,
  favoriteBusy = false,
  canEdit = false,
  onLike,
  onFavorite,
  onEdit,
}) {
  const coverUrl = pack?.cover || "";
  const thumbs = Array.isArray(pack?.thumbs) ? pack.thumbs : [];
  const referenceCount = Number(project?.reference_count || thumbs.length || 0);

  return (
    <Link to={to} className="block text-inherit no-underline">
      <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
        {coverUrl ? (
          <div className="relative h-44 w-full overflow-hidden bg-slate-200">
            <img
              src={coverUrl}
              alt={project?.title || "project cover"}
              className="block h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          </div>
        ) : thumbs.length ? (
          <div className="relative">
            <div
              className="grid gap-1 bg-slate-50 p-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(3, thumbs.length)}, 1fr)`,
              }}
            >
              {thumbs.map((item, index) => (
                <div
                  key={(item.thumb || item.url) + index}
                  className="relative h-24 overflow-hidden rounded-lg bg-slate-100"
                >
                  <img
                    src={item.thumb || item.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {item.mediaType === "video" ? (
                    <span className="absolute inset-0 flex items-center justify-center text-white">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
                        <SymbolIcon name="play_arrow" fill={1} className="text-[22px]" />
                      </span>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative flex h-44 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
            No media
          </div>
        )}

        <div className="p-4">
          <div className="mb-2 flex items-start gap-2">
            <div className="min-w-0 flex-1 truncate text-base font-semibold text-slate-950">
              {project?.title}
            </div>
            {project?.category ? <Badge>{project.category}</Badge> : null}
          </div>

          <div className="line-clamp-2 text-sm leading-6 text-slate-600">
            {project?.summary || <span className="opacity-60">No summary</span>}
          </div>

          <div className="mt-3 text-xs font-medium text-slate-500">
            {isReferenceGallery
              ? `${referenceCount} reference image${referenceCount === 1 ? "" : "s"}`
              : `by ${project?.owner_username || "unknown"}`}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            {isReferenceGallery ? (
              <span className="inline-flex rounded-full px-2 py-1 font-medium text-slate-700">
                View profile
              </span>
            ) : canSave ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                onClick={onLike}
                disabled={likeBusy}
                aria-label={liked ? "Unlike project" : "Like project"}
                title={liked ? "Unlike project" : "Like project"}
              >
                <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[18px]" />
                <span>{likeCount}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 rounded-full px-2 py-1">
                <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[18px]" />
                <span>{likeCount}</span>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5">
              {canEdit ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Edit project"
                  title="Edit project"
                  onClick={onEdit}
                >
                  <SymbolIcon name="edit" className="text-[20px]" />
                </button>
              ) : canSave ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  onClick={onFavorite}
                  disabled={favoriteBusy}
                  aria-label={saved ? "Unsave project" : "Save project"}
                  title={saved ? "Unsave project" : "Save project"}
                >
                  <SymbolIcon name="bookmark" fill={saved ? 1 : 0} className="text-[20px]" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
