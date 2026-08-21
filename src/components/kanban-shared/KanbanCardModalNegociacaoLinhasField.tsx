'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import { fmtMoedaKanban } from '@/lib/kanban/kanban-card-modal-detalhes';
import {
  criarNegociacaoLinhaDraftVazia,
  negociacaoLinhaTemConteudo,
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
  /** Persiste linhas após alterar data manual (change/blur). */
  onPersistLinhas?: (linhas: NegociacaoLinhaDraft[]) => void | Promise<void>;
};

/** Mesma densidade de NegocioPrazoField / BCA/Gbox: py-1 + text-xs, min-h só no mobile. */
const inputClass =
  'mt-0.5 w-full bg-[var(--moni-surface-0)] px-2 py-1 text-xs text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  fontFamily: 'var(--moni-font-sans)',
} as const;

const moedaFieldClass =
  'flex w-full min-h-[44px] items-center gap-1.5 rounded-[var(--moni-radius-md)] bg-[var(--moni-surface-0)] px-2 py-1 sm:min-h-0';
const labelClass = 'text-[11px] font-medium text-[var(--moni-text-secondary)]';

function fmtData(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

function normalizarDataManualInput(raw: string): string {
  const v = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function labelVinculo(
  vinculo: string | null | undefined,
  opcoes: OpcaoVinculoCalculadora[],
): string | null {
  const v = String(vinculo ?? '').trim();
  if (!v) return null;
  const found = opcoes.find((o) => o.value === v);
  return found?.label ?? v;
}

function resumoPartes(opts: {
  condicao: string;
  valor: string;
  dataLabel: string;
  atrelarLabel: string | null;
}): string[] {
  const partes: string[] = [];
  const cond = opts.condicao.trim();
  partes.push(cond || 'Sem condição');
  const valorFmt = fmtMoedaKanban(opts.valor);
  if (valorFmt && valorFmt !== '—') partes.push(valorFmt);
  if (opts.dataLabel && opts.dataLabel !== '—') partes.push(opts.dataLabel);
  if (opts.atrelarLabel) partes.push(opts.atrelarLabel);
  return partes;
}

function NegociacaoResumoLinha({ partes }: { partes: string[] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-[12px] text-[var(--moni-text-primary)]">
      {partes.map((p, i) => {
        const isMoeda = p.startsWith('R$');
        return (
          <span key={`${i}-${p}`} className="inline-flex min-w-0 items-center gap-1.5">
            {i > 0 ? (
              <span className="shrink-0 text-[var(--moni-text-tertiary)]" aria-hidden>
                ·
              </span>
            ) : null}
            <span className={isMoeda ? 'shrink-0 whitespace-nowrap' : 'min-w-0 whitespace-normal break-words'}>
              {p}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function KanbanCardModalNegociacaoLinhasField({
  linhas,
  onChange,
  disabled = false,
  modoLeitura = false,
  linhasLeitura = [],
  opcoesVinculo = [{ value: '', label: 'Data manual' }],
  datasResolvidas,
  onPersistLinhas,
}: Props) {
  const [expandidoIds, setExpandidoIds] = useState<Set<string>>(() => new Set());
  const [leituraExpandido, setLeituraExpandido] = useState<Set<number>>(() => new Set());
  const linhasRef = useRef(linhas);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPersistLinhasRef = useRef(onPersistLinhas);

  linhasRef.current = linhas;
  onPersistLinhasRef.current = onPersistLinhas;

  useEffect(
    () => () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    },
    [],
  );

  const idsAtuais = useMemo(() => new Set(linhas.map((l) => l.id)), [linhas]);

  useEffect(() => {
    setExpandidoIds((prev) => {
      let mudou = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (idsAtuais.has(id)) next.add(id);
        else mudou = true;
      }
      return mudou ? next : prev;
    });
  }, [idsAtuais]);

  const atualizarLinha = useCallback((id: string, patch: Partial<NegociacaoLinha>) => {
    const next = linhasRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l));
    linhasRef.current = next;
    onChange(next);
    return next;
  }, [onChange]);

  const agendarPersistenciaLinhas = useCallback((next: NegociacaoLinhaDraft[]) => {
    const persist = onPersistLinhasRef.current;
    if (!persist) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void persist(next);
    }, 350);
  }, []);

  const atualizarDataManual = useCallback(
    (id: string, raw: string, opts?: { persistirImediato?: boolean }) => {
      const dataPagamento = normalizarDataManualInput(raw);
      const next = atualizarLinha(id, { dataPagamento });
      if (!dataPagamento) return;
      if (opts?.persistirImediato) {
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        void onPersistLinhasRef.current?.(next);
        return;
      }
      agendarPersistenciaLinhas(next);
    },
    [agendarPersistenciaLinhas, atualizarLinha],
  );

  const toggleExpandido = useCallback((id: string) => {
    setExpandidoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const fecharLinha = (id: string) => {
    const linha = linhasRef.current.find((l) => l.id === id);
    setExpandidoIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (!linha || negociacaoLinhaTemConteudo(linha)) return;
    const next = linhasRef.current.filter((l) => l.id !== id);
    const out = next.length > 0 ? next : [criarNegociacaoLinhaDraftVazia()];
    linhasRef.current = out;
    onChange(out);
  };

  const removerLinha = (id: string) => {
    setExpandidoIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const next = linhas.filter((l) => l.id !== id);
    onChange(next.length > 0 ? next : [criarNegociacaoLinhaDraftVazia()]);
  };

  const adicionarNegociacao = () => {
    const vaziaExistente = linhas.find((l) => !negociacaoLinhaTemConteudo(l));
    if (vaziaExistente) {
      setExpandidoIds((prev) => new Set(prev).add(vaziaExistente.id));
      return;
    }
    const nova = criarNegociacaoLinhaDraftVazia();
    const preenchidas = linhas.filter(negociacaoLinhaTemConteudo);
    onChange([...preenchidas, nova]);
    setExpandidoIds((prev) => new Set(prev).add(nova.id));
  };

  const linhasExibidas = useMemo(() => {
    return linhas.filter((l) => negociacaoLinhaTemConteudo(l) || expandidoIds.has(l.id));
  }, [linhas, expandidoIds]);

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
        <ul className="space-y-1.5">
          {linhasLeitura.map((linha, idx) => {
            const aberto = leituraExpandido.has(idx);
            const atrelar = labelVinculo(linha.vinculoCalculadora, opcoesVinculo);
            const partes = resumoPartes({
              condicao: linha.condicao,
              valor: linha.valor,
              dataLabel: fmtData(linha.dataPagamento),
              atrelarLabel: atrelar,
            });
            return (
              <li
                key={`neg-read-${idx}`}
                className="overflow-hidden rounded-[var(--moni-radius-lg)]"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  background: 'var(--moni-surface-0)',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setLeituraExpandido((prev) => {
                      const next = new Set(prev);
                      if (next.has(idx)) next.delete(idx);
                      else next.add(idx);
                      return next;
                    })
                  }
                  className="flex w-full min-h-[44px] items-start gap-2 px-2.5 py-2 text-left transition hover:bg-[var(--moni-surface-100)] sm:min-h-0"
                  aria-expanded={aberto}
                >
                  {aberto ? (
                    <ChevronDown
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--moni-text-tertiary)]"
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--moni-text-tertiary)]"
                      aria-hidden
                    />
                  )}
                  <NegociacaoResumoLinha partes={partes} />
                </button>
                {aberto ? (
                  <div
                    className="space-y-2 px-2 pb-2 pt-1"
                    style={{ borderTop: '0.5px solid var(--moni-border-subtle)' }}
                  >
                    <div>
                      <div className={labelClass}>Condição</div>
                      <div className="mt-0.5 text-xs text-[var(--moni-text-primary)] break-words">
                        {linha.condicao.trim() || '—'}
                      </div>
                    </div>
                    <div>
                      <div className={labelClass}>Valor</div>
                      <div className="mt-0.5 text-xs text-[var(--moni-text-primary)] whitespace-nowrap">
                        {fmtMoedaKanban(linha.valor) || '—'}
                      </div>
                    </div>
                    <div>
                      <div className={labelClass}>Data</div>
                      <div className="mt-0.5 text-xs text-[var(--moni-text-primary)]">
                        {fmtData(linha.dataPagamento)}
                      </div>
                    </div>
                    {atrelar ? (
                      <div>
                        <div className={labelClass}>Atrelar à fase</div>
                        <div className="mt-0.5 text-xs text-[var(--moni-text-primary)] break-words">
                          {atrelar}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <fieldset
      className="rounded-[var(--moni-radius-lg)] p-2"
      style={{ border: '0.5px solid var(--moni-border-subtle)' }}
      disabled={disabled}
    >
      <legend className="px-1 text-[11px] font-medium text-[var(--moni-text-secondary)]">Negociação</legend>

      <ul className="space-y-1.5">
        {linhasExibidas.map((linha) => {
          const aberto = expandidoIds.has(linha.id);
          const vinculo = String(linha.vinculoCalculadora ?? '').trim();
          const temVinculo = vinculo.length > 0;
          const resolvida = datasResolvidas?.get(linha.id);
          const atrelar = labelVinculo(vinculo, opcoesVinculo);
          const dataResumo = temVinculo ? fmtData(resolvida?.data ?? null) : fmtData(linha.dataPagamento);
          const partes = resumoPartes({
            condicao: linha.condicao,
            valor: linha.valor,
            dataLabel: dataResumo,
            atrelarLabel: atrelar && atrelar !== 'Data manual' ? atrelar : null,
          });
          const temConteudo = negociacaoLinhaTemConteudo(linha);

          return (
            <li
              key={linha.id}
              className="overflow-hidden rounded-[var(--moni-radius-lg)]"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
              }}
            >
              {!aberto ? (
                <button
                  type="button"
                  onClick={() => toggleExpandido(linha.id)}
                  className="flex w-full min-h-[44px] items-start gap-2 px-2.5 py-2 text-left transition hover:bg-[var(--moni-surface-100)] disabled:opacity-50 sm:min-h-0"
                  aria-expanded={false}
                  disabled={disabled}
                >
                  <ChevronRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--moni-text-tertiary)]"
                    aria-hidden
                  />
                  <NegociacaoResumoLinha partes={partes} />
                </button>
              ) : (
                <div className="p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => fecharLinha(linha.id)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 text-[11px] font-medium text-[var(--moni-text-secondary)] transition hover:text-[var(--moni-text-primary)] sm:min-h-0"
                      aria-expanded={true}
                    >
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {temConteudo ? 'Minimizar' : 'Fechar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removerLinha(linha.id)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--moni-radius-md)] text-[var(--moni-text-tertiary)] transition hover:bg-[var(--moni-surface-100)] hover:text-[var(--moni-text-secondary)] disabled:opacity-40 sm:min-h-0 sm:min-w-[28px]"
                      style={{ border: '0.5px solid var(--moni-border-default)' }}
                      aria-label="Remover negociação"
                      disabled={disabled}
                      title="Remover"
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <label className="block min-w-0">
                      <span className={labelClass}>Condição</span>
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
                      <span className={labelClass}>Valor</span>
                      <div className="mt-0.5" style={inputStyle}>
                        <KanbanCardModalMoedaField
                          value={moedaCampoValorInicial(linha.valor)}
                          onChange={(valor) => atualizarLinha(linha.id, { valor })}
                          className={moedaFieldClass}
                        />
                      </div>
                    </label>

                    <label className="block min-w-0">
                      <span className={labelClass}>Atrelar à fase</span>
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

                    <label className="block min-w-0">
                      <span className={labelClass}>Data</span>
                      {temVinculo ? (
                        <div
                          className={`${inputClass} flex items-center gap-1.5`}
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
                          onChange={(e) => atualizarDataManual(linha.id, e.target.value)}
                          onBlur={(e) =>
                            atualizarDataManual(linha.id, e.target.value, { persistirImediato: true })
                          }
                          className={inputClass}
                          style={inputStyle}
                        />
                      )}
                    </label>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={adicionarNegociacao}
        disabled={disabled}
        className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--moni-radius-md)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--moni-navy-800)] transition hover:bg-[var(--moni-surface-100)] disabled:opacity-50 sm:min-h-0"
        style={{ border: '0.5px solid var(--moni-border-default)' }}
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
        Adicionar negociação
      </button>
    </fieldset>
  );
}
