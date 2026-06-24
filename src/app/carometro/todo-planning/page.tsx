'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { MeuCarometroBloco } from '@/components/carometro/todo/MeuCarometroBloco';
import { BacklogBloco } from '@/components/carometro/todo/BacklogBloco';
import { AgendaBloco } from '@/components/carometro/todo/AgendaBloco';
import { ModalAgendamento } from '@/components/carometro/todo/ModalAgendamento';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { useModalAgendamento } from '@/hooks/useModalAgendamento';
import { MetasIndicadoresBloco } from '@/components/carometro/todo/MetasIndicadoresBloco';

export default function TodoPlanningPage() {
  const { effectiveProfileId, areaId } = useEffectiveUser();

  // Chave de refresh: incrementar força re-fetch da Agenda
  const [agendaRefreshKey, setAgendaRefreshKey] = useState(0);

  const modal = useModalAgendamento(
    effectiveProfileId,
    areaId,
    () => setAgendaRefreshKey(k => k + 1),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const drag = active.data.current as { type?: string; id?: string } | undefined;
    if (drag?.type !== 'atividade' || !drag.id) return;
    const parts = String(over.id).split('::'); // ['drop', 'YYYY-MM-DD', 'HH']
    if (parts.length !== 3 || parts[0] !== 'drop') return;
    const hora    = parseInt(parts[2], 10);
    const horaFim = Math.min(23, hora + 1);
    modal.abrirParaCriar({
      data:        parts[1],
      hora_inicio: `${String(hora).padStart(2, '0')}:00`,
      hora_fim:    `${String(horaFim).padStart(2, '0')}:00`,
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-xl font-bold text-gray-800">TO DO &amp; Planning</h1>
        <MeuCarometroBloco />
        <BacklogBloco onAbrirModal={modal.abrirParaCriar} />
        <AgendaBloco
          onAbrirModal={modal.abrirParaCriar}
          onAbrirParaEditar={modal.abrirParaEditar}
          refreshKey={agendaRefreshKey}
        />
        <MetasIndicadoresBloco />
      </div>

      {effectiveProfileId && (
        <ModalAgendamento
          aberto={modal.aberto}
          onFechar={modal.fechar}
          onSalvar={modal.salvar}
          preenchido={modal.preenchido}
          modo={modal.modo}
          profileId={effectiveProfileId}
          areaId={areaId}
          isSaving={modal.isSaving}
        />
      )}
    </DndContext>
  );
}
