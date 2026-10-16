'use client';

/**
 * NovaAtividadeDrawer
 * Restaurado a partir do commit 1835e3fd (Ingrid, antes do merge 14/09).
 *
 * Fluxo:
 *  1. Selecionar comportamento (tarefa) — ou criar um novo
 *  2. Selecionar atividade (acao) — ou criar uma nova
 *  3. Definir prazo (data) e caneta verde → grava em gantt_planejamento
 *
 * Itens ocultos são persistidos em localStorage por usuário.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { isoWeek } from '@/utils/periodos';

type Tarefa = { id: string; nome: string };
type Acao   = { id: string; nome: string; caneta_verde: string | null };
type HiddenState = { tarefas: string[]; acoes: string[] };

type NovaAtividadeDrawerProps = {
  onFechar: () => void;
  onSalvo:  () => void;
};

export function NovaAtividadeDrawer({ onFechar, onSalvo }: NovaAtividadeDrawerProps) {
  const supabase           = useMemo(() => createClient(), []);
  const { effectiveProfileId, areaId, areaIds } = useEffectiveUser();

  /* ── hidden state (localStorage) ─────────────────────────────────────── */
  const [userId,        setUserId]        = useState<string | null>(null);
  const [hiddenTarefas, setHiddenTarefas] = useState<Set<string>>(new Set());
  const [hiddenAcoes,   setHiddenAcoes]   = useState<Set<string>>(new Set());

  /* ── dados ────────────────────────────────────────────────────────────── */
  const [tarefas,      setTarefas]      = useState<Tarefa[]>([]);
  const [tarefaId,     setTarefaId]     = useState('');
  const [tarefaNome,   setTarefaNome]   = useState('');
  const [acoes,        setAcoes]        = useState<Acao[]>([]);
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  /* ── fluxo ────────────────────────────────────────────────────────────── */
  const [step, setStep] = useState<'comportamento' | 'atividades'>('comportamento');

  /* ── criar comportamento ──────────────────────────────────────────────── */
  const [criandoComp, setCriandoComp] = useState(false);
  const [novaTarefa,  setNovaTarefa]  = useState('');

  /* ── popup de atividade existente ─────────────────────────────────────── */
  const [acaoPopup,     setAcaoPopup]     = useState<{ id: string; nome: string; prazo: string; caneta: string } | null>(null);
  const [salvandoPopup, setSalvandoPopup] = useState(false);

  /* ── criar nova atividade ─────────────────────────────────────────────── */
  const [adicionando,  setAdicionando]  = useState(false);
  const [nomeAtv,      setNomeAtv]      = useState('');
  const [prazoAtv,     setPrazoAtv]     = useState('');
  const [canetaVerde,  setCanetaVerde]  = useState('nao');
  const [salvando,     setSalvando]     = useState(false);
  const [erro,         setErro]         = useState<string | null>(null);

  /* ── ocultos expansíveis ──────────────────────────────────────────────── */
  const [ocultosTExpand, setOcultosTExpand] = useState(false);
  const [ocultosAExpand, setOcultosAExpand] = useState(false);

  /* ── áreas efetivas ───────────────────────────────────────────────────── */
  const effectiveAreaIds = areaIds.length ? areaIds : (areaId ? [areaId] : []);
  const primaryAreaId    = effectiveAreaIds[0] ?? null;
  const areaIdsKey       = effectiveAreaIds.join(',');

  /* ── carrega userId + hidden do localStorage ──────────────────────────── */
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

  const salvarHidden = useCallback((ht: Set<string>, ha: Set<string>, uid: string | null) => {
    if (!uid) return;
    localStorage.setItem(`backlog_hidden_${uid}`, JSON.stringify({
      tarefas: [...ht], acoes: [...ha],
    }));
  }, []);

  const toggleHideTarefa = (id: string) => {
    setHiddenTarefas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      salvarHidden(next, hiddenAcoes, userId);
      return next;
    });
  };

  const toggleHideAcao = (id: string) => {
    setHiddenAcoes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      salvarHidden(hiddenTarefas, next, userId);
      return next;
    });
  };

  /* ── carrega tarefas (comportamentos) ────────────────────────────────── */
  useEffect(() => {
    if (!areaIdsKey) return;
    void supabase.from('tarefas').select('id, nome')
      .in('area_id', effectiveAreaIds).order('nome')
      .then(({ data }) => setTarefas((data ?? []) as Tarefa[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, areaIdsKey]);

  const carregarAcoes = async (tId: string) => {
    setLoadingAcoes(true);
    const { data } = await supabase.from('acoes')
      .select('id, nome, caneta_verde')
      .eq('tarefa_id', tId).order('nome');
    setAcoes((data ?? []) as Acao[]);
    setLoadingAcoes(false);
  };

  /* ── selecionar comportamento ─────────────────────────────────────────── */
  const handleSelectComp = async (tId: string) => {
    const t = tarefas.find(x => x.id === tId);
    setTarefaId(tId);
    setTarefaNome(t?.nome ?? '');
    setOcultosAExpand(false);
    setAdicionando(false);
    setAcaoPopup(null);
    setErro(null);
    await carregarAcoes(tId);
    setStep('atividades');
  };

  /* ── criar comportamento ──────────────────────────────────────────────── */
  const handleCriarComp = async () => {
    if (!novaTarefa.trim()) { setErro('Nome obrigatório.'); return; }
    setSalvando(true); setErro(null);
    const { data: ins, error: e } = await supabase
      .from('tarefas').insert({ area_id: primaryAreaId, nome: novaTarefa.trim() })
      .select('id, nome').single();
    if (e) { setErro(e.message); setSalvando(false); return; }
    const t = ins as Tarefa;
    setTarefas(prev => [...prev, t].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setTarefaId(t.id); setTarefaNome(t.nome);
    setNovaTarefa(''); setCriandoComp(false);
    setAcoes([]); setStep('atividades');
    setSalvando(false);
  };

  /* ── grava gantt_planejamento ─────────────────────────────────────────── */
  const ativarNoBacklog = async (acoId: string, prazoDate: string) => {
    if (!effectiveProfileId) return;
    const semana = prazoDate
      ? isoWeek(new Date(prazoDate + 'T00:00:00'))
      : isoWeek(new Date());
    await supabase.from('gantt_planejamento').insert({
      acao_id:              acoId,
      profile_id:           effectiveProfileId,
      semana_ano_inicio:    semana,
      semana_ano_fim:       semana,
      semanas_selecionadas: [semana],
      comportamento_chave:  false,
      hora_inicio:          null,
      origem:               'backlog',
    });
  };

  /* ── salvar atividade existente com prazo ─────────────────────────────── */
  const handleSalvarAcaoPopup = async () => {
    if (!acaoPopup) return;
    setSalvandoPopup(true);
    await ativarNoBacklog(acaoPopup.id, acaoPopup.prazo);
    setSalvandoPopup(false);
    setAcaoPopup(null);
    onSalvo();
    onFechar();
  };

  /* ── criar nova atividade + ativar no backlog ─────────────────────────── */
  const handleSalvarAtividade = async () => {
    if (!nomeAtv.trim()) { setErro('Nome da atividade é obrigatório.'); return; }
    setSalvando(true); setErro(null);
    const { data: novaAcao, error: e } = await supabase.from('acoes').insert({
      tarefa_id:              tarefaId,
      nome:                   nomeAtv.trim(),
      caneta_verde:           canetaVerde,
      tempo_estimado_minutos: null,
      recorrencia:            'unica',
    }).select('id').single();
    if (e) { setErro(e.message); setSalvando(false); return; }
    await ativarNoBacklog((novaAcao as { id: string }).id, prazoAtv);
    setNomeAtv(''); setPrazoAtv(''); setCanetaVerde('nao'); setAdicionando(false);
    setSalvando(false);
    onSalvo();
    onFechar();
  };

  /* ── listas separadas em visíveis / ocultos ───────────────────────────── */
  const tarefasVisiveis = tarefas.filter(t => !hiddenTarefas.has(t.id));
  const tarefasOcultas  = tarefas.filter(t =>  hiddenTarefas.has(t.id));
  const acoesVisiveis   = acoes.filter(a => !hiddenAcoes.has(a.id));
  const acoesOcultas    = acoes.filter(a =>  hiddenAcoes.has(a.id));

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onFechar}
    >
      <div
        className="w-[480px] max-h-[85vh] flex flex-col rounded-xl shadow-xl"
        style={{
          background:    'var(--moni-surface-0, #fff)',
          border:        'var(--moni-border-width, 0.5px) solid var(--moni-border-default)',
          borderRadius:  'var(--moni-radius-lg, 12px)',
          fontFamily:    'var(--moni-font-sans)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '0.5px solid var(--moni-border-default)' }}
        >
          {step === 'atividades' ? (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => { setStep('comportamento'); setAdicionando(false); setAcaoPopup(null); setErro(null); }}
                className="shrink-0"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moni-text-tertiary)', fontSize: 16 }}
              >←</button>
              <h3
                className="truncate"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--moni-text-primary)' }}
              >{tarefaNome}</h3>
            </div>
          ) : (
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--moni-text-primary)' }}>
              Nova atividade
            </h3>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="shrink-0"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moni-text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Corpo ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {/* ═══ PASSO 1: comportamentos ═══════════════════════════════ */}
          {step === 'comportamento' && (
            <>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--moni-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Comportamento / Grupo
              </label>

              {criandoComp ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    placeholder="Nome do comportamento"
                    value={novaTarefa}
                    onChange={e => setNovaTarefa(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px',
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      fontSize: 13,
                      background: 'transparent',
                      color: 'var(--moni-text-primary)',
                      outline: 'none',
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCriarComp}
                      disabled={salvando}
                      style={{
                        flex: 1, padding: '6px 0',
                        borderRadius: 'var(--moni-radius-md)',
                        border: 'none', cursor: 'pointer',
                        background: 'var(--moni-navy-800)',
                        color: '#fff', fontSize: 12, fontWeight: 600,
                        opacity: salvando ? 0.6 : 1,
                      }}
                    >
                      {salvando ? 'Criando...' : 'Criar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCriandoComp(false); setNovaTarefa(''); setErro(null); }}
                      style={{ fontSize: 12, color: 'var(--moni-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Lista visível */}
                  <div className="flex flex-col gap-1">
                    {tarefasVisiveis.length === 0 && tarefasOcultas.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--moni-text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
                        Nenhum comportamento cadastrado
                      </p>
                    )}
                    {tarefasVisiveis.map(t => (
                      <div key={t.id} className="flex items-center gap-1 group">
                        <button
                          type="button"
                          onClick={() => handleSelectComp(t.id)}
                          style={{
                            flex: 1, textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: 'var(--moni-radius-md)',
                            border: '0.5px solid var(--moni-border-default)',
                            background: 'transparent',
                            color: 'var(--moni-text-primary)',
                            fontSize: 13, cursor: 'pointer',
                          }}
                        >{t.nome}</button>
                        <button
                          type="button"
                          onClick={() => toggleHideTarefa(t.id)}
                          title="Ocultar"
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moni-text-tertiary)', fontSize: 13, padding: '4px 6px' }}
                        >👁</button>
                      </div>
                    ))}
                  </div>

                  {/* Seção ocultos */}
                  {tarefasOcultas.length > 0 && (
                    <div style={{ borderTop: '0.5px solid var(--moni-border-default)', paddingTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setOcultosTExpand(v => !v)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--moni-text-tertiary)', padding: '2px 0' }}
                      >
                        <span>Itens Ocultos ({tarefasOcultas.length})</span>
                        <span>{ocultosTExpand ? '▲' : '▼'}</span>
                      </button>
                      {ocultosTExpand && (
                        <div className="flex flex-col gap-1 mt-1.5">
                          {tarefasOcultas.map(t => (
                            <div key={t.id} className="flex items-center gap-1">
                              <span style={{ flex: 1, padding: '7px 12px', borderRadius: 'var(--moni-radius-md)', border: '0.5px solid var(--moni-border-default)', color: 'var(--moni-text-tertiary)', fontSize: 13, textDecoration: 'line-through', opacity: 0.6 }}>
                                {t.nome}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleHideTarefa(t.id)}
                                title="Tornar visível"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moni-navy-800)', fontSize: 13, padding: '4px 6px' }}
                              >👁</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* + Novo comportamento */}
                  <button
                    type="button"
                    onClick={() => setCriandoComp(true)}
                    style={{
                      width: '100%', padding: '7px 0',
                      border: '0.5px dashed var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                      background: 'none',
                      color: 'var(--moni-navy-800)',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    + Novo comportamento / grupo
                  </button>
                </>
              )}

              {erro && <p style={{ fontSize: 11, color: '#dc2626' }}>{erro}</p>}
            </>
          )}

          {/* ═══ PASSO 2: atividades do comportamento ══════════════════ */}
          {step === 'atividades' && (
            <>
              {loadingAcoes ? (
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--moni-border-default)' }} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Lista visível */}
                  <div className="flex flex-col gap-1">
                    {acoesVisiveis.length === 0 && !adicionando && acoesOcultas.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--moni-text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
                        Nenhuma atividade cadastrada
                      </p>
                    )}
                    {acoesVisiveis.map(a => (
                      <div key={a.id}>
                        {acaoPopup?.id === a.id ? (
                          /* Popup inline de prazo */
                          <div
                            style={{
                              border: '0.5px solid var(--moni-navy-800)',
                              borderRadius: 'var(--moni-radius-md)',
                              padding: 12,
                              background: 'var(--moni-kanban-stepone-light, #f0f4f8)',
                              display: 'flex', flexDirection: 'column', gap: 8,
                            }}
                          >
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--moni-text-primary)' }}>{a.nome}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <label style={{ fontSize: 11, color: 'var(--moni-text-tertiary)', flexShrink: 0 }}>Prazo</label>
                              <input
                                type="date"
                                value={acaoPopup.prazo}
                                onChange={e => setAcaoPopup(p => p ? { ...p, prazo: e.target.value } : p)}
                                style={{
                                  flex: 1, padding: '5px 8px',
                                  border: '0.5px solid var(--moni-border-default)',
                                  borderRadius: 'var(--moni-radius-md)',
                                  fontSize: 12,
                                  background: 'var(--moni-surface-0, #fff)',
                                  color: 'var(--moni-text-primary)',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <select
                              value={acaoPopup.caneta}
                              onChange={e => setAcaoPopup(p => p ? { ...p, caneta: e.target.value } : p)}
                              style={{
                                padding: '5px 8px',
                                border: '0.5px solid var(--moni-border-default)',
                                borderRadius: 'var(--moni-radius-md)',
                                fontSize: 12,
                                background: 'var(--moni-surface-0, #fff)',
                                color: 'var(--moni-text-primary)',
                                outline: 'none',
                              }}
                            >
                              <option value="nao">Caneta Verde: Não</option>
                              <option value="sim">Caneta Verde: Sim</option>
                            </select>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setAcaoPopup(null)}
                                style={{ fontSize: 12, color: 'var(--moni-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >Cancelar</button>
                              <button
                                type="button"
                                onClick={handleSalvarAcaoPopup}
                                disabled={salvandoPopup}
                                style={{
                                  fontSize: 12, padding: '5px 14px',
                                  border: 'none', borderRadius: 'var(--moni-radius-md)',
                                  background: 'var(--moni-navy-800)', color: '#fff',
                                  fontWeight: 600, cursor: 'pointer',
                                  opacity: salvandoPopup ? 0.6 : 1,
                                }}
                              >
                                {salvandoPopup ? 'Salvando...' : 'Adicionar ao Backlog'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <button
                              type="button"
                              onClick={() => setAcaoPopup({ id: a.id, nome: a.nome, prazo: '', caneta: a.caneta_verde ?? 'nao' })}
                              style={{
                                flex: 1, textAlign: 'left',
                                padding: '8px 12px',
                                borderRadius: 'var(--moni-radius-md)',
                                border: '0.5px solid var(--moni-border-default)',
                                background: 'transparent',
                                color: 'var(--moni-text-primary)',
                                fontSize: 13, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              }}
                            >
                              <span>{a.nome}</span>
                              {a.caneta_verde === 'sim' && (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#d1fae5', color: 'var(--moni-green-800)', fontWeight: 600 }}>
                                  Caneta
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleHideAcao(a.id)}
                              title="Ocultar"
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moni-text-tertiary)', fontSize: 13, padding: '4px 6px' }}
                            >👁</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Seção ocultos atividades */}
                  {acoesOcultas.length > 0 && (
                    <div style={{ borderTop: '0.5px solid var(--moni-border-default)', paddingTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setOcultosAExpand(v => !v)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--moni-text-tertiary)', padding: '2px 0' }}
                      >
                        <span>Itens Ocultos ({acoesOcultas.length})</span>
                        <span>{ocultosAExpand ? '▲' : '▼'}</span>
                      </button>
                      {ocultosAExpand && (
                        <div className="flex flex-col gap-1 mt-1.5">
                          {acoesOcultas.map(a => (
                            <div key={a.id} className="flex items-center gap-1">
                              <span style={{ flex: 1, padding: '7px 12px', borderRadius: 'var(--moni-radius-md)', border: '0.5px solid var(--moni-border-default)', color: 'var(--moni-text-tertiary)', fontSize: 13, textDecoration: 'line-through', opacity: 0.6 }}>
                                {a.nome}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleHideAcao(a.id)}
                                title="Tornar visível"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moni-navy-800)', fontSize: 13, padding: '4px 6px' }}
                              >👁</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form criar nova atividade */}
                  {adicionando ? (
                    <div
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        padding: 12, marginTop: 4,
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}
                    >
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--moni-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Nova atividade
                      </p>
                      <input
                        autoFocus
                        placeholder="Nome da atividade"
                        value={nomeAtv}
                        onChange={e => setNomeAtv(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          padding: '7px 10px',
                          border: '0.5px solid var(--moni-border-default)',
                          borderRadius: 'var(--moni-radius-md)',
                          fontSize: 13, background: 'transparent',
                          color: 'var(--moni-text-primary)', outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--moni-text-tertiary)', flexShrink: 0 }}>Prazo</label>
                        <input
                          type="date"
                          value={prazoAtv}
                          onChange={e => setPrazoAtv(e.target.value)}
                          style={{
                            flex: 1, padding: '5px 8px',
                            border: '0.5px solid var(--moni-border-default)',
                            borderRadius: 'var(--moni-radius-md)',
                            fontSize: 12,
                            background: 'var(--moni-surface-0, #fff)',
                            color: 'var(--moni-text-primary)', outline: 'none',
                          }}
                        />
                      </div>
                      <select
                        value={canetaVerde}
                        onChange={e => setCanetaVerde(e.target.value)}
                        style={{
                          padding: '5px 8px',
                          border: '0.5px solid var(--moni-border-default)',
                          borderRadius: 'var(--moni-radius-md)',
                          fontSize: 12,
                          background: 'var(--moni-surface-0, #fff)',
                          color: 'var(--moni-text-primary)', outline: 'none',
                        }}
                      >
                        <option value="nao">Caneta Verde: Não</option>
                        <option value="sim">Caneta Verde: Sim</option>
                      </select>
                      {erro && <p style={{ fontSize: 11, color: '#dc2626' }}>{erro}</p>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={handleSalvarAtividade}
                          disabled={salvando}
                          style={{
                            flex: 1, padding: '7px',
                            borderRadius: 'var(--moni-radius-md)',
                            border: 'none', cursor: 'pointer',
                            background: 'var(--moni-navy-800)', color: '#fff',
                            fontSize: 12, fontWeight: 600,
                            opacity: salvando ? 0.6 : 1,
                          }}
                        >
                          {salvando ? 'Salvando...' : 'Salvar atividade'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAdicionando(false); setNomeAtv(''); setPrazoAtv(''); setErro(null); }}
                          style={{ fontSize: 12, color: 'var(--moni-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdicionando(true)}
                      style={{
                        width: '100%', padding: '7px 0',
                        border: '0.5px dashed var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'none',
                        color: 'var(--moni-navy-800)',
                        fontSize: 12, cursor: 'pointer', marginTop: 4,
                      }}
                    >
                      + Nova atividade
                    </button>
                  )}
                </>
              )}

              {erro && step === 'atividades' && !adicionando && (
                <p style={{ fontSize: 11, color: '#dc2626' }}>{erro}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
