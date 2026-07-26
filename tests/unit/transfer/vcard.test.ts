import { describe, expect, it } from "vitest";

import {
  czuEmails,
  detectImage,
  parseVCards,
  unfoldLines,
} from "../../../scripts/transfer/vcard";

describe("unfoldLines", () => {
  it("joins continuation lines that begin with a space", () => {
    expect(unfoldLines("PHOTO:AAA\n BBB\n CCC\nFN:X")).toEqual(["PHOTO:AAABBBCCC", "FN:X"]);
  });

  it("joins continuation lines that begin with a tab", () => {
    expect(unfoldLines("A:1\n\t2")).toEqual(["A:12"]);
  });

  it("handles CRLF line endings", () => {
    expect(unfoldLines("A:1\r\n 2\r\nB:3")).toEqual(["A:12", "B:3"]);
  });

  it("leaves unfolded text untouched", () => {
    expect(unfoldLines("A:1\nB:2")).toEqual(["A:1", "B:2"]);
  });
});

const CARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Jonáš Plichta",
  "TEL;TYPE=CELL:606358931",
  "EMAIL;TYPE=INTERNET:plichtajonas@gmail.com",
  "EMAIL;TYPE=INTERNET:plichta@pef.czu.cz",
  "PHOTO;ENCODING=b;TYPE=JPEG:AAAA",
  " BBBB",
  "END:VCARD",
].join("\n");

describe("parseVCards", () => {
  it("extracts the full name, every email and the photo payload", () => {
    const [contact] = parseVCards(CARD);

    expect(contact.fullName).toBe("Jonáš Plichta");
    expect(contact.emails).toEqual(["plichtajonas@gmail.com", "plichta@pef.czu.cz"]);
    expect(contact.photoBase64).toBe("AAAABBBB");
  });

  it("lowercases emails so matching is case-insensitive", () => {
    const [contact] = parseVCards(
      "BEGIN:VCARD\nEMAIL;TYPE=INTERNET:XKulo007@Studenti.CZU.cz\nEND:VCARD",
    );

    expect(contact.emails).toEqual(["xkulo007@studenti.czu.cz"]);
  });

  it("reports a missing photo as null rather than omitting the contact", () => {
    const [contact] = parseVCards("BEGIN:VCARD\nFN:No Photo\nEND:VCARD");

    expect(contact.photoBase64).toBeNull();
    expect(contact.fullName).toBe("No Photo");
  });

  it("parses several cards", () => {
    expect(parseVCards(`${CARD}\n${CARD}`)).toHaveLength(2);
  });

  it("ignores content outside a BEGIN/END pair", () => {
    expect(parseVCards("FN:Stray\nBEGIN:VCARD\nFN:Real\nEND:VCARD")).toEqual([
      { fullName: "Real", emails: [], photoBase64: null },
    ]);
  });
});

describe("czuEmails", () => {
  it("keeps only institutional addresses", () => {
    expect(czuEmails(parseVCards(CARD)[0])).toEqual(["plichta@pef.czu.cz"]);
  });

  it("accepts all three czu domains", () => {
    const contact = parseVCards(
      [
        "BEGIN:VCARD",
        "EMAIL:a@studenti.czu.cz",
        "EMAIL:b@rektorat.czu.cz",
        "EMAIL:c@pef.czu.cz",
        "END:VCARD",
      ].join("\n"),
    )[0];

    expect(czuEmails(contact)).toHaveLength(3);
  });

  it("does not match a lookalike domain", () => {
    const contact = parseVCards("BEGIN:VCARD\nEMAIL:x@notczu.cz\nEMAIL:y@pef.czu.cz.evil.com\nEND:VCARD")[0];

    expect(czuEmails(contact)).toEqual([]);
  });
});

describe("detectImage", () => {
  it("identifies JPEG from its magic bytes", () => {
    expect(detectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });

  it("identifies a PNG even though the vCard declares TYPE=JPEG", () => {
    expect(detectImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toEqual({
      contentType: "image/png",
      extension: "png",
    });
  });

  it("identifies GIF", () => {
    expect(detectImage(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toEqual({
      contentType: "image/gif",
      extension: "gif",
    });
  });

  it("returns null for an unrecognised payload rather than guessing", () => {
    expect(detectImage(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("returns null for an empty payload", () => {
    expect(detectImage(new Uint8Array([]))).toBeNull();
  });
});
