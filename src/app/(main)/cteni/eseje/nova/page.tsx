import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';
import { PageShell } from '@/components/ui/page-shell';

export default async function NovaEsejPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  return (
    <PageShell size="wide">
      {/* The visible document title is the editor's own title field, so the
          page heading only needs to exist for assistive technology. */}
      <h1 className="sr-only">Napsat esej</h1>
      <EssayEditorForm profileId={profile?.id} />
    </PageShell>
  );
}
