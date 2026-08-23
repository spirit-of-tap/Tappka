import sharp from "sharp"

import { TEAM_ACTIVITY_IMAGE } from "./image"

const MAX_INPUT_PIXELS = TEAM_ACTIVITY_IMAGE.maxEdge ** 2

export interface WebpDimensions {
  width: number
  height: number
}

export async function getWebpDimensions(content: Buffer): Promise<WebpDimensions | null> {
  try {
    const image = sharp(content, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
    const metadata = await image.metadata()
    if (metadata.format !== "webp") return null

    const { info } = await image.raw().toBuffer({ resolveWithObject: true })
    return info.width > 0 && info.height > 0
      ? { width: info.width, height: info.height }
      : null
  } catch {
    return null
  }
}
