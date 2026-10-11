/**
 * Browser-side export of a report chart: the Recharts SVG plus a title and legend drawn on a
 * canvas, saved as PNG (for slides), and CSV downloads. Colours come from the live theme,
 * so a light-mode export suits slides and a dark-mode export stays dark.
 */

/** Device pixels per CSS pixel in the PNG (sharp on projectors and retina screens). */
const PNG_SCALE = 2
const PADDING = 24
const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 12
const LEGEND_FONT_SIZE = 12
const LEGEND_SWATCH = 10
const LEGEND_GAP = 16
const LEGEND_ROW_HEIGHT = 20
const LINE_GAP = 8
/** SVG presentation properties copied from computed styles so CSS variables survive export. */
const INLINED_STYLE_PROPERTIES = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-family", "font-weight"] as const

export interface LegendItem {
  label: string
  /** Any CSS colour, including `var(--token)`; resolved against the live theme. */
  color: string
}

export interface PngExportOptions {
  /** Element that contains the Recharts `<svg>`. */
  container: HTMLElement
  title: string
  subtitle?: string
  legend: readonly LegendItem[]
  fileName: string
}

function rootStyle(): CSSStyleDeclaration {
  return getComputedStyle(document.body)
}

/** Resolves a colour (e.g. `var(--time-training)`) to what the browser actually paints. */
function resolveColor(color: string): string {
  const probe = document.createElement("span")
  probe.style.color = color
  probe.style.display = "none"
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved
}

function inlineComputedStyles(source: Element, target: Element): void {
  const computed = getComputedStyle(source)
  for (const property of INLINED_STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(property)
    if (value) (target as SVGElement).style.setProperty(property, value)
  }
  const sourceChildren = source.children
  const targetChildren = target.children
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index]
    const targetChild = targetChildren[index]
    if (sourceChild && targetChild) inlineComputedStyles(sourceChild, targetChild)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Chart image failed to load"))
    image.src = url
  })
}

function triggerDownload(url: string, fileName: string): void {
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Lays legend items out in rows that fit `maxWidth`; returns their positions. */
function layoutLegend(
  context: CanvasRenderingContext2D,
  items: readonly LegendItem[],
  maxWidth: number,
): { item: LegendItem; x: number; row: number }[] {
  const placed: { item: LegendItem; x: number; row: number }[] = []
  let x = 0
  let row = 0
  for (const item of items) {
    const width = LEGEND_SWATCH + 6 + context.measureText(item.label).width
    if (x > 0 && x + width > maxWidth) {
      x = 0
      row += 1
    }
    placed.push({ item, x, row })
    x += width + LEGEND_GAP
  }
  return placed
}

export async function exportChartAsPng({ container, title, subtitle, legend, fileName }: PngExportOptions): Promise<void> {
  const svg = container.querySelector("svg.recharts-surface")
  if (!(svg instanceof SVGSVGElement)) throw new Error("No chart to export")

  const { width: chartWidth, height: chartHeight } = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true) as SVGSVGElement
  inlineComputedStyles(svg, clone)
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(chartWidth))
  clone.setAttribute("height", String(chartHeight))
  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }),
  )

  try {
    const image = await loadImage(svgUrl)
    const style = rootStyle()
    const background = style.backgroundColor
    const foreground = style.color
    const muted = resolveColor("var(--muted-foreground)")
    const fontFamily = style.fontFamily

    const width = chartWidth + PADDING * 2
    const measure = document.createElement("canvas").getContext("2d")
    if (!measure) throw new Error("Canvas is not supported")
    measure.font = `${LEGEND_FONT_SIZE}px ${fontFamily}`
    const legendLayout = layoutLegend(measure, legend, chartWidth)
    const legendRows = legendLayout.length === 0 ? 0 : (legendLayout.at(-1)?.row ?? 0) + 1

    const headerHeight =
      TITLE_FONT_SIZE + (subtitle ? LINE_GAP + SUBTITLE_FONT_SIZE : 0) + LINE_GAP * 2 + legendRows * LEGEND_ROW_HEIGHT
    const height = PADDING + headerHeight + chartHeight + PADDING

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * PNG_SCALE)
    canvas.height = Math.round(height * PNG_SCALE)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is not supported")
    context.scale(PNG_SCALE, PNG_SCALE)

    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    let y = PADDING
    context.textBaseline = "top"
    context.fillStyle = foreground
    context.font = `600 ${TITLE_FONT_SIZE}px ${fontFamily}`
    context.fillText(title, PADDING, y)
    y += TITLE_FONT_SIZE
    if (subtitle) {
      y += LINE_GAP
      context.fillStyle = muted
      context.font = `${SUBTITLE_FONT_SIZE}px ${fontFamily}`
      context.fillText(subtitle, PADDING, y)
      y += SUBTITLE_FONT_SIZE
    }
    y += LINE_GAP * 2

    context.font = `${LEGEND_FONT_SIZE}px ${fontFamily}`
    for (const { item, x, row } of legendLayout) {
      const rowY = y + row * LEGEND_ROW_HEIGHT
      context.fillStyle = resolveColor(item.color)
      context.fillRect(PADDING + x, rowY + 1, LEGEND_SWATCH, LEGEND_SWATCH)
      context.fillStyle = foreground
      context.fillText(item.label, PADDING + x + LEGEND_SWATCH + 6, rowY)
    }
    y += legendRows * LEGEND_ROW_HEIGHT

    context.drawImage(image, PADDING, y, chartWidth, chartHeight)

    const pngUrl = canvas.toDataURL("image/png")
    triggerDownload(pngUrl, fileName)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/** Saves text as a CSV file. */
export function downloadCsv(csv: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  try {
    triggerDownload(url, fileName)
  } finally {
    // Revoke after the click has been handled by the browser.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** File-name-safe slug: no diacritics, lowercase, dashes. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
