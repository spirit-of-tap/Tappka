import { getTransformedImageUrl } from "@/lib/storage/public-url"

/** Thumbnail rendition width requested from Supabase image transforms (px). */
const THUMB_WIDTH = 192

/**
 * Square thumbnail for an activity with a photo; type-initials disc fallback
 * when there is none. Requests a small transformed rendition; if the
 * transformation endpoint is unavailable, falls back to the original object.
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

  const renditionSize = Math.max(THUMB_WIDTH, size * 2)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getTransformedImageUrl("images", imagePath, {
        width: renditionSize,
        height: renditionSize,
        quality: 70,
        resize: "cover",
      })}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg border border-border/50 object-cover"
    />
  )
}
