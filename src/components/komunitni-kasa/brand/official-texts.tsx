import { KASA_OFFICIAL_TEXTS } from "@/lib/komunitni-kasa/brand/constants";
import { CopyButton } from "./copy-button";

/** Oficiální věty k označení, každá s kopírováním. */
export function OfficialTexts() {
  return (
    <dl className="divide-y border-y">
      {KASA_OFFICIAL_TEXTS.map((item) => (
        <div key={item.id} className="flex items-center gap-4 py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-medium">{item.text}</dd>
          </div>
          <CopyButton text={item.text} label="Kopírovat" successMessage="Text zkopírován" />
        </div>
      ))}
    </dl>
  );
}
