"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Check,
  RefreshCcw,
  Trash2,
  Lock,
  AlertTriangle,
  Wrench,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/responsive-alert-dialog";
import { ISSUE_TYPE_LABELS, type RoomIssue, type IssueType } from "@/lib/reservations/types";

interface IssuesManagerProps {
  issues: (RoomIssue & {
    room?: { id: string; code: string; name: string };
    reporter?: { id: string; name: string };
    resolver?: { id: string; name: string };
  })[];
  isAdmin?: boolean;
}

const ISSUE_ICONS: Record<IssueType, typeof Lock> = {
  locked: Lock,
  mess: AlertTriangle,
  technical: Wrench,
  other: HelpCircle,
};

/**
 * Component for managing room issues (for coaches/admins)
 */
export function IssuesManager({ issues, isAdmin = false }: IssuesManagerProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleResolve = async (issueId: string) => {
    setLoadingId(issueId);
    try {
      const response = await fetch(`/api/room-issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Nepodařilo se vyřešit problém");
        return;
      }

      toast.success("Problém vyřešen");
      router.refresh();
    } catch (error) {
      toast.error("Něco se pokazilo");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReopen = async (issueId: string) => {
    setLoadingId(issueId);
    try {
      const response = await fetch(`/api/room-issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Nepodařilo se znovu otevřít problém");
        return;
      }

      toast.success("Problém znovu otevřen");
      router.refresh();
    } catch (error) {
      toast.error("Něco se pokazilo");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (issueId: string) => {
    setLoadingId(issueId);
    try {
      const response = await fetch(`/api/room-issues/${issueId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Nepodařilo se smazat problém");
        return;
      }

      toast.success("Problém smazán");
      router.refresh();
    } catch (error) {
      toast.error("Něco se pokazilo");
    } finally {
      setLoadingId(null);
    }
  };

  const openIssues = issues.filter((i) => i.status === "open");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");

  return (
    <div className="space-y-6">
      {/* Open issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="size-5 text-orange-500" />
            Otevřené problémy ({openIssues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openIssues.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Žádné otevřené problémy
            </p>
          ) : (
            <div className="space-y-3">
              {openIssues.map((issue) => (
                <IssueItem
                  key={issue.id}
                  issue={issue}
                  isLoading={loadingId === issue.id}
                  onResolve={() => handleResolve(issue.id)}
                  onDelete={isAdmin ? () => handleDelete(issue.id) : undefined}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolved issues */}
      {resolvedIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Check className="size-5 text-green-500" />
              Vyřešené problémy ({resolvedIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolvedIssues.map((issue) => (
                <IssueItem
                  key={issue.id}
                  issue={issue}
                  isLoading={loadingId === issue.id}
                  onReopen={() => handleReopen(issue.id)}
                  onDelete={isAdmin ? () => handleDelete(issue.id) : undefined}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface IssueItemProps {
  issue: RoomIssue & {
    room?: { id: string; code: string; name: string };
    reporter?: { id: string; name: string };
    resolver?: { id: string; name: string };
  };
  isLoading: boolean;
  onResolve?: () => void;
  onReopen?: () => void;
  onDelete?: () => void;
}

function IssueItem({ issue, isLoading, onResolve, onReopen, onDelete }: IssueItemProps) {
  const Icon = ISSUE_ICONS[issue.issue_type];
  const isOpen = issue.status === "open";

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-lg border bg-card">
      <div className={`p-2 rounded-lg flex-shrink-0 ${isOpen ? "bg-orange-100 dark:bg-orange-950/50" : "bg-green-100 dark:bg-green-950/50"}`}>
        <Icon className={`size-4 ${isOpen ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-medium text-sm sm:text-base">{issue.room?.name || "Místnost"}</span>
          <Badge variant={isOpen ? "destructive" : "default"} className="text-xs">
            {ISSUE_TYPE_LABELS[issue.issue_type]}
          </Badge>
        </div>

        {issue.description && (
          <p className="text-sm text-muted-foreground mb-1">{issue.description}</p>
        )}

        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            Nahlášeno: {format(new Date(issue.created_at), "d.M.yyyy HH:mm", { locale: cs })}
            {issue.reporter && ` (${issue.reporter.name})`}
          </p>
          {issue.resolved_at && (
            <p>
              Vyřešeno: {format(new Date(issue.resolved_at), "d.M.yyyy HH:mm", { locale: cs })}
              {issue.resolver && ` (${issue.resolver.name})`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-start">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            {onResolve && (
              <Button variant="ghost" size="icon-sm" onClick={onResolve} title="Označit jako vyřešené">
                <Check className="size-4 text-green-600" />
              </Button>
            )}
            {onReopen && (
              <Button variant="ghost" size="icon-sm" onClick={onReopen} title="Znovu otevřít">
                <RefreshCcw className="size-4" />
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm" title="Smazat">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Smazat problém?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tato akce nelze vrátit zpět. Problém bude trvale smazán.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Smazat</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>
    </div>
  );
}
