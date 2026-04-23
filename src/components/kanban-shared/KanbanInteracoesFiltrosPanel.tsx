'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import type { InteracaoModal, KanbanTimeRow } from './kanban-card-modal-helpers';

export type ListaInteracoesModal = 'abertas' | 'concluidas' | 'todas';
export type SituacaoFiltroModal = 'qualquer' | InteracaoModal['status'];
export type OrdenacaoInteracoesModal = 'prazo_asc' | 'prazo_desc' | 'criado_asc' | 'criado_desc';

export type KanbanModalInteracoesFiltros = {
  lista: ListaInteracoesModal;
  situacao: SituacaoFiltroModal;
  time: string;
  responsavel: string;
  ordenacao: OrdenacaoInteracoesModal;
  busca: string;
};

export const KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT: KanbanModalInteracoesFiltros = {
  lista: 'abertas',
  situacao: 'qualquer',
  time: 'todos',
  responsavel: 'todos',
  ordenacao: 'prazo_asc',
  busca: '',
};

export function countKanbanModalInteracoesFiltrosAtivos(f: KanbanModalInteracoesFiltros): number {
  const d = KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT;
  let n = 0;
  if (f.lista !== d.lista) n++;
  if ((f.lista === 'abertas' || f.lista === 'todas') && f.situacao !== d.situacao) n++;
  if (f.time !== d.time) n++;
  if (f.responsavel !== d.responsavel) n++;
  if (f.ordenacao !== d.ordenacao) n++;
  if (f.busca.trim() !== '') n++;
  return n;
}

type SecaoFiltroId = 'lista' | 'situacao' | 'time' | 'responsavel' | 'ordenar';

const def = KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT;

function computeExpandedInicial(f: KanbanModalInteracoesFiltros): Record<SecaoFiltroId, boolean> {
  const hasLista = f.lista !== def.lista;
  const hasSit = (f.lista === 'abertas' || f.lista === 'todas') && f.situacao !== def.situacao;
  const hasTime = f.time !== def.time;
  const hasResp = f.responsavel !== def.responsavel;
  const hasOrd = f.ordenacao !== def.ordenacao;
  const algum = hasLista || hasSit || hasTime || hasResp || hasOrd;
  if (!algum) {
    return { lista: false, situacao: false, time: false, responsavel: false, ordenar: false };
  }
  return {
    lista: hasLista,
    situacao: hasSit,
    time: hasTime,
    responsavel: hasResp,
    ordenar: hasOrd,
  };
}

function badgeLista(f: KanbanModalInteracoesFiltros): string | null {
  if (f.lista === def.lista) return null;
  if (f.lista === 'abertas') return 'Em aberto';
  if (f.lista === 'todas') return 'Todos';
  return 'Concluídos';
}

function badgeSituacao(f: KanbanModalInteracoesFiltros): string | null {
  if (f.lista === 'concluidas') return null;
  if (f.situacao === def.situacao) return null;
  const map: Record<string, string> = {
    qualquer: 'Qualquer',
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };
  return map[f.situacao] ?? f.situacao;
}

function badgeTime(f: KanbanModalInteracoesFiltros, times: KanbanTimeRow[]): string | null {
  if (f.time === def.time) return null;
  const nome = times.find((t) => t.id === f.time)?.nome;
  return nome ?? f.time.slice(0, 8);
}

function badgeResponsavel(
  f: KanbanModalInteracoesFiltros,
  opcoes: { id: string; nome: string }[],
): string | null {
  if (f.responsavel === def.responsavel) return null;
  return opcoes.find((r) => r.id === f.responsavel)?.nome ?? f.responsavel.slice(0, 8);
}

function badgeOrdenar(f: KanbanModalInteracoesFiltros): string | null {
  if (f.ordenacao === def.ordenacao) return null;
  const map: Record<OrdenacaoInteracoesModal, string> = {
    prazo_asc: 'Prazo ↑',
    prazo_desc: 'Prazo ↓',
    criado_asc: 'Criado ↑',
    criado_desc: 'Criado ↓',
  };
  return map[f.ordenacao] ?? f.ordenacao;
}

