'use client';

import Link from 'next/link';
import { useState, useTransition, useEffect } from 'react';
import {
  listChamadosParaVincularPericia,
  listPericias,
  listPericiasComChamados,
  vincularChamadoPericia,
} from '../actions';

type ChamadoPendente = {
  id: number;
  numero: number;
  incendio: string;
  tema: string | null;
  mapeamento_pericia: string | null;
};

type Pericia = {
  id: number;
  nome_pericia: string;
  time_responsavel: string | null;
  responsavel_nome: string | null;
  data_inicio: string | null;
  status: string;
};

type PericiaComChamados = Pericia & {
  chamados: Array<{ id: number; numero: number; incendio: string }>;
};

export function PericiasConteudo({
  chamadosPendentesInicial,
  periciasPlanejamentoInicial,
}: {
  chamadosPendentesInicial: ChamadoPendente[];
  periciasPlanejamentoInicial: PericiaComChamados[];
}) {
  const [chamadosPendentes, setChamadosPendentes] = useState(chamadosPendentesInicial);
  const [periciasPlanejamento, setPericiasPlanejamento] = useState(periciasPlanejamentoInicial);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroTime, setFiltroTime] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [isPending, startTransition] = useTransition();

  const recarregar = () => {
    startTransition(async () => {
      const [r1, r2] = await Promise.all([
        listChamadosParaVincularPericia(),
        listPericiasComChamados({
          nome: filtroNome || undefined,
          time: filtroTime || undefined,
          status: filtroStatus || undefined,
        }),
      ]);
      if (r1.ok) setChamadosPendentes(r1.chamados);
      if (r2.ok) setPericiasPlanejamento(r2.pericias);
    });
  };

  useEffect(() => {
    if (!filtroNome && !filtroTime && !filtroStatus) return;
    const t = setTimeout(() => {
      listPericiasComChamados({
        nome: filtroNome || undefined,
        time: filtroTime || undefined,
        status: filtroStatus || undefined,
      }).then((r) => r.ok && setPericiasPlanejamento(r.pericias));
    }, 300);
    return () => clearTimeout(t);
  }, [filtroNome, filtroTime, filtroStatus]);

  return (
    <div className="mt-6 space-y-8">
      {/* Chamados aguardando vinculação */}
      <section className="rounded-xl border border-stone-700 bg-stone-800/60 p-5">
        <h2 className="text-lg font-semibold text-stone-100">Chamados aguardando vinculação</h2>
        <p className="mt-1 text-sm text-stone-400">
          Chamados com tema e mapeamento preenchidos pelo Bombeiro. Escolha o nome da perícia para
          vincular (dados do planejamento serão usados).
        </p>
        {chamadosPendentes.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Nenhum chamado aguardando vinculação.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {chamadosPendentes.map((c) => (
              <li key={c.id}>
                <VincularPericiaRow
                  chamado={c}
                  onVinculado={recarregar}
                  isPending={isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Planejamento: perícias e chamados vinculados */}
      <section className="rounded-xl border border-stone-700 bg-stone-800/60 p-5">
        <h2 className="text-lg font-semibold text-stone-100">Planejamento de perícias</h2>
        <p className="mt-1 text-sm text-stone-400">
          Filtre por nome, time ou status e veja os chamados vinculados a cada perícia.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Nome da perícia"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-sm text-stone-100"
          />
          <input
            type="text"
            placeholder="Time responsável"
            value={filtroTime}
            onChange={(e) => setFiltroTime(e.target.value)}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-sm text-stone-100"
          />
          <input
            type="text"
            placeholder="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-sm text-stone-100"
          />
          <button
            type="button"
            onClick={recarregar}
            disabled={isPending}
            className="rounded-lg bg-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-500 disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
        <ul className="mt-4 space-y-4">
          {periciasPlanejamento.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-stone-600 bg-stone-900/80 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-stone-200">{p.nome_pericia}</span>
                {p.time_responsavel && (
                  <span className="rounded bg-stone-600 px-1.5 py-0.5 text-xs text-stone-300">
                    {p.time_responsavel}
                  </span>
                )}
                {p.responsavel_nome && (
                  <span className="text-xs text-stone-500">{p.responsavel_nome}</span>
                )}
                {p.data_inicio && (
                  <span className="text-xs text-stone-500">Início: {p.data_inicio}</span>
                )}
                <span className="rounded bg-stone-600 px-1.5 py-0.5 text-xs text-stone-400">
                  {p.status}
                </span>
              </div>
              {p.chamados.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {p.chamados.map((ch) => (
                    <li key={ch.id}>
                      <Link
                        href={`/sirene/${ch.id}`}
                        className="text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        #{ch.numero} — {ch.incendio}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-stone-500">Nenhum chamado vinculado.</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function VincularPericiaRow({
  chamado,
  onVinculado,
  isPending,
}: {
  chamado: ChamadoPendente;
  onVinculado: () => void;
  isPending: boolean;
}) {
  const [pericias, setPericias] = useState<Pericia[]>([]);
  const [busca, setBusca] = useState('');
  const [periciaId, setPericiaId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listPericias(busca || undefined).then((r) => r.ok && setPericias(r.pericias));
  }, [busca]);

  const handleVincular = () => {
    if (!periciaId) {
      setErro('Selecione uma perícia.');
      return;
    }
    setErro(null);
    vincularChamadoPericia(chamado.id, periciaId).then((r) => {
      if (!r.ok) setErro(r.error);
      else onVinculado();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-600 bg-stone-900/80 p-3">
      <div className="min-w-0 flex-1">
        <Link href={`/sirene/${chamado.id}`} className="font-medium text-white hover:underline">
          #{chamado.numero} — {chamado.incendio}
        </Link>
        {chamado.tema && (
          <p className="mt-0.5 truncate text-xs text-stone-500">Tema: {chamado.tema}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar perícia..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-48 rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
        />
        <select
          value={periciaId ?? ''}
          onChange={(e) => setPericiaId(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-sm text-stone-100"
        >
          <option value="">Selecione a perícia</option>
          {pericias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome_pericia}
              {p.time_responsavel ? ` (${p.time_responsavel})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleVincular}
          disabled={isPending || !periciaId}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Vincular
        </button>
      </div>
      {erro && <p className="w-full text-xs text-red-400">{erro}</p>}
    </div>
  );
}
