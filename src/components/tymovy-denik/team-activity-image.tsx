import {
  getTransformedImageSrcSet,
  getTransformedImageUrl,
} from "@/lib/storage/public-url"

const CARD_DESKTOP_RENDITIONS = [
  { width: 960, height: 360 },
  { width: 1280, height: 480 },
  { width: 1600, height: 600 },
] as const

const IMAGE_VARIANTS = {
  card: {
    height: 640,
    quality: 72,
    sizes: "calc(100vw - 1.5rem)",
    width: 960,
    renditions: [
      { width: 480, height: 320 },
      { width: 768, height: 512 },
      { width: 1280, height: 853 },
    ] as const,
  },
  hero: {
    height: 900,
    quality: 75,
    sizes: "(max-width: 768px) 100vw, 768px",
    width: 1600,
    renditions: [
      { width: 480, height: 270 },
      { width: 768, height: 432 },
      { width: 1200, height: 675 },
      { width: 1600, height: 900 },
    ] as const,
  },
} as const

interface TeamActivityImageProps {
  imagePath: string
  variant: keyof typeof IMAGE_VARIANTS
  className?: string
  priority?: boolean
}

export function TeamActivityImage({
  imagePath,
  variant,
  className,
  priority = false,
}: TeamActivityImageProps) {
  const config = IMAGE_VARIANTS[variant]
  const transform = { quality: config.quality, resize: "cover" as const }
  const eager = variant === "hero" || priority
  const image = (
    // Supabase serves every srcset candidate directly; Vercel does not re-optimize these images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getTransformedImageUrl("images", imagePath, {
        ...transform,
        width: config.width,
        height: config.height,
      })}
      srcSet={getTransformedImageSrcSet("images", imagePath, config.renditions, transform)}
      sizes={config.sizes}
      width={config.width}
      height={config.height}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className={className}
    />
  )

  if (variant === "card") {
    return (
      <picture>
        <source
          media="(min-width: 640px)"
          srcSet={getTransformedImageSrcSet(
            "images",
            imagePath,
            CARD_DESKTOP_RENDITIONS,
            transform,
          )}
          sizes="960px"
        />
        {image}
      </picture>
    )
  }

  return image
}
