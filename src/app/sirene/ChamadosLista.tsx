'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ModalNovoChamado } from './ModalNovoChamado';
import { formatarStatus } from '@/lib/sirene';

type Chamado = {
  id: number;
  numero: number;
  incendio: string;
  status: string;
  prioridade: string;
  tipo: string;
  hdm_responsavel: string | null;
  time_abertura: string | null;
  abertura_responsavel_nome: string | null;
  trava: boolean;
  created_at: string;
  primeiro_topico_responsavel_nome: string | null;
  primeiro_topico_time_responsavel: string | null;
};

export function ChamadosLista({ chamados }: { chamados: Chamado[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipo = (searchParams.get('tipo') || 'todos') as 'todos' | 'padrao' | 'hdm';
  const [modalAberto, setModalAberto] = useState(false);

  function setFiltroTipo(value: 'todos' | 'padrao' | 'hdm') {
    const p = new URLSearchParams(searchParams.toString());
    if (value === 'todos') p.delete('tipo');
    else p.set('tipo', value);
    router.push(`/sirene/chamados?${p.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Novo chamado
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {chamados.length === 0 ? (
          <li className="rounded-xl border border-stone-700 bg-stone-800/80 p-6 text-center text-stone-500">
            Nenhum chamado encontrado.
          </li>
        ) : (
          chamados.map((c) => (
            <li key={c.id}>
              <Link
                href={`/sirene/${c.id}`}
                className={`block rounded-xl border bg-stone-800/80 p-4 shadow-sm transition hover:bg-stone-700/80 ${
                  c.tipo === 'hdm'
                    ? 'border-l-4 border-stone-700 border-l-[#1e3a5f]'
                    : 'border-l-4 border-stone-700 border-l-red-500'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">#{c.numero}</span>
                      {c.time_abertura && (
                        <span className="text-sm text-stone-400">
                          {c.time_abertura}
                          {c.abertura_responsavel_nome
                            ? ` · ${c.abertura_responsavel_nome}`
                            : ''}
                        </span>
                      )}
                      {c.tipo === 'hdm' && c.hdm_responsavel && (
                        <span className="rounded bg-[#1e3a5f] px-2 py-0.5 text-xs font-medium text-white">
                          HDM — {c.hdm_responsavel}
                        </span>
                      )}
                      <span className="rounded bg-stone-600 px-2 py-0.5 text-xs text-stone-200">
                        {formatarStatus(c.status as 'nao_iniciado' | 'em_andamento' | 'concluido')}
                      </span>
                      <span className="text-xs text-stone-400">{c.prioridade}</span>
                      {c.trava && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                          Trava
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
                  </div>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>

      {modalAberto && (
        <ModalNovoChamado
          onClose={() => setModalAberto(false)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
