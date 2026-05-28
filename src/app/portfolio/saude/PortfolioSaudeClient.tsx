'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  franqueadoLabelBloco,
  franqueadoSearchTextBloco,
  totalCardsAtivos,
} from '@/lib/kanban/portfolio-saude-blocos';
import type {
  PortfolioSaudeBlocoFranqueado,
  PortfolioSaudeRow,
} from '@/lib/kanban/portfolio-saude-types';

type Props = {
  blocos: PortfolioSaudeBlocoFranqueado[];
};

const COL_COUNT = 11;

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? '—';
}

function FlagCell({ ok, vazio }: { ok: boolean; vazio?: boolean }) {
  if (vazio) return <span className="text-stone-300"> </span>;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm font-semibold"
      title={ok ? 'Concluído' : 'Pendente'}
    >
      {ok ? (
        <span className="text-emerald-700" aria-label="Concluído">
          ✓
        </span>
      ) : (
        <span className="text-amber-700" aria-label="Pendente">
          ⏳
        </span>
      )}
    </span>
  );
}

function CapitalCell({ row, vazio }: { row: PortfolioSaudeRow; vazio?: boolean }) {
  if (vazio) return <span className="text-stone-300"> </span>;
  if (!row.capital_aplicavel) {
    return <span className="text-stone-400">—</span>;
  }
  return <FlagCell ok={row.capital_ok} />;
}

function FaseBadge({ nome, ordem, maxOrdem }: { nome: string; ordem: number; maxOrdem: number }) {
  const t = maxOrdem > 0 ? ordem / maxOrdem : 0;
  let bg: string;
  let color: string;
  let border: string;
  if (t >= 0.66) {
    bg = 'var(--moni-green-800)';
    color = '#fff';
    border = 'var(--moni-green-900)';
  } else if (t >= 0.33) {
    bg = '#FAEEDA';
    color = '#92400e';
    border = '#D4AD68';
  } else {
    bg = 'var(--moni-surface-100, #f5f5f4)';
    color = 'var(--moni-text-secondary, #57534e)';
    border = 'var(--moni-border-default, #e7e5e4)';
  }
  return (
    <span
      className="inline-block max-w-[10rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: bg, color, border: `0.5px solid ${border}` }}
      title={nome}
    >
      {nome}
    </span>
  );
}