type Props = {
  draft: KanbanModalInteracoesFiltros;
  setDraft: Dispatch<SetStateAction<KanbanModalInteracoesFiltros>>;
  kanbanTimes: KanbanTimeRow[];
  responsaveisOpcoes: { id: string; nome: string }[];
  onLimpar: () => void;
  onAplicar: () => void;
};

const radioRow = 'flex flex-wrap gap-1 text-xs';
const radioLabel = 'inline-flex cursor-pointer items-center gap-1 text-xs';
const radioClass = 'h-3 w-3 shrink-0 border-stone-300 text-[color:var(--moni-navy-600)] focus:ring-[color:var(--moni-navy-400)]';

function SecaoColapsavel({
  id,
  titulo,
  expandido,
  onToggle,
  badge,
  children,
}: {
  id: SecaoFiltroId;
  titulo: string;
  expandido: boolean;
  onToggle: () => void;
  badge: string | null;
  children: ReactNode;
}) {
  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: 'var(--moni-border-default)' }}
      data-secao={id}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-1 py-1.5 text-left transition-colors hover:bg-stone-50/80"
      >
        <span className="min-w-0 flex flex-1 items-center gap-1 truncate">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--moni-text-tertiary)' }}
          >
            {titulo}
          </span>
          {badge ? (
            <span
              className="max-w-[7rem] truncate rounded px-1 py-0.5 text-[9px] font-semibold"
              style={{
                background: 'var(--moni-surface-100)',
                color: 'var(--moni-text-secondary)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-stone-500" aria-hidden>
          {expandido ? '▾' : '▸'}
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${expandido ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-2 pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function KanbanInteracoesFiltrosPanel({
  draft,
  setDraft,
  kanbanTimes,
  responsaveisOpcoes,
  onLimpar,
  onAplicar,
}: Props) {
  const situacaoDisabled = draft.lista === 'concluidas';

  const [expanded, setExpanded] = useState<Record<SecaoFiltroId, boolean>>(() => computeExpandedInicial(draft));

  const badges = useMemo(
    () => ({
      lista: badgeLista(draft),
      situacao: badgeSituacao(draft),
      time: badgeTime(draft, kanbanTimes),
      responsavel: badgeResponsavel(draft, responsaveisOpcoes),
      ordenar: badgeOrdenar(draft),
    }),
    [draft, kanbanTimes, responsaveisOpcoes],
  );

  const toggle = (id: SecaoFiltroId) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div
      className="rounded-xl border p-2 shadow-xl"
      style={{
        borderColor: 'var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
        boxShadow: 'var(--moni-shadow-sm), 0 12px 40px rgba(12, 38, 51, 0.12)',
      }}
    >
      <div className="max-h-[min(70vh,32rem)] space-y-1.5 overflow-y-auto pr-0.5 text-xs">
        <label className="block text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
            Buscar
          </span>
          <input
            type="search"
            value={draft.busca}
            onChange={(e) => setDraft((d) => ({ ...d, busca: e.target.value }))}
            placeholder="Buscar…"
            className="mt-0.5 w-full rounded-lg px-2 py-1 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-1"
            style={{
              border: '0.5px solid var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
              color: 'var(--moni-text-primary)',
              boxShadow: '0 0 0 1px transparent',
            }}
          />
        </label>

        <SecaoColapsavel
          id="lista"
          titulo="Lista"
          expandido={expanded.lista}
          onToggle={() => toggle('lista')}
          badge={badges.lista}
        >
          <div className={radioRow} style={{ color: 'var(--moni-text-primary)' }}>
            {(
              [
                ['abertas', 'Em aberto'],
                ['todas', 'Todos'],
                ['concluidas', 'Concluídos'],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={radioLabel}>
                <input
                  type="radio"
                  name="modal-filtro-lista"
                  checked={draft.lista === v}
                  onChange={() =>
                    setDraft((d) => ({
                      ...d,
                      lista: v,
                      situacao: v === 'abertas' && d.situacao === 'concluida' ? 'qualquer' : d.situacao,
                    }))
                  }
                  className={radioClass}
                />
                {lab}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          id="situacao"
          titulo="Situação"
          expandido={expanded.situacao}
          onToggle={() => toggle('situacao')}
          badge={badges.situacao}
        >
          <div
            className={`${radioRow} ${situacaoDisabled ? 'pointer-events-none opacity-45' : ''}`}
            style={{ color: 'var(--moni-text-primary)' }}
          >
            {(
              [
                ['qualquer', 'Qualquer'],
                ['pendente', 'Pendente'],
                ['em_andamento', 'Em andamento'],
                ['concluida', 'Concluída'],
                ['cancelada', 'Cancelada'],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={radioLabel}>
                <input
                  type="radio"
                  name="modal-filtro-situacao"
                  checked={draft.situacao === v}
                  disabled={situacaoDisabled}
                  onChange={() => setDraft((d) => ({ ...d, situacao: v }))}
                  className={radioClass}
                />
                {lab}
              </label>
            ))}
          </div>
          {situacaoDisabled ? (
            <p className="mt-1 text-[10px] leading-tight" style={{ color: 'var(--moni-text-tertiary)' }}>
              Com &ldquo;Concluídos&rdquo; na lista, a situação não se aplica.
            </p>
          ) : null}
        </SecaoColapsavel>

        <SecaoColapsavel
          id="time"
          titulo="Time"
          expandido={expanded.time}
          onToggle={() => toggle('time')}
          badge={badges.time}
        >
          <div
            className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs transition-all"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <label className={radioLabel}>
              <input
                type="radio"
                name="modal-filtro-time"
                checked={draft.time === 'todos'}
                onChange={() => setDraft((d) => ({ ...d, time: 'todos' }))}
                className={radioClass}
              />
              Todos
            </label>
            {kanbanTimes.map((t) => (
              <label key={t.id} className={radioLabel}>
                <input
                  type="radio"
                  name="modal-filtro-time"
                  checked={draft.time === t.id}
                  onChange={() => setDraft((d) => ({ ...d, time: t.id }))}
                  className={radioClass}
                />
                {t.nome}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          id="responsavel"
          titulo="Responsável"
          expandido={expanded.responsavel}
          onToggle={() => toggle('responsavel')}
          badge={badges.responsavel}
        >
          <div
            className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs transition-all"
            style={{ color: 'var(--moni-text-primary)' }}
          >
            <label className={radioLabel}>
              <input
                type="radio"
                name="modal-filtro-resp"
                checked={draft.responsavel === 'todos'}
                onChange={() => setDraft((d) => ({ ...d, responsavel: 'todos' }))}
                className={radioClass}
              />
              Todos
            </label>
            {responsaveisOpcoes.map((r) => (
              <label key={r.id} className={radioLabel}>
                <input
                  type="radio"
                  name="modal-filtro-resp"
                  checked={draft.responsavel === r.id}
                  onChange={() => setDraft((d) => ({ ...d, responsavel: r.id }))}
                  className={radioClass}
                />
                {r.nome}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          id="ordenar"
          titulo="Ordenar"
          expandido={expanded.ordenar}
          onToggle={() => toggle('ordenar')}
          badge={badges.ordenar}
        >
          <div className={radioRow} style={{ color: 'var(--moni-text-primary)' }}>
            {(
              [
                ['prazo_asc', 'Prazo ↑'],
                ['prazo_desc', 'Prazo ↓'],
                ['criado_asc', 'Criado ↑'],
                ['criado_desc', 'Criado ↓'],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={radioLabel}>
                <input
                  type="radio"
                  name="modal-filtro-ordem"
                  checked={draft.ordenacao === v}
                  onChange={() => setDraft((d) => ({ ...d, ordenacao: v }))}
                  className={radioClass}
                />
                {lab}
              </label>
            ))}
          </div>
        </SecaoColapsavel>
      </div>

      <div
        className="mt-1.5 flex flex-wrap gap-1 border-t pt-1.5"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <button
          type="button"
          onClick={onLimpar}
          className="rounded-lg border px-2 py-0.5 text-xs font-medium transition hover:opacity-95"
          style={{
            borderColor: 'var(--moni-border-default)',
            background: 'var(--moni-surface-50)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onAplicar}
          className="rounded-lg px-2 py-0.5 text-xs font-medium text-[var(--moni-text-inverse)] transition hover:opacity-95"
          style={{ background: 'var(--moni-navy-800)' }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
