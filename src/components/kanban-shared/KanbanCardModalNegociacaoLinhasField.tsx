'use client';

import { Plus, Trash2 } from 'lucide-react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import { fmtMoedaKanban } from '@/lib/kanban/kanban-card-modal-detalhes';
import {
  criarNegociacaoLinhaDraftVazia,
  type NegociacaoLinha,
  type NegociacaoLinhaDraft,
} from '@/lib/kanban/negociacao-linhas';
import type { OpcaoVinculoCalculadora } from '@/lib/kanban/calculadora-negociacao';
import { KanbanCardModalMoedaField } from '@/components/kanban-shared/KanbanCardModalMoedaField';
import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';

type Props = {
  linhas: NegociacaoLinhaDraft[];
  onChange: (linhas: NegociacaoLinhaDraft[]) => void;
  disabled?: boolean;
  modoLeitura?: boolean;
  linhasLeitura?: NegociacaoLinha[];
  opcoesVinculo?: OpcaoVinculoCalculadora[];
  datasResolvidas?: Map<string, { data: string | null; prevista: boolean }>;
};

const inputClass =
  'w-full bg-white px-2 py-1.5 text-xs text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-[36px]';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  fontFamily: 'var(--moni-font-sans)',
} as const;

function fmtData(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

export function KanbanCardModalNegociacaoLinhasField({
  linhas,
  onChange,
  disabled = false,
  modoLeitura = false,
  linhasLeitura = [],
  opcoesVinculo = [{ value: '', label: 'Data manual' }],
  datasResolvidas,
}: Props) {
  const atualizarLinha = (id: string, patch: Partial<NegociacaoLinha>) => {
    onChange(linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removerLinha = (id: string) => {
    const next = linhas.filter((l) => l.id !== id);
    onChange(next.length > 0 ? next : [criarNegociacaoLinhaDraftVazia()]);
  };

  const adicionarLinha = () => {
    onChange([...linhas, criarNegociacaoLinhaDraftVazia()]);
  };

  if (modoLeitura) {
    if (linhasLeitura.length === 0) {
      return (
        <div>
          <div className="text-[11px] font-medium text-[var(--moni-text-secondary)]">Negociação</div>
          <p className="mt-0.5 text-xs text-[var(--moni-text-tertiary)]">—</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-[var(--moni-text-secondary)]">Negociação</div>
        <div
          className="hidden gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-[var(--moni-text-tertiary)] sm:grid sm:grid-cols-[1fr_1fr_minmax(88px,0.75fr)]"
          aria-hidden
        >
          <span>Condição</span>
          <span>Valor</span>
          <span>Data pagamento</span>
        </div>
        {linhasLeitura.map((linha, idx) => (
          <div
            key={`neg-read-${idx}`}
            className="grid grid-cols-1 gap-1.5 rounded-lg p-2 sm:grid-cols-[1fr_1fr_minmax(88px,0.75fr)] sm:gap-2 sm:p-0"
            style={idx > 0 ? { borderTop: '0.5px solid var(--moni-border-subtle)', paddingTop: '8px' } : undefined}
          >
            <div className="min-w-0">
              <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Condição</span>
              <div className="text-xs text-[var(--moni-text-primary)]">{linha.condicao.trim() || '—'}</div>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Valor</span>
              <div className="text-xs text-[var(--moni-text-primary)]">{fmtMoedaKanban(linha.valor) || '—'}</div>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Data pagamento</span>
              <div className="text-xs text-[var(--moni-text-primary)]">{fmtData(linha.dataPagamento)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <fieldset
      className="rounded-lg p-2"
      style={{ border: '0.5px solid var(--moni-border-subtle)' }}
      disabled={disabled}
    >
      <legend className="px-1 text-[11px] font-medium text-[var(--moni-text-secondary)]">Negociação</legend>

      <div
        className="mb-1.5 hidden gap-2 px-0.5 text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:grid sm:grid-cols-[1fr_1fr_minmax(108px,0.8fr)_minmax(120px,1fr)_32px]"
        aria-hidden
      >
        <span>Condição</span>
        <span>Valor</span>
        <span>Data</span>
        <span>Atrelar à fase</span>
        <span />
      </div>

      <div className="space-y-2">
        {linhas.map((linha) => {
          const vinculo = String(linha.vinculoCalculadora ?? '').trim();
          const temVinculo = vinculo.length > 0;
          const resolvida = datasResolvidas?.get(linha.id);

          return (
            <div
              key={linha.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_minmax(108px,0.8fr)_minmax(120px,1fr)_32px] sm:items-start"
            >
              <label className="block min-w-0">
                <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Condição</span>
                <input
                  type="text"
                  value={linha.condicao}
                  onChange={(e) => atualizarLinha(linha.id, { condicao: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Ex.: Na escritura"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Valor</span>
                <KanbanCardModalMoedaField
                  value={moedaCampoValorInicial(linha.valor)}
                  onChange={(valor) => atualizarLinha(linha.id, { valor })}
                  className={`${inputClass} gap-0`}
                />
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Data pagamento</span>
                {temVinculo ? (
                  <div
                    className={`${inputClass} flex flex-col justify-center`}
                    style={inputStyle}
                    title={resolvida?.data ? fmtData(resolvida.data) : undefined}
                  >
                    <span className="text-xs text-[var(--moni-text-primary)]">
                      {fmtData(resolvida?.data ?? null)}
                    </span>
                    <span className="text-[10px] text-[var(--moni-text-tertiary)]">
                      {resolvida?.prevista === false ? 'real' : 'est.'}
                    </span>
                  </div>
                ) : (
                  <input
                    type="date"
                    value={linha.dataPagamento}
                    onChange={(e) => atualizarLinha(linha.id, { dataPagamento: e.target.value })}
                    className={inputClass}
                    style={inputStyle}
                  />
                )}
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-medium text-[var(--moni-text-tertiary)] sm:hidden">Atrelar à fase</span>
                <select
                  value={vinculo}
                  onChange={(e) => {
                    const next = e.target.value;
                    atualizarLinha(linha.id, {
                      vinculoCalculadora: next,
                      dataPagamento: next ? '' : linha.dataPagamento,
                    });
                  }}
                  className={inputClass}
                  style={inputStyle}
                >
                  {opcoesVinculo.map((o) => (
                    <option key={o.value || '__manual'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-end sm:justify-center sm:pt-1">
                <button
                  type="button"
                  onClick={() => removerLinha(linha.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--moni-text-tertiary)] transition hover:bg-[var(--moni-surface-1)] hover:text-[var(--moni-text-secondary)] disabled:opacity-40 sm:min-h-[36px] sm:min-w-[36px]"
                  style={{ border: '0.5px solid var(--moni-border-default)' }}
                  aria-label="Remover linha de negociação"
                  disabled={disabled || linhas.length <= 1}
                  title="Remover linha"
                >
                  <Trash2 size={14} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={adicionarLinha}
        disabled={disabled}
        className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--moni-navy-800)] transition hover:bg-[var(--moni-surface-1)] disabled:opacity-50 sm:min-h-[36px]"
        style={{ border: '0.5px solid var(--moni-border-default)' }}
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
        Adicionar linha
      </button>
    </fieldset>
  );
}
