'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type Chamado = {
  id: number;
  numero: number;
  incendio: string;
  status: string;
  prioridade: string;
  tipo: string;
  hdm_responsavel: string | null;
  time_abertura: string | null;
  trava: boolean;
  created_at: string;
  primeiro_topico_responsavel_nome: string | null;
  primeiro_topico_time_responsavel: string | null;
};

const COLS: { status: string; label: string }[] = [
  { status: 'nao_iniciado', label: 'Não iniciados' },
  { status: 'em_andamento', label: 'Em andamento' },
  { status: 'concluido', label: 'Concluídos' },
];

export function KanbanBoard({ chamados }: { chamados: Chamado[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipo = (searchParams.get('tipo') || 'todos') as 'todos' | 'padrao' | 'hdm';

  function setFiltroTipo(value: 'todos' | 'padrao' | 'hdm') {
    const p = new URLSearchParams(searchParams.toString());
    if (value === 'todos') p.delete('tipo');
    else p.set('tipo', value);
    router.push(`/sirene/kanban?${p.toString()}`);
  }

  const byStatus = (status: string) => chamados.filter((c) => c.status === status);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-stone-400">Tipo:</span>
        <select
          value={tipo}
          onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'padrao' | 'hdm')}
          className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-sm text-stone-200"
        >
          <option value="todos">Todos</option>
          <option value="padrao">Padrão</option>
          <option value="hdm">HDM</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLS.map((col) => (
          <div key={col.status} className="rounded-xl border border-stone-700 bg-stone-800/60 p-3">
            <h2 className="mb-3 text-sm font-semibold text-stone-200">{col.label}</h2>
            <div className="space-y-2">
              {byStatus(col.status).map((c) => (
                <Link
                  key={c.id}
                  href={`/sirene/${c.id}`}
                  className={`block rounded-lg border bg-stone-800/80 p-3 shadow-sm transition hover:bg-stone-700/80 ${
                    c.tipo === 'hdm'
                      ? 'border-l-4 border-stone-700 border-l-[#1e3a5f]'
                      : 'border-l-4 border-stone-700 border-l-red-500'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-white">#{c.numero}</span>
                    {c.tipo === 'hdm' && c.hdm_responsavel && (
                      <span className="rounded bg-[#1e3a5f] px-1.5 py-0.5 text-xs font-medium text-white">
                        HDM — {c.hdm_responsavel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-stone-300">{c.incendio}</p>
                  {(c.primeiro_topico_responsavel_nome || c.primeiro_topico_time_responsavel) && (
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {[c.primeiro_topico_responsavel_nome, c.primeiro_topico_time_responsavel]
                        .filter((x) => x != null && String(x).trim() !== '')
                        .join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-stone-500">{c.prioridade}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
