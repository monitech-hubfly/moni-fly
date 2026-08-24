'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import type { KanbanFase } from './types';
import { KANBAN_BOARD_FILTROS_DEFAULT, type KanbanBoardFiltros } from './kanbanBoardFiltros';

type SecaoId = 'fase' | 'responsavel' | 'sla' | 'status' | 'especial' | 'corretor' | 'imobiliaria' | 'tipologia';

const def = KANBAN_BOARD_FILTROS_DEFAULT;

function computeExpandedInicial(f: KanbanBoardFiltros): Record<SecaoId, boolean> {
  const hasFase = f.fase !== def.fase;
  const hasResp = f.responsavel !== def.responsavel;
  const hasSla = f.sla !== def.sla;
  const hasStatus = f.status !== def.status;
  const hasEspecial = f.especial !== def.especial;
  const hasCorretor = (f.corretor ?? 'todos') !== 'todos';
  const hasImob = (f.imobiliaria ?? 'todos') !== 'todos';
  const hasTip = (f.tipologia ?? 'todos') !== 'todos';
  const algum =
    hasFase || hasResp || hasSla || hasStatus || hasEspecial || hasCorretor || hasImob || hasTip;
  if (!algum) {
    return {
      fase: false,
      responsavel: false,
      sla: false,
      status: false,
      especial: false,
      corretor: false,
      imobiliaria: false,
      tipologia: false,
    };
  }
  return {
    fase: hasFase,
    responsavel: hasResp,
    sla: hasSla,
    status: hasStatus,
    especial: hasEspecial,
    corretor: hasCorretor,
    imobiliaria: hasImob,
    tipologia: hasTip,
  };
}

function badgeFase(f: KanbanBoardFiltros, fases: KanbanFase[]): string | null {
  if (f.fase === def.fase) return null;
  return fases.find((x) => x.id === f.fase)?.nome ?? f.fase.slice(0, 8);
}

function badgeResponsavel(
  f: KanbanBoardFiltros,
  opcoes: { id: string; nome: string }[],
): string | null {
  if (f.responsavel === def.responsavel) return null;
  if (f.responsavel === 'eu') return 'Eu';
  return opcoes.find((r) => r.id === f.responsavel)?.nome ?? f.responsavel.slice(0, 8);
}

function badgeSla(f: KanbanBoardFiltros): string | null {
  if (f.sla === def.sla) return null;
  const map: Record<string, string> = {
    atrasados: 'Atrasados',
    vence_hoje: 'Vence hoje',
    dentro_prazo: 'Dentro do prazo',
  };
  return map[f.sla] ?? f.sla;
}

function badgeStatus(f: KanbanBoardFiltros): string | null {
  if (f.status === def.status) return null;
  const map: Record<string, string> = {
    arquivados: 'Arquivados',
    concluidos: 'Concluídos',
    perdas: 'Perdas',
    ganhos: 'Ganhos',
  };
  return map[f.status] ?? f.status;
}

function badgeEspecial(f: KanbanBoardFiltros): string | null {
  if (f.especial === def.especial) return null;
  const map: Record<string, string> = {
    somente: '⭐ Especial',
    nao: 'Sem especial',
  };
  return map[f.especial] ?? f.especial;
}

const radioRow = 'flex flex-wrap gap-x-2 gap-y-1 text-xs';
const radioLabel = 'inline-flex cursor-pointer items-center gap-1 text-xs';
const radioClass = 'h-3 w-3 shrink-0 border-stone-300 text-[color:var(--moni-navy-600)] focus:ring-[color:var(--moni-navy-400)]';

