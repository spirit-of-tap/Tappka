import { describe, expect, it } from "vitest";

import {
  birthGivingConfirmedFileSchema,
  birthGivingFileSchema,
  extensionForBirthGivingMimeType,
} from "@/lib/birth-giving/files";
import { BIRTH_GIVING_MAX_FILE_SIZE_BYTES } from "@/lib/birth-giving/constants";

describe("Birth Giving file validation", () => {
  it.each([
    ["report.pdf", "application/pdf", "pdf"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
    ["document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ["table.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
    ["photo.jpeg", "image/jpeg", "jpg"],
  ])("accepts safe matching file %s", (originalFileName, mimeType, extension) => {
    expect(birthGivingFileSchema.safeParse({ originalFileName, mimeType, fileSize: 1_024 }).success).toBe(true);
    expect(extensionForBirthGivingMimeType(mimeType)).toBe(extension);
  });

  it("accepts safe confirmation metadata with its generated storage path", () => {
    expect(birthGivingConfirmedFileSchema.safeParse({
      originalFileName: "report.pdf",
      mimeType: "application/pdf",
      fileSize: 1_024,
      storagePath: "birth-giving/assignments/event/report.pdf",
    }).success).toBe(true);
  });

  it.each([
    { originalFileName: "payload.exe", mimeType: "application/octet-stream", fileSize: 1_024 },
    { originalFileName: "payload.exe.pdf", mimeType: "application/pdf", fileSize: 1_024 },
    { originalFileName: "renamed.pdf", mimeType: "image/png", fileSize: 1_024 },
    { originalFileName: "empty.pdf", mimeType: "application/pdf", fileSize: 0 },
    { originalFileName: "large.pdf", mimeType: "application/pdf", fileSize: BIRTH_GIVING_MAX_FILE_SIZE_BYTES + 1 },
  ])("rejects unsafe metadata %#", (metadata) => {
    expect(birthGivingFileSchema.safeParse(metadata).success).toBe(false);
  });
});
