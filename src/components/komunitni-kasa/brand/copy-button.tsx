"use client";

import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCopy } from "../use-copy";

interface CopyButtonProps {
  text: string;
  /** Viditelný popisek; bez něj jen ikona. */
  label?: string;
  successMessage?: string;
}

export function CopyButton({ text, label, successMessage = "Zkopírováno do schránky" }: CopyButtonProps) {
  const { copy, copied } = useCopy();
  const done = copied === text;

  const handleClick = async () => {
    if (await copy(text)) toast.success(successMessage);
    else toast.error("Kopírování se nepodařilo, označ text ručně");
  };

  return (
    <Button
      variant="ghost"
      size={label ? "sm" : "icon"}
      className="shrink-0 gap-1.5"
      onClick={handleClick}
      aria-label={`Kopírovat: ${text}`}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {label ? <span aria-hidden>{done ? "Zkopírováno" : label}</span> : null}
    </Button>
  );
}
