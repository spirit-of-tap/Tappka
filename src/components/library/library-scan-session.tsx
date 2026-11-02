'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, QrCode, ScanLine, X } from 'lucide-react';
import { BarcodeScanner } from 'react-barcode-scanner';
import { toast } from 'sonner';
import 'react-barcode-scanner/polyfill';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatLibraryLabelCode, parseLibraryLabelCode } from '@/lib/library/label-code';
import { playScanFeedback, primeScanAudio } from '@/lib/library/scan-feedback';
import {
  buildLabelLookup,
  type LibraryLabelEntry,
  type ScanDetection,
  shouldReportScan,
} from '@/lib/library/scan-session';

const SCANNER_DELAY_MS = 300;
// Module-level so the scanner's scan loop is not restarted on every render.
const QR_SCANNER_OPTIONS = { delay: SCANNER_DELAY_MS, formats: ['qr_code'] };
const CAMERA_START_TIMEOUT_MS = 8_000;

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface ScanResult {
  code: number;
  title: string | null;
}

interface ScanCounts {
  paired: number;
  unpaired: number;
}

interface LibraryScanSessionProps {
  labels: readonly LibraryLabelEntry[];
}

export function LibraryScanSession({ labels }: LibraryScanSessionProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) primeScanAudio();
    setOpen(nextOpen);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => handleOpenChange(true)}
      >
        <ScanLine className="size-4" />
        <span>Živé skenování</span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-black p-0 sm:max-w-none"
        >
          <ScanSessionContent labels={labels} onClose={() => handleOpenChange(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScanSessionContent({
  labels,
  onClose,
}: {
  labels: readonly LibraryLabelEntry[];
  onClose: () => void;
}) {
  const lookup = useMemo(() => buildLabelLookup(labels), [labels]);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [counts, setCounts] = useState<ScanCounts>({ paired: 0, unpaired: 0 });
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraTimedOut, setCameraTimedOut] = useState(false);

  const lastDetection = useRef<ScanDetection | null>(null);
  const countedCodes = useRef(new Set<number>());

  useEffect(() => {
    if (cameraReady) return;

    const timer = window.setTimeout(() => setCameraTimedOut(true), CAMERA_START_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [cameraReady]);

  const handleCapture = useCallback(
    (barcodes: DetectedBarcode[]) => {
      const rawValue = barcodes[0]?.rawValue;
      if (!rawValue) return;

      const now = Date.now();
      const isNewScan = shouldReportScan(lastDetection.current, rawValue, now);
      lastDetection.current = { key: rawValue, at: now };
      if (!isNewScan) return;

      const code = parseLibraryLabelCode(rawValue);
      if (code == null) {
        toast.warning('Tenhle QR kód není knihovní štítek');
        return;
      }

      const title = lookup.get(code) ?? null;
      setLastResult({ code, title });

      if (!countedCodes.current.has(code)) {
        countedCodes.current.add(code);
        setCounts((previous) =>
          title == null
            ? { ...previous, unpaired: previous.unpaired + 1 }
            : { ...previous, paired: previous.paired + 1 },
        );
      }

      if (title == null) {
        toast.warning(`Štítek ${formatLibraryLabelCode(code)} není přiřazený`);
      } else {
        toast.success(`Přiřazeno: ${formatLibraryLabelCode(code)} — ${title}`);
      }

      playScanFeedback(title == null ? 'unpaired' : 'paired');
    },
    [lookup],
  );

  const total = counts.paired + counts.unpaired;

  return (
    <div className="relative flex h-[100dvh] w-full flex-col bg-black">
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 text-white">
        <div className="min-w-0">
          <DialogTitle className="font-heading text-base font-bold">Živé skenování</DialogTitle>
          <DialogDescription className="text-xs text-white/70">
            Namiř kameru na QR štítek knihy, nemusíš nic mačkat
          </DialogDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Zavřít skenování"
          className="text-white hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-xs text-white">
        <ScanCounter label="Přiřazeno" value={counts.paired} testId="scan-count-paired" tone="paired" />
        <ScanCounter
          label="Nepřiřazeno"
          value={counts.unpaired}
          testId="scan-count-unpaired"
          tone="unpaired"
        />
        <ScanCounter label="Celkem" value={total} testId="scan-count-total" tone="neutral" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <BarcodeScanner
          options={QR_SCANNER_OPTIONS}
          onCapture={handleCapture}
          onPlaying={() => setCameraReady(true)}
          paused={false}
          aria-label="Náhled kamery pro skenování štítků"
        />

        {!cameraReady && !cameraTimedOut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
            <Spinner className="size-6" />
            <p className="text-sm text-white/70">Spouštím kameru…</p>
          </div>
        )}

        {cameraTimedOut && !cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
            <AlertTriangle className="size-8 text-warning" />
            <p className="max-w-sm text-sm">
              Kameru se nepodařilo spustit. Povol přístup ke kameře v nastavení prohlížeče a otevři
              skenování znovu.
            </p>
          </div>
        )}

        <ScanResultBanner result={lastResult} />
      </div>
    </div>
  );
}

function ScanCounter({
  label,
  value,
  testId,
  tone,
}: {
  label: string;
  value: number;
  testId: string;
  tone: 'paired' | 'unpaired' | 'neutral';
}) {
  const valueClassName =
    tone === 'paired' ? 'text-success' : tone === 'unpaired' ? 'text-warning' : 'text-white';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
      <span className="text-white/70">{label}</span>
      <strong data-testid={testId} className={`font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </strong>
    </span>
  );
}

function ScanResultBanner({ result }: { result: ScanResult | null }) {
  const paired = result != null && result.title != null;

  return (
    <div
      data-testid="scan-last-result"
      role="status"
      aria-live="polite"
      className="absolute inset-x-3 bottom-4 flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-lg"
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          result == null
            ? 'bg-muted text-muted-foreground'
            : paired
              ? 'bg-success/10 text-success-strong'
              : 'bg-warning/15 text-warning-strong'
        }`}
      >
        {result == null ? (
          <QrCode className="size-5" />
        ) : paired ? (
          <CheckCircle2 className="size-5" />
        ) : (
          <AlertTriangle className="size-5" />
        )}
      </div>
      {result == null ? (
        <p className="text-sm text-muted-foreground">Zatím nic naskenováno</p>
      ) : (
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold ${
              paired ? 'text-success-strong' : 'text-warning-strong'
            }`}
          >
            {paired ? 'Přiřazeno' : 'Nepřiřazeno'}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {formatLibraryLabelCode(result.code)}
            {result.title ? ` · ${result.title}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
