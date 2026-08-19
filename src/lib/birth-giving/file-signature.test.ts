import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { validateBirthGivingFileContent } from "@/lib/birth-giving/file-signature";

const OFFICE_MIME_TYPES = {
  docx: {
    directory: "word",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pptx: {
    directory: "ppt",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  xlsx: {
    directory: "xl",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
} as const;

describe("validateBirthGivingFileContent", () => {
  it.each([
    ["application/pdf", Buffer.from("%PDF-1.7\n")],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/webp", Buffer.from("RIFF0000WEBP")],
  ])("accepts a matching %s signature", async (mimeType, content) => {
    await expect(validateBirthGivingFileContent(content, mimeType)).resolves.toBe(true);
  });

  it.each(Object.entries(OFFICE_MIME_TYPES))(
    "accepts a valid %s OOXML container",
    async (_extension, { directory, mimeType }) => {
      const zip = new JSZip();
      zip.file("[Content_Types].xml", "<Types />");
      zip.file(`${directory}/document.xml`, "<document />");

      await expect(validateBirthGivingFileContent(await zip.generateAsync({ type: "nodebuffer" }), mimeType))
        .resolves.toBe(true);
    },
  );

  it("rejects metadata/content mismatches and incomplete OOXML containers", async () => {
    await expect(validateBirthGivingFileContent(Buffer.from("%PDF-1.7"), "image/png")).resolves.toBe(false);
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types />");
    zip.file("xl/workbook.xml", "<workbook />");
    await expect(validateBirthGivingFileContent(
      await zip.generateAsync({ type: "nodebuffer" }),
      OFFICE_MIME_TYPES.docx.mimeType,
    )).resolves.toBe(false);
  });
});
