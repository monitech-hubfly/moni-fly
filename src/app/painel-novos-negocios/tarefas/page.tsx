import Link from 'next/link';
import { TarefasPainelConteudo } from '@/app/steps-viabilidade/tarefas/TarefasPainelConteudo';

export default async function PainelTarefasPage() {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/painel-novos-negocios?tab=painel" className="text-moni-primary hover:underline">
            ← Portfolio + Operações (aba Painel)
          </Link>
          <span className="text-stone-400">/</span>
          <span className="font-medium text-stone-700">Painel de Chamados</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-2 text-xl font-bold text-stone-900">Painel de Chamados</h1>
        <p className="mb-4 text-sm text-stone-600">
          Chamados dos kanbans em um só lugar. Filtre por status, tipo, kanban, time, responsável e SLA.
        </p>
        <TarefasPainelConteudo basePath="/painel-novos-negocios" />
      </main>
    </div>
  );
}
