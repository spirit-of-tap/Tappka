import { getPublicStorageUrl } from "@/lib/storage/public-url"

/**
 * Square thumbnail for an activity with a photo; type-initials disc fallback
 * when there is none. Used by overview rows and the detail hero placeholder.
 */
export function TeamActivityThumb({
  imagePath,
  activityType,
  size = 48,
}: {
  imagePath?: string | null
  activityType: string
  /** Pixel edge for the fallback disc; the photo scales to this box. */
  size?: number
}) {
  const src = imagePath ? getPublicStorageUrl("images", imagePath) : null

  if (!src) {
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
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg border border-border/50 object-cover"
    />
  )
}
