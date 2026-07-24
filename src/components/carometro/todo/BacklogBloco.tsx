'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useBacklog, SireneItem, AtividadeItem, PastelariaItem } from '@/hooks/useBacklog';
import { BacklogColunaCard, StatusPrazo } from './BacklogColuna';
import { isoWeek } from '@/utils/periodos';
import type { DadosAgendamento } from './ModalAgendamento';
import { BacklogKanbanColuna } from './BacklogKanbanColuna';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';

const STATUS_ORDER: Record<StatusPrazo, number> = {
  atrasado: 0, esta_semana: 1, sem_prazo: 2, futuro: 3,
};

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

function StatusDot({ cor, count }: { cor: string; count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
      <span className={`h-2 w-2 rounded-full shrink-0 ${cor}`} />
      {count}
    </span>
  );
}

// ── NovaAtividadeDrawer ───────────────────────────────────────────────────────
type Tarefa = { id: string; nome: string };
const RECORR_OPTS = [
  { value: 'unica', label: 'Atividade única' },
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
];

function NovaAtividadeDrawer({ areaId, onFechar }: { areaId: string | null; onFechar: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [tarefas,     setTarefas]     = useState<Tarefa[]>([]);
  const [tarefaId,    setTarefaId]    = useState('');
  const [novaTarefa,  setNovaTarefa]  = useState('');
  const [criandoComp, setCriandoComp] = useState(false);
  const [nome,        setNome]        = useState('');
  const [tempoVal,    setTempoVal]    = useState('');
  const [tempoUnit,   setTempoUnit]   = useState<'minutos' | 'horas'>('minutos');
  const [canetaVerde, setCanetaVerde] = useState('nao');
  const [recorrencia, setRecorrencia] = useState('unica');
  const [salvando,    setSalvando]    = useState(false);
  const [erro,        setErro]        = useState<string | null>(null);

  useEffect(() => {
    if (!areaId) return;
    void supabase.from('tarefas').select('id, nome').eq('area_id', areaId).order('nome').then(({ data }) => {
      setTarefas((data ?? []) as Tarefa[]);
    });
  }, [supabase, areaId]);

  const handleSalvar = async () => {
    if (!nome.trim()) { setErro('Nome da atividade é obrigatório.'); return; }
    setSalvando(true); setErro(null);
    try {
      let tId = tarefaId;
      if (criandoComp) {
        if (!novaTarefa.trim()) { setErro('Nome do comportamento é obrigatório.'); setSalvando(false); return; }
        const { data: ins, error: e } = await supabase
          .from('tarefas').insert({ area_id: areaId, nome: novaTarefa.trim() }).select('id').single();
        if (e) throw e;
        tId = (ins as { id: string }).id;
        setTarefas(prev => [...prev, { id: tId, nome: novaTarefa.trim() }]);
        setTarefaId(tId); setCriandoComp(false); setNovaTarefa('');
      }
      if (!tId) { setErro('Selecione um comportamento.'); setSalvando(false); return; }
      const tempoMin = tempoVal ? (tempoUnit === 'horas' ? Math.round(Number(tempoVal) * 60) : Math.round(Number(tempoVal))) : null;
      const { error: e2 } = await supabase.from('acoes').insert({
        tarefa_id: tId, nome: nome.trim(),
        tempo_estimado_minutos: tempoMin,
        caneta_verde: canetaVerde,
        recorrencia,
      });
      if (e2) throw e2;
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onFechar}>
      <div className="w-80 bg-white h-full shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Nova atividade</h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Comportamento */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Comportamento</label>
            {criandoComp ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  placeholder="Nome do comportamento"
                  value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} autoFocus />
                <button type="button" onClick={() => setCriandoComp(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none"
                  value={tarefaId} onChange={e => setTarefaId(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {tarefas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <button type="button" onClick={() => setCriandoComp(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap">+ Novo</button>
              </div>
            )}
          </div>

          {/* Nome da atividade */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome da atividade *</label>
            <input
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Nome da atividade"
              value={nome} onChange={e => setNome(e.target.value)} />
          </div>

          {/* Tempo */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tempo</label>
            <div className="flex gap-2">
              <input type="number" min="0"
                className="w-20 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none"
                placeholder="0" value={tempoVal} onChange={e => setTempoVal(e.target.value)} />
              <select className="text-xs border border-gray-300 rounded px-2 py-1.5"
                value={tempoUnit} onChange={e => setTempoUnit(e.target.value as 'minutos' | 'horas')}>
                <option value="minutos">min</option>
                <option value="horas">h</option>
              </select>
            </div>
          </div>

          {/* Caneta verde */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Caneta verde</label>
            <select className="text-xs border border-gray-300 rounded px-2 py-1.5 w-full"
              value={canetaVerde} onChange={e => setCanetaVerde(e.target.value)}>
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>

          {/* Recorrência */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Recorrência</label>
            <select className="text-xs border border-gray-300 rounded px-2 py-1.5 w-full"
              value={recorrencia} onChange={e => setRecorrencia(e.target.value)}>
              {RECORR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button type="button" onClick={onFechar} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
          <button type="button" onClick={handleSalvar} disabled={salvando}
            className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors">
            {salvando ? 'Salvando...' : 'Salvar atividade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sirene ────────────────────────────────────────────────────────────────────
type ColunaSireneProps = { items: SireneItem[]; pastelariaItems?: PastelariaItem[] };
function ColunaSirene({ items, pastelariaItems = [] }: ColunaSireneProps) {
  const comStatus = items
    .map(i => ({ item: i, status: statusSirene(i) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const total = comStatus.length + pastelariaItems.length;

  return (
    <div className={`flex flex-col gap-1.5 ${total > 0 ? 'max-h-[22rem] overflow-y-auto pr-0.5' : ''}`}>
      {total === 0 && <EmptyState />}
      {comStatus.map(({ item, status }) => {
        const tituloExibir = item.chamado_titulo ?? item.descricao ?? item.tipo;
        return (
          <DraggableSirene
            key={item.id}
            dragId={`sirene::${item.id}`}
            dragData={{ type: 'sirene', id: item.id, titulo: tituloExibir, chamado_id: item.chamado_id ?? null }}
          >
            <BacklogColunaCard
              tipo="sirene"
              titulo={tituloExibir}
              prazo={item.data_fim ?? item.prazo_proposto}
              prioridade={item.prioridade}
              numeroChamado={item.chamado_numero}
              status={status}
              origemBadge="Sirene"
              href={item.chamado_id ? `/sirene/chamados?id=${item.chamado_id}` : undefined}
              abertoPor={item.aberto_por_nome}
            />
          </DraggableSirene>
        );
      })}
      {pastelariaItems.map(item => (
        <DraggableSirene
          key={item.id}
          dragId={`pastelaria::${item.id}`}
          dragData={{ type: 'pastelaria', id: item.id, titulo: item.nome }}
        >
          <BacklogColunaCard
            tipo="sirene"
            titulo={item.nome}
            prazo={null}
            status={statusPastelaria(item)}
            origemBadge="Pastelaria"
            href="/carometro/pastelaria"
          />
        </DraggableSirene>
      ))}
    </div>
  );
}

// ── Wrapper draggável ─────────────────────────────────────────────────────────
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

type DragSireneData =
  | { type: 'sirene';    id: string; titulo: string; chamado_id: string | null }
  | { type: 'pastelaria'; id: string; titulo: string };

function DraggableSirene({ dragId, dragData, children }: { dragId: string; dragData: DragSireneData; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
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

// ── Atividades Planejadas ─────────────────────────────────────────────────────
type ColunaAtividadesProps = {
  items: AtividadeItem[];
  semanaAtual: number;
  onAbrirNovaAtividade?: () => void;
};
function ColunaAtividades({ items, semanaAtual, onAbrirNovaAtividade }: ColunaAtividadesProps) {
  const comStatus = items.map(i => ({ item: i, status: statusAtividade(i, semanaAtual) }));

  return (
    <div className={`flex flex-col gap-1.5 ${items.length > 0 ? 'max-h-[22rem] overflow-y-auto pr-0.5' : ''}`}>
      {items.length === 0 && <EmptyState />}
      {comStatus.map(({ item, status }) => (
        <DraggableAtividade key={item.id} id={String(item.id)}>
          <BacklogColunaCard
            tipo="atividade"
            titulo={item.nome_acao ?? '(sem título)'}
            prazo={semanaFimEfetiva(item) != null ? `S${semanaFimEfetiva(item)}` : null}
            status={status}
          />
        </DraggableAtividade>
      ))}
      {onAbrirNovaAtividade && (
        <button
          type="button"
          onClick={onAbrirNovaAtividade}
          className="mt-2 w-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-md py-1.5 transition-colors"
        >
          + Nova atividade
        </button>
      )}
    </div>
  );
}

// ── BacklogBloco ──────────────────────────────────────────────────────────────
type BacklogBlocoProps = {
  onAbrirModal?: (preenchido: Partial<DadosAgendamento>) => void;
};

export function BacklogBloco({ onAbrirModal }: BacklogBlocoProps = {}) {
  const { sirene, pastelaria, atividades, isLoading, error } = useBacklog();
  const { areaId } = useEffectiveUser();
  const semanaAtual = isoWeek(new Date());
  const [drawerAberto, setDrawerAberto] = useState(false);

  // Contadores para dots de status
  const sireneAtrasados  = sirene.filter(i => statusSirene(i) === 'atrasado').length;
  const sireneEstaSemana = sirene.filter(i => statusSirene(i) === 'esta_semana').length;
  const sireneFuturos    = sirene.filter(i => statusSirene(i) === 'futuro').length;

  const atividadesAtrasadas  = atividades.filter(i => statusAtividade(i, semanaAtual) === 'atrasado').length;
  const atividadesEstaSemana = atividades.filter(i => statusAtividade(i, semanaAtual) === 'esta_semana').length;
  const atividadesFuturas    = atividades.filter(i => statusAtividade(i, semanaAtual) === 'futuro').length;

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
          {/* Coluna 1 — Sirene / Pastelaria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Sirene / Pastelaria</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusDot cor="bg-red-500"   count={sireneAtrasados} />
                  <StatusDot cor="bg-green-500" count={sireneEstaSemana} />
                  <StatusDot cor="bg-gray-400"  count={sireneFuturos} />
                </div>
                <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                  {sirene.length + pastelaria.length}
                </span>
              </div>
            </div>
            <ColunaSirene items={sirene} pastelariaItems={pastelaria} />
          </div>

          {/* Coluna 2 — Atividades Planejadas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Atividades Planejadas</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusDot cor="bg-red-500"   count={atividadesAtrasadas} />
                  <StatusDot cor="bg-green-500" count={atividadesEstaSemana} />
                  <StatusDot cor="bg-gray-400"  count={atividadesFuturas} />
                </div>
                <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                  {atividades.length}
                </span>
              </div>
            </div>
            <ColunaAtividades
              items={atividades}
              semanaAtual={semanaAtual}
              onAbrirNovaAtividade={() => setDrawerAberto(true)}
            />
          </div>

          {/* Coluna 3 — Cards / Kanban */}
          <BacklogKanbanColuna />
        </div>
      )}

      {drawerAberto && (
        <NovaAtividadeDrawer areaId={areaId} onFechar={() => setDrawerAberto(false)} />
      )}
    </section>
  );
}
