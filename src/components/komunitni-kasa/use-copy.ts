"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_RESET_MS = 2000;

/** Zkopíruje text do schránky; `copied` drží poslední zkopírovanou hodnotu 2 s. */
export function useCopy(): { copy: (text: string) => Promise<boolean>; copied: string | null } {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    setCopied(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), COPIED_RESET_MS);
    return true;
  }, []);

  return { copy, copied };
}
