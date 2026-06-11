'use client';

import { Trophy } from 'lucide-react';
import {
  badgeCompatibilidade,
  formatPrecoAnuncio,
  type RankingPorFaixaMercado,
  type ResultadoRankingModelo,
} from '@/lib/kanban/pre-batalha-compatibilidade';

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

type Props = {
  grupos: RankingPorFaixaMercado[];
};

/** Leaderboard Pré Batalha — uma tabela ranqueada por faixa do mapa de competidores. */
export function PreBatalhaRankingLeaderboard({ grupos }: Props) {
  if (grupos.length === 0) return null;

  return (
    <div className="space-y-8">
      {grupos.map((grupo) => (
        <section
          key={grupo.faixa}
          className="overflow-hidden rounded-2xl border border-stone-300/70 bg-gradient-to-b from-stone-200/40 via-stone-50/90 to-white p-4 shadow-lg backdrop-blur-md sm:p-5"
        >
          <header className="mb-4 border-b border-stone-200/80 pb-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-stone-500">
              Mapa de competidores
            </p>
            <h3 className="mt-1 text-base font-bold uppercase tracking-wide text-stone-800 sm:text-lg">
              Faixa {grupo.faixaLabel}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {grupo.quantidadeAnuncios}{' '}
              {grupo.quantidadeAnuncios === 1 ? 'anúncio' : 'anúncios'} ·{' '}
              {grupo.ranking.length}{' '}
              {grupo.ranking.length === 1 ? 'modelo ranqueado' : 'modelos ranqueados'}
            </p>
          </header>

          <PodiumTop3 top3={grupo.ranking.slice(0, 3)} />
          <LeaderboardTable ranking={grupo.ranking} />
        </section>
      ))}
    </div>
  );
}
