'use client';

import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { nomesTimesIncluemBombeiro } from '@/lib/kanban/chamados-validacao';
import type { KanbanTimeRow } from './kanban-card-modal-helpers';

export type AtividadeFormDraft = {
  nome: string;
  descricaoDetalhe: string;
  data: string;
  timesIds: string[];
  responsaveisIds: string[];
  trava: boolean;
  status: SubInteracaoStatusDb;
  pastel: boolean;
};

export const ATIVIDADE_FORM_DRAFT_VAZIO: AtividadeFormDraft = {
  nome: '',
  descricaoDetalhe: '',
  data: '',
  timesIds: [],
  responsaveisIds: [],
  trava: false,
  status: 'nao_iniciado',
  pastel: false,
};

type Props = {
  draft: AtividadeFormDraft;
  setDraft: React.Dispatch<React.SetStateAction<AtividadeFormDraft>>;
  kanbanTimes: KanbanTimeRow[];
  responsaveisOpcoes: { id: string; nome: string }[];
  sessionUserId: string | null;
  compact?: boolean;
  showPastel?: boolean;
  idPrefix?: string;
};

export function KanbanAtividadeFormFields({
  draft,
  setDraft,
  kanbanTimes,
  responsaveisOpcoes,
  sessionUserId,
  compact = false,
  showPastel = true,
  idPrefix = 'ativ',
}: Props) {
  const timesNomes = draft.timesIds
    .map((id) => kanbanTimes.find((t) => t.id === id)?.nome?.trim())
    .filter((n): n is string => Boolean(n));
  const bombeiro = nomesTimesIncluemBombeiro(timesNomes);
  const podePastel =
    showPastel &&
    !bombeiro &&
    draft.responsaveisIds.length > 0 &&
    sessionUserId != null &&
    draft.responsaveisIds.includes(sessionUserId);

  const py = compact ? 'py-1' : 'py-1.5';
  const text = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div className={`flex flex-col gap-2 ${text}`}>
      <input
        type="text"
        value={draft.nome}
        onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
        placeholder="Nome da atividade"
        className={`w-full px-2 ${py}`}
        style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
      />
      <textarea
        value={draft.descricaoDetalhe}
        onChange={(e) => setDraft((d) => ({ ...d, descricaoDetalhe: e.target.value }))}
        placeholder="Descrição (opcional)"
        rows={2}
        className={`w-full resize-y px-2 ${py}`}
        style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
      />
      <label className="block">
        <span className="mb-0.5 block font-medium text-stone-600">Prazo limite</span>
        <input
          type="date"
          value={draft.data}
          onChange={(e) => setDraft((d) => ({ ...d, data: e.target.value }))}
          className={`w-full px-2 ${py}`}
          style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
        />
      </label>
      <div>
        <span className="mb-1 block font-medium text-stone-600">Times</span>
        <div className="flex flex-wrap gap-1">
          {kanbanTimes.map((t) => {
            const on = draft.timesIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    timesIds: on ? d.timesIds.filter((id) => id !== t.id) : [...d.timesIds, t.id],
                    responsaveisIds: on && d.timesIds.length === 1 ? [] : d.responsaveisIds,
                  }))
                }
                className={`rounded-full px-2 py-0.5 font-medium ${on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}`}
              >
                {t.nome}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className="mb-1 block font-medium text-stone-600">Responsáveis</span>
        {draft.timesIds.length === 0 ? (
          <p className="text-stone-500">Selecione ao menos um time.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {responsaveisOpcoes.map((p) => {
              const on = draft.responsaveisIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      responsaveisIds: on
                        ? d.responsaveisIds.filter((id) => id !== p.id)
                        : [...d.responsaveisIds, p.id],
                    }))
                  }
                  className={`rounded-full px-2 py-0.5 font-medium ${on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}`}
                >
                  {p.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-stone-700">
        <input
          type="checkbox"
          className="h-3.5 w-3.5"
          checked={draft.trava}
          onChange={(e) => setDraft((d) => ({ ...d, trava: e.target.checked }))}
        />
        Trava - não consigo avançar sem
      </label>
      <label className="block">
        <span className="mb-0.5 block font-medium text-stone-600">Status</span>
        <select
          value={draft.status}
          onChange={(e) =>
            setDraft((d) => ({ ...d, status: e.target.value as SubInteracaoStatusDb }))
          }
          className={`w-full px-2 ${py}`}
          style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
          id={`${idPrefix}-status`}
        >
          <option value="nao_iniciado">Não Iniciado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
        </select>
      </label>
      {podePastel ? (
        <label className="flex cursor-pointer items-center gap-2 text-stone-700">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={draft.pastel}
            onChange={(e) => setDraft((d) => ({ ...d, pastel: e.target.checked }))}
          />
          Pastel
        </label>
      ) : null}
    </div>
  );
}
