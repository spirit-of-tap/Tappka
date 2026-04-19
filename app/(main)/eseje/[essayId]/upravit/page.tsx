import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';
import { Button } from '@/components/ui/button';
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
  if (essay.author_profile_id !== profile?.id) redirect(`/eseje/${essayId}`);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      <Button variant="ghost" asChild className="gap-2">
        <Link href={`/eseje/${essayId}`}>
          <ArrowLeft className="size-4" />
          Zpět na esej
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Upravit esej</h1>
      </div>
      <EssayEditorForm initialEssay={essay} />
    </div>
  );
}
