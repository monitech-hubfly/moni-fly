import { DashboardNovosNegociosClient } from './DashboardNovosNegociosClient';

export default async function DashboardNovosNegociosPage() {
  return (
    <div className="min-h-screen bg-white text-stone-900">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <DashboardNovosNegociosClient />
      </main>
    </div>
  );
}