function CardDataRow({
  row,
  maxOrdem,
  vazio,
}: {
  row: PortfolioSaudeRow;
  maxOrdem: number;
  vazio?: boolean;
}) {
  return (
    <tr className="hover:bg-stone-50/60">
      <td className="max-w-[14rem] px-3 py-2 pl-6">
        {vazio ? (
          <span className="text-xs italic text-stone-400">Sem empreendimento em andamento</span>
        ) : (
          <span className="line-clamp-2 text-sm text-stone-800" title={row.titulo}>
            {row.titulo}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {vazio ? (
          <span className="text-stone-300"> </span>
        ) : (
          <FaseBadge
            nome={row.fase_nome ?? row.fase_slug ?? '—'}
            ordem={row.fase_ordem}
            maxOrdem={maxOrdem}
          />
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <FlagCell ok={row.acoplamento_concluido} vazio={vazio} />
      </td>
      <td className="px-3 py-2 text-center">
        <FlagCell ok={row.credito_terreno_ok} vazio={vazio} />
      </td>
      <td className="px-3 py-2 text-center">
        <FlagCell ok={row.contabilidade_ok} vazio={vazio} />
      </td>
      <td className="px-3 py-2 text-center">
        <FlagCell ok={row.juridico_ok} vazio={vazio} />
      </td>
      <td className="px-3 py-2 text-center">
        <CapitalCell row={row} vazio={vazio} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-stone-700">
        {vazio ? <span className="text-stone-300"> </span> : fmtData(row.data_step3_opcao)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-stone-700">
        {vazio ? <span className="text-stone-300"> </span> : fmtData(row.data_step5_comite)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-stone-700">
        {vazio ? <span className="text-stone-300"> </span> : fmtData(row.data_step7_contrato)}
      </td>
      <td className="px-3 py-2">
        {vazio ? (
          <span className="text-stone-300"> </span>
        ) : (
          <Link
            href={`/portfolio?card=${row.card_id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-moni-primary hover:bg-moni-light/60"
          >
            Ver card
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </td>
    </tr>
  );
}

function blocoMatchesBusca(bloco: PortfolioSaudeBlocoFranqueado, q: string): boolean {
  if (franqueadoSearchTextBloco(bloco).includes(q)) return true;
  return bloco.cards.some((c) => String(c.titulo ?? '').trim().toLowerCase().includes(q));
}

function filtrarCardsBloco(bloco: PortfolioSaudeBlocoFranqueado, q: string): PortfolioSaudeRow[] {
  if (franqueadoSearchTextBloco(bloco).includes(q)) return bloco.cards;
  return bloco.cards.filter((c) => String(c.titulo ?? '').trim().toLowerCase().includes(q));
}

export function PortfolioSaudeClient({ blocos }: Props) {
  const [busca, setBusca] = useState('');

  const maxOrdem = useMemo(
    () =>
      blocos.reduce(
        (m, b) => b.cards.reduce((inner, c) => Math.max(inner, c.fase_ordem ?? 0), m),
        0,
      ),
    [blocos],
  );

  const totalCards = useMemo(() => totalCardsAtivos(blocos), [blocos]);

  const blocosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return blocos;
    return blocos
      .filter((b) => blocoMatchesBusca(b, q))
      .map((b) => ({
        ...b,
        cards: filtrarCardsBloco(b, q),
      }));
  }, [blocos, busca]);

  const cardsFiltrados = useMemo(() => totalCardsAtivos(blocosFiltrados), [blocosFiltrados]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-stone-600">
          {blocosFiltrados.length} unidade{blocosFiltrados.length === 1 ? '' : 's'} de franquia
          {' · '}
          {cardsFiltrados} card{cardsFiltrados === 1 ? '' : 's'} ativo{cardsFiltrados === 1 ? '' : 's'}
          {busca.trim() ? ` (filtrado de ${blocos.length} unidades · ${totalCards} cards)` : ''}
        </p>
        <label className="block w-full sm:max-w-xs">
          <span className="mb-1 block text-xs font-medium text-stone-600">Buscar franqueado</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou nº franquia"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <th className="whitespace-nowrap px-3 py-2.5">Empreendimento</th>
              <th className="whitespace-nowrap px-3 py-2.5">Fase atual</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Acopl.</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Créd. terreno</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Contab.</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Jurídico</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center">Moní Capital</th>
              <th className="whitespace-nowrap px-3 py-2.5">Opção (S3)</th>
              <th className="whitespace-nowrap px-3 py-2.5">Comitê (S5)</th>
              <th className="whitespace-nowrap px-3 py-2.5">Contrato (S7)</th>
              <th className="whitespace-nowrap px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {blocosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="px-3 py-8 text-center text-stone-500">
                  Nenhuma unidade encontrada.
                </td>
              </tr>
            ) : (
              blocosFiltrados.flatMap((bloco) => {
                const label = franqueadoLabelBloco(bloco);
                const placeholderRow: PortfolioSaudeRow = {
                  card_id: '',
                  titulo: '',
                  rede_franqueado_id: bloco.rede_franqueado_id,
                  franqueado_nome: bloco.franqueado_nome,
                  n_franquia: bloco.n_franquia,
                  fase_slug: null,
                  fase_nome: null,
                  fase_ordem: 0,
                  acoplamento_concluido: false,
                  credito_terreno_ok: false,
                  contabilidade_ok: false,
                  juridico_ok: false,
                  capital_ok: false,
                  credito_obra_ok: false,
                  capital_aplicavel: false,
                  created_at: '',
                  updated_at: '',
                  data_step3_opcao: null,
                  data_step5_comite: null,
                  data_step7_contrato: null,
                };

                const header = (
                  <tr
                    key={`${bloco.rede_franqueado_id}-head`}
                    className="border-t border-stone-200 bg-stone-100/90 first:border-t-0"
                  >
                    <td colSpan={COL_COUNT} className="px-3 py-2">
                      <span className="text-sm font-semibold text-stone-800" title={label}>
                        {label}
                      </span>
                      {bloco.cards.length > 0 ? (
                        <span className="ml-2 text-xs font-normal text-stone-500">
                          {bloco.cards.length} empreendimento{bloco.cards.length === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );

                const dataRows =
                  bloco.cards.length === 0
                    ? [
                        <CardDataRow
                          key={`${bloco.rede_franqueado_id}-vazio`}
                          row={placeholderRow}
                          maxOrdem={maxOrdem}
                          vazio
                        />,
                      ]
                    : bloco.cards.map((row) => (
                        <CardDataRow key={row.card_id} row={row} maxOrdem={maxOrdem} />
                      ));

                return [header, ...dataRows];
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
