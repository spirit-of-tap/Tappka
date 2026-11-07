import { describe, expect, it, vi } from "vitest";

import { KASA_CONTACT } from "./brand/constants";
import { fetchKasaContact } from "./contact";

function fakeClient(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  const client = { from: vi.fn().mockReturnValue(chain) };
  return { client: client as unknown as Parameters<typeof fetchKasaContact>[0], chain };
}

describe("fetchKasaContact", () => {
  it("returns the profile name and picture", async () => {
    const { client, chain } = fakeClient({ data: { name: "Julie Holá", picture: "a/b.jpg" }, error: null });
    expect(await fetchKasaContact(client)).toEqual({ name: "Julie Holá", picture: "a/b.jpg" });
    expect(chain.eq).toHaveBeenCalledWith("id", KASA_CONTACT.profileId);
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it("falls back quietly when the profile does not exist", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: null });
    expect(await fetchKasaContact(client)).toEqual({ name: KASA_CONTACT.fallbackName, picture: null });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("falls back when the query fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    expect(await fetchKasaContact(client)).toEqual({ name: KASA_CONTACT.fallbackName, picture: null });
  });
});
