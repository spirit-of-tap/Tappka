import JSZip from "jszip";

const FILE_SIGNATURES = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
  pdf: Buffer.from("%PDF-"),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  riff: Buffer.from("RIFF"),
  webp: Buffer.from("WEBP"),
} as const;

const OOXML_DIRECTORIES = {
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xl/",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/",
} as const;

function startsWith(content: Buffer, signature: Buffer): boolean {
  return content.length >= signature.length && content.subarray(0, signature.length).equals(signature);
}

export async function validateBirthGivingFileContent(
  content: Buffer,
  mimeType: string,
): Promise<boolean> {
  if (mimeType === "application/pdf") return startsWith(content, FILE_SIGNATURES.pdf);
  if (mimeType === "image/jpeg") return startsWith(content, FILE_SIGNATURES.jpeg);
  if (mimeType === "image/png") return startsWith(content, FILE_SIGNATURES.png);
  if (mimeType === "image/webp") {
    return startsWith(content, FILE_SIGNATURES.riff)
      && content.length >= 12
      && content.subarray(8, 12).equals(FILE_SIGNATURES.webp);
  }

  const expectedDirectory = OOXML_DIRECTORIES[mimeType as keyof typeof OOXML_DIRECTORIES];
  if (!expectedDirectory) return false;
  try {
    const zip = await JSZip.loadAsync(content);
    return Boolean(zip.file("[Content_Types].xml"))
      && Object.keys(zip.files).some((path) => path.startsWith(expectedDirectory));
  } catch {
    return false;
  }
}
