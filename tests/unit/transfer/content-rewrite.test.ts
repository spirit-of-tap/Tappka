import { describe, expect, it } from "vitest";

import {
  collectLocalObjectPaths,
  rewriteLocalStorageUrls,
} from "../../../scripts/transfer/content-rewrite";

const FROM = "http://127.0.0.1:54321/storage/v1/object/public/images";
const TO = "https://preview.supabase.co/storage/v1/object/public/images";

const DOC = {
  type: "doc",
  content: [
    {
      type: "image",
      attrs: { src: `${FROM}/essay-images/import/1897/Image_910.png`, alt: "local" },
    },
    {
      type: "image",
      attrs: { src: "https://upload.wikimedia.org/wikipedia/commons/3/37/x.jpg" },
    },
    { type: "image", attrs: { src: "/forpsi-errors/images/logo.gif" } },
    { type: "image", attrs: { src: "blob:https://tiimiakatemia.cz/1a991f5f" } },
    {
      type: "paragraph",
      content: [{ type: "text", text: "no url here" }],
    },
  ],
} as const;

describe("rewriteLocalStorageUrls", () => {
  it("replaces only the local storage prefix", () => {
    const { value } = rewriteLocalStorageUrls(DOC, FROM, TO);

    expect(value.content[0].attrs.src).toBe(
      `${TO}/essay-images/import/1897/Image_910.png`,
    );
  });

  it("leaves external https, root-relative and blob srcs byte-identical", () => {
    const { value } = rewriteLocalStorageUrls(DOC, FROM, TO);

    expect(value.content[1].attrs.src).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/3/37/x.jpg",
    );
    expect(value.content[2].attrs.src).toBe("/forpsi-errors/images/logo.gif");
    expect(value.content[3].attrs.src).toBe("blob:https://tiimiakatemia.cz/1a991f5f");
  });

  it("reports how many strings it rewrote", () => {
    expect(rewriteLocalStorageUrls(DOC, FROM, TO).rewritten).toBe(1);
  });

  it("does not mutate the input document", () => {
    const before = JSON.stringify(DOC);
    rewriteLocalStorageUrls(DOC, FROM, TO);

    expect(JSON.stringify(DOC)).toBe(before);
  });

  it("preserves non-string leaves and nulls", () => {
    const input = { a: 1, b: true, c: null, d: [1, "x"] };

    expect(rewriteLocalStorageUrls(input, FROM, TO).value).toEqual(input);
  });

  it("rewrites every occurrence, including repeats", () => {
    const input = {
      a: `${FROM}/one.png`,
      b: [`${FROM}/one.png`, `${FROM}/two.png`],
    };
    const { value, rewritten } = rewriteLocalStorageUrls(input, FROM, TO);

    expect(rewritten).toBe(3);
    expect(value.b[1]).toBe(`${TO}/two.png`);
  });

  it("does not rewrite a string that merely contains the prefix mid-way", () => {
    const input = { src: `see ${FROM}/x.png` };

    expect(rewriteLocalStorageUrls(input, FROM, TO).rewritten).toBe(0);
  });
});

describe("collectLocalObjectPaths", () => {
  it("returns deduplicated object paths without the prefix", () => {
    const input = {
      a: `${FROM}/essay-images/import/1897/Image_910.png`,
      b: `${FROM}/essay-images/import/1897/Image_910.png`,
      c: `${FROM}/essay-images/import/test/1002_Image_399.jpeg`,
    };

    expect(collectLocalObjectPaths(input, FROM).sort()).toEqual([
      "essay-images/import/1897/Image_910.png",
      "essay-images/import/test/1002_Image_399.jpeg",
    ]);
  });

  it("ignores non-local srcs", () => {
    expect(collectLocalObjectPaths(DOC, FROM)).toEqual([
      "essay-images/import/1897/Image_910.png",
    ]);
  });

  it("percent-decodes paths so they match storage object names", () => {
    expect(collectLocalObjectPaths({ src: `${FROM}/a%20b/c%2Bd.png` }, FROM)).toEqual([
      "a b/c+d.png",
    ]);
  });

  it("skips a bare prefix with no object path", () => {
    expect(collectLocalObjectPaths({ src: `${FROM}/` }, FROM)).toEqual([]);
  });
});
