const CZU_DOMAINS = ["pef.czu.cz", "studenti.czu.cz", "rektorat.czu.cz"] as const;

const IMAGE_SIGNATURES = [
  { magic: [0xff, 0xd8, 0xff], contentType: "image/jpeg", extension: "jpg" },
  { magic: [0x89, 0x50, 0x4e, 0x47], contentType: "image/png", extension: "png" },
  { magic: [0x47, 0x49, 0x46, 0x38], contentType: "image/gif", extension: "gif" },
] as const;

export interface VCardContact {
  readonly fullName: string | null;
  readonly emails: readonly string[];
  /** Raw base64 payload of the PHOTO property, if present. */
  readonly photoBase64: string | null;
}

export interface DetectedImage {
  readonly contentType: string;
  readonly extension: string;
}

/**
 * Unfolds vCard line folding: a line beginning with a space or tab is a
 * continuation of the previous one. Base64 photo payloads are split across many
 * such lines, so joining them is required before decoding.
 */
export function unfoldLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith(" ") || raw.startsWith("\t")) {
      if (out.length > 0) out[out.length - 1] += raw.slice(1);
      continue;
    }
    out.push(raw);
  }
  return out;
}

export function parseVCards(text: string): VCardContact[] {
  const contacts: VCardContact[] = [];
  let fullName: string | null = null;
  let emails: string[] = [];
  let photoBase64: string | null = null;
  let open = false;

  for (const line of unfoldLines(text)) {
    if (line === "BEGIN:VCARD") {
      open = true;
      fullName = null;
      emails = [];
      photoBase64 = null;
      continue;
    }
    if (!open) continue;
    if (line === "END:VCARD") {
      contacts.push({ fullName, emails, photoBase64 });
      open = false;
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const property = line.slice(0, separator).split(";")[0].toUpperCase();
    const value = line.slice(separator + 1);

    if (property === "FN") fullName = value.trim();
    else if (property === "EMAIL") emails.push(value.trim().toLowerCase());
    else if (property === "PHOTO") photoBase64 = value.trim();
  }

  return contacts;
}

/** The contact's institutional address — the only one that matches a profile. */
export function czuEmails(contact: VCardContact): string[] {
  return contact.emails.filter((email) =>
    CZU_DOMAINS.some((domain) => email.endsWith(`@${domain}`)),
  );
}

/**
 * Identifies the image from its magic bytes. The vCard's own `TYPE=JPEG` is not
 * trustworthy — this export declares PNGs as JPEG — and serving a PNG as
 * `image/jpeg` leaves the browser to guess.
 */
export function detectImage(bytes: Uint8Array): DetectedImage | null {
  for (const signature of IMAGE_SIGNATURES) {
    const matches = signature.magic.every((byte, index) => bytes[index] === byte);
    if (matches) {
      return { contentType: signature.contentType, extension: signature.extension };
    }
  }
  return null;
}
