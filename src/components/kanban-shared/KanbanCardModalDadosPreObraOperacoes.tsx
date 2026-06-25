'use client';

import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { OperacoesPreObraDraft } from '@/lib/kanban/previsibilidade-operacoes';

type Props = {
  draft: OperacoesPreObraDraft;
  onChange: (patch: Partial<OperacoesPreObraDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
};

const labelCls = 'text-[11px] font-medium';
const inputCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1.5 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-primary)] min-h-[44px]';
const inputReadonlyCls =
  'mt-0.5 w-full cursor-not-allowed rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-[var(--moni-surface-muted,#f5f5f4)] px-2 py-1.5 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-secondary)] min-h-[44px]';
const hintCls = 'mt-0.5 block text-[10px] text-[var(--moni-text-tertiary)]';

function fmtPrev(iso: string): string {
  if (!iso) return '—';
  return formatIsoDateOnlyPtBr(iso) ?? iso;
}

export function KanbanCardModalDadosPreObraOperacoes({
  draft,
  onChange,
  onSalvar,
  salvando,
  podeEditar,
}: Props) {
  return (
    <div className="space-y-4 moni-form-novo-card">
      <div>
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          Datas reais
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Data Aprovação Condomínio
            </span>
            <input
              type="date"
              value={draft.condominio_aprovada_em}
              disabled={!podeEditar}
              onChange={(e) => onChange({ condominio_aprovada_em: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Data Aprovação Prefeitura
            </span>
            <input
              type="date"
              value={draft.prefeitura_aprovada_em}
              disabled={!podeEditar}
              onChange={(e) => onChange({ prefeitura_aprovada_em: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block min-w-0 sm:col-span-2">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Data Emissão Alvará
            </span>
            <input
              type="date"
              value={draft.alvara_emitido_em}
              disabled={!podeEditar}
              onChange={(e) => onChange({ alvara_emitido_em: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div>
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--moni-text-tertiary)]"
          style={{ fontFamily: 'var(--moni-font-sans)' }}
        >
          Previsões (calculadas automaticamente)
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Prev. Aprovação Condomínio
            </span>
            <input
              type="text"
              readOnly
              value={fmtPrev(draft.prev_aprovacao_condominio)}
              className={inputReadonlyCls}
              title={draft.prev_aprovacao_condominio || undefined}
            />
          </label>
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Prev. Aprovação Prefeitura
            </span>
            <input
              type="text"
              readOnly
              value={fmtPrev(draft.prev_aprovacao_prefeitura)}
              className={inputReadonlyCls}
            />
          </label>
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Prev. Emissão Alvará
            </span>
            <input
              type="text"
              readOnly
              value={fmtPrev(draft.prev_emissao_alvara)}
              className={inputReadonlyCls}
            />
          </label>
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Prev. Envio Crédito Obra
            </span>
            <input
              type="text"
              readOnly
              value={fmtPrev(draft.prev_envio_credito_obra)}
              className={inputReadonlyCls}
            />
            <span className={hintCls}>30 dias corridos antes da previsão de prefeitura</span>
          </label>
          <label className="block min-w-0 sm:col-span-2">
            <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
              Prev. Início Obra
            </span>
            <input
              type="text"
              readOnly
              value={fmtPrev(draft.prev_inicio_obra)}
              className={inputReadonlyCls}
            />
            <span className={hintCls}>30 dias corridos após emissão do alvará (real ou prevista)</span>
          </label>
        </div>
      </div>

      {podeEditar ? (
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-transparent px-3 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          style={{
            background: 'var(--moni-navy-800)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar dados pré-obra'}
        </button>
      ) : null}
    </div>
  );
}
