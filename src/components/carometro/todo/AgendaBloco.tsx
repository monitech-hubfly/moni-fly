'use client';

import { useDroppable } from '@dnd-kit/core';
import { useAgenda, AtividadeAgenda, DiaAgenda } from '@/hooks/useAgenda';
import type { DadosAgendamento } from './ModalAgendamento';

const HORA_INICIO   = 8;
const HORA_FIM      = 20;
const TOTAL_HORAS   = HORA_FIM - HORA_INICIO; // 12
const ALTURA_HORA   = 60;                      // px por hora
const ALTURA_GRADE  = TOTAL_HORAS * ALTURA_HORA; // 720px
const LARGURA_HORAS = 56;                      // px coluna esquerda

// ── Slot droppable (1 hora × 1 dia) ──────────────────────────────────────────
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
function AgendaCard({
  atv,
  onAbrirParaEditar,
}: {
  atv: AtividadeAgenda;
  onAbrirParaEditar: (id: string) => void;
}) {
  const [h, m]  = atv.hora_inicio.split(':').map(Number);
  const topPx   = (h - HORA_INICIO) * ALTURA_HORA + (m ?? 0);
  let heightPx  = 30;
  if (atv.hora_fim) {
    const [hf, mf] = atv.hora_fim.split(':').map(Number);
    heightPx = Math.max(30, (hf * 60 + (mf ?? 0)) - (h * 60 + (m ?? 0)));
  }
  return (
    <div
      data-atividade="true"
      className="absolute rounded px-1.5 py-0.5 text-white text-xs overflow-hidden cursor-pointer hover:brightness-90 transition-all select-none"
      style={{ top: topPx, height: heightPx, left: 2, right: 2, backgroundColor: atv.cor, zIndex: 10 }}
      onClick={(e) => {
        e.stopPropagation();
        onAbrirParaEditar(atv.id);
      }}
    >
      <div className="font-medium truncate leading-tight">
        {atv.comportamento_chave ?? '(sem título)'}
      </div>
      {heightPx >= 40 && (
        <div className="opacity-80 text-[10px]">
          {atv.hora_inicio}{atv.hora_fim ? ` – ${atv.hora_fim}` : ''}
        </div>
      )}
    </div>
  );
}

// ── Coluna de um dia ──────────────────────────────────────────────────────────
function ColunaDia({
  dia,
  atividades,
  onAbrirModal,
  onAbrirParaEditar,
}: {
  dia: DiaAgenda;
  atividades: AtividadeAgenda[];
  onAbrirModal: (p: Partial<DadosAgendamento>) => void;
  onAbrirParaEditar: (id: string) => void;
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
      {horas.map(h => (
        <DroppableSlot key={h} dateStr={dia.dateStr} hora={h} />
      ))}
      {atividades.map(atv => (
        <AgendaCard key={atv.id} atv={atv} onAbrirParaEditar={onAbrirParaEditar} />
      ))}
    </div>
  );
}

// ── Coluna de horas (esquerda) ────────────────────────────────────────────────
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
  const agora   = new Date();
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

type AgendaBlocoProps = {
  onAbrirModal: (preenchido: Partial<DadosAgendamento>) => void;
  onAbrirParaEditar: (id: string) => void;
  refreshKey?: number;
};

// ── AgendaBloco ───────────────────────────────────────────────────────────────
export function AgendaBloco({ onAbrirModal, onAbrirParaEditar, refreshKey = 0 }: AgendaBlocoProps) {
  const {
    atividades,
    diasDaSemana,
    semanaLabel,
    semanaOffset,
    isLoading,
    error,
    navegar,
    irParaHoje,
  } = useAgenda(refreshKey);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header — navegação */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Semana anterior"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => navegar(1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Próxima semana"
        >
          →
        </button>
        <span className="text-sm font-semibold text-gray-700 min-w-[200px]">{semanaLabel}</span>
        {semanaOffset !== 0 && (
          <button
            type="button"
            onClick={irParaHoje}
            className="text-xs px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            Hoje
          </button>
        )}
        <span className="ml-auto text-xs font-medium text-gray-400">Agenda</span>
        {isLoading && <span className="text-xs text-gray-400">carregando...</span>}
        {error && <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>}
      </div>

      {/* Cabeçalho dos dias */}
      <div className="flex border-b border-gray-100 bg-white">
        <div
          style={{ width: LARGURA_HORAS, flexShrink: 0 }}
          className="text-[9px] text-gray-400 flex items-end justify-end pr-2 pb-1.5 select-none"
        >
          GMT-3
        </div>
        {diasDaSemana.map(dia => (
          <div key={dia.dateStr} className="flex-1 text-center py-2 select-none">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-1">
              {dia.label.split(' ')[0]}
            </div>
            <div
              className={`text-sm font-medium mx-auto flex items-center justify-center rounded-full w-7 h-7 ${
                dia.isHoje ? 'bg-blue-500 text-white' : 'text-gray-700'
              }`}
            >
              {dia.date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Grade com scroll */}
      <div className="overflow-y-auto" style={{ height: 600 }}>
        <div className="relative flex" style={{ minHeight: ALTURA_GRADE }}>
          <ColunaHoras />
          {diasDaSemana.map(dia => (
            <ColunaDia
              key={dia.dateStr}
              dia={dia}
              atividades={atividades.filter(a => a.data === dia.dateStr)}
              onAbrirModal={onAbrirModal}
              onAbrirParaEditar={onAbrirParaEditar}
            />
          ))}
          <LinhaAgora semanaOffset={semanaOffset} />
        </div>
      </div>
    </section>
  );
}
