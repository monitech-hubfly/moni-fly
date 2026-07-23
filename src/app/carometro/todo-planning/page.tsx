'use client';

import { type ReactNode, useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import type { OrigemInfo } from '@/components/carometro/todo/ModalAgendamento';
import { MeuCarometroBloco } from '@/components/carometro/todo/MeuCarometroBloco';
import { BacklogBloco } from '@/components/carometro/todo/BacklogBloco';
import { AgendaBloco } from '@/components/carometro/todo/AgendaBloco';
import { ModalAgendamento } from '@/components/carometro/todo/ModalAgendamento';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { useModalAgendamento } from '@/hooks/useModalAgendamento';
import { MetasIndicadoresBloco } from '@/components/carometro/todo/MetasIndicadoresBloco';
import { GuardaConstrucao } from '@/components/carometro/GuardaConstrucao';

function SecaoColapsavel({ titulo, children, defaultOpen = true }: {
  titulo: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [aberta, setAberta] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
        onClick={() => setAberta(v => !v)}
      >
        <span className="text-sm font-semibold text-gray-700">{titulo}</span>
        <span className="text-gray-400 text-xs">{aberta ? '▲' : '▼'}</span>
      </button>
      {aberta && (
        <div className="border-t border-gray-200">
          {children}
        </div>
      )}
    </section>
  );
}

function TodoPlanningPageContent() {
  const { effectiveProfileId, areaId } = useEffectiveUser();

  // Chave de refresh: incrementar força re-fetch da Agenda
  const [agendaRefreshKey, setAgendaRefreshKey] = useState(0);
  const [origemInfo, setOrigemInfo] = useState<OrigemInfo | undefined>(undefined);

  const modal = useModalAgendamento(
    effectiveProfileId,
    areaId,
    () => setAgendaRefreshKey(k => k + 1),
  );

  const fecharModal = () => { modal.fechar(); setOrigemInfo(undefined); };

  type DragData = { type?: string; id?: string; titulo?: string; subtitulo?: string; chamado_id?: string | null };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const drag = active.data.current as DragData | undefined;
    if (!drag?.type) return;

    const parts = String(over.id).split('::'); // ['drop', 'YYYY-MM-DD', 'HH']
    if (parts.length !== 3 || parts[0] !== 'drop') return;
    const hora    = parseInt(parts[2], 10);
    const horaFim = Math.min(23, hora + 1);
    const base = {
      data:        parts[1],
      hora_inicio: `${String(hora).padStart(2, '0')}:00`,
      hora_fim:    `${String(horaFim).padStart(2, '0')}:00`,
    };

    if (drag.type === 'atividade') {
      setOrigemInfo(undefined);
      modal.abrirParaCriar(base);
    } else if (drag.type === 'sirene') {
      setOrigemInfo({ titulo: drag.titulo ?? '', tipo: 'sirene' });
      modal.abrirParaCriar(base);
    } else if (drag.type === 'pastelaria') {
      setOrigemInfo({ titulo: drag.titulo ?? '', tipo: 'pastelaria' });
      modal.abrirParaCriar(base);
    } else if (drag.type === 'kanban') {
      setOrigemInfo({ titulo: drag.titulo ?? '', tipo: 'kanban', subtitulo: drag.subtitulo });
      modal.abrirParaCriar(base);
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-xl font-bold text-gray-800">TO DO &amp; Planning</h1>

        <SecaoColapsavel titulo="Meu Carômetro">
          <MeuCarometroBloco />
        </SecaoColapsavel>

        <SecaoColapsavel titulo="Backlog">
          <BacklogBloco onAbrirModal={modal.abrirParaCriar} />
        </SecaoColapsavel>

        <SecaoColapsavel titulo="Agenda">
          <AgendaBloco
            onAbrirModal={modal.abrirParaCriar}
            onAbrirParaEditar={modal.abrirParaEditar}
            refreshKey={agendaRefreshKey}
          />
        </SecaoColapsavel>

        <MetasIndicadoresBloco />
      </div>

      {effectiveProfileId && (
        <ModalAgendamento
          key={effectiveProfileId}
          aberto={modal.aberto}
          onFechar={fecharModal}
          onSalvar={modal.salvar}
          onExcluir={modal.excluir}
          preenchido={modal.preenchido}
          modo={modal.modo}
          profileId={effectiveProfileId}
          areaId={areaId}
          isSaving={modal.isSaving}
          erroSalvar={modal.erroSalvar}
          origemInfo={origemInfo}
        />
      )}
    </DndContext>
  );
}

export default function TodoPlanningPage() {
  return <GuardaConstrucao><TodoPlanningPageContent /></GuardaConstrucao>;
}
