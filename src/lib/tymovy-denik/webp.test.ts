import { describe, expect, it } from "vitest"
import sharp from "sharp"

import { getWebpDimensions } from "./webp"

const ONE_PIXEL_WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
)

function vp8xImage(width: number, height: number): Buffer {
  const vp8Chunk = ONE_PIXEL_WEBP.subarray(12)
  const image = Buffer.alloc(30 + vp8Chunk.length)
  image.write("RIFF", 0)
  image.writeUInt32LE(image.length - 8, 4)
  image.write("WEBP", 8)
  image.write("VP8X", 12)
  image.writeUInt32LE(10, 16)
  image.writeUIntLE(width - 1, 24, 3)
  image.writeUIntLE(height - 1, 27, 3)
  vp8Chunk.copy(image, 30)
  return image
}

function headerOnlyLossyWebp(): Buffer {
  const image = Buffer.alloc(30)
  image.write("RIFF", 0)
  image.writeUInt32LE(image.length - 8, 4)
  image.write("WEBP", 8)
  image.write("VP8 ", 12)
  image.writeUInt32LE(10, 16)
  image.set([0x9d, 0x01, 0x2a], 23)
  image.writeUInt16LE(1, 26)
  image.writeUInt16LE(1, 28)
  return image
}

function headerOnlyLosslessWebp(): Buffer {
  const image = Buffer.alloc(26)
  image.write("RIFF", 0)
  image.writeUInt32LE(image.length - 8, 4)
  image.write("WEBP", 8)
  image.write("VP8L", 12)
  image.writeUInt32LE(5, 16)
  image[20] = 0x2f
  return image
}

describe("getWebpDimensions", () => {
  it("reads dimensions from a decodable lossy WebP", async () => {
    await expect(getWebpDimensions(ONE_PIXEL_WEBP)).resolves.toEqual({ width: 1, height: 1 })
  })

  it("reads dimensions from a decodable extended WebP", async () => {
    const extendedWebp = await sharp({
      create: {
        width: 2001,
        height: 1001,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).webp().toBuffer()

    await expect(getWebpDimensions(extendedWebp)).resolves.toEqual({ width: 2001, height: 1001 })
  })

  it("rejects a RIFF/WEBP signature without an image chunk", async () => {
    await expect(getWebpDimensions(Buffer.from("RIFF\x04\x00\x00\x00WEBP"))).resolves.toBeNull()
  })

  it("rejects an extended header without image data", async () => {
    const headerOnly = Buffer.from(vp8xImage(100, 100).subarray(0, 30))
    headerOnly.writeUInt32LE(22, 4)
    await expect(getWebpDimensions(headerOnly)).resolves.toBeNull()
  })

  it("rejects a truncated image chunk", async () => {
    await expect(getWebpDimensions(ONE_PIXEL_WEBP.subarray(0, 24))).resolves.toBeNull()
  })

  it("rejects a lossy WebP header without decodable pixels", async () => {
    await expect(getWebpDimensions(headerOnlyLossyWebp())).resolves.toBeNull()
  })

  it("rejects a lossless WebP header without decodable pixels", async () => {
    await expect(getWebpDimensions(headerOnlyLosslessWebp())).resolves.toBeNull()
  })
})
