'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { PortfolioSaudeRow } from '@/lib/kanban/portfolio-saude-types';

type Props = {
  rows: PortfolioSaudeRow[];
};

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? '—';
}

function franqueadoLabel(row: PortfolioSaudeRow): string {
  const fk = String(row.n_franquia ?? '').trim();
  const nome = String(row.franqueado_nome ?? '').trim();
  if (fk && nome) return `${fk} — ${nome}`;
  return fk || nome || '—';
}

function franqueadoSearchText(row: PortfolioSaudeRow): string {
  return [row.n_franquia, row.franqueado_nome, row.rede_franqueado_id]
    .map((x) => String(x ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function FlagCell({ ok }: { ok: boolean }) {
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

function CapitalCell({ row }: { row: PortfolioSaudeRow }) {
  if (!row.capital_aplicavel) {
    return <span className="text-stone-400">—</span>;
  }
  return <FlagCell ok={row.capital_ok} />;
}

/** Badge de fase por ordem: avançado = verde escuro, meio = âmbar, início = cinza. */
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

export function PortfolioSaudeClient({ rows }: Props) {
  const [busca, setBusca] = useState('');

  const maxOrdem = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.fase_ordem ?? 0), 0),
    [rows],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => franqueadoSearchText(r).includes(q));
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-stone-600">
          {filtradas.length} card{filtradas.length === 1 ? '' : 's'} ativo
          {busca.trim() ? ` (filtrado de ${rows.length})` : ''}
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
              <th className="whitespace-nowrap px-3 py-2.5">Franqueado</th>
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
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-stone-500">
                  Nenhum card encontrado.
                </td>
              </tr>
            ) : (
              filtradas.map((row) => (
                <tr key={row.card_id} className="hover:bg-stone-50/80">
                  <td className="max-w-[12rem] px-3 py-2">
                    <span className="line-clamp-2 font-medium text-stone-800" title={franqueadoLabel(row)}>
                      {franqueadoLabel(row)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500" title={row.titulo}>
                      {row.titulo}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <FaseBadge
                      nome={row.fase_nome ?? row.fase_slug ?? '—'}
                      ordem={row.fase_ordem}
                      maxOrdem={maxOrdem}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FlagCell ok={row.acoplamento_concluido} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FlagCell ok={row.credito_terreno_ok} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FlagCell ok={row.contabilidade_ok} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <FlagCell ok={row.juridico_ok} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <CapitalCell row={row} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-700">{fmtData(row.data_step3_opcao)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-700">{fmtData(row.data_step5_comite)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-700">{fmtData(row.data_step7_contrato)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/portfolio?card=${row.card_id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-moni-primary hover:bg-moni-light/60"
                    >
                      Ver card
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
