'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import {
  badgeCompatibilidade,
  formatPrecoAnuncio,
  type BatalhaModeloAnuncioPreBatalha,
  type RankingPorFaixaMercado,
  type ResultadoRankingModelo,
} from '@/lib/kanban/pre-batalha-compatibilidade';
import { gerarExplicacaoRankingFaixaPreBatalha } from '@/lib/kanban/pre-batalha-explicacao-faixa';

function formatRank(posicao: number): string {
  return String(posicao).padStart(2, '0');
}

function notaCellClass(nota: number): string {
  if (nota >= 1) return 'text-emerald-700';
  if (nota >= 0) return 'text-amber-800';
  return 'text-red-700';
}

function PodiumTop3({ top3 }: { top3: ResultadoRankingModelo[] }) {
  if (top3.length === 0) return null;

  const slots: { item: ResultadoRankingModelo; pos: number; height: string; trophy: string }[] = [];
  if (top3[1]) slots.push({ item: top3[1], pos: 2, height: 'h-16', trophy: 'text-stone-400' });
  if (top3[0]) slots.push({ item: top3[0], pos: 1, height: 'h-20', trophy: 'text-amber-500' });
  if (top3[2]) slots.push({ item: top3[2], pos: 3, height: 'h-14', trophy: 'text-amber-700/80' });

  return (
    <div
      className="mb-5 rounded-xl border border-stone-200/80 bg-stone-900/5 px-4 py-4 backdrop-blur-sm"
      aria-label="Pódio — top 3 modelos"
    >
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {slots.map(({ item, pos, height, trophy }) => (
          <div
            key={item.catalogoId}
            className={`flex ${height} min-w-[5.5rem] max-w-[8rem] flex-1 flex-col items-center justify-end text-center sm:min-w-[6.5rem]`}
          >
            <Trophy className={`mb-1 h-6 w-6 shrink-0 sm:h-7 sm:w-7 ${trophy}`} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500 sm:text-xs">
              {formatRank(pos)}
            </span>
            <span className="mt-0.5 line-clamp-2 text-xs font-semibold leading-tight text-stone-800">
              {item.modelo}
            </span>
            <span className="mt-0.5 text-[11px] font-bold tabular-nums text-amber-900">
              {item.notaFinal}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatalhasTable({ batalhas }: { batalhas: BatalhaModeloAnuncioPreBatalha[] }) {
  if (batalhas.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50/90 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
            <th className="px-3 py-2 text-left sm:px-4">Modelo</th>
            <th className="px-3 py-2 text-left sm:px-4">Anúncio</th>
            <th className="px-3 py-2 text-right sm:px-4">Preço anúncio</th>
            <th className="px-3 py-2 text-right sm:px-4">INC + Kit</th>
            <th className="px-3 py-2 text-center sm:px-4">Lote</th>
            <th className="px-3 py-2 text-center sm:px-4">Preço</th>
            <th className="px-3 py-2 text-center sm:px-4">Produto</th>
            <th className="px-3 py-2 text-center sm:px-4">Final</th>
          </tr>
        </thead>
        <tbody>
          {batalhas.map((b) => (
            <tr
              key={`${b.catalogoId}-${b.anuncioId}`}
              className="border-b border-stone-100 last:border-0 bg-white/50 hover:bg-stone-50/90"
            >
              <td className="px-3 py-2.5 sm:px-4">
                <span className="font-medium text-stone-900">{b.modelo}</span>
                {b.topografia !== '—' ? (
                  <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 ring-1 ring-stone-200">
                    {b.topografia}
                  </span>
                ) : null}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2.5 text-stone-700 sm:px-4" title={b.condominio}>
                {b.condominio}
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-stone-600 sm:px-4">
                {b.precoAnuncio > 0 ? formatPrecoAnuncio(b.precoAnuncio) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-stone-600 sm:px-4">
                {b.precoIncKitMoni != null && b.precoIncKitMoni > 0
                  ? formatPrecoAnuncio(b.precoIncKitMoni)
                  : '—'}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(b.notaLote)}`}
              >
                {b.notaLote}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(b.notaPreco)}`}
              >
                {b.notaPreco}
              </td>
              <td
                className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(b.notaProduto)}`}
              >
                {b.notaProduto}
              </td>
              <td className="px-3 py-2.5 text-center sm:px-4">
                <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-stone-900/5 px-1.5 py-0.5 text-xs font-bold tabular-nums text-stone-900">
                  {b.notaFinalLinha}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardTable({ ranking }: { ranking: ResultadoRankingModelo[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200/90 bg-white/80 shadow-inner backdrop-blur-sm">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-100/90 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
            <th className="px-3 py-2.5 text-left sm:px-4">Rank</th>
            <th className="px-3 py-2.5 text-left sm:px-4">Modelo</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Lote</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Preço</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Produto</th>
            <th className="px-3 py-2.5 text-center sm:px-4">Nota final</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((item, idx) => {
            const posicao = idx + 1;
            const destaqueTop3 = posicao <= 3;
            const compat = badgeCompatibilidade(item.notaFinal);

            return (
              <tr
                key={item.catalogoId}
                className={`border-b border-stone-100 last:border-0 ${
                  destaqueTop3 ? 'bg-amber-50/80' : 'bg-white/60 hover:bg-stone-50/90'
                }`}
              >
                <td className="px-3 py-3 font-bold tabular-nums text-stone-700 sm:px-4">
                  {formatRank(posicao)}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{item.modelo}</span>
                    {item.topografia !== '—' ? (
                      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 ring-1 ring-stone-200">
                        {item.topografia}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${compat.className}`}
                    >
                      {compat.label}
                    </span>
                  </div>
                  {item.precoIncKitMoni != null && item.precoIncKitMoni > 0 ? (
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      INC + Kit: {formatPrecoAnuncio(item.precoIncKitMoni)}
                    </p>
                  ) : null}
                </td>
                <td
                  className={`px-3 py-3 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(item.notaLote)}`}
                >
                  {item.notaLote}
                </td>
                <td
                  className={`px-3 py-3 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(item.notaPrecoMedia)}`}
                >
                  {item.notaPrecoMedia}
                </td>
                <td
                  className={`px-3 py-3 text-center text-sm font-semibold tabular-nums sm:px-4 ${notaCellClass(item.notaProdutoMedia)}`}
                >
                  {item.notaProdutoMedia}
                </td>
                <td className="px-3 py-3 text-center sm:px-4">
                  <span className="inline-flex min-w-[2.5rem] justify-center rounded-md bg-stone-900/5 px-2 py-1 text-sm font-bold tabular-nums text-stone-900">
                    {item.notaFinal}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function linhaResumoRanking(item: ResultadoRankingModelo, idx: number): string {
  const palavra = item.modelo.trim().split(/\s+/)[0] || item.modelo.trim();
  const abrev = palavra.length <= 4 ? palavra : palavra.slice(0, 3);
  const topoRaw = item.topografia.trim().toLowerCase();
  const topoSlug = topoRaw === '—' || !topoRaw ? '—' : topoRaw;
  return `${idx + 1}º ${abrev}/${topoSlug} (Final: ${item.notaFinal} | L:${item.notaLote} P:${item.notaPrecoMedia} Prod:${item.notaProdutoMedia})`;
}

function SubSecaoTabelaColapsavel({
  titulo,
  resumo,
  expandida,
  onToggle,
  panelId,
  children,
}: {
  titulo: string;
  resumo: ReactNode;
  expandida: boolean;
  onToggle: () => void;
  panelId: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white/70 shadow-inner backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandida}
        aria-controls={panelId}
        className="flex w-full items-start justify-between gap-3 border-b border-stone-200 bg-stone-100/90 px-3 py-2.5 text-left transition hover:bg-stone-100"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">{titulo}</p>
          {!expandida ? <div className="mt-1.5">{resumo}</div> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[11px] font-medium text-stone-500">
          {expandida ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </span>
      </button>
      {expandida ? (
        <div id={panelId} className="p-1 sm:p-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function RankingResumoMinimizado({ ranking }: { ranking: ResultadoRankingModelo[] }) {
  if (ranking.length === 0) {
    return <p className="text-xs text-stone-500">Nenhum modelo ranqueado nesta faixa.</p>;
  }

  return (
    <ul className="space-y-1 text-xs leading-relaxed text-stone-700">
      {ranking.map((item, idx) => (
        <li
          key={item.catalogoId}
          className={`rounded-md px-2 py-1 ${idx < 3 ? 'bg-amber-50/90 font-medium text-stone-800' : 'bg-white/60'}`}
        >
          {linhaResumoRanking(item, idx)}
        </li>
      ))}
    </ul>
  );
}

function ExplicacaoFaixaPreBatalha({ grupo }: { grupo: RankingPorFaixaMercado }) {
  const paragrafos = gerarExplicacaoRankingFaixaPreBatalha(grupo);
  if (paragrafos.length === 0) return null;

  return (
    <div
      className="mx-4 mb-3 rounded-lg border border-sky-200/90 bg-sky-50/90 px-3 py-3 text-xs leading-relaxed text-sky-950 sm:mx-5"
      role="note"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
        Por que este ranking nesta faixa?
      </p>
      {paragrafos.map((paragrafo, idx) => (
        <p key={idx} className={idx > 0 ? 'mt-2' : undefined}>
          {paragrafo}
        </p>
      ))}
    </div>
  );
}

function FaixaPreBatalhaColapsavel({
  grupo,
  expandida,
  onToggle,
}: {
  grupo: RankingPorFaixaMercado;
  expandida: boolean;
  onToggle: () => void;
}) {
  const panelId = `pre-batalha-faixa-${grupo.faixa}`;
  const [batalhasAbertas, setBatalhasAbertas] = useState(false);
  const [rankingAberto, setRankingAberto] = useState(false);

  useEffect(() => {
    if (!expandida) {
      setBatalhasAbertas(false);
      setRankingAberto(false);
    }
  }, [expandida]);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-300/70 bg-gradient-to-b from-stone-200/40 via-stone-50/90 to-white shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandida}
        aria-controls={panelId}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-stone-100/40 sm:px-5 sm:py-4"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              Mapa de competidores
            </p>
            <h3 className="mt-0.5 text-base font-bold uppercase tracking-wide text-stone-800 sm:text-lg">
              Faixa {grupo.faixaLabel}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {grupo.quantidadeAnuncios}{' '}
              {grupo.quantidadeAnuncios === 1 ? 'anúncio' : 'anúncios'} ·{' '}
              {grupo.batalhas.length}{' '}
              {grupo.batalhas.length === 1 ? 'batalha' : 'batalhas'} ·{' '}
              {grupo.ranking.length}{' '}
              {grupo.ranking.length === 1 ? 'modelo' : 'modelos'}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pt-1 text-[11px] font-medium text-stone-600">
            {expandida ? (
              <>
                <ChevronDown className="h-5 w-5" aria-hidden />
                <span className="hidden sm:inline">Recolher</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-5 w-5" aria-hidden />
                <span className="hidden sm:inline">Expandir</span>
              </>
            )}
          </span>
        </div>

        {!expandida ? (
          <div className="w-full border-t border-stone-200/80 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Ranking agregado
            </p>
            <RankingResumoMinimizado ranking={grupo.ranking} />
          </div>
        ) : null}
      </button>

      <ExplicacaoFaixaPreBatalha grupo={grupo} />

      {expandida ? (
        <div id={panelId} className="space-y-4 border-t border-stone-200/80 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          {grupo.batalhas.length > 0 ? (
            <SubSecaoTabelaColapsavel
              titulo="Batalhas — modelo × anúncio"
              resumo={
                <p className="text-xs text-stone-500">
                  {grupo.batalhas.length}{' '}
                  {grupo.batalhas.length === 1 ? 'batalha' : 'batalhas'} — clique para ver a lista
                </p>
              }
              expandida={batalhasAbertas}
              onToggle={() => setBatalhasAbertas((v) => !v)}
              panelId={`${panelId}-batalhas`}
            >
              <BatalhasTable batalhas={grupo.batalhas} />
            </SubSecaoTabelaColapsavel>
          ) : null}

          <SubSecaoTabelaColapsavel
            titulo="Ranking agregado"
            resumo={<RankingResumoMinimizado ranking={grupo.ranking} />}
            expandida={rankingAberto}
            onToggle={() => setRankingAberto((v) => !v)}
            panelId={`${panelId}-ranking`}
          >
            <PodiumTop3 top3={grupo.ranking.slice(0, 3)} />
            <LeaderboardTable ranking={grupo.ranking} />
          </SubSecaoTabelaColapsavel>
        </div>
      ) : null}
    </section>
  );
}

type Props = {
  grupos: RankingPorFaixaMercado[];
};

/** Leaderboard Pré Batalha — faixas colapsáveis (resumo) com opção de expandir listas completas. */
export function PreBatalhaRankingLeaderboard({ grupos }: Props) {
  const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set());

  if (grupos.length === 0) return null;

  const toggleFaixa = (faixa: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(faixa)) next.delete(faixa);
      else next.add(faixa);
      return next;
    });
  };

  const expandirTodas = () => setExpandidas(new Set(grupos.map((g) => g.faixa)));
  const recolherTodas = () => setExpandidas(new Set());

  return (
    <div className="space-y-4">
      {grupos.length > 1 ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={expandirTodas}
            className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Expandir todas
          </button>
          <button
            type="button"
            onClick={recolherTodas}
            className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Recolher todas
          </button>
        </div>
      ) : null}

      <div className="space-y-4">
        {grupos.map((grupo) => (
          <FaixaPreBatalhaColapsavel
            key={grupo.faixa}
            grupo={grupo}
            expandida={expandidas.has(grupo.faixa)}
            onToggle={() => toggleFaixa(grupo.faixa)}
          />
        ))}
      </div>
    </div>
  );
}
