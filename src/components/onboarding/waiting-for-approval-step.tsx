"use client";

import { Clock, Mail } from "lucide-react";

interface WaitingForApprovalStepProps {
  verifiedEmail?: string | null;
}

/**
 * Waiting screen shown when a user has verified their CZU email
 * but no matching profile exists in the system yet.
 *
 * This happens for alumni, late additions, or anyone whose profile
 * hasn't been pre-created by an admin. The ProfileLinkRealtimeListener
 * (rendered by the parent) will auto-redirect the user to the dashboard
 * the moment an admin creates and links their profile.
 */
export function WaitingForApprovalStep({
  verifiedEmail,
}: WaitingForApprovalStepProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="rounded-full bg-primary/10 p-4">
            <Clock className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Čekáme na schválení
        </h1>
        <p className="text-sm text-muted-foreground">
          Tvůj email je ověřený, ale tvůj profil zatím není v systému.
          Musíme ti ho přidat ručně.
        </p>
      </div>

      {/* Verified email display */}
      {verifiedEmail && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Ověřený email</p>
              <p className="text-sm font-medium">{verifiedEmail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin contacts */}
      <div className="space-y-3">
        <p className="text-sm font-medium">
          Pokud si myslíš, že do systému patříš, ozvi se nám:
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>Ondřej Schlossár</li>
          <li>Ondřej Kulhavý</li>
          <li>Tomáš Protiva</li>
          <li>Marie Machytková</li>
        </ul>
      </div>

      {/* Auto-redirect notice */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
          <p className="text-sm text-muted-foreground">
            Jakmile tě přidáme, automaticky tě přesměrujeme. Tuhle stránku klidně nech otevřenou.
          </p>
        </div>
      </div>
    </div>
  );
}
