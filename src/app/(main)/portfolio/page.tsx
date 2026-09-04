import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { PortfolioUploader } from '@/components/portfolio/portfolio-uploader';

export const metadata = {
  title: 'Portfolio',
  description: 'Nahraj své portfolio (.xlsx) a prohlížej si přehled svých aktivit',
};

export default function PortfolioPage() {
  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Portfolio"
        description="Nahraj své portfolio (.xlsx) a prohlížej si přehled svých aktivit"
      />
      <PortfolioUploader />
    </PageShell>
  );
}
