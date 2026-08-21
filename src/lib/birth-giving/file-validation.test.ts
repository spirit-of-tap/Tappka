import { describe, expect, it } from "vitest";

import {
  BIRTH_GIVING_MAX_FILE_SIZE_BYTES,
  BIRTH_GIVING_MAX_TEAM_RESULT_TOTAL_SIZE_BYTES,
} from "./constants";
import {
  ALLOWED_BIRTH_GIVING_FILE_TYPES,
  validateBirthGivingFile,
  validateBirthGivingResultFile,
} from "./file-validation";

describe("validateBirthGivingFile", () => {
  it.each([
    ["document.pdf", "application/pdf"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["image.png", "image/png"],
    ["image.webp", "image/webp"],
  ])("accepts %s with a consistent MIME type", (fileName, mimeType) => {
    expect(
      validateBirthGivingFile({ fileName, mimeType, sizeBytes: 1 }),
    ).toBeNull();
  });

  it("exposes only the safe allowlist", () => {
    expect(Object.keys(ALLOWED_BIRTH_GIVING_FILE_TYPES)).toHaveLength(7);
  });

  it("accepts uppercase safe extensions", () => {
    expect(
      validateBirthGivingFile({
        fileName: "DOCUMENT.PDF",
        mimeType: "application/pdf",
        sizeBytes: 1,
      }),
    ).toBeNull();
  });

  it("rejects unknown and unsafe MIME types", () => {
    for (const mimeType of ["application/octet-stream", "text/html"]) {
      expect(
        validateBirthGivingFile({ fileName: "file.pdf", mimeType, sizeBytes: 1 }),
      ).toMatchObject({ code: "unsupported_type" });
    }
  });

  it("rejects missing, unsafe, and MIME-mismatched extensions", () => {
    for (const fileName of ["document", "document.exe", "document.exe.pdf", "document.png"]) {
      expect(
        validateBirthGivingFile({
          fileName,
          mimeType: "application/pdf",
          sizeBytes: 1,
        }),
      ).toMatchObject({ code: "invalid_extension" });
    }
  });

  it("rejects empty files", () => {
    expect(
      validateBirthGivingFile({
        fileName: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
      }),
    ).toMatchObject({ code: "empty_file" });
  });

  it("accepts the per-file limit and rejects one byte over it", () => {
    const input = {
      fileName: "document.pdf",
      mimeType: "application/pdf",
    };

    expect(
      validateBirthGivingFile({
        ...input,
        sizeBytes: BIRTH_GIVING_MAX_FILE_SIZE_BYTES,
      }),
    ).toBeNull();
    expect(
      validateBirthGivingFile({
        ...input,
        sizeBytes: BIRTH_GIVING_MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toMatchObject({ code: "file_too_large" });
  });
});

describe("validateBirthGivingResultFile", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    "rejects invalid current total %s",
    (currentTotalSizeBytes) => {
      expect(
        validateBirthGivingResultFile(
          {
            fileName: "document.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1,
          },
          currentTotalSizeBytes,
        ),
      ).toMatchObject({ code: "team_total_too_large" });
    },
  );

  it("accepts the team total limit and rejects one byte over it", () => {
    const input = {
      fileName: "document.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
    };

    expect(
      validateBirthGivingResultFile(
        input,
        BIRTH_GIVING_MAX_TEAM_RESULT_TOTAL_SIZE_BYTES - 1,
      ),
    ).toBeNull();
    expect(
      validateBirthGivingResultFile(
        input,
        BIRTH_GIVING_MAX_TEAM_RESULT_TOTAL_SIZE_BYTES,
      ),
    ).toMatchObject({ code: "team_total_too_large" });
  });
});
