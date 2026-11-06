"use client";

import { useCallback, useEffect, useState } from "react";

import type { KasaResponse } from "@/lib/komunitni-kasa/types";

const KASA_API_URL = "/api/komunitni-kasa";
const FALLBACK_ERROR = "Načtení selhalo";

export type KasaLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: KasaResponse };

/** Načte data transparentního účtu; `reload` zkusí načtení znovu. */
export function useKasaData(): { state: KasaLoadState; reload: () => void } {
  const [state, setState] = useState<KasaLoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(KASA_API_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? FALLBACK_ERROR);
        return (await res.json()) as KasaResponse;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: error instanceof Error ? error.message : FALLBACK_ERROR });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { state, reload };
}
