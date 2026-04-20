'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Download, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EsejeTable } from './sheets/eseje-table';
import { fillEsejeSheetZip } from '@/lib/portfolio/fill-eseje';
import type { PortfolioEsejeRow } from '@/lib/portfolio/types';

const SUPPORTED_SHEETS: Record<string, string> = {
  Eseje: 'Eseje',
};

interface DetectedSheet {
  name: string;
  supported: boolean;
}

type Phase =
  | { name: 'idle' }
  | { name: 'selecting'; fileName: string; sheets: DetectedSheet[]; selected: Set<string>; buffer: ArrayBuffer }
  | { name: 'loading' }
  | { name: 'done'; fileName: string; rows: PortfolioEsejeRow[]; blob: Blob };

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-14 cursor-pointer transition-colors ${
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file?.name.endsWith('.xlsx')) onFile(file);
      }}
    >
      <FileSpreadsheet className="size-10 text-muted-foreground" />
      <div className="text-center space-y-1">
        <p className="font-medium">Přetáhni své portfolio (.xlsx) sem</p>
        <p className="text-sm text-muted-foreground">nebo klikni a vyber soubor</p>
      </div>
      <input
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

export function PortfolioUploader() {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const JSZip = (await import('jszip')).default;
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      // Detect sheet names from workbook.xml
      const wbXml = await zip.file('xl/workbook.xml')!.async('string');
      const parser = new DOMParser();
      const wbDoc = parser.parseFromString(wbXml, 'application/xml');
      const sheetNames = Array.from(wbDoc.querySelectorAll('sheet')).map(
        (s) => s.getAttribute('name') ?? ''
      );

      const sheets: DetectedSheet[] = sheetNames.map((name) => ({
        name,
        supported: name in SUPPORTED_SHEETS,
      }));

      const selected = new Set(sheets.filter((s) => s.supported).map((s) => s.name));
      setPhase({ name: 'selecting', fileName: file.name, sheets, selected, buffer });
    } catch {
      setError('Soubor se nepodařilo načíst. Ujisti se, že jde o platný .xlsx soubor.');
    }
  }, []);

  const handleFill = useCallback(async () => {
    if (phase.name !== 'selecting') return;
    const { buffer, fileName } = phase;

    setPhase({ name: 'loading' });
    setError(null);

    try {
      const res = await fetch('/api/portfolio/data');
      if (!res.ok) throw new Error('Nepodařilo se načíst data');
      const { rows: rawRows } = await res.json() as { rows: Omit<PortfolioEsejeRow, 'essayUrl'>[] };

      const origin = window.location.origin;
      const rows: PortfolioEsejeRow[] = rawRows.map((r) => ({
        ...r,
        essayUrl: `${origin}/eseje/${r.essayId}`,
      }));

      const blob = await fillEsejeSheetZip(buffer, rows);
      setPhase({ name: 'done', fileName, rows, blob });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neočekávaná chyba');
      setPhase({ name: 'idle' });
    }
  }, [phase]);

  const handleDownload = useCallback(() => {
    if (phase.name !== 'done') return;
    const url = URL.createObjectURL(phase.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = phase.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [phase]);

  const reset = () => {
    setPhase({ name: 'idle' });
    setError(null);
  };

  if (phase.name === 'idle') {
    return (
      <div className="space-y-3">
        <DropZone onFile={handleFile} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (phase.name === 'selecting') {
    const { sheets, selected, fileName } = phase;

    const toggle = (name: string) => {
      if (!(name in SUPPORTED_SHEETS)) return;
      setPhase((prev) => {
        if (prev.name !== 'selecting') return prev;
        const next = new Set(prev.selected);
        next.has(name) ? next.delete(name) : next.add(name);
        return { ...prev, selected: next };
      });
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="size-4" />
            <span>{fileName}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-4 mr-1" /> Zrušit
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Listy k vyplnění</p>
          <div className="rounded-lg border divide-y">
            {sheets.map((sheet) => (
              <div
                key={sheet.name}
                className={`flex items-center justify-between px-4 py-3 transition-colors ${
                  sheet.supported
                    ? `cursor-pointer hover:bg-muted/40 ${selected.has(sheet.name) ? 'bg-primary/5' : ''}`
                    : 'opacity-40'
                }`}
                onClick={() => toggle(sheet.name)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                      selected.has(sheet.name) ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {selected.has(sheet.name) && (
                      <svg
                        viewBox="0 0 10 8"
                        className="size-2.5 fill-none stroke-current text-primary-foreground"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 4l3 3 5-6" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-sm">{sheet.name}</span>
                </div>
                {sheet.supported ? (
                  <Badge variant="secondary" className="text-xs">Podporováno</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Brzy</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleFill} disabled={selected.size === 0} className="gap-2">
          Vyplnit portfolio
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  if (phase.name === 'loading') {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Načítám data&hellip;
      </div>
    );
  }

  // done
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="size-4" />
          <span>{phase.fileName}</span>
          <Badge variant="secondary" className="text-xs">Vyplněno</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <Upload className="size-4 mr-1.5" /> Jiný soubor
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="size-4 mr-1.5" /> Stáhnout Excel
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Eseje</h2>
        {phase.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Zatím nemáš žádné eseje s přiřazenou knihou z katalogu.
          </p>
        ) : (
          <EsejeTable rows={phase.rows} />
        )}
      </div>
    </div>
  );
}
