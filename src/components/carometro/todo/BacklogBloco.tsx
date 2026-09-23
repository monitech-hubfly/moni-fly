'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { createClient } from '@/lib/supabase/client';
import { useBacklog, SireneItem, AtividadeItem } from '@/hooks/useBacklog';
import { BacklogColunaCard, StatusPrazo } from './BacklogColuna';
import { isoWeek } from '@/utils/periodos';
import type { DadosAgendamento } from './ModalAgendamento';
import { BacklogKanbanColuna } from './BacklogKanbanColuna';
import { NovaAtividadeDrawer } from './NovaAtividadeDrawer';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SireneChamadoDetalheModal } from '@/app/sirene/chamados/SireneChamadoDetalheModal';
import { SireneModalHoras } from '@/app/sirene/chamados/SireneModalHoras';
import { ClassificacaoConclusaoModal } from '@/app/sirene/chamados/ClassificacaoConclusaoModal';
import { buscarDadosModalChamado, atualizarStatusInteracaoSirene, type StatusInteracaoDb } from '@/app/sirene/chamados/actions';
import { getTopicosChamado, type TopicoPainelLinha } from '@/app/sirene/actions';
import { atualizarStatusSubInteracao, type SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { ATIVIDADE_FORM_DRAFT_VAZIO, type AtividadeFormDraft } from '@/components/kanban-shared/KanbanAtividadeFormFields';
import type { InteracaoSireneRow } from '@/app/sirene/chamados/InteracoesLista';

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

// ── Sirene ────────────────────────────────────────────────────────────────────
type ColunaSireneProps = { items: SireneItem[]; onAbrirChamado: (chamadoId: number, interacaoId: string | null) => void };
function ColunaSirene({ items, onAbrirChamado }: ColunaSireneProps) {
  const comStatus = items
    .map(i => ({ item: i, status: statusSirene(i) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className={`flex flex-col gap-1.5 ${comStatus.length > 0 ? 'max-h-[22rem] overflow-y-auto pr-0.5' : ''}`}>
      {comStatus.length === 0 && <EmptyState />}
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
              onClickExternal={
                item.chamado_interno_id != null
                  ? () => onAbrirChamado(item.chamado_interno_id!, item.interacao_id ?? null)
                  : undefined
              }
              href={
                item.chamado_interno_id == null && item.interacao_id
                  ? `/sirene/chamados?interacao=${item.interacao_id}`
                  : undefined
              }
            />
          </DraggableSirene>
        );
      })}
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
  | { type: 'sirene'; id: string; titulo: string; chamado_id: string | null };

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
  onNovaAtividade?: () => void;
  onExcluirAtividade?: (id: string, nome: string | null) => void;
};
function ColunaAtividades({ items, semanaAtual, onNovaAtividade, onExcluirAtividade }: ColunaAtividadesProps) {
  const comStatus = items.map(i => ({ item: i, status: statusAtividade(i, semanaAtual) }));

  return (
    <>
      <div className={`flex flex-col gap-1.5 ${items.length > 0 ? 'max-h-[22rem] overflow-y-auto pr-0.5' : ''}`}>
        {items.length === 0 && <EmptyState />}
        {comStatus.map(({ item, status }) => (
          <DraggableAtividade key={item.id} id={String(item.id)}>
            <BacklogColunaCard
              tipo="atividade"
              titulo={item.nome_acao ?? '(sem título)'}
              prazo={semanaFimEfetiva(item) != null ? `S${semanaFimEfetiva(item)}` : null}
              status={status}
              onExcluir={onExcluirAtividade
                ? () => onExcluirAtividade(item.id, item.nome_acao)
                : undefined
              }
            />
          </DraggableAtividade>
        ))}
      </div>
      {onNovaAtividade && (
        <button
          type="button"
          onClick={onNovaAtividade}
          className="mt-2 w-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-md py-1.5 transition-colors"
        >
          + Nova atividade
        </button>
      )}
    </>
  );
}

