import { getTransformedImageUrl } from "@/lib/storage/public-url"

/** Thumbnail rendition width requested from Supabase image transforms (px). */
const THUMB_WIDTH = 192

/**
 * Square thumbnail for an activity with a photo; type-initials disc fallback
 * when there is none. The photo requests a small transformed rendition
 * (Supabase image worker, CDN-cached) instead of the original object.
 */
export function TeamActivityThumb({
  imagePath,
  activityType,
  size = 48,
}: {
  imagePath?: string | null
  activityType: string
  /** Pixel edge for the fallback disc; also drives the transform width. */
  size?: number
}) {
  if (!imagePath) {
    return (
      <span
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-lg bg-muted text-xs font-medium uppercase text-muted-foreground"
        aria-hidden
      >
        {activityType.slice(0, 2)}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getTransformedImageUrl("images", imagePath, {
        width: Math.max(THUMB_WIDTH, size * 2),
        quality: 70,
        format: "webp",
        resize: "cover",
      })}
      alt=""
      loading="lazy"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg border border-border/50 object-cover"
    />
  )
}