function SecaoColapsavel({
  titulo,
  expandido,
  onToggle,
  badge,
  children,
}: {
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

type Props = {
  draft: KanbanBoardFiltros;
  setDraft: Dispatch<SetStateAction<KanbanBoardFiltros>>;
  fases: KanbanFase[];
  responsaveisOpcoes: { id: string; nome: string }[];
  showFiltroEu: boolean;
  /** Exibe opções Perdas/Ganhos no filtro STATUS (Kanban Funding). */
  showPerdaGanhoFiltros?: boolean;
  /** Funil Corretores — opções derivadas dos cards. */
  corretoresOpcoes?: string[];
  imobiliariasOpcoes?: string[];
  tipologiasOpcoes?: string[];
  onLimpar: () => void;
  onAplicar: () => void;
};

export function KanbanBoardFiltrosPanel({
  draft,
  setDraft,
  fases,
  responsaveisOpcoes,
  showFiltroEu,
  showPerdaGanhoFiltros = false,
  corretoresOpcoes = [],
  imobiliariasOpcoes = [],
  tipologiasOpcoes = [],
  onLimpar,
  onAplicar,
}: Props) {
  const [expanded, setExpanded] = useState<Record<SecaoId, boolean>>(() => computeExpandedInicial(draft));
  const showCorretoresFiltros =
    corretoresOpcoes.length > 0 || imobiliariasOpcoes.length > 0 || tipologiasOpcoes.length > 0;

  const badges = useMemo(
    () => ({
      fase: badgeFase(draft, fases),
      responsavel: badgeResponsavel(draft, responsaveisOpcoes),
      sla: badgeSla(draft),
      status: badgeStatus(draft),
      especial: badgeEspecial(draft),
      corretor: (draft.corretor ?? 'todos') !== 'todos' ? draft.corretor! : null,
      imobiliaria: (draft.imobiliaria ?? 'todos') !== 'todos' ? draft.imobiliaria! : null,
      tipologia: (draft.tipologia ?? 'todos') !== 'todos' ? draft.tipologia! : null,
    }),
    [draft, fases, responsaveisOpcoes],
  );

  const toggle = (id: SecaoId) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const fasesOrdenadas = useMemo(() => [...fases].sort((a, b) => a.ordem - b.ordem), [fases]);

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
        <SecaoColapsavel
          titulo="Fase"
          expandido={expanded.fase}
          onToggle={() => toggle('fase')}
          badge={badges.fase}
        >
          <div className={`${radioRow} max-h-32 flex-col flex-nowrap overflow-y-auto`} style={{ color: 'var(--moni-text-primary)' }}>
            <label className={radioLabel}>
              <input
                type="radio"
                name="board-filtro-fase"
                checked={draft.fase === 'todas'}
                onChange={() => setDraft((d) => ({ ...d, fase: 'todas' }))}
                className={radioClass}
              />
              Todas
            </label>
            {fasesOrdenadas.map((fa) => (
              <label key={fa.id} className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-fase"
                  checked={draft.fase === fa.id}
                  onChange={() => setDraft((d) => ({ ...d, fase: fa.id }))}
                  className={radioClass}
                />
                {fa.nome}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Responsável"
          expandido={expanded.responsavel}
          onToggle={() => toggle('responsavel')}
          badge={badges.responsavel}
        >
          <div className={`${radioRow} max-h-28 flex-col flex-nowrap overflow-y-auto`} style={{ color: 'var(--moni-text-primary)' }}>
            <label className={radioLabel}>
              <input
                type="radio"
                name="board-filtro-resp"
                checked={draft.responsavel === 'todos'}
                onChange={() => setDraft((d) => ({ ...d, responsavel: 'todos' }))}
                className={radioClass}
              />
              Todos
            </label>
            {showFiltroEu ? (
              <label className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-resp"
                  checked={draft.responsavel === 'eu'}
                  onChange={() => setDraft((d) => ({ ...d, responsavel: 'eu' }))}
                  className={radioClass}
                />
                Eu
              </label>
            ) : null}
            {responsaveisOpcoes.map((r) => (
              <label key={r.id} className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-resp"
                  checked={draft.responsavel === r.id}
                  onChange={() => setDraft((d) => ({ ...d, responsavel: r.id }))}
                  className={radioClass}
                />
                <span className="max-w-[11rem] truncate">{r.nome}</span>
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel titulo="SLA" expandido={expanded.sla} onToggle={() => toggle('sla')} badge={badges.sla}>
          <div className={radioRow} style={{ color: 'var(--moni-text-primary)' }}>
            {(
              [
                ['todos', 'Todos'],
                ['atrasados', 'Atrasados'],
                ['vence_hoje', 'Vence hoje'],
                ['dentro_prazo', 'Dentro do prazo'],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-sla"
                  checked={draft.sla === v}
                  onChange={() => setDraft((d) => ({ ...d, sla: v }))}
                  className={radioClass}
                />
                {lab}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Status"
          expandido={expanded.status}
          onToggle={() => toggle('status')}
          badge={badges.status}
        >
          <div className={radioRow} style={{ color: 'var(--moni-text-primary)' }}>
            {(
              [
                ['ativos', 'Ativos'],
                ['arquivados', 'Arquivados'],
                ...(showPerdaGanhoFiltros
                  ? ([
                      ['perdas', 'Perdas'],
                      ['ganhos', 'Ganhos'],
                    ] as const)
                  : []),
                ['concluidos', 'Concluídos'],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-status"
                  checked={draft.status === v}
                  onChange={() => setDraft((d) => ({ ...d, status: v }))}
                  className={radioClass}
                />
                {lab}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Especial"
          expandido={expanded.especial}
          onToggle={() => toggle('especial')}
          badge={badges.especial}
        >
          <div className={radioRow} style={{ color: 'var(--moni-text-primary)' }}>
            {(
              [
                ['todos', 'Todos'],
                ['somente', '⭐ Somente especiais'],
                ['nao', 'Sem especial'],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-especial"
                  checked={draft.especial === v}
                  onChange={() => setDraft((d) => ({ ...d, especial: v }))}
                  className={radioClass}
                />
                {lab}
              </label>
            ))}
          </div>
        </SecaoColapsavel>

        {showCorretoresFiltros && corretoresOpcoes.length > 0 ? (
          <SecaoColapsavel
            titulo="Corretor"
            expandido={expanded.corretor}
            onToggle={() => toggle('corretor')}
            badge={badges.corretor}
          >
            <div
              className={`${radioRow} max-h-28 flex-col flex-nowrap overflow-y-auto`}
              style={{ color: 'var(--moni-text-primary)' }}
            >
              <label className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-corretor"
                  checked={(draft.corretor ?? 'todos') === 'todos'}
                  onChange={() => setDraft((d) => ({ ...d, corretor: 'todos' }))}
                  className={radioClass}
                />
                Todos
              </label>
              {corretoresOpcoes.map((nome) => (
                <label key={nome} className={radioLabel}>
                  <input
                    type="radio"
                    name="board-filtro-corretor"
                    checked={draft.corretor === nome}
                    onChange={() => setDraft((d) => ({ ...d, corretor: nome }))}
                    className={radioClass}
                  />
                  <span className="max-w-[11rem] truncate">{nome}</span>
                </label>
              ))}
            </div>
          </SecaoColapsavel>
        ) : null}

        {showCorretoresFiltros && imobiliariasOpcoes.length > 0 ? (
          <SecaoColapsavel
            titulo="Imobiliária"
            expandido={expanded.imobiliaria}
            onToggle={() => toggle('imobiliaria')}
            badge={badges.imobiliaria}
          >
            <div
              className={`${radioRow} max-h-28 flex-col flex-nowrap overflow-y-auto`}
              style={{ color: 'var(--moni-text-primary)' }}
            >
              <label className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-imob"
                  checked={(draft.imobiliaria ?? 'todos') === 'todos'}
                  onChange={() => setDraft((d) => ({ ...d, imobiliaria: 'todos' }))}
                  className={radioClass}
                />
                Todas
              </label>
              {imobiliariasOpcoes.map((nome) => (
                <label key={nome} className={radioLabel}>
                  <input
                    type="radio"
                    name="board-filtro-imob"
                    checked={draft.imobiliaria === nome}
                    onChange={() => setDraft((d) => ({ ...d, imobiliaria: nome }))}
                    className={radioClass}
                  />
                  <span className="max-w-[11rem] truncate">{nome}</span>
                </label>
              ))}
            </div>
          </SecaoColapsavel>
        ) : null}

        {showCorretoresFiltros && tipologiasOpcoes.length > 0 ? (
          <SecaoColapsavel
            titulo="Tipologia"
            expandido={expanded.tipologia}
            onToggle={() => toggle('tipologia')}
            badge={badges.tipologia}
          >
            <div
              className={`${radioRow} max-h-28 flex-col flex-nowrap overflow-y-auto`}
              style={{ color: 'var(--moni-text-primary)' }}
            >
              <label className={radioLabel}>
                <input
                  type="radio"
                  name="board-filtro-tipologia"
                  checked={(draft.tipologia ?? 'todos') === 'todos'}
                  onChange={() => setDraft((d) => ({ ...d, tipologia: 'todos' }))}
                  className={radioClass}
                />
                Todas
              </label>
              {tipologiasOpcoes.map((nome) => (
                <label key={nome} className={radioLabel}>
                  <input
                    type="radio"
                    name="board-filtro-tipologia"
                    checked={draft.tipologia === nome}
                    onChange={() => setDraft((d) => ({ ...d, tipologia: nome }))}
                    className={radioClass}
                  />
                  <span className="max-w-[11rem] truncate">{nome}</span>
                </label>
              ))}
            </div>
          </SecaoColapsavel>
        ) : null}
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
