'use client';

import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useBacklog, SireneItem, AtividadeItem, ChamadoPendenteItem, AtividadeItemAgendada, SireneItemAgendada } from '@/hooks/useBacklog';
import { SireneChamadoDetalheModal } from '@/app/sirene/chamados/SireneChamadoDetalheModal';
import { SireneModalHoras } from '@/app/sirene/chamados/SireneModalHoras';
import { ClassificacaoConclusaoModal } from '@/app/sirene/chamados/ClassificacaoConclusaoModal';
import { buscarDadosModalChamado } from '@/app/sirene/chamados/actions';
import { getTopicosChamado } from '@/app/sirene/actions';
import { atualizarStatusSubInteracao, type SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { atualizarStatusInteracaoSirene, type StatusInteracaoDb } from '@/app/sirene/chamados/actions';
import { ATIVIDADE_FORM_DRAFT_VAZIO, type AtividadeFormDraft } from '@/components/kanban-shared/KanbanAtividadeFormFields';
import type { InteracaoSireneRow } from '@/app/sirene/chamados/InteracoesLista';
import type { TopicoPainelLinha } from '@/app/sirene/actions';
import { BacklogColunaCard, StatusPrazo } from './BacklogColuna';
import type { DadosAgendamento } from './ModalAgendamento';
import { BacklogKanbanColuna } from './BacklogKanbanColuna';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// sem_prazo = 0 (mais crítico — sem data definida = urgente)
const STATUS_ORDER: Record<StatusPrazo, number> = {
  sem_prazo: 0, atrasado: 1, esta_semana: 2, futuro: 3,
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

function statusAtividade(item: AtividadeItem): StatusPrazo {
  if (!item.prazo) return 'sem_prazo';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazoDate = new Date(item.prazo + 'T00:00:00');
  if (prazoDate < hoje) return 'atrasado';
  const sexta = getSexta();
  if (prazoDate <= sexta) return 'esta_semana';
  return 'futuro';
}

function getHojeStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatAgendaBadge(data: string, hora_inicio: string | null, count: number): { text: string; isVencido: boolean } {
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const d = new Date(`${data}T00:00:00`);
  const dia = DIAS[d.getDay()] ?? '';
  const hora = hora_inicio ? hora_inicio.slice(0, 5) : '';
  const base = hora ? `${dia} ${hora}` : dia;
  const text = count > 1 ? `${base} (+${count - 1})` : base;
  return { text, isVencido: data < getHojeStr() };
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
type Acao   = { id: string; nome: string; caneta_verde: string | null; prazo: string | null };

type HiddenState = { tarefas: string[]; acoes: string[] };

function NovaAtividadeDrawer({ areaId, areaIds: areaIdsProp, onFechar, onSaved, ativoIds, onAtivar }: {
  areaId: string | null; areaIds?: string[]; onFechar: () => void; onSaved?: () => void;
  ativoIds?: Set<string>; onAtivar?: (id: string) => Promise<void> | void;
}) {
  const supabase = useMemo(() => createClient(), []);

  // Auth + localStorage hidden state
  const [userId,       setUserId]       = useState<string | null>(null);
  const [hiddenTarefas, setHiddenTarefas] = useState<Set<string>>(new Set());
  const [hiddenAcoes,   setHiddenAcoes]   = useState<Set<string>>(new Set());

  const [tarefas,     setTarefas]     = useState<Tarefa[]>([]);
  const [tarefaId,    setTarefaId]    = useState('');
  const [tarefaNome,  setTarefaNome]  = useState('');
  const [novaTarefa,  setNovaTarefa]  = useState('');
  const [criandoComp, setCriandoComp] = useState(false);
  const [step,        setStep]        = useState<'comportamento' | 'atividades'>('comportamento');
  const [acoes,       setAcoes]       = useState<Acao[]>([]);
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // Inline popup para atividade existente (Item 3)
  const [acaoPopup,     setAcaoPopup]     = useState<{ id: string; nome: string; prazo: string; caneta: string } | null>(null);
  const [salvandoPopup, setSalvandoPopup] = useState(false);

  // Form nova atividade (simplificado — Item 4)
  const [adicionando,  setAdicionando]  = useState(false);
  const [nome,         setNome]         = useState('');
  const [prazo,        setPrazo]        = useState('');
  const [canetaVerde,  setCanetaVerde]  = useState('nao');
  const [salvando,     setSalvando]     = useState(false);
  const [erro,         setErro]         = useState<string | null>(null);

  // Seções "Ocultos" expandidas
  const [ocultosTExpand, setOcultosTExpand] = useState(false);
  const [ocultosAExpand, setOcultosAExpand] = useState(false);

  // Carrega userId + hidden do localStorage
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      try {
        const raw = JSON.parse(localStorage.getItem(`backlog_hidden_${user.id}`) ?? '{}') as HiddenState;
        setHiddenTarefas(new Set(raw.tarefas ?? []));
        setHiddenAcoes(new Set(raw.acoes ?? []));
      } catch { /* ignore */ }
    });
  }, [supabase]);

  const salvarHidden = (ht: Set<string>, ha: Set<string>, uid: string | null) => {
    if (!uid) return;
    localStorage.setItem(`backlog_hidden_${uid}`, JSON.stringify({
      tarefas: [...ht], acoes: [...ha],
    }));
  };

  const toggleHideTarefa = (id: string) => {
    setHiddenTarefas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      salvarHidden(next, hiddenAcoes, userId);
      return next;
    });
  };

  const toggleHideAcao = (id: string) => {
    setHiddenAcoes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      salvarHidden(hiddenTarefas, next, userId);
      return next;
    });
  };

  const effectiveAreaIds = areaIdsProp?.length ? areaIdsProp : (areaId ? [areaId] : []);
  const primaryAreaId    = effectiveAreaIds[0] ?? null;

  useEffect(() => {
    if (effectiveAreaIds.length === 0) return;
    void supabase.from('tarefas').select('id, nome')
      .in('area_id', effectiveAreaIds).order('nome')
      .then(({ data }) => { setTarefas((data ?? []) as Tarefa[]); });
  // effectiveAreaIds muda só quando as áreas do usuário mudam — join como dep estável
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, effectiveAreaIds.join(',')]);

  const carregarAcoes = async (tId: string) => {
    setLoadingAcoes(true);
    const { data } = await supabase.from('acoes')
      .select('id, nome, caneta_verde, prazo')
      .eq('tarefa_id', tId).order('nome');
    setAcoes((data ?? []) as Acao[]);
    setLoadingAcoes(false);
  };

  const handleSelectComp = async (tId: string) => {
    const t = tarefas.find(x => x.id === tId);
    setTarefaId(tId);
    setTarefaNome(t?.nome ?? '');
    setOcultosAExpand(false);
    await carregarAcoes(tId);
    setStep('atividades');
  };

  const handleCriarComp = async () => {
    if (!novaTarefa.trim()) { setErro('Nome obrigatório.'); return; }
    setSalvando(true); setErro(null);
    const { data: ins, error: e } = await supabase
      .from('tarefas').insert({ area_id: primaryAreaId, nome: novaTarefa.trim() }).select('id, nome').single();
    if (e) { setErro(e.message); setSalvando(false); return; }
    const t = ins as Tarefa;
    setTarefas(prev => [...prev, t].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setTarefaId(t.id); setTarefaNome(t.nome);
    setNovaTarefa(''); setCriandoComp(false);
    setAcoes([]); setStep('atividades');
    setSalvando(false);
  };

  // Item 3: salva prazo/caneta em acao existente + ativa no backlog do usuário
  const handleSalvarAcaoPopup = async () => {
    if (!acaoPopup) return;
    setSalvandoPopup(true);
    await supabase.from('acoes').update({
      prazo:        acaoPopup.prazo || null,
      caneta_verde: acaoPopup.caneta,
    }).eq('id', acaoPopup.id);
    onAtivar?.(acaoPopup.id);
    setAcaoPopup(null);
    setSalvandoPopup(false);
    await carregarAcoes(tarefaId);
    onSaved?.();
  };

  // Item 4: form simplificado — sem tempo/recorrencia na UI
  const handleSalvarAtividade = async () => {
    if (!nome.trim()) { setErro('Nome da atividade é obrigatório.'); return; }
    setSalvando(true); setErro(null);
    const { error: e } = await supabase.from('acoes').insert({
      tarefa_id:    tarefaId,
      nome:         nome.trim(),
      prazo:        prazo || null,
      caneta_verde: canetaVerde,
      // defaults registrados no banco, ocultos da UI
      tempo_estimado_minutos: null,
      recorrencia:            'unica',
    });
    if (e) { setErro(e.message); setSalvando(false); return; }
    // Ativa no backlog: busca o id do acao recém-criado
    const { data: novaAcao } = await supabase.from('acoes')
      .select('id').eq('tarefa_id', tarefaId).eq('nome', nome.trim())
      .order('criado_em', { ascending: false }).limit(1).maybeSingle();
    if (novaAcao) onAtivar?.((novaAcao as { id: string }).id);
    setNome(''); setPrazo(''); setCanetaVerde('nao'); setAdicionando(false);
    await carregarAcoes(tarefaId);
    onSaved?.();
    setSalvando(false);
  };

  // Listas ordenadas com separação visíveis/ocultos
  const tarefasVisiveis = tarefas.filter(t => !hiddenTarefas.has(t.id));
  const tarefasOcultas  = tarefas.filter(t =>  hiddenTarefas.has(t.id));
  const acoesVisiveis   = acoes.filter(a => !hiddenAcoes.has(a.id));
  const acoesOcultas    = acoes.filter(a =>  hiddenAcoes.has(a.id));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onFechar}>
      <div className="w-[480px] max-h-[85vh] bg-white rounded-xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          {step === 'atividades' ? (
            <div className="flex items-center gap-2 min-w-0">
              <button type="button"
                onClick={() => { setStep('comportamento'); setAdicionando(false); setAcaoPopup(null); setErro(null); }}
                className="text-gray-400 hover:text-gray-600 text-base shrink-0">←</button>
              <h3 className="text-sm font-semibold text-gray-700 truncate">{tarefaNome}</h3>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-gray-700">Nova atividade</h3>
          )}
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'comportamento' ? (
            /* Passo 1: comportamentos */
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Comportamento / Grupo
              </label>
              {criandoComp ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="Nome do comportamento"
                    value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCriarComp} disabled={salvando}
                      className="flex-1 text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                      {salvando ? 'Criando...' : 'Criar'}
                    </button>
                    <button type="button" onClick={() => { setCriandoComp(false); setErro(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Lista visível */}
                  <div className="flex flex-col gap-1">
                    {tarefasVisiveis.length === 0 && tarefasOcultas.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Nenhum comportamento cadastrado</p>
                    )}
                    {tarefasVisiveis.map(t => (
                      <div key={t.id} className="flex items-center gap-1 group">
                        <button type="button" onClick={() => handleSelectComp(t.id)}
                          className="flex-1 text-left text-xs px-3 py-2 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-700">
                          {t.nome}
                        </button>
                        <button type="button" onClick={() => toggleHideTarefa(t.id)} title="Ocultar"
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 text-xs px-1 transition-opacity shrink-0">
                          👁
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Seção Ocultos */}
                  {tarefasOcultas.length > 0 && (
                    <div className="border-t border-gray-100 pt-2">
                      <button type="button"
                        onClick={() => setOcultosTExpand(v => !v)}
                        className="w-full text-left text-[10px] text-gray-400 hover:text-gray-600 flex items-center justify-between py-0.5">
                        <span>Itens Ocultos ({tarefasOcultas.length})</span>
                        <span>{ocultosTExpand ? '▲' : '▼'}</span>
                      </button>
                      {ocultosTExpand && (
                        <div className="flex flex-col gap-1 mt-1.5">
                          {tarefasOcultas.map(t => (
                            <div key={t.id} className="flex items-center gap-1 group">
                              <span className="flex-1 text-xs px-3 py-2 rounded-md bg-gray-50 text-gray-400 line-through border border-gray-100">
                                {t.nome}
                              </span>
                              <button type="button" onClick={() => toggleHideTarefa(t.id)} title="Tornar visível"
                                className="text-blue-400 hover:text-blue-600 text-xs px-1 shrink-0">
                                👁
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" onClick={() => setCriandoComp(true)}
                    className="mt-1 w-full text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-200 hover:border-blue-400 rounded-md py-1.5 transition-colors">
                    + Novo comportamento / grupo
                  </button>
                </>
              )}
              {erro && <p className="text-xs text-red-500">{erro}</p>}
            </div>
          ) : (
            /* Passo 2: atividades do comportamento */
            <div className="flex flex-col gap-3">
              {loadingAcoes ? (
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />)}
                </div>
              ) : (
                <>
                  {/* Lista visível — clicáveis (Item 3) */}
                  <div className="flex flex-col gap-1">
                    {acoesVisiveis.length === 0 && !adicionando && acoesOcultas.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">Nenhuma atividade cadastrada</p>
                    )}
                    {acoesVisiveis.map(a => (
                      <div key={a.id}>
                        {acaoPopup?.id === a.id ? (
                          /* Popup inline de prazo/caneta */
                          <div className="border border-blue-200 rounded-md p-3 bg-blue-50 flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-700 truncate">{a.nome}</p>
                            <div className="flex gap-2 items-center">
                              <label className="text-[10px] text-gray-500 shrink-0">Prazo</label>
                              <input type="date"
                                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                                value={acaoPopup.prazo}
                                onChange={e => setAcaoPopup(p => p ? { ...p, prazo: e.target.value } : p)} />
                            </div>
                            <select
                              className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                              value={acaoPopup.caneta}
                              onChange={e => setAcaoPopup(p => p ? { ...p, caneta: e.target.value } : p)}>
                              <option value="nao">Caneta: Não</option>
                              <option value="sim">Caneta: Sim</option>
                            </select>
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => setAcaoPopup(null)}
                                className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                              <button type="button" onClick={handleSalvarAcaoPopup} disabled={salvandoPopup}
                                className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                                {salvandoPopup ? '…' : 'Salvar'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <button type="button"
                              onClick={() => setAcaoPopup({ id: a.id, nome: a.nome, prazo: a.prazo ?? '', caneta: a.caneta_verde ?? 'nao' })}
                              className={`flex-1 text-left text-xs px-3 py-2 rounded-md border transition-colors ${ativoIds?.has(a.id) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-gray-600 border-gray-100'}`}>
                              <span className="flex items-center gap-1.5">
                                {ativoIds?.has(a.id) && <span title="No seu backlog" className="text-[10px]">🔖</span>}
                                {a.caneta_verde === 'sim' && <span title="Caneta verde" className="text-[10px]">🖊️</span>}
                                {a.nome}
                                {a.prazo && <span className="ml-auto text-[9px] text-gray-400 shrink-0">{a.prazo}</span>}
                              </span>
                            </button>
                            <button type="button" onClick={() => toggleHideAcao(a.id)} title="Ocultar"
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 text-xs px-1 transition-opacity shrink-0">
                              👁
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Seção Ocultos — atividades */}
                  {acoesOcultas.length > 0 && (
                    <div className="border-t border-gray-100 pt-2">
                      <button type="button"
                        onClick={() => setOcultosAExpand(v => !v)}
                        className="w-full text-left text-[10px] text-gray-400 hover:text-gray-600 flex items-center justify-between py-0.5">
                        <span>Itens Ocultos ({acoesOcultas.length})</span>
                        <span>{ocultosAExpand ? '▲' : '▼'}</span>
                      </button>
                      {ocultosAExpand && (
                        <div className="flex flex-col gap-1 mt-1.5">
                          {acoesOcultas.map(a => (
                            <div key={a.id} className="flex items-center gap-1 group">
                              <span className="flex-1 text-xs px-3 py-2 rounded-md bg-gray-50 text-gray-400 line-through border border-gray-100">
                                {a.nome}
                              </span>
                              <button type="button" onClick={() => toggleHideAcao(a.id)} title="Tornar visível"
                                className="text-blue-400 hover:text-blue-600 text-xs px-1 shrink-0">
                                👁
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Form nova atividade — simplificado (Item 4) */}
              {adicionando ? (
                <div className="border border-blue-200 rounded-md p-3 bg-blue-50 flex flex-col gap-2.5">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Nova atividade</p>
                  <input autoFocus
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                    placeholder="Nome *"
                    value={nome} onChange={e => setNome(e.target.value)} />
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-gray-500 shrink-0">Prazo *</label>
                    <input type="date"
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                      value={prazo} onChange={e => { setPrazo(e.target.value); setErro(null); }} />
                  </div>
                  <select className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                    value={canetaVerde} onChange={e => setCanetaVerde(e.target.value)}>
                    <option value="nao">Caneta: Não</option>
                    <option value="sim">Caneta: Sim</option>
                  </select>
                  {erro && <p className="text-xs text-red-500">{erro}</p>}
                  <div className="flex gap-2 justify-end">
                    <button type="button"
                      onClick={() => { setAdicionando(false); setErro(null); setNome(''); setPrazo(''); setCanetaVerde('nao'); }}
                      className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button type="button" onClick={handleSalvarAtividade} disabled={salvando}
                      className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setAdicionando(true); setErro(null); }}
                  className="w-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-md py-1.5 transition-colors">
                  + Adicionar Nova Atividade
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sirene ───────────────────────────────────────────────────────────────────
type ColunaSireneProps = {
  items: SireneItem[];
  agendadas?: SireneItemAgendada[];
  chamadosPendentes?: ChamadoPendenteItem[];
  onAbrirChamado?: (chamadoId: number) => void;
};
function ColunaSirene({ items, agendadas = [], chamadosPendentes = [], onAbrirChamado }: ColunaSireneProps) {
  const [pendentesAberta, setPendentesAberta] = useState(false);
  const [agendadasExpand, setAgendadasExpand] = useState(false);

  const comStatus = items
    .map(i => ({ item: i, status: statusSirene(i) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <>
      <div className={`flex flex-col gap-1.5 ${comStatus.length > 0 ? 'max-h-[22rem] overflow-y-auto pr-0.5' : ''}`}>
        {comStatus.length === 0 && chamadosPendentes.length === 0 && <EmptyState />}
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
                descricao={item.chamado_titulo ? item.descricao : null}
                onClickExternal={
                  item.chamado_id && onAbrirChamado
                    ? () => onAbrirChamado(Number(item.chamado_id))
                    : undefined
                }
                href={
                  !item.chamado_id
                    ? (item.interacao_id
                        ? `/sirene/chamados?interacao=${item.interacao_id}`
                        : item.card_id
                          ? hrefAbrirCardKanban(item.card_kanban_nome ?? '', item.card_id)
                          : undefined)
                    : undefined
                }
                abertoPor={item.aberto_por_nome}
                onClick={
                  item.chamado_id && onAbrirChamado
                    ? () => onAbrirChamado(Number(item.chamado_id))
                    : undefined
                }
              />
            </DraggableSirene>
          );
        })}

        {/* Seção Agendadas — colapsável */}
        {agendadas.length > 0 && (() => {
          const hojeStr = getHojeStr();
          const numVencidos = agendadas.filter(i => i.agendaInfo.data < hojeStr).length;
          const headerColor = numVencidos === agendadas.length ? 'text-amber-600 hover:text-amber-800' : 'text-blue-500 hover:text-blue-700';
          const headerLabel = numVencidos === agendadas.length
            ? `⚠ ${agendadas.length} vencido${agendadas.length > 1 ? 's' : ''} não concluído${agendadas.length > 1 ? 's' : ''}`
            : `📅 ${agendadas.length} já agendado${agendadas.length > 1 ? 's' : ''}`;
          return (
            <div className="border-t border-gray-100 pt-1.5 mt-0.5">
              <button
                type="button"
                onClick={() => setAgendadasExpand(v => !v)}
                className={`w-full text-left text-[10px] ${headerColor} flex items-center justify-between py-0.5`}
              >
                <span>{headerLabel}</span>
                <span>{agendadasExpand ? '▲' : '▼'}</span>
              </button>
              {agendadasExpand && (
                <div className="flex flex-col gap-1 mt-1.5">
                  {agendadas.map(item => {
                    const tituloExibir = item.chamado_titulo ?? item.descricao ?? item.tipo;
                    const badge = formatAgendaBadge(item.agendaInfo.data, item.agendaInfo.hora_inicio, item.agendaInfo.count);
                    return (
                      <DraggableSirene
                        key={item.id}
                        dragId={`sirene::${item.id}::agendada`}
                        dragData={{ type: 'sirene', id: item.id, titulo: tituloExibir, chamado_id: item.chamado_id ?? null }}
                      >
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs text-gray-600 ${badge.isVencido ? 'border-amber-200 bg-amber-50/50' : 'border-blue-100 bg-blue-50/50'}`}>
                          <span className="flex-1 truncate">{tituloExibir}</span>
                          <span className={`text-[9px] shrink-0 whitespace-nowrap ${badge.isVencido ? 'text-amber-600' : 'text-blue-500'}`}>
                            {badge.isVencido ? '⚠ ' : '📅 '}{badge.text}
                          </span>
                        </div>
                      </DraggableSirene>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Seção Chamados Pendentes Conclusão — colapsável */}
        {chamadosPendentes.length > 0 && (
          <div className="border-t border-gray-100 pt-1.5 mt-0.5">
            <button
              type="button"
              onClick={() => setPendentesAberta(v => !v)}
              className="w-full text-left text-[10px] text-amber-600 hover:text-amber-800 flex items-center justify-between py-0.5"
            >
              <span>⏳ Pendentes Conclusão ({chamadosPendentes.length})</span>
              <span>{pendentesAberta ? '▲' : '▼'}</span>
            </button>
            {pendentesAberta && (
              <div className="flex flex-col gap-1.5 mt-1.5">
                {chamadosPendentes.map(item => (
                  <BacklogColunaCard
                    key={item.id}
                    tipo="sirene"
                    titulo={item.incendio}
                    prazo={item.criado_em.slice(0, 10)}
                    status="esta_semana"
                    origemBadge="Sirene"
                    onClick={onAbrirChamado ? () => onAbrirChamado(item.id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
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

// ── Helpers para modal Sirene ─────────────────────────────────────────────────
function statusDbParaSelect(s: string): StatusInteracaoDb {
  const x = String(s ?? '').trim().toLowerCase();
  if (x === 'concluida' || x === 'concluída') return 'concluida';
  if (x === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

function badgeTipoHelper(tipo: string): { label: string; className: string } {
  const t = String(tipo ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t === 'duvida') return { label: 'Dúvida', className: 'border-blue-200 bg-blue-50 text-blue-800' };
  if (t === 'reclamacao') return { label: 'Reclamação', className: 'border-red-200 bg-red-50 text-red-800' };
  if (t === 'sugestao') return { label: 'Sugestão', className: 'border-green-200 bg-green-50 text-green-800' };
  return { label: tipo || 'Chamado', className: 'border-gray-200 bg-gray-50 text-gray-700' };
}

// ── SireneChamadoBacklogWrapper ───────────────────────────────────────────────
type SireneChamadoBacklogWrapperProps = {
  chamadoId: number;
  onClose: () => void;
};

export function SireneChamadoBacklogWrapper({ chamadoId, onClose }: SireneChamadoBacklogWrapperProps) {
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
        textoResponsavel={row.responsavel_nome ?? row.responsavel_nome_texto ?? ''}
        parseTimesNomes={(raw) => Array.isArray(raw) ? raw.map(x => String(x)) : []}
        statusSelect={statusDbParaSelect(row.atividade_status)}
        temSubAberta={topicos.some(t => t.status !== 'concluido' && t.status !== 'aprovado')}
        pending={pending}
        onStatusChange={async (id, status) => {
          setPending(true);
          await atualizarStatusInteracaoSirene(id, status);
          setPending(false);
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

// ── Atividades Planejadas ─────────────────────────────────────────────────────
type ColunaAtividadesProps = {
  items: AtividadeItem[];
  agendadas?: AtividadeItemAgendada[];
  onDesativar?: (id: string) => void;
};
function ColunaAtividades({ items, agendadas = [], onDesativar }: ColunaAtividadesProps) {
  const [confirmItem, setConfirmItem] = useState<{ id: string; nome: string } | null>(null);
  const [agendadasExpand, setAgendadasExpand] = useState(false);

  const comStatus = items
    .map(i => ({ item: i, status: statusAtividade(i) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <>
      <div className={`flex flex-col gap-1.5 ${items.length > 0 || agendadas.length > 0 ? 'max-h-[22rem] overflow-y-auto pr-0.5' : ''}`}>
        {items.length === 0 && agendadas.length === 0 && <EmptyState />}
        {comStatus.map(({ item, status }) => (
          <DraggableAtividade key={item.id} id={item.id}>
            <div className="flex items-center gap-1 group">
              <div className="flex-1 min-w-0">
                <BacklogColunaCard
                  tipo="atividade"
                  titulo={item.nome}
                  prazo={item.prazo ?? null}
                  status={status}
                />
              </div>
              {onDesativar && (
                <button
                  type="button"
                  onClick={() => setConfirmItem({ id: item.id, nome: item.nome })}
                  onPointerDown={e => e.stopPropagation()}
                  title="Remover do backlog"
                  className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-300 hover:text-red-400 text-xs px-1 py-1 transition-opacity"
                >
                  ✕
                </button>
              )}
            </div>
          </DraggableAtividade>
        ))}

        {/* Seção Agendadas — colapsável */}
        {agendadas.length > 0 && (() => {
          const hojeStr = getHojeStr();
          const numVencidos = agendadas.filter(i => i.agendaInfo.data < hojeStr).length;
          const headerColor = numVencidos === agendadas.length ? 'text-amber-600 hover:text-amber-800' : 'text-blue-500 hover:text-blue-700';
          const headerLabel = numVencidos === agendadas.length
            ? `⚠ ${agendadas.length} vencido${agendadas.length > 1 ? 's' : ''} não concluído${agendadas.length > 1 ? 's' : ''}`
            : `📅 ${agendadas.length} já agendado${agendadas.length > 1 ? 's' : ''}`;
          return (
            <div className="border-t border-gray-100 pt-1.5 mt-0.5">
              <button
                type="button"
                onClick={() => setAgendadasExpand(v => !v)}
                className={`w-full text-left text-[10px] ${headerColor} flex items-center justify-between py-0.5`}
              >
                <span>{headerLabel}</span>
                <span>{agendadasExpand ? '▲' : '▼'}</span>
              </button>
              {agendadasExpand && (
                <div className="flex flex-col gap-1 mt-1.5">
                  {agendadas.map(item => {
                    const badge = formatAgendaBadge(item.agendaInfo.data, item.agendaInfo.hora_inicio, item.agendaInfo.count);
                    return (
                      <DraggableAtividade key={item.id} id={item.id}>
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs text-gray-600 ${badge.isVencido ? 'border-amber-200 bg-amber-50/50' : 'border-blue-100 bg-blue-50/50'}`}>
                          <span className="flex-1 truncate">{item.nome}</span>
                          <span className={`text-[9px] shrink-0 whitespace-nowrap ${badge.isVencido ? 'text-amber-600' : 'text-blue-500'}`}>
                            {badge.isVencido ? '⚠ ' : '📅 '}{badge.text}
                          </span>
                        </div>
                      </DraggableAtividade>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <ConfirmModal
        open={!!confirmItem}
        title="Remover atividade"
        description={`Deseja remover "${confirmItem?.nome ?? ''}" do seu backlog?`}
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (confirmItem) onDesativar?.(confirmItem.id);
          setConfirmItem(null);
        }}
        onClose={() => setConfirmItem(null)}
      />
    </>
  );
}

// ── BacklogBloco ──────────────────────────────────────────────────────────────
type BacklogBlocoProps = {
  onAbrirModal?: (preenchido: Partial<DadosAgendamento>) => void;
  onAbrirChamado?: (id: number) => void;
};

export function BacklogBloco({ onAbrirModal, onAbrirChamado }: BacklogBlocoProps = {}) {
  const { sirene, chamadosPendentes, atividades, ativoIds, atividadesAgendadas, sireneAgendadas, isLoading, error, recarregar, ativar, desativar } = useBacklog();
  const { areaId, areaIds } = useEffectiveUser();
  const [drawerAberto, setDrawerAberto] = useState(false);

  // Apenas acoes que o usuário ativou
  const atividadesAtivas = atividades.filter(i => ativoIds.has(i.id));

  // Contadores para dots de status
  const sireneAtrasados  = sirene.filter(i => statusSirene(i) === 'atrasado').length;
  const sireneEstaSemana = sirene.filter(i => statusSirene(i) === 'esta_semana').length;
  const sireneFuturos    = sirene.filter(i => statusSirene(i) === 'futuro').length;

  const atividadesAtrasadas  = atividadesAtivas.filter(i => statusAtividade(i) === 'atrasado').length;
  const atividadesEstaSemana = atividadesAtivas.filter(i => statusAtividade(i) === 'esta_semana').length;
  const atividadesFuturas    = atividadesAtivas.filter(i => statusAtividade(i) === 'futuro').length;

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
                  {sirene.length + chamadosPendentes.length}
                </span>
              </div>
            </div>
            <ColunaSirene
              items={sirene}
              agendadas={sireneAgendadas}
              chamadosPendentes={chamadosPendentes}
              onAbrirChamado={onAbrirChamado}
            />
          </div>

          {/* Coluna 2 — Atividades Planejadas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-600">Atividades Planejadas</span>
                <button
                  type="button"
                  onClick={() => setDrawerAberto(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded px-2 py-0.5 transition-colors"
                >
                  + Planejar Atividade
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusDot cor="bg-gray-400"  count={atividadesAtivas.filter(i => statusAtividade(i) === 'sem_prazo').length} />
                  <StatusDot cor="bg-red-500"   count={atividadesAtrasadas} />
                  <StatusDot cor="bg-green-500" count={atividadesEstaSemana} />
                  <StatusDot cor="bg-gray-300"  count={atividadesFuturas} />
                </div>
                <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                  {atividadesAtivas.length + atividadesAgendadas.length}
                </span>
              </div>
            </div>
            <ColunaAtividades
              items={atividadesAtivas}
              agendadas={atividadesAgendadas}
              onDesativar={desativar}
            />
          </div>

          {/* Coluna 3 — Cards / Kanban */}
          <BacklogKanbanColuna />
        </div>
      )}

      {drawerAberto && (
        <NovaAtividadeDrawer
          areaId={areaId}
          areaIds={areaIds}
          onFechar={() => setDrawerAberto(false)}
          onSaved={recarregar}
          ativoIds={ativoIds}
          onAtivar={ativar}
        />
      )}
    </section>
  );
}
