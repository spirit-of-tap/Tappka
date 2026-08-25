"use client";

import * as React from "react";

import type { SpotlightUser } from "./spotlight-items";
import { SpotlightDialog } from "./spotlight-dialog";

export interface SpotlightContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  user?: SpotlightUser;
}

const SpotlightContext = React.createContext<SpotlightContextValue | null>(null);

export interface SpotlightProviderProps {
  children: React.ReactNode;
  user?: SpotlightUser;
}

export function SpotlightProvider({ children, user }: SpotlightProviderProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
        return;
      }

      // Quick slash / shortcut when not inside an input, textarea, select or contenteditable
      if (
        event.key === "/" &&
        !isOpen &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        const isEditable =
          target?.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select";

        if (!isEditable) {
          event.preventDefault();
          open();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, open, toggle]);

  const value = React.useMemo<SpotlightContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      setOpen: setIsOpen,
      user,
    }),
    [isOpen, open, close, toggle, user],
  );

  return (
    <SpotlightContext.Provider value={value}>
      {children}
      <SpotlightDialog />
    </SpotlightContext.Provider>
  );
}

export function useSpotlight(): SpotlightContextValue {
  const context = React.useContext(SpotlightContext);
  if (!context) {
    throw new Error("useSpotlight must be used within a SpotlightProvider.");
  }
  return context;
}
