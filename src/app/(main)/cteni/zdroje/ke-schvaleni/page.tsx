import { redirect } from 'next/navigation';

export default async function ZdrojeKeSchvaleniPage() {
  redirect('/cteni/sprava?tab=processing&sub=sources');
}
