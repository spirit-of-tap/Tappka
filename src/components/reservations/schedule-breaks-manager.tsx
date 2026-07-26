"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ScheduleBreak } from "@/lib/reservations/types";

interface ScheduleBreaksManagerProps {
  breaks: ScheduleBreak[];
}

/**
 * Manager component for schedule breaks (Days of Joy, holidays, etc.)
 */
export function ScheduleBreaksManager({ breaks }: ScheduleBreaksManagerProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  /** Resets the add-break form fields back to their initial empty state. */
  const resetForm = () => {
    setName("");
    setStartDate(undefined);
    setEndDate(undefined);
    setError(null);
  };

  /** Validates and submits a new schedule break via POST /api/schedule-breaks. */
  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!name.trim() || !startDate || !endDate) {
      setError("Vyplň všechna pole");
      return;
    }

    if (startDate > endDate) {
      setError("Datum konce musí být po datu začátku");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/schedule-breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se vytvořit výjimku");
      }

      toast.success("Výjimka vytvořena");
      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  /** Asks for confirmation and deletes the given schedule break via DELETE /api/schedule-breaks/:id. */
  const handleDelete = async (breakId: string) => {
    if (!confirm("Opravdu chceš smazat tuto výjimku?")) return;

    try {
      const response = await fetch(`/api/schedule-breaks/${breakId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se smazat výjimku");
      }

      toast.success("Výjimka smazána");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    }
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !event.metaKey) {
      return;
    }

    event.preventDefault();

    if (isLoading) {
      return;
    }

    void handleSubmit();
  };

  return (
    <div className="space-y-6">
      {/* Add button */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4 mr-2" />
            Přidat výjimku
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nová výjimka z rozvrhu</DialogTitle>
            <DialogDescription>
              Během této doby se nebudou konat Training Sessions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Název</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="např. Days of Joy - Jaro 2026"
              />
            </div>

            {/* Start date */}
            <div className="space-y-2">
              <Label>Od</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: cs }) : "Vyber datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End date */}
            <div className="space-y-2">
              <Label>Do</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: cs }) : "Vyber datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
              {isLoading ? "Vytvářím..." : "Vytvořit výjimku"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List of existing breaks */}
      {breaks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Žádné výjimky</p>
      ) : (
        <div className="space-y-2">
          {breaks.map((breakItem) => (
            <div
              key={breakItem.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card gap-3"
            >
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="font-medium text-sm sm:text-base">{breakItem.name}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {format(new Date(breakItem.start_date), "d.M.yyyy")} - {format(new Date(breakItem.end_date), "d.M.yyyy")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(breakItem.id)}
                className="text-destructive hover:text-destructive self-end sm:self-auto"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
