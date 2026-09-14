'use client';

import { displayOrDash } from '@/lib/kanban/kanban-card-modal-detalhes';
import {
  MKT_TIPO_MATERIAL_OPCOES,
  type MktTipoMaterial,
} from '@/lib/kanban/funis-marketing';

export type MarketingMaterialDraft = {
  mkt_tipo_material: string;
};

export const MARKETING_MATERIAL_DRAFT_EMPTY: MarketingMaterialDraft = {
  mkt_tipo_material: '',
};

const fieldCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] px-2 py-1.5 text-xs min-h-[36px]';
const fieldStyle = {
  border: '0.5px solid var(--moni-border-default)',
  color: 'var(--moni-text-primary)',
  background: 'var(--moni-surface-0)',
} as const;

type Props = {
  draft: MarketingMaterialDraft;
  onChange: (patch: Partial<MarketingMaterialDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
};

export function KanbanCardModalDadosMaterial({
  draft,
  onChange,
  onSalvar,
  salvando,
  podeEditar,
  editando,
  onEditar,
  onCancelar,
}: Props) {
  if (!editando) {
    return (
      <div className="space-y-2 text-xs">
        <div>
          <div
            className="text-[10px] uppercase tracking-wide"
            style={{ color: 'var(--moni-text-tertiary)' }}
          >
            Tipo de material
          </div>
          <div style={{ color: 'var(--moni-text-primary)' }}>
            {displayOrDash(draft.mkt_tipo_material)}
          </div>
        </div>
        {podeEditar ? (
          <button
            type="button"
            onClick={onEditar}
            className="rounded-[var(--moni-radius-md)] px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: 'var(--moni-navy-800)', minHeight: 44 }}
          >
            Editar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <label className="block">
        <span className="text-[11px] font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          Tipo de material
        </span>
        <select
          value={draft.mkt_tipo_material}
          onChange={(e) => onChange({ mkt_tipo_material: e.target.value })}
          className={fieldCls}
          style={fieldStyle}
        >
          <option value="">Selecione…</option>
          {MKT_TIPO_MATERIAL_OPCOES.map((op: MktTipoMaterial) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="rounded-[var(--moni-radius-md)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--moni-navy-800)', minHeight: 44 }}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="rounded-[var(--moni-radius-md)] px-3 py-1.5 text-xs disabled:opacity-50"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            color: 'var(--moni-text-secondary)',
            minHeight: 44,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
