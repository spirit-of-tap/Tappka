"use client";

import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function KasaLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Data se nepodařilo načíst</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}. Údaje z banky zkus načíst znovu.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Načíst znovu
        </Button>
      </AlertDescription>
    </Alert>
  );
}
