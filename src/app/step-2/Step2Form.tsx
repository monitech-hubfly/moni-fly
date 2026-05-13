'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Processo = {
  id: string;
  cidade: string | null;
  estado: string | null;
  status: string | null;
  etapa_atual: number | null;
  updated_at: string | null;
};

export function Step2Form({ processos }: { processos: Processo[] }) {
  const router = useRouter();
  const [processoId, setProcessoId] = useState('');
  const [error, setError] = useState('');

  const handleContinuar = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!processoId.trim()) {
      setError('Selecione um processo Step 1.');
      return;
    }
    router.push(`/step-2/${processoId}`);
    router.refresh();
  };

  if (!processos.length) {
    return (
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Nenhum estudo Step 1 finalizado ainda.</p>
        <p className="mt-2">
          Conclua as etapas 1 a 5 no Step 1 e use <strong>Finalizar estudo</strong> na etapa 5. Só
          estudos finalizados podem ser usados no Step 2.
        </p>
        <Link
          href="/step-one"
          className="mt-3 inline-block font-medium text-moni-accent hover:underline"
        >
          Ir para Step 1 →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleContinuar} className="mt-8 space-y-4">
      <div>
        <label htmlFor="processo" className="block text-sm font-medium text-stone-700">
          Processo (Step 1) *
        </label>
        <select
          id="processo"
          value={processoId}
          onChange={(e) => setProcessoId(e.target.value)}
          className="mt-1 w-full max-w-[280px] rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
          required
        >
          <option value="">— Selecione o processo —</option>
          {processos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.cidade ?? 'Sem cidade'}
              {p.estado ? `, ${p.estado}` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-500">
          Selecione qual Step 1 (banco de informações) deseja utilizar. A listagem de casas e de
          lotes desse processo será usada no estudo; em seguida você fará a escolha do lote, dos 3
          modelos, batalha, BCA e PDF.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="pt-4">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          Continuar para estudo de viabilidade
        </button>
      </div>
    </form>
  );
}
