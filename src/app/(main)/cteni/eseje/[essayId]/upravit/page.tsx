import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';
import { PageShell } from '@/components/ui/page-shell';
import { BackButton } from '@/components/essays/back-button';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';

interface PageProps {
  params: Promise<{ essayId: string }>;
}

export default async function EssayEditPage({ params }: PageProps) {
  const { essayId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  const essay = await getEssayById(supabase, essayId);

  if (!essay) notFound();
  if (essay.author_profile_id !== profile?.id) redirect(`/cteni/eseje/${essayId}`);

  const isDraft = essay.published_at == null;

  return (
    <PageShell size="narrow">
      <BackButton />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{isDraft ? 'Koncept' : 'Upravit esej'}</h1>
        {isDraft && (
          <p className="text-sm text-muted-foreground">
            Rozepsaná esej. Uvidíš ji jenom ty, dokud ji nezveřejníš.
          </p>
        )}
      </div>
      <EssayEditorForm initialEssay={essay} />
    </PageShell>
  );
}