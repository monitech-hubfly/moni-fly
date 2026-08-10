'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { useAgenda, AtividadeAgenda, DiaAgenda } from '@/hooks/useAgenda';
import { createClient } from '@/lib/supabase/client';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { SireneChamadoBacklogWrapper } from './BacklogBloco';
import type { DadosAgendamento } from './ModalAgendamento';
import type { RecorrenciaEscopo } from '@/hooks/useModalAgendamento';

const HORA_INICIO   = 8;
const HORA_FIM      = 20;
const TOTAL_HORAS   = HORA_FIM - HORA_INICIO;
const ALTURA_HORA   = 60;
const ALTURA_GRADE  = TOTAL_HORAS * ALTURA_HORA;
const LARGURA_HORAS = 56;

// ── Slot droppable ────────────────────────────────────────────────────────────
function DroppableSlot({ dateStr, hora }: { dateStr: string; hora: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop::${dateStr}::${String(hora).padStart(2, '0')}`,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        height: ALTURA_HORA,
        borderBottom: '1px solid #f3f4f6',
        backgroundColor: isOver ? 'rgba(55,138,221,0.10)' : undefined,
        transition: 'background-color 0.1s',
      }}
    />
  );
}

// ── Card de atividade agendada ────────────────────────────────────────────────
// ── Layout de sobreposição (igual Google Calendar) ────────────────────────────
function calcularLayoutSobreposicao(atividades: AtividadeAgenda[]): Map<string, { colIndex: number; totalCols: number }> {
  const result = new Map<string, { colIndex: number; totalCols: number }>();

  // Converter hora "HH:MM" para minutos
  const toMin = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return (hh ?? 0) * 60 + (mm ?? 0);
  };

  const sorted = [...atividades].sort((a, b) => toMin(a.hora_inicio) - toMin(b.hora_inicio));

  // Grupos de eventos que se sobrepõem
  const grupos: AtividadeAgenda[][] = [];

  for (const atv of sorted) {
    const inicio = toMin(atv.hora_inicio);
    const fim    = atv.hora_fim ? toMin(atv.hora_fim) : inicio + 60;

    let adicionado = false;
    for (const grupo of grupos) {
      // Verifica se sobrepõe com qualquer evento do grupo
      const sobrepoe = grupo.some(g => {
        const gInicio = toMin(g.hora_inicio);
        const gFim    = g.hora_fim ? toMin(g.hora_fim) : gInicio + 60;
        return inicio < gFim && fim > gInicio;
      });
      if (sobrepoe) {
        grupo.push(atv);
        adicionado = true;
        break;
      }
    }
    if (!adicionado) grupos.push([atv]);
  }

  // Atribuir colIndex e totalCols dentro de cada grupo
  for (const grupo of grupos) {
    const totalCols = grupo.length;
    grupo.forEach((atv, idx) => {
      result.set(atv.id, { colIndex: idx, totalCols });
    });
  }

  return result;
}

function AgendaCard({
  atv,
  colIndex,
  totalCols,
  onAbrirParaEditar,
  onConcluir,
  onDesconcluir,
  onAtualizarHorario,
  onAtualizarHorarioInicio,
  onDragStart,
}: {
  atv: AtividadeAgenda;
  colIndex: number;
  totalCols: number;
  onAbrirParaEditar: (id: string) => void;
  onConcluir: (atv: AtividadeAgenda) => void;
  onDesconcluir: (id: string) => void;
  onAtualizarHorario: (id: string, hora_fim: string) => Promise<void>;
  onAtualizarHorarioInicio: (id: string, hora_inicio: string) => Promise<void>;
  onDragStart: (atv: AtividadeAgenda, e: React.MouseEvent) => void;
}) {
  const [h, m] = atv.hora_inicio.split(':').map(Number);
  const topPx  = (h - HORA_INICIO) * ALTURA_HORA + (m ?? 0);

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const isVencido = !atv.concluido && atv.data < hojeStr;

  const [visualHoraFim, setVisualHoraFim] = useState<string | null>(null);
  const visualHoraFimRef = useRef<string | null>(null);
  const [visualHoraInicio, setVisualHoraInicio] = useState<string | null>(null);
  const visualHoraInicioRef = useRef<string | null>(null);
  const resizingRef = useRef(false);

  const horaFimEfetiva    = visualHoraFim    ?? atv.hora_fim;
  const horaInicioEfetiva = visualHoraInicio ?? atv.hora_inicio;
  const [hEf, mEf] = horaInicioEfetiva.split(':').map(Number);
  const topPxEfetivo = (hEf - HORA_INICIO) * ALTURA_HORA + (mEf ?? 0);

  let heightPx = 30;
  if (horaFimEfetiva) {
    const [hf, mf] = horaFimEfetiva.split(':').map(Number);
    heightPx = Math.max(30, (hf * 60 + (mf ?? 0)) - (hEf * 60 + (mEf ?? 0)));
  }

  // ── Resize inferior (hora_fim) ──
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizingRef.current = true;

    const startY       = e.clientY;
    const horaFimBase  = horaFimEfetiva ?? `${String(Math.min(HORA_FIM, hEf + 1)).padStart(2, '0')}:00`;
    const [hfb, mfb]   = horaFimBase.split(':').map(Number);
    const minutosBase  = hfb * 60 + mfb;
    const minutosInicio = hEf * 60 + (mEf ?? 0);

    const onMove = (me: MouseEvent) => {
      const delta   = me.clientY - startY;
      const rawMin  = minutosBase + Math.round(delta / ALTURA_HORA * 60 / 15) * 15;
      const clamped = Math.max(minutosInicio + 15, Math.min(HORA_FIM * 60, rawMin));
      const nh = Math.floor(clamped / 60);
      const nm = clamped % 60;
      const newVal = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
      setVisualHoraFim(newVal);
      visualHoraFimRef.current = newVal;
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizingRef.current = false;
      const finalHoraFim = visualHoraFimRef.current;
      if (finalHoraFim && finalHoraFim !== atv.hora_fim) {
        await onAtualizarHorario(atv.id, finalHoraFim);
      }
      setVisualHoraFim(null);
      visualHoraFimRef.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Resize superior (hora_inicio) ──
  const handleResizeTopStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizingRef.current = true;

    const startY         = e.clientY;
    const [hib, mib]     = atv.hora_inicio.split(':').map(Number);
    const minutosBase    = hib * 60 + mib;
    const minutosFim     = horaFimEfetiva
      ? (() => { const [hf, mf] = horaFimEfetiva.split(':').map(Number); return hf * 60 + mf; })()
      : minutosBase + 60;

    const onMove = (me: MouseEvent) => {
      const delta   = me.clientY - startY;
      const rawMin  = minutosBase + Math.round(delta / ALTURA_HORA * 60 / 15) * 15;
      const clamped = Math.max(HORA_INICIO * 60, Math.min(minutosFim - 15, rawMin));
      const nh = Math.floor(clamped / 60);
      const nm = clamped % 60;
      const newVal = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
      setVisualHoraInicio(newVal);
      visualHoraInicioRef.current = newVal;
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizingRef.current = false;
      const finalHoraInicio = visualHoraInicioRef.current;
      if (finalHoraInicio && finalHoraInicio !== atv.hora_inicio) {
        await onAtualizarHorarioInicio(atv.id, finalHoraInicio);
      }
      setVisualHoraInicio(null);
      visualHoraInicioRef.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const colWidthPct  = 100 / totalCols;
  const colLeftPct   = colIndex * colWidthPct;
  const GAP = 2; // px entre colunas

  return (
    <div
      data-atividade="true"
      className="absolute rounded px-1.5 py-0.5 text-white text-xs overflow-hidden select-none group"
      style={{
        top: topPxEfetivo,
        height: heightPx,
        left:  `calc(${colLeftPct}% + ${GAP}px)`,
        width: `calc(${colWidthPct}% - ${GAP * 2}px)`,
        backgroundColor: atv.cor,
        zIndex: 10,
        opacity: atv.concluido ? 0.6 : isVencido ? 0.7 : 1,
        borderTop: isVencido ? '3px solid rgba(239,159,39,0.9)' : undefined,
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        onDragStart(atv, e);
      }}
      onClick={(e) => {
        if (resizingRef.current) return;
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        e.stopPropagation();
      }}
    >
      {/* Handle de resize superior */}
      {!atv.concluido && (
        <div
          data-action="resize-top"
          className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 flex items-center justify-center"
          onMouseDown={handleResizeTopStart}
        >
          <div className="w-8 h-0.5 rounded-full bg-white/60" />
        </div>
      )}
      <div className="flex items-start justify-between gap-1 h-full">
        <div className="flex-1 min-w-0">
          <div className={`font-medium truncate leading-tight ${atv.concluido ? 'line-through opacity-70' : ''}`}>
            {atv.titulo}
          </div>
          {heightPx >= 40 && (
            <div className="opacity-80 text-[10px]">
              {horaInicioEfetiva}{horaFimEfetiva ? ` – ${horaFimEfetiva}` : ''}
              {atv.link_reuniao && (
                <a
                  data-action="link"
                  href={atv.link_reuniao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 underline opacity-80 hover:opacity-100"
                  onClick={e => e.stopPropagation()}
                  title="Abrir link / local da reunião"
                >
                  🔗
                </a>
              )}
            </div>
          )}
        </div>

        {/* Botão concluir — visível no hover */}
        {!atv.concluido && (
          <button
            data-action="concluir"
            type="button"
            title="Marcar como concluído"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 w-4 h-4 rounded-full border border-white/70 flex items-center justify-center hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); onConcluir(atv); }}
          >
            <span className="text-[9px] leading-none">✓</span>
          </button>
        )}

        {/* Botão desfazer conclusão */}
        {atv.concluido && (
          <button
            data-action="desconcluir"
            type="button"
            title="Desfazer conclusão"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 w-4 h-4 rounded-full border border-white/70 flex items-center justify-center hover:bg-white/20 text-[9px] leading-none"
            onClick={(e) => { e.stopPropagation(); onDesconcluir(atv.id); }}
          >
            ↩
          </button>
        )}
      </div>

      {/* Handle de resize — aparece no hover, na borda inferior */}
      {!atv.concluido && (
        <div
          data-action="resize"
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 flex items-center justify-center"
          onMouseDown={handleResizeStart}
        >
          <div className="w-8 h-0.5 rounded-full bg-white/60" />
        </div>
      )}
    </div>
  );
}

// ── Coluna de um dia ──────────────────────────────────────────────────────────
function ColunaDia({
  dia, atividades, onAbrirModal, onAbrirParaEditar, onConcluir, onDesconcluir, onAtualizarHorario, onAtualizarHorarioInicio, onDragStart,
}: {
  dia: DiaAgenda;
  atividades: AtividadeAgenda[];
  onAbrirModal: (p: Partial<DadosAgendamento>) => void;
  onAbrirParaEditar: (id: string) => void;
  onConcluir: (atv: AtividadeAgenda) => void;
  onDesconcluir: (id: string) => void;
  onAtualizarHorario: (id: string, hora_fim: string) => Promise<void>;
  onAtualizarHorarioInicio: (id: string, hora_inicio: string) => Promise<void>;
  onDragStart: (atv: AtividadeAgenda, e: React.MouseEvent) => void;
}) {
  const horas = Array.from({ length: TOTAL_HORAS }, (_, i) => HORA_INICIO + i);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-atividade]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hora = Math.floor((e.clientY - rect.top) / ALTURA_HORA) + HORA_INICIO;
    if (hora >= HORA_INICIO && hora < HORA_FIM) {
      const horaFim = Math.min(23, hora + 1);
      onAbrirModal({
        data:        dia.dateStr,
        hora_inicio: `${String(hora).padStart(2, '0')}:00`,
        hora_fim:    `${String(horaFim).padStart(2, '0')}:00`,
      });
    }
  };

  return (
    <div
      className="flex-1 relative border-l border-gray-100 cursor-pointer"
      style={{ minHeight: ALTURA_GRADE }}
      onClick={handleClick}
    >
      {horas.map(h => <DroppableSlot key={h} dateStr={dia.dateStr} hora={h} />)}
      {(() => {
        const layout = calcularLayoutSobreposicao(atividades);
        return atividades.map(atv => {
          const { colIndex, totalCols } = layout.get(atv.id) ?? { colIndex: 0, totalCols: 1 };
          return (
            <AgendaCard
              key={atv.id}
              atv={atv}
              colIndex={colIndex}
              totalCols={totalCols}
              onAbrirParaEditar={onAbrirParaEditar}
              onConcluir={onConcluir}
              onDesconcluir={onDesconcluir}
              onAtualizarHorario={onAtualizarHorario}
              onAtualizarHorarioInicio={onAtualizarHorarioInicio}
              onDragStart={onDragStart}
            />
          );
        });
      })()}
    </div>
  );
}

// ── Coluna de horas ───────────────────────────────────────────────────────────
function ColunaHoras() {
  return (
    <div style={{ width: LARGURA_HORAS, flexShrink: 0 }}>
      {Array.from({ length: TOTAL_HORAS }, (_, i) => (
        <div key={i} style={{ height: ALTURA_HORA }} className="flex items-start justify-end pr-2 pt-0.5">
          <span className="text-[10px] text-gray-400 leading-none select-none">
            {i === 0 ? '' : `${String(HORA_INICIO + i).padStart(2, '0')}h`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Linha "agora" ─────────────────────────────────────────────────────────────
function LinhaAgora({ semanaOffset }: { semanaOffset: number }) {
  if (semanaOffset !== 0) return null;
  const agora    = new Date();
  const topAgora = (agora.getHours() - HORA_INICIO) * ALTURA_HORA + agora.getMinutes();
  if (topAgora < 0 || topAgora > ALTURA_GRADE) return null;
  return (
    <div
      className="absolute pointer-events-none"
      style={{ top: topAgora, left: LARGURA_HORAS, right: 0, height: 2, backgroundColor: '#ef4444', zIndex: 20 }}
    >
      <div className="absolute rounded-full bg-red-500" style={{ width: 8, height: 8, top: -3, left: -4 }} />
    </div>
  );
}

// ── Dialog de confirmação de conclusão ────────────────────────────────────────
type DialogState = {
  id: string;
  tipo: string; // 'sirene' | 'pastelaria' | 'kanban'
  chamadoId: number | null;
  cardId: string | null;
  href: string | null;
  loading: boolean;
};

function DialogConcluir({
  state,
  onConcluir,
  onFechar,
}: {
  state: DialogState;
  onConcluir: () => void;
  onFechar: () => void;
}) {
  const ehSirene = state.tipo === 'sirene' || state.tipo === 'pastelaria';
  const label    = ehSirene ? 'chamado' : 'card';
  const href     = ehSirene && state.chamadoId
    ? `/sirene/chamados?id=${state.chamadoId}`
    : state.href;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onFechar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Concluir atividade</h3>
          <p className="text-xs text-gray-500">
            {ehSirene
              ? 'Abra o chamado na Sirene, conclua-o lá e depois confirme aqui.'
              : 'Abra o card no Kanban, conclua-o lá e depois confirme aqui.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {state.loading ? (
            <div className="h-9 bg-gray-100 animate-pulse rounded-lg" />
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <span>↗</span>
              Abrir {label}
            </a>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1">Link não disponível</p>
          )}

          <button
            type="button"
            onClick={onConcluir}
            className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
          >
            Já concluí — fechar atividade
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dialog de escopo de recorrência ──────────────────────────────────────────
function DialogEscopoRecorrencia({
  onSelecionarEscopo,
  onFechar,
}: {
  onSelecionarEscopo: (escopo: RecorrenciaEscopo) => void;
  onFechar: () => void;
}) {
  const opcoes: { escopo: RecorrenciaEscopo; label: string; desc: string }[] = [
    { escopo: 'single',    label: 'Este evento',          desc: 'Edita ou exclui apenas esta ocorrência.' },
    { escopo: 'following', label: 'Este e os seguintes',  desc: 'Afeta esta data e todas as ocorrências futuras.' },
    { escopo: 'all',       label: 'Todos os eventos',     desc: 'Afeta toda a série de eventos recorrentes.' },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onFechar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-800">Editar evento recorrente</h3>
        <div className="flex flex-col gap-2">
          {opcoes.map(({ escopo, label, desc }) => (
            <button
              key={escopo}
              type="button"
              onClick={() => onSelecionarEscopo(escopo)}
              className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

type AgendaBlocoProps = {
  onAbrirModal: (preenchido: Partial<DadosAgendamento>) => void;
  onAbrirParaEditar: (id: string, escopo?: RecorrenciaEscopo) => void;
  refreshKey?: number;
};

// ── Tipo drag state ───────────────────────────────────────────────────────────
type DragState = {
  atv: AtividadeAgenda;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean; // true após 8px de movimento
  durationMin: number;
};

// ── AgendaBloco ───────────────────────────────────────────────────────────────
export function AgendaBloco({ onAbrirModal, onAbrirParaEditar, refreshKey = 0 }: AgendaBlocoProps) {
  const {
    atividades, diasDaSemana, semanaLabel, semanaOffset,
    isLoading, error, navegar, irParaHoje, concluir, desconcluir, atualizarHorario, atualizarHorarioInicio, moverEvento,
  } = useAgenda(refreshKey);

  const supabase = useMemo(() => createClient(), []);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [pendingEditar, setPendingEditar] = useState<{ id: string } | null>(null);
  const [chamadoModalId, setChamadoModalId] = useState<number | null>(null);
  const [pendingConcluirId, setPendingConcluirId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const gradeRef = useRef<HTMLDivElement | null>(null);

  const handleAbrirParaEditar = useCallback((id: string) => {
    const atv = atividades.find(a => a.id === id);
    if (atv?.recorrencia_grupo_id) {
      setPendingEditar({ id });
    } else {
      onAbrirParaEditar(id);
    }
  }, [atividades, onAbrirParaEditar]);

  // ── Drag de eventos ───────────────────────────────────────────────────────
  const handleDragStart = useCallback((atv: AtividadeAgenda, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const [hi, mi] = atv.hora_inicio.split(':').map(Number);
    const [hf, mf] = (atv.hora_fim ?? `${String(hi + 1).padStart(2,'0')}:00`).split(':').map(Number);
    const durationMin = (hf * 60 + mf) - (hi * 60 + mi);
    const state: DragState = {
      atv, startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
      isDragging: false, durationMin,
    };
    dragStateRef.current = state;
    setDragState(state);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      const updated: DragState = {
        ...ds,
        currentX: e.clientX, currentY: e.clientY,
        isDragging: ds.isDragging || Math.hypot(dx, dy) > 8,
      };
      dragStateRef.current = updated;
      setDragState({ ...updated });
    };

    const onUp = async (e: MouseEvent) => {
      const ds = dragStateRef.current;
      dragStateRef.current = null;
      setDragState(null);
      if (!ds) return;

      if (!ds.isDragging) {
        // Click simples → abrir editar
        handleAbrirParaEditar(ds.atv.id);
        return;
      }

      // Calcular nova data/hora a partir da posição do mouse
      const grade = gradeRef.current;
      if (!grade) return;
      const rect = grade.getBoundingClientRect();
      const scrollTop = grade.scrollTop;
      const relX = e.clientX - rect.left - LARGURA_HORAS;
      const relY = e.clientY - rect.top + scrollTop;

      const colWidth = (rect.width - LARGURA_HORAS) / diasDaSemana.length;
      const colIdx = Math.max(0, Math.min(diasDaSemana.length - 1, Math.floor(relX / colWidth)));
      const novaData = diasDaSemana[colIdx]?.dateStr ?? ds.atv.data;

      const minutosInicio = Math.max(
        HORA_INICIO * 60,
        Math.min((HORA_FIM - 1) * 60, Math.round(relY / ALTURA_HORA * 60 / 15) * 15 + HORA_INICIO * 60),
      );
      const minutosFim = Math.min(HORA_FIM * 60, minutosInicio + ds.durationMin);

      const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
      const novaHoraInicio = fmt(minutosInicio);
      const novaHoraFim    = fmt(minutosFim);

      if (novaData === ds.atv.data && novaHoraInicio === ds.atv.hora_inicio) return;
      await moverEvento(ds.atv.id, novaData, novaHoraInicio, novaHoraFim);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [diasDaSemana, handleAbrirParaEditar, moverEvento]);

  const handleEscopoSelecionado = useCallback((escopo: RecorrenciaEscopo) => {
    if (!pendingEditar) return;
    onAbrirParaEditar(pendingEditar.id, escopo);
    setPendingEditar(null);
  }, [pendingEditar, onAbrirParaEditar]);

  const handleConcluir = useCallback(async (atv: AtividadeAgenda) => {
    const tipo = atv.origem_tipo ?? 'atividades';

    // Atividades Planejadas → concluir direto
    if (tipo === 'atividades' || (!atv.sirene_chamado_id && !atv.card_id)) {
      await concluir(atv.id);
      return;
    }

    // Sirene / Pastelaria → abre modal do chamado direto (sem popup)
    if (tipo === 'sirene' || tipo === 'pastelaria') {
      if (atv.sirene_chamado_id) {
        setChamadoModalId(atv.sirene_chamado_id);
        setPendingConcluirId(atv.id);
      } else {
        await concluir(atv.id);
      }
      return;
    }

    // Kanban → buscar href do card, depois abrir dialog
    if (tipo === 'kanban' && atv.card_id) {
      setDialogState({
        id: atv.id, tipo: 'kanban', chamadoId: null,
        cardId: atv.card_id, href: null, loading: true,
      });
      try {
        type KanbanCardRow = { kanbans: { nome: string } | { nome: string }[] | null };
        const { data } = await supabase
          .from('kanban_cards')
          .select('kanbans(nome)')
          .eq('id', atv.card_id)
          .maybeSingle();
        const row = data as KanbanCardRow | null;
        const kanbanObj = row?.kanbans
          ? (Array.isArray(row.kanbans) ? row.kanbans[0] : row.kanbans)
          : null;
        const kanbanNome = kanbanObj?.nome ?? null;
        const href = kanbanNome ? hrefAbrirCardKanban(kanbanNome, atv.card_id) : null;
        setDialogState(prev => prev ? { ...prev, href, loading: false } : null);
      } catch {
        setDialogState(prev => prev ? { ...prev, loading: false } : null);
      }
      return;
    }

    // Fallback
    await concluir(atv.id);
  }, [concluir, supabase]);

  const handleConfirmarConcluir = useCallback(async () => {
    if (!dialogState) return;
    await concluir(dialogState.id);
    setDialogState(null);
  }, [concluir, dialogState]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button type="button" onClick={() => navegar(-1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Semana anterior">
          ←
        </button>
        <button type="button" onClick={() => navegar(1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Próxima semana">
          →
        </button>
        <span className="text-sm font-semibold text-gray-700 min-w-[200px]">{semanaLabel}</span>
        {semanaOffset !== 0 && (
          <button type="button" onClick={irParaHoje}
            className="text-xs px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors">
            Hoje
          </button>
        )}
        <span className="ml-auto text-xs font-medium text-gray-400">Agenda</span>
        {isLoading && <span className="text-xs text-gray-400">carregando...</span>}
        {error && <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>}
      </div>

      {/* Cabeçalho dos dias */}
      <div className="flex border-b border-gray-100 bg-white">
        <div style={{ width: LARGURA_HORAS, flexShrink: 0 }}
          className="text-[9px] text-gray-400 flex items-end justify-end pr-2 pb-1.5 select-none">
          GMT-3
        </div>
        {diasDaSemana.map(dia => (
          <div key={dia.dateStr} className="flex-1 text-center py-2 select-none">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-1">
              {dia.label.split(' ')[0]}
            </div>
            <div className={`text-sm font-medium mx-auto flex items-center justify-center rounded-full w-7 h-7 ${
              dia.isHoje ? 'bg-blue-500 text-white' : 'text-gray-700'
            }`}>
              {dia.date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Grade */}
      <div ref={gradeRef} className="overflow-y-auto" style={{ height: 600 }}>
        <div className="relative flex" style={{ minHeight: ALTURA_GRADE }}>
          <ColunaHoras />
          {diasDaSemana.map(dia => (
            <ColunaDia
              key={dia.dateStr}
              dia={dia}
              atividades={atividades.filter(a => a.data === dia.dateStr)}
              onAbrirModal={onAbrirModal}
              onAbrirParaEditar={handleAbrirParaEditar}
              onConcluir={handleConcluir}
              onDesconcluir={desconcluir}
              onAtualizarHorario={atualizarHorario}
              onAtualizarHorarioInicio={atualizarHorarioInicio}
              onDragStart={handleDragStart}
            />
          ))}
          <LinhaAgora semanaOffset={semanaOffset} />
        </div>
      </div>

      {/* Ghost de drag */}
      {dragState?.isDragging && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed pointer-events-none rounded px-1.5 py-0.5 text-white text-xs font-medium shadow-lg opacity-80"
          style={{
            top: dragState.currentY - 16,
            left: dragState.currentX - 40,
            backgroundColor: dragState.atv.cor,
            zIndex: 9999,
            minWidth: 80,
            transform: 'rotate(2deg)',
          }}
        >
          {dragState.atv.titulo}
        </div>,
        document.body,
      )}

      {/* Dialog de conclusão para Sirene/Kanban */}
      {dialogState && (
        <DialogConcluir
          state={dialogState}
          onConcluir={() => { void handleConfirmarConcluir(); }}
          onFechar={() => setDialogState(null)}
        />
      )}

      {/* Dialog de escopo para eventos recorrentes */}
      {pendingEditar && (
        <DialogEscopoRecorrencia
          onSelecionarEscopo={handleEscopoSelecionado}
          onFechar={() => setPendingEditar(null)}
        />
      )}

      {/* Modal chamado Sirene — portal no body para evitar stacking context */}
      {chamadoModalId != null && typeof document !== 'undefined' && createPortal(
        <SireneChamadoBacklogWrapper
          chamadoId={chamadoModalId}
          onClose={() => {
            if (pendingConcluirId) {
              void concluir(pendingConcluirId);
              setPendingConcluirId(null);
            }
            setChamadoModalId(null);
          }}
        />,
        document.body,
      )}
    </section>
  );
}
