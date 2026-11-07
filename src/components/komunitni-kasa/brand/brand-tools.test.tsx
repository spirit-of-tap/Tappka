import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { KASA_ASSETS } from "@/lib/komunitni-kasa/brand/assets";
import { KASA_OFFICIAL_TEXTS } from "@/lib/komunitni-kasa/brand/constants";

const downloadAsset = vi.fn().mockResolvedValue(undefined);
const downloadAllAssetsZip = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/komunitni-kasa/brand/export", () => ({
  downloadAsset: (...args: unknown[]) => downloadAsset(...args),
  downloadAllAssetsZip: (...args: unknown[]) => downloadAllAssetsZip(...args),
}));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

import { AssetGallery } from "./asset-gallery";
import { OfficialTexts } from "./official-texts";
import { RolePosterTool } from "./role-poster-tool";

beforeEach(() => {
  downloadAsset.mockClear();
  downloadAllAssetsZip.mockClear();
  toastSuccess.mockClear();
});

describe("AssetGallery", () => {
  it("shows nine assets, each with SVG and PNG downloads", () => {
    render(<AssetGallery />);
    const tiles = screen.getAllByRole("listitem");
    expect(tiles).toHaveLength(9);
    for (const [index, asset] of KASA_ASSETS.entries()) {
      const tile = tiles[index];
      expect(within(tile).getByRole("heading", { name: asset.name })).toBeInTheDocument();
      expect(within(tile).getByRole("img", { name: asset.name })).toBeInTheDocument();
      expect(within(tile).getByRole("button", { name: `Stáhnout ${asset.name} jako SVG` })).toBeInTheDocument();
      expect(within(tile).getByRole("button", { name: `Stáhnout ${asset.name} jako PNG` })).toBeInTheDocument();
    }
  });

  it("downloads a single asset", async () => {
    render(<AssetGallery />);
    fireEvent.click(screen.getByRole("button", { name: "Stáhnout Značka jako SVG" }));
    await waitFor(() => expect(downloadAsset).toHaveBeenCalledWith(KASA_ASSETS[0], "svg"));
  });

  it("downloads everything as a ZIP", async () => {
    render(<AssetGallery />);
    fireEvent.click(screen.getByRole("button", { name: /stáhnout vše/i }));
    await waitFor(() => expect(downloadAllAssetsZip).toHaveBeenCalledWith(KASA_ASSETS));
  });
});

describe("RolePosterTool", () => {
  it("updates the preview as you type and escapes markup", () => {
    render(<RolePosterTool />);
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Správa <b>klubovny</b>" } });
    const preview = screen.getByRole("img", { name: /náhled plakátu/i });
    expect(preview.innerHTML).toContain("Správa &lt;b&gt;klubovny&lt;/b&gt;");
    expect(preview.querySelector("b")).toBeNull();
  });

  it("downloads the filled poster", async () => {
    render(<RolePosterTool />);
    fireEvent.change(screen.getByLabelText("Kdo ji zastává"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: /plakát jako PNG/i }));
    await waitFor(() => expect(downloadAsset).toHaveBeenCalled());
    const [asset, format] = downloadAsset.mock.calls[0] as [{ id: string; body: () => string }, string];
    expect(asset.id).toBe("plakat");
    expect(format).toBe("png");
    expect(asset.body()).toContain("Alex");
  });
});

describe("OfficialTexts", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the five sentences verbatim", () => {
    render(<OfficialTexts />);
    for (const t of KASA_OFFICIAL_TEXTS) expect(screen.getByText(t.text)).toBeInTheDocument();
  });

  it("copies the exact sentence and confirms", async () => {
    render(<OfficialTexts />);
    fireEvent.click(screen.getByRole("button", { name: `Kopírovat: ${KASA_OFFICIAL_TEXTS[0].text}` }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(KASA_OFFICIAL_TEXTS[0].text));
    expect(toastSuccess).toHaveBeenCalled();
  });
});