// ── Helpers para modal Sirene ─────────────────────────────────────────────────
function statusDbParaSelect(s: string): StatusInteracaoDb {
  const x = String(s ?? '').trim().toLowerCase();
  if (x === 'concluida' || x === 'concluída') return 'concluida';
  if (x === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

function badgeTipoHelper(tipo: string): { label: string; className: string } {
  const t = String(tipo ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t === 'duvida') return { label: 'Dúvida', className: 'border-blue-200 bg-blue-50 text-blue-800' };
  if (t === 'reclamacao') return { label: 'Reclamação', className: 'border-red-200 bg-red-50 text-red-800' };
  if (t === 'sugestao') return { label: 'Sugestão', className: 'border-green-200 bg-green-50 text-green-800' };
  return { label: tipo || 'Chamado', className: 'border-gray-200 bg-gray-50 text-gray-700' };
}

// ── SireneChamadoBacklogWrapper ───────────────────────────────────────────────
type SireneChamadoBacklogWrapperProps = {
  chamadoId: number;
  interacaoId?: string | null;
  onClose: () => void;
  /** Callback acionado quando o status do chamado é marcado como concluído. */
  onConcluido?: () => void;
};

export function SireneChamadoBacklogWrapper({
  chamadoId,
  onClose,
  onConcluido,
}: SireneChamadoBacklogWrapperProps) {
  const supabase = useMemo(() => createClient(), []);
  const [row, setRow] = useState<InteracaoSireneRow | null>(null);
  const [topicos, setTopicos] = useState<TopicoPainelLinha[]>([]);
  const [topicosLoading, setTopicosLoading] = useState(true);
  const [novaAtivDraft, setNovaAtivDraft] = useState<AtividadeFormDraft>({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [podeArquivar, setPodeArquivar] = useState(false);
  const [sessionRole, setSessionRole] = useState('');
  const [pending, setPending] = useState(false);
  const [horasModal, setHorasModal] = useState<{ chamadoId: number; titulo: string } | null>(null);
  const [classificacaoPendente, setClassificacaoPendente] = useState<{ topicoId: number } | null>(null);
  const [subStatusPendente, setSubStatusPendente] = useState<{ topicoId: number; status: SubInteracaoStatusDb } | null>(null);
  const skipHorasRef = useRef(false);

  useEffect(() => {
    setRow(null);
    setTopicos([]);
    void buscarDadosModalChamado(chamadoId).then(r => { if (r.ok) setRow(r.row); });
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = String((prof as { role?: string | null } | null)?.role ?? '').toLowerCase();
      setPodeArquivar(role === 'admin' || role === 'team');
      setSessionRole(role);
    })();
  }, [chamadoId, supabase]);

  const reloadTopicos = useCallback(async () => {
    setTopicosLoading(true);
    const res = await getTopicosChamado(chamadoId);
    if (res.ok) setTopicos(res.topicos);
    setTopicosLoading(false);
  }, [chamadoId]);

  useEffect(() => { void reloadTopicos(); }, [reloadTopicos]);

  async function handleSubStatus(topicoId: number, status: SubInteracaoStatusDb) {
    if (status === 'concluido' && !skipHorasRef.current && row?.sirene_chamado_id != null) {
      setHorasModal({ chamadoId: row.sirene_chamado_id, titulo: row.titulo });
      setSubStatusPendente({ topicoId, status });
      return;
    }
    if (status === 'concluido') {
      setClassificacaoPendente({ topicoId });
      return;
    }
    setPending(true);
    await atualizarStatusSubInteracao(String(topicoId), status, '/carometro/todo-planning', true);
    setPending(false);
    void reloadTopicos();
    window.dispatchEvent(new CustomEvent('backlog-reload'));
  }

  async function concluirComClassificacao(classificacao: 'pontual' | 'recorrente') {
    if (!classificacaoPendente) return;
    setPending(true);
    await atualizarStatusSubInteracao(
      String(classificacaoPendente.topicoId), 'concluido', '/carometro/todo-planning', true, classificacao,
    );
    setPending(false);
    setClassificacaoPendente(null);
    void reloadTopicos();
    window.dispatchEvent(new CustomEvent('backlog-reload'));
  }

  if (!row) return null;

  return (
    <>
      <SireneChamadoDetalheModal
        row={row}
        onClose={onClose}
        topicos={topicos}
        topicosLoading={topicosLoading}
        nomePorUserId={new Map()}
        textoResponsavel={row.sirene_abertura_responsavel_nome ?? row.responsavel_nome ?? row.responsavel_nome_texto ?? ''}
        parseTimesNomes={(raw) => Array.isArray(raw) ? raw.map(x => String(x)) : []}
        statusSelect={statusDbParaSelect(row.atividade_status)}
        temSubAberta={topicos.some(t => t.status !== 'concluido' && t.status !== 'aprovado')}
        pending={pending}
        onStatusChange={async (id, status) => {
          setPending(true);
          await atualizarStatusInteracaoSirene(id, status);
          setPending(false);
          if (status === 'concluida') onConcluido?.();
          window.dispatchEvent(new CustomEvent('backlog-reload'));
        }}
        onSubStatusChange={(topicoId, status) => void handleSubStatus(topicoId, status)}
        podeArquivar={podeArquivar}
        badgeTipo={badgeTipoHelper(row.tipo)}
        times={[]}
        responsaveis={[]}
        novaAtivDraft={novaAtivDraft}
        setNovaAtivDraft={setNovaAtivDraft}
        onAdicionarAtividade={() => { /* não implementado no backlog */ }}
        salvandoNovaAtividade={false}
        currentUserId={currentUserId}
        sessionEhAdmin={podeArquivar}
        sessionRole={sessionRole}
        onRecarregarTopicos={reloadTopicos}
      />
      {horasModal && (
        <SireneModalHoras
          chamadoId={horasModal.chamadoId}
          titulo={horasModal.titulo}
          onClose={() => { setHorasModal(null); setSubStatusPendente(null); }}
          onSaved={() => {
            setHorasModal(null);
            if (subStatusPendente) {
              skipHorasRef.current = true;
              void handleSubStatus(subStatusPendente.topicoId, subStatusPendente.status).finally(() => {
                skipHorasRef.current = false;
              });
              setSubStatusPendente(null);
            }
          }}
        />
      )}
      {classificacaoPendente && (
        <ClassificacaoConclusaoModal
          nomeAtividade={
            topicos.find(t => t.id === classificacaoPendente.topicoId)?.descricao ??
            `Tópico #${classificacaoPendente.topicoId}`
          }
          onEscolher={concluirComClassificacao}
          pending={pending}
          chamadoId={chamadoId}
        />
      )}
    </>
  );
}

// ── BacklogBloco ──────────────────────────────────────────────────────────────
type BacklogBlocoProps = {
  onAbrirModal?: (preenchido: Partial<DadosAgendamento>) => void;
};

// onAbrirModal mantido no tipo por compatibilidade com o pai (não é mais usado internamente)
export function BacklogBloco({ onAbrirModal: _onAbrirModal }: BacklogBlocoProps = {}) {
  const { sirene, atividades, isLoading, error, recarregar } = useBacklog();
  const semanaAtual = isoWeek(new Date());
  const supabase = useMemo(() => createClient(), []);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState<{ id: string; nome: string | null } | null>(null);
  const [chamadoModal, setChamadoModal] = useState<{ chamadoId: number; interacaoId: string | null } | null>(null);

  function handleExcluirAtividade(id: string, nome: string | null) {
    setConfirmExcluir({ id, nome });
  }

  async function handleConfirmarExclusao() {
    if (!confirmExcluir) return;
    const { error: err } = await supabase
      .from('gantt_planejamento')
      .delete()
      .eq('id', confirmExcluir.id);
    setConfirmExcluir(null);
    if (err) {
      console.error('[BacklogBloco] erro ao excluir atividade:', err);
      return;
    }
    recarregar();
  }

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
          {/* Coluna 1 — Sirene */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Sirene</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusDot cor="bg-red-500"   count={sireneAtrasados} />
                  <StatusDot cor="bg-green-500" count={sireneEstaSemana} />
                  <StatusDot cor="bg-gray-400"  count={sireneFuturos} />
                </div>
                <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                  {sirene.length}
                </span>
              </div>
            </div>
            <ColunaSirene items={sirene} onAbrirChamado={(chamadoId, interacaoId) => setChamadoModal({ chamadoId, interacaoId })} />
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
              onNovaAtividade={() => setDrawerAberto(true)}
              onExcluirAtividade={handleExcluirAtividade}
            />
          </div>

          {/* Coluna 3 — Cards / Kanban */}
          <BacklogKanbanColuna />
        </div>
      )}

      {/* Drawer de Nova Atividade */}
      {drawerAberto && (
        <NovaAtividadeDrawer
          onFechar={() => setDrawerAberto(false)}
          onSalvo={() => { recarregar(); setDrawerAberto(false); }}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        open={confirmExcluir !== null}
        title={`Remover "${confirmExcluir?.nome ?? 'atividade'}" do backlog?`}
        description="O registro de planejamento será excluído."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleConfirmarExclusao}
        onClose={() => setConfirmExcluir(null)}
      />

      {/* Modal inline do chamado Sirene — renderizado via portal para evitar clipping */}
      {chamadoModal != null && typeof document !== 'undefined' && createPortal(
        <SireneChamadoBacklogWrapper
          chamadoId={chamadoModal.chamadoId}
          interacaoId={chamadoModal.interacaoId}
          onClose={() => setChamadoModal(null)}
        />,
        document.body,
      )}
    </section>
  );
}
