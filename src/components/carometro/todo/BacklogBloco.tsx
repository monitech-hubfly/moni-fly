'use client';

import { type ReactNode, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useBacklog, SireneItem, AtividadeItem, PastelariaItem } from '@/hooks/useBacklog';
import { BacklogColunaCard, StatusPrazo } from './BacklogColuna';
import { isoWeek } from '@/utils/periodos';
import type { DadosAgendamento } from './ModalAgendamento';
import { BacklogKanbanColuna } from './BacklogKanbanColuna';

function getSexta(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dow = hoje.getDay() || 7;
  const sexta = new Date(hoje);
  sexta.setDate(hoje.getDate() + (5 - dow));
  return sexta;
}

function statusSirene(item: SireneItem): StatusPrazo {
  const prazo = item.data_fim ?? item.prazo_proposto;
  if (!prazo) return 'sem_prazo';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazoDate = new Date(`${prazo}T00:00:00`);
  if (prazoDate < hoje) return 'atrasado';
  const sexta = getSexta();
  if (prazoDate <= sexta) return 'esta_semana';
  return 'futuro';
}

function semanaFimEfetiva(item: AtividadeItem): number | null {
  if (item.semana_ano_fim != null) return item.semana_ano_fim;
  return item.semanas_selecionadas.length ? Math.max(...item.semanas_selecionadas) : null;
}

function statusAtividade(item: AtividadeItem, semanaAtual: number): StatusPrazo {
  const sf = semanaFimEfetiva(item);
  if (sf == null) return 'sem_prazo';
  if (sf < semanaAtual) return 'atrasado';
  if (sf === semanaAtual) return 'esta_semana';
  return 'futuro';
}

function statusPastelaria(item: PastelariaItem): StatusPrazo {
  if (item.coluna === 'doing') return 'esta_semana';
  return 'sem_prazo';
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-sm text-gray-500">
      <span className="text-green-500 text-xl mb-1">✓</span>
      Tudo em dia!
    </div>
  );
}

