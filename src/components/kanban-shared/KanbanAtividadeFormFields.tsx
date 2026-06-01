'use client';

import { Trash2 } from 'lucide-react';
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { nomesTimesIncluemBombeiro } from '@/lib/kanban/chamados-validacao';
import type { KanbanTimeRow } from './kanban-card-modal-helpers';
import { AnexosAtividadeDraft } from './AnexosAtividadeDraft';
import { AnexosSubchamado, type AnexosSubchamadoProps } from './AnexosSubchamado';

export type AtividadeFormDraft = {
  nome: string;
  descricaoDetalhe: string;
  data: string;
  timesIds: string[];
  responsaveisIds: string[];
  trava: boolean;
  status: SubInteracaoStatusDb;
  pastel: boolean;
  /** Anexos selecionados antes de salvar a atividade. */
  pendingAnexos?: File[];
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
  pendingAnexos: [],
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
  /** Exibe ícone de excluir (limpar formulário ou excluir atividade existente). */
  onDelete?: () => void;
  deleteTitle?: string;
  /** Anexos de atividade já salva. */
  anexosSubchamado?: Omit<AnexosSubchamadoProps, 'subchamadoId'> & { subchamadoId: string };
  /** Permite anexos em rascunho antes de salvar. */
  showAnexosDraft?: boolean;
};

const listBoxClass =
  'flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded border border-stone-200 bg-white p-2';

export function KanbanAtividadeFormFields({
  draft,
  setDraft,
  kanbanTimes,
  responsaveisOpcoes,
  sessionUserId,
  compact = false,
  showPastel = true,
  idPrefix = 'ativ',
  onDelete,
  deleteTitle = 'Excluir atividade',
  anexosSubchamado,
  showAnexosDraft = true,
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
  const pendingAnexos = draft.pendingAnexos ?? [];

  return (
    <div className={`flex flex-col gap-2 ${text}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
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
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="mt-0.5 shrink-0 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
            title={deleteTitle}
            aria-label={deleteTitle}
          >
            <Trash2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block min-w-0">
          <span className="mb-0.5 block font-medium text-stone-600">Prazo limite</span>
          <input
            type="date"
            value={draft.data}
            onChange={(e) => setDraft((d) => ({ ...d, data: e.target.value }))}
            className={`w-full px-2 ${py}`}
            style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
          />
        </label>
        <label className="block min-w-0">
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
        <label className="flex min-h-[2.25rem] cursor-pointer items-end gap-2 pb-1 text-stone-700 sm:pb-1.5">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 shrink-0"
            checked={draft.trava}
            onChange={(e) => setDraft((d) => ({ ...d, trava: e.target.checked }))}
          />
          <span className="leading-snug">Trava - não consigo avançar sem</span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <span className="mb-1 block font-medium text-stone-600">Times</span>
          <div className={listBoxClass}>
            {kanbanTimes.map((t) => {
              const on = draft.timesIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-1.5 text-stone-700"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 rounded border-stone-300"
                    checked={on}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDraft((d) => ({
                        ...d,
                        timesIds: checked
                          ? [...d.timesIds, t.id]
                          : d.timesIds.filter((id) => id !== t.id),
                        responsaveisIds:
                          !checked && d.timesIds.length === 1 && d.timesIds[0] === t.id
                            ? []
                            : d.responsaveisIds,
                      }));
                    }}
                  />
                  {t.nome}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <span className="mb-1 block font-medium text-stone-600">Responsáveis</span>
          {draft.timesIds.length === 0 ? (
            <p className="rounded border border-stone-200 bg-stone-50 p-2 text-stone-500">
              Selecione ao menos um time.
            </p>
          ) : (
            <div className={listBoxClass}>
              {responsaveisOpcoes.map((p) => {
                const on = draft.responsaveisIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-1.5 text-stone-700"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0 rounded border-stone-300"
                      checked={on}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDraft((d) => ({
                          ...d,
                          responsaveisIds: checked
                            ? [...d.responsaveisIds, p.id]
                            : d.responsaveisIds.filter((id) => id !== p.id),
                        }));
                      }}
                    />
                    {p.nome}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(showAnexosDraft || anexosSubchamado) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2">
          {showAnexosDraft ? (
            <AnexosAtividadeDraft
              files={pendingAnexos}
              onChange={(files) => setDraft((d) => ({ ...d, pendingAnexos: files }))}
              compact={compact}
            />
          ) : null}
          {anexosSubchamado ? (
            <AnexosSubchamado
              subchamadoId={anexosSubchamado.subchamadoId}
              uploader_nome={anexosSubchamado.uploader_nome}
              basePath={anexosSubchamado.basePath}
              sessionUserId={anexosSubchamado.sessionUserId}
              sessionEhAdminOuTeam={anexosSubchamado.sessionEhAdminOuTeam}
            />
          ) : null}
        </div>
      )}

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
