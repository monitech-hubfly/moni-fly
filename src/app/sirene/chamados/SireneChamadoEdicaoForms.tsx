'use client';

import {
  inferirHdmResponsavelPorNomesTimes,
  responsaveisDoTimeMoni,
} from '@/lib/times-responsaveis';

export type EditLinhaDraft = {
  titulo: string;
  tipo: 'atividade' | 'duvida' | 'proposicoes';
  data: string;
  timesIds: string[];
  responsaveisIds: string[];
  trava: boolean;
};

export type EditSireneDraft = {
  incendio: string;
  time_abertura: string;
  abertura_responsavel_nome: string;
  data: string;
  trava: boolean;
  tipo: 'padrao' | 'hdm';
  hdm_responsavel: string;
};

type TimeOpt = { id: string; nome: string };
type RespOpt = { id: string; nome: string };

const inputClass =
  'mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]';

const selectClass =
  'mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)] outline-none focus:border-[color:var(--moni-navy-400)] focus:ring-1 focus:ring-[color:var(--moni-navy-400)]';

type KanbanEditProps = {
  draft: EditLinhaDraft;
  setDraft: React.Dispatch<React.SetStateAction<EditLinhaDraft | null>>;
  times: TimeOpt[];
  responsaveis: RespOpt[];
  salvando: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
};

export function SireneChamadoEdicaoKanbanForm({
  draft,
  setDraft,
  times,
  responsaveis,
  salvando,
  onSalvar,
  onCancelar,
}: KanbanEditProps) {
  return (
    <div className="space-y-3 border-b border-[color:var(--moni-border-default)] pb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
        Editar chamado
      </p>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
        Título
        <input
          type="text"
          value={draft.titulo}
          onChange={(e) => setDraft((d) => (d ? { ...d, titulo: e.target.value } : d))}
          className={inputClass}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Tipo
          <select
            value={draft.tipo}
            onChange={(e) =>
              setDraft((d) =>
                d ? { ...d, tipo: e.target.value as EditLinhaDraft['tipo'] } : d,
              )
            }
            className={selectClass}
          >
            <option value="atividade">Atividade</option>
            <option value="duvida">Dúvida</option>
            <option value="proposicoes">Proposições</option>
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Prazo
          <input
            type="date"
            value={draft.data}
            onChange={(e) => setDraft((d) => (d ? { ...d, data: e.target.value } : d))}
            className={inputClass}
          />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Times
        </span>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {times.map((t) => {
            const on = draft.timesIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    if (!d) return d;
                    const has = d.timesIds.includes(t.id);
                    return {
                      ...d,
                      timesIds: has ? d.timesIds.filter((x) => x !== t.id) : [...d.timesIds, t.id],
                    };
                  })
                }
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  on ? 'bg-red-600 text-white' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                }`}
              >
                {t.nome}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Responsáveis
        </span>
        <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
          {responsaveis.map((p) => {
            const on = draft.responsaveisIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    if (!d) return d;
                    const has = d.responsaveisIds.includes(p.id);
                    return {
                      ...d,
                      responsaveisIds: has
                        ? d.responsaveisIds.filter((x) => x !== p.id)
                        : [...d.responsaveisIds, p.id],
                    };
                  })
                }
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  on ? 'bg-red-600 text-white' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                }`}
              >
                {p.nome}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
          checked={draft.trava}
          onChange={(e) => setDraft((d) => (d ? { ...d, trava: e.target.checked } : d))}
        />
        Trava — bloqueia o card até concluir
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={salvando}
          onClick={onSalvar}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={onCancelar}
          className="rounded-lg border border-[color:var(--moni-border-default)] px-3 py-1.5 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

type SireneEditProps = {
  draft: EditSireneDraft;
  setDraft: React.Dispatch<React.SetStateAction<EditSireneDraft | null>>;
  timesSireneEditOpcoes: string[];
  salvando: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
};

export function SireneChamadoEdicaoSireneForm({
  draft,
  setDraft,
  timesSireneEditOpcoes,
  salvando,
  onSalvar,
  onCancelar,
}: SireneEditProps) {
  return (
    <div className="space-y-3 border-b border-[color:var(--moni-border-default)] pb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
        Chamado Sirene
      </p>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
        Incêndio (resumo)
        <textarea
          value={draft.incendio}
          onChange={(e) => setDraft((d) => (d ? { ...d, incendio: e.target.value } : d))}
          rows={3}
          className={inputClass}
        />
      </label>
      <p className="text-[11px] leading-snug text-[color:var(--moni-text-tertiary)]">
        O tipo <strong>HDM</strong> é definido automaticamente quando o time de abertura é{' '}
        <strong>Produto</strong>, <strong>Homologações</strong>, <strong>Executivo Local</strong> ou{' '}
        <strong>Modelo Virtual</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Time (abertura)
          <select
            value={draft.time_abertura}
            onChange={(e) => {
              const v = e.target.value;
              const inf = inferirHdmResponsavelPorNomesTimes(v ? [v] : []);
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      time_abertura: v,
                      abertura_responsavel_nome: responsaveisDoTimeMoni(v).includes(d.abertura_responsavel_nome)
                        ? d.abertura_responsavel_nome
                        : '',
                      tipo: inf ? 'hdm' : 'padrao',
                      hdm_responsavel: inf ?? '',
                    }
                  : d,
              );
            }}
            className={selectClass}
          >
            <option value="">Selecione</option>
            {timesSireneEditOpcoes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Responsável (abertura)
          <select
            value={draft.abertura_responsavel_nome}
            onChange={(e) => setDraft((d) => (d ? { ...d, abertura_responsavel_nome: e.target.value } : d))}
            disabled={!draft.time_abertura}
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">—</option>
            {responsaveisDoTimeMoni(draft.time_abertura).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
        Prazo
        <input
          type="date"
          value={draft.data}
          onChange={(e) => setDraft((d) => (d ? { ...d, data: e.target.value } : d))}
          className={inputClass}
        />
      </label>
      {draft.tipo === 'hdm' && draft.hdm_responsavel ? (
        <p className="text-[11px] text-[color:var(--moni-text-secondary)]">
          Classificação: <strong>HDM</strong> — time responsável: <strong>{draft.hdm_responsavel}</strong>
        </p>
      ) : null}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
          checked={draft.trava}
          onChange={(e) => setDraft((d) => (d ? { ...d, trava: e.target.checked } : d))}
        />
        Trava
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={salvando}
          onClick={onSalvar}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={onCancelar}
          className="rounded-lg border border-[color:var(--moni-border-default)] px-3 py-1.5 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
