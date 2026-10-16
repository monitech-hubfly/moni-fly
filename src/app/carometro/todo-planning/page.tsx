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
import { IndicadoresAreaBloco } from '@/components/carometro/todo/IndicadoresAreaBloco';

function SecaoColapsavel({ titulo, children, defaultOpen = true, badge }: {
  titulo: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [aberta, setAberta] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
        onClick={() => setAberta(v => !v)}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{titulo}</span>
          {badge}
        </span>
        <span className="text-gray-400 text-xs flex-shrink-0 ml-2">{aberta ? '▲' : '▼'}</span>
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
  // Resumo de Indicadores da Área para exibir no título da seção
  const [indsResumo, setIndsResumo] = useState({ meus: 0, total: 0 });
  const [origemInfo, setOrigemInfo] = useState<OrigemInfo | undefined>(undefined);

  const modal = useModalAgendamento(
    effectiveProfileId,
    areaId,
    () => setAgendaRefreshKey(k => k + 1),
  );

  const fecharModal = () => { modal.fechar(); setOrigemInfo(undefined); };

  type DragData = { type?: string; id?: string; acao_id?: string | null; titulo?: string; subtitulo?: string; chamado_id?: string | null };

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
      // drag.acao_id = acoes.id (FK real); drag.id = gantt_planejamento.id do backlog
      modal.abrirParaCriar({ ...base, acao_id: drag.acao_id ?? null, origem_tipo: 'atividades' });
    } else if (drag.type === 'sirene') {
      setOrigemInfo({ titulo: drag.titulo ?? '', tipo: 'sirene' });
      modal.abrirParaCriar({
        ...base,
        sirene_chamado_id: drag.chamado_id ? Number(drag.chamado_id) : null,
        origem_tipo: 'sirene',
      });
    } else if (drag.type === 'pastelaria') {
      setOrigemInfo({ titulo: drag.titulo ?? '', tipo: 'pastelaria' });
      modal.abrirParaCriar(base);
    } else if (drag.type === 'kanban') {
      setOrigemInfo({ titulo: drag.titulo ?? '', tipo: 'kanban', subtitulo: drag.subtitulo });
      modal.abrirParaCriar({ ...base, card_id: drag.id ?? null });
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

        <SecaoColapsavel titulo="Minhas Metas">
          <MetasIndicadoresBloco />
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Indicadores da Área"
          defaultOpen={true}
          badge={
            indsResumo.total > 0 ? (
              <span className="flex items-center gap-1.5">
                {indsResumo.meus > 0 && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-1.5 py-0.5 font-medium">
                    {indsResumo.meus} meu{indsResumo.meus !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-[10px] text-gray-400">
                  {indsResumo.total} indicador{indsResumo.total !== 1 ? 'es' : ''}
                </span>
              </span>
            ) : undefined
          }
        >
          <IndicadoresAreaBloco onSummaryChange={(m, t) => setIndsResumo({ meus: m, total: t })} />
        </SecaoColapsavel>
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
          editandoId={modal.editandoId}
        />
      )}
    </DndContext>
  );
}

export default function TodoPlanningPage() {
  return <TodoPlanningPageContent />;
}
