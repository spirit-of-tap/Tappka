'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import {
  validateContactInput,
  type ContactField,
  type ContactValues,
} from '@/lib/profile/contact-validation';

type FieldErrors = Partial<Record<ContactField, string>>;

interface ContactEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workEmail: string;
  initialValues: ContactValues;
}

export function ContactEditDialog({ open, onOpenChange, workEmail, initialValues }: ContactEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upravit kontakt</DialogTitle>
          <DialogDescription>Údaje se zobrazí na tvém profilu všem v Tappce.</DialogDescription>
        </DialogHeader>
        {/* Mounting the form only while open resets the draft every time the dialog opens. */}
        {open && (
          <ContactEditForm workEmail={workEmail} initialValues={initialValues} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ContactEditFormProps {
  workEmail: string;
  initialValues: ContactValues;
  onDone: () => void;
}

function ContactEditForm({ workEmail, initialValues, onDone }: ContactEditFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    phone_number: initialValues.phone_number ?? '',
    personal_email: initialValues.personal_email ?? '',
    date_of_birth: initialValues.date_of_birth ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const setField = (field: ContactField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateContactInput(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.value),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.fieldErrors) setErrors(data.fieldErrors as FieldErrors);
        toast.error(typeof data?.error === 'string' && data.error.length > 0 ? data.error : 'Nepodařilo se uložit kontakt.');
        return;
      }
      toast.success('Kontakt byl uložen.');
      onDone();
      router.refresh();
    } catch {
      toast.error('Nepodařilo se připojit k serveru.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
      <Field>
        <FieldLabel htmlFor="contact-work-email">Školní e-mail</FieldLabel>
        <Input id="contact-work-email" value={workEmail} readOnly disabled />
        <FieldDescription>Slouží k přihlášení, proto ho tady změnit nejde. S jeho změnou pomůže správa Tappky.</FieldDescription>
      </Field>

      <Field data-invalid={errors.phone_number ? true : undefined}>
        <FieldLabel htmlFor="contact-phone">Telefon</FieldLabel>
        <Input
          id="contact-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+420 777 123 456"
          value={values.phone_number}
          onChange={(event) => setField('phone_number', event.target.value)}
          aria-invalid={errors.phone_number ? true : undefined}
        />
        {errors.phone_number && <FieldError>{errors.phone_number}</FieldError>}
      </Field>

      <Field data-invalid={errors.personal_email ? true : undefined}>
        <FieldLabel htmlFor="contact-personal-email">Osobní e-mail</FieldLabel>
        <Input
          id="contact-personal-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="jmeno@gmail.com"
          value={values.personal_email}
          onChange={(event) => setField('personal_email', event.target.value)}
          aria-invalid={errors.personal_email ? true : undefined}
        />
        {errors.personal_email && <FieldError>{errors.personal_email}</FieldError>}
      </Field>

      <Field data-invalid={errors.date_of_birth ? true : undefined}>
        <FieldLabel htmlFor="contact-birthday">Narozeniny</FieldLabel>
        <Input
          id="contact-birthday"
          type="date"
          autoComplete="bday"
          value={values.date_of_birth}
          onChange={(event) => setField('date_of_birth', event.target.value)}
          aria-invalid={errors.date_of_birth ? true : undefined}
        />
        {errors.date_of_birth && <FieldError>{errors.date_of_birth}</FieldError>}
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Zrušit
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner className="size-4" />}
          Uložit
        </Button>
      </DialogFooter>
    </form>
  );
}
