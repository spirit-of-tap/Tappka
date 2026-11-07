import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import { EXPENSE_KINDS } from "./smernice-data";

describe("kasa explainer copy is gender-neutral", () => {
  it("avoids generic masculine 'členů' and 'člena' outside the verbatim legal text", () => {
    expect(EXPENSE_KINDS.map((k) => k.summary).join(" ")).not.toMatch(/členů|člena/);
    const documentList = readFileSync(resolve(__dirname, "../../components/komunitni-kasa/document-list.tsx"), "utf-8");
    expect(documentList).not.toMatch(/přijetí člena/);
  });
});
