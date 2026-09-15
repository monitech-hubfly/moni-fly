'use client';

import { displayOrDash } from '@/lib/kanban/kanban-card-modal-detalhes';

export type CorretoresLeadDraft = {
  nome_corretor: string;
  imobiliaria_corretor: string;
  empreendimento_interesse: string;
  tipologia_interesse: string;
  orcamento_lead: string;
  probabilidade_fechamento: string;
  cidade_interesse: string;
  telefone_lead: string;
  email_lead: string;
  mensagem_lead: string;
};

export const CORRETORES_LEAD_DRAFT_EMPTY: CorretoresLeadDraft = {
  nome_corretor: '',
  imobiliaria_corretor: '',
  empreendimento_interesse: '',
  tipologia_interesse: '',
  orcamento_lead: '',
  probabilidade_fechamento: '',
  cidade_interesse: '',
  telefone_lead: '',
  email_lead: '',
  mensagem_lead: '',
};

const TIPOLOGIAS = [
  'Casa Térrea',
  'Sobrado',
  'Casa de Campo',
  'Casa de Praia',
  'Outro',
] as const;

const PROBS = ['25%', '50%', '75%', '90%'] as const;

const fieldCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] px-2 py-1.5 text-xs min-h-[36px]';
const fieldStyle = {
  border: '0.5px solid var(--moni-border-default)',
  color: 'var(--moni-text-primary)',
  background: 'var(--moni-surface-0)',
} as const;

type Props = {
  draft: CorretoresLeadDraft;
  onChange: (patch: Partial<CorretoresLeadDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
};

export function KanbanCardModalDadosCorretores({
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Corretor
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>{displayOrDash(draft.nome_corretor)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Imobiliária
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>
              {displayOrDash(draft.imobiliaria_corretor)}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Empreendimento
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>
              {displayOrDash(draft.empreendimento_interesse)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Tipologia
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>
              {displayOrDash(draft.tipologia_interesse)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Orçamento
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>{displayOrDash(draft.orcamento_lead)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Probabilidade
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>
              {displayOrDash(draft.probabilidade_fechamento)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cidade
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>{displayOrDash(draft.cidade_interesse)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Telefone
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>{displayOrDash(draft.telefone_lead)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              E-mail
            </div>
            <div style={{ color: 'var(--moni-text-primary)' }}>{displayOrDash(draft.email_lead)}</div>
          </div>
        </div>
        {podeEditar ? (
          <button
            type="button"
            onClick={onEditar}
            className="mt-2 text-xs font-medium underline"
            style={{ color: 'var(--moni-navy-800)' }}
          >
            Editar dados do lead
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Nome do corretor (leitura)</span>
        <input value={draft.nome_corretor} readOnly className={fieldCls} style={fieldStyle} />
      </label>
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Imobiliária (leitura)</span>
        <input value={draft.imobiliaria_corretor} readOnly className={fieldCls} style={fieldStyle} />
      </label>
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Empreendimento de interesse</span>
        <input
          value={draft.empreendimento_interesse}
          onChange={(e) => onChange({ empreendimento_interesse: e.target.value })}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Tipologia</span>
        <select
          value={draft.tipologia_interesse}
          onChange={(e) => onChange({ tipologia_interesse: e.target.value })}
          className={fieldCls}
          style={fieldStyle}
        >
          <option value="">Selecione</option>
          {TIPOLOGIAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Orçamento estimado</span>
        <input
          value={draft.orcamento_lead}
          onChange={(e) => onChange({ orcamento_lead: e.target.value })}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Probabilidade de fechamento</span>
        <select
          value={draft.probabilidade_fechamento}
          onChange={(e) => onChange({ probabilidade_fechamento: e.target.value })}
          className={fieldCls}
          style={fieldStyle}
        >
          <option value="">Selecione</option>
          {PROBS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px]">
        <span style={{ color: 'var(--moni-text-tertiary)' }}>Cidade</span>
        <input
          value={draft.cidade_interesse}
          onChange={(e) => onChange({ cidade_interesse: e.target.value })}
          className={fieldCls}
          style={fieldStyle}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="rounded-[var(--moni-radius-md)] px-2 py-1 text-xs"
          style={{ border: '0.5px solid var(--moni-border-default)' }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="rounded-[var(--moni-radius-md)] px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
          style={{ background: 'var(--moni-navy-800)' }}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
