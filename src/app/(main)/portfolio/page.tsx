import { PortfolioUploader } from '@/components/portfolio/portfolio-uploader';

export default function PortfolioPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">Nahraj své portfolio (.xlsx) a zobraz přehled svých aktivit</p>
      </div>
      <PortfolioUploader />
    </div>
  );
}