type ColunaSireneProps = { items: SireneItem[]; pastelariaItems?: PastelariaItem[] };
function ColunaSirene({ items, pastelariaItems = [] }: ColunaSireneProps) {
  const [expandido, setExpandido] = useState(false);

  const comStatus = items.map(i => ({ item: i, status: statusSirene(i) }));
  const visiveis = comStatus.filter(
    ({ status }) => status === 'atrasado' || status === 'esta_semana' || status === 'sem_prazo',
  );
  const futuros = comStatus.filter(({ status }) => status === 'futuro');
  const exibidos = expandido ? comStatus : visiveis;

  return (
    <div className="flex flex-col gap-1.5">
      {exibidos.length === 0 && pastelariaItems.length === 0 && futuros.length === 0 && <EmptyState />}
      {exibidos.length === 0 && pastelariaItems.length === 0 && futuros.length > 0 && !expandido && <EmptyState />}
      {exibidos.map(({ item, status }) => {
        const tituloExibir = item.chamado_titulo ?? item.descricao ?? item.tipo;
        return (
          <BacklogColunaCard
            key={item.id}
            tipo="sirene"
            titulo={tituloExibir}
            prazo={item.data_fim ?? item.prazo_proposto}
            prioridade={item.prioridade}
            numeroChamado={item.chamado_numero}
            status={status}
            origemBadge="Sirene"
            onClick={() => {
              const url = item.chamado_id
                ? `/sirene/chamados?id=${item.chamado_id}`
                : '/sirene/chamados';
              window.location.href = url;
            }}
          />
        );
      })}
      {pastelariaItems.map(item => (
        <BacklogColunaCard
          key={item.id}
          tipo="sirene"
          titulo={item.nome}
          prazo={null}
          status={statusPastelaria(item)}
          origemBadge="Pastelaria"
        />
      ))}
      {futuros.length > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(v => !v)}
          className="mt-1 text-xs text-blue-600 hover:underline text-left"
        >
          {expandido ? 'Recolher' : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}

// ── Wrapper draggável para atividades ────────────────────────────────────────
function DraggableAtividade({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `atividade::${id}`,
    data: { type: 'atividade', id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  );
}

type ColunaAtividadesProps = {
  items: AtividadeItem[];
  semanaAtual: number;
  onAbrirModal?: (p: Partial<DadosAgendamento>) => void;
  onExpandir?: () => void;
};
function ColunaAtividades({ items, semanaAtual, onAbrirModal, onExpandir }: ColunaAtividadesProps) {
  const comStatus = items.map(i => ({ item: i, status: statusAtividade(i, semanaAtual) }));
  const visiveis = comStatus.filter(
    ({ status }) => status === 'atrasado' || status === 'esta_semana' || status === 'sem_prazo',
  );
  const futuros = comStatus.filter(({ status }) => status === 'futuro');

  return (
    <div className="flex flex-col gap-1.5">
      {visiveis.length === 0 && futuros.length === 0 && <EmptyState />}
      {visiveis.length === 0 && futuros.length > 0 && <EmptyState />}
      {visiveis.map(({ item, status }) => (
        <DraggableAtividade key={item.id} id={String(item.id)}>
          <BacklogColunaCard
            tipo="atividade"
            titulo={item.nome_acao ?? '(sem título)'}
            prazo={semanaFimEfetiva(item) != null ? `S${semanaFimEfetiva(item)}` : null}
            status={status}
          />
        </DraggableAtividade>
      ))}
      {futuros.length > 0 && onExpandir && (
        <button
          type="button"
          onClick={onExpandir}
          className="mt-1 text-xs text-blue-600 hover:underline text-left"
        >
          ↗ Expandir ({items.length})
        </button>
      )}
      {onAbrirModal && (
        <button
          type="button"
          onClick={() => onAbrirModal({})}
          className="mt-2 w-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-md py-1.5 transition-colors"
        >
          + Nova atividade
        </button>
      )}
    </div>
  );
}


function ModalAtividadesExpandido({
  items,
  semanaAtual,
  onFechar,
}: {
  items: AtividadeItem[];
  semanaAtual: number;
  onFechar: () => void;
}) {
  const atrasadas   = items.filter(i => { const sf = semanaFimEfetiva(i); return sf != null && sf < semanaAtual; });
  const estaSemana  = items.filter(i => semanaFimEfetiva(i) === semanaAtual);
  const futuras     = items.filter(i => { const sf = semanaFimEfetiva(i); return sf != null && sf > semanaAtual; });
  const semPrazo    = items.filter(i => semanaFimEfetiva(i) == null);

  const blocos = [
    { titulo: 'Atrasadas',   itens: atrasadas,  corClasse: 'text-red-600'   },
    { titulo: 'Essa semana', itens: estaSemana, corClasse: 'text-amber-600' },
    { titulo: 'Futuras',     itens: futuras,    corClasse: 'text-blue-600'  },
    { titulo: 'Sem prazo',   itens: semPrazo,   corClasse: 'text-gray-500'  },
  ].filter(b => b.itens.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Atividades Planejadas ({items.length})</h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">
          {blocos.length === 0 && (
            <p className="text-sm text-gray-400">Nenhuma atividade planejada.</p>
          )}
          {blocos.map(bloco => (
            <div key={bloco.titulo}>
              <h4 className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${bloco.corClasse}`}>
                {bloco.titulo} ({bloco.itens.length})
              </h4>
              <div className="flex flex-col gap-1.5">
                {bloco.itens.map(item => (
                  <div key={item.id} className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                    <div className="text-sm text-gray-800 leading-snug">
                      {item.nome_acao ?? '(sem título)'}
                    </div>
                    {semanaFimEfetiva(item) != null && (
                      <div className="mt-0.5 text-[10px] text-gray-400">S{semanaFimEfetiva(item)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type BacklogBlocoProps = {
  onAbrirModal?: (preenchido: Partial<DadosAgendamento>) => void;
};

export function BacklogBloco({ onAbrirModal }: BacklogBlocoProps = {}) {
  const { sirene, pastelaria, atividades, isLoading, error } = useBacklog();
  const semanaAtual = isoWeek(new Date());
  const [modalAtividadesAberto, setModalAtividadesAberto] = useState(false);

  const sireneVisiveis = sirene.filter(i => {
    const s = statusSirene(i);
    return s === 'atrasado' || s === 'esta_semana' || s === 'sem_prazo';
  });
  const atividadesVisiveis = atividades.filter(i => {
    const s = statusAtividade(i, semanaAtual);
    return s === 'atrasado' || s === 'esta_semana' || s === 'sem_prazo';
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Backlog</h2>

      {error && (
        <p className="text-xs text-red-500 mb-3">Erro ao carregar backlog: {error}</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Coluna 1 — Sirene */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Sirene / Pastelaria</span>
              <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                {sireneVisiveis.length + pastelaria.length}
              </span>
            </div>
            <ColunaSirene items={sirene} pastelariaItems={pastelaria} />
          </div>

          {/* Coluna 2 — Atividades */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Atividades Planejadas</span>
              <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                {atividadesVisiveis.length}
              </span>
            </div>
            <ColunaAtividades
              items={atividades}
              semanaAtual={semanaAtual}
              onAbrirModal={onAbrirModal}
              onExpandir={() => setModalAtividadesAberto(true)}
            />
          </div>

          {/* Coluna 3 — Kanban */}
          <BacklogKanbanColuna />
        </div>
      )}

      {modalAtividadesAberto && (
        <ModalAtividadesExpandido
          items={atividades}
          semanaAtual={semanaAtual}
          onFechar={() => setModalAtividadesAberto(false)}
        />
      )}
    </section>
  );
}
