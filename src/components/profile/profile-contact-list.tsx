'use client';

import { useEffect, useRef, useState } from 'react';
import { Cake, Check, Copy, Mail, Phone, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '@/lib/utils/clipboard';

/** How long the copy button shows its "copied" checkmark. */
const COPIED_FEEDBACK_MS = 2000;

interface ProfileContactListProps {
  workEmail: string;
  personalEmail: string | null;
  phoneNumber: string | null;
  /** Pre-formatted on the server so it hydrates identically. */
  birthday: string | null;
}

export function ProfileContactList({
  workEmail,
  personalEmail,
  phoneNumber,
  birthday,
}: ProfileContactListProps) {
  return (
    <section aria-label="Kontakt" className="grid gap-2 sm:grid-cols-2">
      <ContactRow icon={Mail} label="Školní e-mail" value={workEmail} href={`mailto:${workEmail}`} copyable />
      {personalEmail && (
        <ContactRow icon={Mail} label="Osobní e-mail" value={personalEmail} href={`mailto:${personalEmail}`} copyable />
      )}
      {phoneNumber && (
        <ContactRow
          icon={Phone}
          label="Telefon"
          value={phoneNumber}
          href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
          copyable
          callable
        />
      )}
      {birthday && <ContactRow icon={Cake} label="Narozeniny" value={birthday} />}
    </section>
  );
}

interface ContactRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  copyable?: boolean;
  /** Show a prominent tap-to-call button on mobile. */
  callable?: boolean;
}

function ContactRow({ icon: Icon, label, value, href, copyable, callable }: ContactRowProps) {
  const valueClassName = 'block truncate text-sm font-medium text-foreground';

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} className={`${valueClassName} focus-ring rounded-sm hover:text-primary hover:underline underline-offset-4`}>
            {value}
          </a>
        ) : (
          <span className={valueClassName}>{value}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {callable && href && (
          <Button asChild size="sm" className="md:hidden">
            <a href={href}>
              <Phone />
              Zavolat
            </a>
          </Button>
        )}
        {copyable && <CopyButton value={value} label={label} />}
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(value);
      toast.success(`${label} zkopírován do schránky`);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error('Kopírování se nezdařilo');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      aria-label={`Zkopírovat ${label.toLowerCase()}`}
      className="text-muted-foreground"
    >
      {copied ? <Check className="text-success-strong" /> : <Copy />}
    </Button>
  );
}
