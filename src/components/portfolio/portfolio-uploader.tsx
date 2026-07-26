'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Download, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SUPPORTED_SHEETS = new Set(['Eseje']);

interface DetectedSheet { name: string; supported: boolean }

type Phase =
  | { name: 'idle' }
  | { name: 'selecting'; file: File; sheets: DetectedSheet[]; selected: Set<string> }
  | { name: 'loading' }
  | { name: 'done'; fileName: string; bookCount: number; blob: Blob };

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-14 cursor-pointer transition-colors ${
        dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.xlsx')) onFile(f); }}
    >
      <FileSpreadsheet className="size-10 text-muted-foreground" />
      <div className="text-center space-y-1">
        <p className="font-medium">Přetáhni své portfolio (.xlsx) sem</p>
        <p className="text-sm text-muted-foreground">nebo klikni a vyber soubor</p>
      </div>
      <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
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
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const wbXml = await zip.file('xl/workbook.xml')!.async('string');
      const parser = new DOMParser();
      const wbDoc = parser.parseFromString(wbXml, 'application/xml');
      const sheets: DetectedSheet[] = Array.from(wbDoc.querySelectorAll('sheet')).map((s) => ({
        name: s.getAttribute('name') ?? '',
        supported: SUPPORTED_SHEETS.has(s.getAttribute('name') ?? ''),
      }));
      const selected = new Set(sheets.filter((s) => s.supported).map((s) => s.name));
      setPhase({ name: 'selecting', file, sheets, selected });
    } catch {
      setError('Soubor se nepodařilo načíst. Ujisti se, že jde o platný .xlsx soubor.');
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (phase.name !== 'selecting') return;
    const { file } = phase;
    setPhase({ name: 'loading' });
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/portfolio/generate', { method: 'POST', body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Nepodařilo se vygenerovat soubor');
      }
      const blob = await res.blob();

      // Parse row count from response headers or estimate from blob size
      const countHeader = res.headers.get('X-Essay-Count');
      const bookCount = countHeader ? Number(countHeader) : 0;

      setPhase({ name: 'done', fileName: file.name, bookCount, blob });
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

  const reset = () => { setPhase({ name: 'idle' }); setError(null); };

  if (phase.name === 'idle') {
    return (
      <div className="space-y-3">
        <DropZone onFile={handleFile} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (phase.name === 'selecting') {
    const { sheets, selected, file } = phase;
    const supportedSheets = sheets.filter((s) => s.supported);

    const toggle = (name: string) => {
      setPhase((prev) => {
        if (prev.name !== 'selecting') return prev;
        const next = new Set(prev.selected);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return { ...prev, selected: next };
      });
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="size-4" /><span>{file.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}><X className="size-4 mr-1" />Zrušit</Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Listy, které Tappka umí vyplnit</p>
          {supportedSheets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
              V tomto souboru nebyl nalezen žádný podporovaný list.
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {supportedSheets.map((sheet) => (
                <div
                  key={sheet.name}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${selected.has(sheet.name) ? 'bg-primary/5' : ''}`}
                  onClick={() => toggle(sheet.name)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${selected.has(sheet.name) ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                      {selected.has(sheet.name) && (
                        <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current text-primary-foreground" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l3 3 5-6" /></svg>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{sheet.name}</span>
                      <p className="text-xs text-muted-foreground">Přepíše stávající obsah tohoto listu</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">Podporováno</Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground px-1">
            Ostatní listy v souboru zůstanou beze změny.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-medium">Před stažením zkontroluj výsledek</p>
          <p className="text-xs leading-relaxed">
            Data jsou přebírána z Tappka automaticky. Za správnost a úplnost obsahu odpovídáš ty — doporučujeme soubor před odevzdáním zkontrolovat.
          </p>
        </div>

        <Button onClick={handleGenerate} disabled={selected.size === 0} className="gap-2">
          Vyplnit portfolio <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  if (phase.name === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm">Generuji portfolio&hellip;</p>
      </div>
    );
  }

  // done
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <div className="space-y-1">
          <p className="font-heading font-semibold text-lg">Portfolio je připraveno</p>
          <p className="text-sm text-muted-foreground">
            List <span className="font-medium">Eseje</span> byl vyplněn daty z Tappka a naformátován.
            Ostatní listy zůstaly beze změny.
          </p>
        </div>
        <Button size="lg" onClick={handleDownload} className="gap-2 mt-1">
          <Download className="size-4" /> Stáhnout {phase.fileName}
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
          <Upload className="size-3.5 mr-1.5" /> Nahrát jiný soubor
        </Button>
      </div>
    </div>
  );
}
