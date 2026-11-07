"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

/** Spustí stahování; `pending` drží klíč právě připravovaného souboru. */
export function useDownload(): { run: (key: string, task: () => Promise<void>) => Promise<void>; pending: string | null } {
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(async (key: string, task: () => Promise<void>) => {
    setPending(key);
    try {
      await task();
    } catch {
      toast.error("Soubor se nepodařilo připravit, zkus to znovu");
    } finally {
      setPending(null);
    }
  }, []);

  return { run, pending };
}
