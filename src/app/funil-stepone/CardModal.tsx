'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcularStatusSLA } from '@/lib/dias-uteis';

type Fase = {
  id: string;
  nome: string;
  ordem: number;
  sla_dias: number | null;
};

type Card = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  kanban_id: string;
  profiles?: {
    full_name: string | null;
  } | null;
};

type Atividade = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  data_vencimento: string | null;
  responsavel_id: string | null;
  time: string | null;
  created_at: string;
  concluida_em: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

export function CardModal({
  cardId,
  onClose,
  isAdmin,
}: {
  cardId: string;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [fases, setFases] = useState<Fase[]>([]);
  const [faseAtual, setFaseAtual] = useState<Fase | null>(null);
  const [abasMinimizadas, setAbasMinimizadas] = useState<Set<string>>(new Set());
  const [novoComentario, setNovoComentario] = useState('');
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  
  // Estados para nova atividade
  const [novaAtividade, setNovaAtividade] = useState({
    titulo: '',
    data: '',
    time: '',
    responsavel: '',
    status: 'pendente' as const,
  });
  
  // Estados para filtros
  const [filtros, setFiltros] = useState({
    status: 'todos',
    time: 'todos',
    responsavel: 'todos',
    ordenacao: 'prazo_asc',
  });

  useEffect(() => {
    loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  async function loadCard() {
    setLoading(true);
    try {
      const supabase = createClient();

      console.log('[CardModal] Carregando card:', cardId);

      // Busca o card
      const { data: cardData, error: cardError } = await supabase
        .from('kanban_cards')
        .select('id, titulo, status, created_at, fase_id, franqueado_id, kanban_id')
        .eq('id', cardId)
        .single();

      console.log('[CardModal] Card data:', cardData);
      console.log('[CardModal] Card error:', cardError);

      if (cardError || !cardData) {
        console.error('Erro ao carregar card:', cardError);
        alert('Card não encontrado');
        onClose();
        return;
      }

      // Busca perfil do responsável
      let profiles = null;
      if (isAdmin) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', cardData.franqueado_id)
          .single();
        profiles = profileData;
      }

      setCard({ ...cardData, profiles });

      // Busca as fases do kanban
      const { data: fasesData } = await supabase
        .from('kanban_fases')
        .select('id, nome, ordem, sla_dias')
        .eq('kanban_id', cardData.kanban_id)
        .eq('ativo', true)
        .order('ordem');

      setFases(fasesData || []);
      const faseEncontrada = fasesData?.find((f) => f.id === cardData.fase_id) || null;
      setFaseAtual(faseEncontrada);

      // Minimiza todas as fases anteriores por padrão
      if (fasesData && faseEncontrada) {
        const fasesAnterioresIds = fasesData
          .filter((f) => f.ordem < faseEncontrada.ordem)
          .map((f) => f.id);
        setAbasMinimizadas(new Set(fasesAnterioresIds));
      }

      // Busca as atividades do card (opcional, não quebra se tabela não existir)
      try {
        const { data: atividadesData, error: atividadesError } = await supabase
          .from('kanban_atividades')
          .select('id, titulo, descricao, status, prioridade, data_vencimento, responsavel_id, time, created_at, concluida_em')
          .eq('card_id', cardId)
          .order('ordem', { ascending: true });

        if (atividadesError) {
          console.warn('[CardModal] Atividades não carregadas:', atividadesError.message);
          setAtividades([]);
        } else if (atividadesData && atividadesData.length > 0) {
          // Busca perfis dos responsáveis das atividades
          const responsavelIds = [...new Set(atividadesData.map(a => a.responsavel_id).filter(Boolean))] as string[];
          
          if (responsavelIds.length > 0) {
            const { data: responsaveisData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', responsavelIds);

            const responsaveisMap = new Map(responsaveisData?.map(r => [r.id, { full_name: r.full_name }]) || []);
            
            const atividadesComPerfil = atividadesData.map(a => ({
              ...a,
              profiles: a.responsavel_id ? responsaveisMap.get(a.responsavel_id) : null,
            }));
            
            setAtividades(atividadesComPerfil);
          } else {
            setAtividades(atividadesData);
          }
        } else {
          setAtividades([]);
        }
      } catch (atividadesErr) {
        console.warn('[CardModal] Erro ao buscar atividades (tabela pode não existir ainda):', atividadesErr);
        setAtividades([]);
      }
      
      console.log('[CardModal] Card carregado com sucesso');
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdicionarAtividade() {
    if (!card || !novaAtividade.titulo.trim()) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('kanban_atividades').insert({
        card_id: card.id,
        titulo: novaAtividade.titulo.trim(),
        status: novaAtividade.status,
        prioridade: 'normal',
        data_vencimento: novaAtividade.data || null,
        responsavel_id: novaAtividade.responsavel || null,
        time: novaAtividade.time || null,
        criado_por: user?.id,
        ordem: atividades.length,
      });

      if (error) throw error;

      // Limpa o formulário
      setNovaAtividade({
        titulo: '',
        data: '',
        time: '',
        responsavel: '',
        status: 'pendente',
      });

      // Recarrega atividades
      await loadCard();
    } catch (err) {
      console.error('Erro ao criar atividade:', err);
      alert('Erro ao criar atividade. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAvancarFase() {
    if (!card || !faseAtual) return;

    const proximaFase = fases.find((f) => f.ordem === (faseAtual.ordem + 1));
    if (!proximaFase) {
      alert('Esta é a última fase do funil.');
      return;
    }

    if (!confirm(`Avançar para a fase "${proximaFase.nome}"?`)) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('kanban_cards')
        .update({ fase_id: proximaFase.id })
        .eq('id', card.id);

      if (error) throw error;

      await loadCard();
      router.refresh();
    } catch (err) {
      console.error('Erro ao avançar fase:', err);
      alert('Erro ao avançar fase. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleArquivar() {
    if (!card) return;
    if (!confirm('Tem certeza que deseja arquivar este card?')) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('kanban_cards')
        .update({ status: 'arquivado' })
        .eq('id', card.id);

      if (error) throw error;

      router.refresh();
      onClose();
    } catch (err) {
      console.error('Erro ao arquivar:', err);
      alert('Erro ao arquivar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function toggleAba(faseId: string) {
    setAbasMinimizadas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(faseId)) {
        newSet.delete(faseId);
      } else {
        newSet.add(faseId);
      }
      return newSet;
    });
  }

  if (loading || !card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  const createdDate = new Date(card.created_at);
  const sla = calcularStatusSLA(createdDate, faseAtual?.sla_dias ?? 999);
  const fasesAnteriores = fases.filter((f) => f.ordem < (faseAtual?.ordem ?? 0));

  // Usa o título real do card (já vem no formato FK0001 - Nome - Área)
  const cardTitulo = card.titulo;

  // Aplica filtros nas atividades
  const atividadesFiltradas = atividades.filter((atividade) => {
    // Filtro por status
    if (filtros.status !== 'todos' && atividade.status !== filtros.status) {
      return false;
    }
    
    // Filtro por time
    if (filtros.time !== 'todos' && atividade.time !== filtros.time) {
      return false;
    }
    
    // Filtro por responsável
    if (filtros.responsavel !== 'todos' && atividade.responsavel_id !== filtros.responsavel) {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Ordenação
    if (filtros.ordenacao === 'prazo_asc') {
      if (!a.data_vencimento) return 1;
      if (!b.data_vencimento) return -1;
      return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
    } else if (filtros.ordenacao === 'prazo_desc') {
      if (!a.data_vencimento) return 1;
      if (!b.data_vencimento) return -1;
      return new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime();
    }
    return 0;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="moni-card-modal-split relative flex h-[90vh] w-full flex-col overflow-hidden bg-white sm:flex-row"
        style={{
          maxWidth: 'var(--moni-card-modal-max)',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER DO MODAL (faixa superior leve) */}
        <div
          className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4"
          style={{
            borderColor: 'var(--moni-border-default)',
            borderTopLeftRadius: 'var(--moni-radius-xl)',
            borderTopRightRadius: 'var(--moni-radius-xl)',
          }}
        >
          {/* Título do card */}
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold sm:text-lg" style={{ color: 'var(--moni-text-primary)' }}>
              {cardTitulo}
            </h2>

            {/* Badge da fase atual */}
            {faseAtual && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold"
                style={{
                  background: 'var(--moni-gold-50)',
                  color: 'var(--moni-gold-800)',
                  border: '0.5px solid var(--moni-gold-400)',
                  borderRadius: 'var(--moni-radius-pill)',
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {faseAtual.nome}
              </span>
            )}

            {/* Tag de SLA */}
            {sla.label && sla.status !== 'ok' && (
              <span className={sla.classe}>{sla.label}</span>
            )}
          </div>

          {/* Botão X fechar */}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CORPO DO MODAL (duas colunas, com padding-top para não sobrepor o header) */}
        <div className="flex h-full w-full flex-col sm:flex-row" style={{ paddingTop: '70px' }}>
          {/* COLUNA DIREITA (60%) — Mobile: aparece primeiro */}
          <div
            className="moni-card-modal-right order-1 flex h-full flex-1 flex-col overflow-y-auto p-6 sm:order-2 sm:w-[60%]"
            style={{ background: 'var(--moni-surface-0)' }}
          >
            {/* Título "Fase atual" */}
            <h3 className="mb-4 text-lg font-bold" style={{ color: 'var(--moni-text-primary)' }}>
              Fase atual: {faseAtual?.nome || 'Não definida'}
            </h3>

            {/* Seção Checklist */}
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Checklist
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded bg-white" disabled />
                    <span style={{ color: 'var(--moni-text-primary)' }}>Item do checklist 1</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded bg-white" disabled />
                    <span style={{ color: 'var(--moni-text-primary)' }}>Item do checklist 2</span>
                  </label>
                  <p className="mt-3 text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Em desenvolvimento - checklist personalizado por fase
                  </p>
                </div>
              </div>
            </div>

            {/* Seção Campos */}
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Campos desta fase
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Em desenvolvimento - campos personalizados por fase
                </p>
              </div>
            </div>

            {/* Seção Comentários */}
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Comentários desta fase
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                <textarea
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Adicione um comentário..."
                  rows={3}
                  disabled
                  className="w-full resize-none rounded-lg p-3 text-sm focus:outline-none"
                  style={{
                    border: '0.5px solid var(--moni-border-default)',
                    background: 'var(--moni-surface-0)',
                  }}
                />
                <p className="mt-2 text-xs text-stone-400">
                  Em desenvolvimento - sistema de comentários
                </p>
              </div>
            </div>

            {/* Seção Atividades */}
            <div className="mb-6">
              <h4 className="mb-4 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Atividades vinculadas ({atividades.length})
              </h4>

              {/* Filtros */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="filtro-status" className="mb-1 block text-xs text-stone-600">
                    Status
                  </label>
                  <select
                    id="filtro-status"
                    value={filtros.status}
                    onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs focus:outline-none"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                    }}
                  >
                    <option value="todos">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filtro-time" className="mb-1 block text-xs text-stone-600">
                    Time
                  </label>
                  <select
                    id="filtro-time"
                    value={filtros.time}
                    onChange={(e) => setFiltros({ ...filtros, time: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs focus:outline-none"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                    }}
                  >
                    <option value="todos">Todos</option>
                    <option value="comercial">Comercial</option>
                    <option value="operacoes">Operações</option>
                    <option value="juridico">Jurídico</option>
                    <option value="financeiro">Financeiro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filtro-responsavel" className="mb-1 block text-xs text-stone-600">
                    Responsável
                  </label>
                  <select
                    id="filtro-responsavel"
                    value={filtros.responsavel}
                    onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs focus:outline-none"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                    }}
                  >
                    <option value="todos">Todos</option>
                    {/* Responsáveis serão carregados dinamicamente */}
                  </select>
                </div>

                <div>
                  <label htmlFor="filtro-ordenacao" className="mb-1 block text-xs text-stone-600">
                    Ordenar por
                  </label>
                  <select
                    id="filtro-ordenacao"
                    value={filtros.ordenacao}
                    onChange={(e) => setFiltros({ ...filtros, ordenacao: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs focus:outline-none"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-md)',
                    }}
                  >
                    <option value="prazo_asc">Prazo (menor → maior)</option>
                    <option value="prazo_desc">Prazo (maior → menor)</option>
                  </select>
                </div>
              </div>

              {/* Lista de Atividades */}
              {atividadesFiltradas.length > 0 ? (
                <div className="mb-4 space-y-2">
                  {atividadesFiltradas.map((atividade) => {
                    const isPendente = atividade.status === 'pendente';
                    const isEmAndamento = atividade.status === 'em_andamento';
                    const isConcluida = atividade.status === 'concluida';
                    const isUrgente = atividade.prioridade === 'urgente';
                    const isAlta = atividade.prioridade === 'alta';

                    let bgColor = 'var(--moni-surface-0)';
                    let borderColor = 'var(--moni-border-default)';
                    let statusColor = 'var(--moni-text-tertiary)';
                    let statusIcon = '⚪';

                    if (isConcluida) {
                      bgColor = 'var(--moni-status-done-bg)';
                      borderColor = 'var(--moni-status-done-border)';
                      statusColor = 'var(--moni-status-done-text)';
                      statusIcon = '✅';
                    } else if (isEmAndamento) {
                      bgColor = 'var(--moni-status-active-bg)';
                      borderColor = 'var(--moni-status-active-border)';
                      statusColor = 'var(--moni-status-active-text)';
                      statusIcon = '🔄';
                    } else if (isUrgente) {
                      bgColor = 'var(--moni-status-overdue-bg)';
                      borderColor = 'var(--moni-status-overdue-border)';
                      statusColor = 'var(--moni-status-overdue-text)';
                      statusIcon = '🔴';
                    } else if (isAlta) {
                      bgColor = 'var(--moni-status-attention-bg)';
                      borderColor = 'var(--moni-status-attention-border)';
                      statusColor = 'var(--moni-status-attention-text)';
                      statusIcon = '🟡';
                    }

                    return (
                      <div
                        key={atividade.id}
                        className="rounded-lg p-3"
                        style={{
                          background: bgColor,
                          border: `0.5px solid ${borderColor}`,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base">{statusIcon}</span>
                          <div className="flex-1">
                            <h5 className="text-sm font-medium text-stone-800">
                              {atividade.titulo}
                            </h5>
                            {atividade.descricao && (
                              <p className="mt-1 text-xs text-stone-600">
                                {atividade.descricao}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className="rounded px-2 py-0.5"
                                style={{
                                  background: statusColor,
                                  color: 'var(--moni-surface-0)',
                                }}
                              >
                                {atividade.status === 'pendente' && 'Pendente'}
                                {atividade.status === 'em_andamento' && 'Em andamento'}
                                {atividade.status === 'concluida' && 'Concluída'}
                                {atividade.status === 'cancelada' && 'Cancelada'}
                              </span>
                              {atividade.data_vencimento && (
                                <span className="text-stone-500">
                                  Vence: {new Date(atividade.data_vencimento).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                              {atividade.profiles?.full_name && (
                                <span className="text-stone-500">
                                  • {atividade.profiles.full_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="mb-4 rounded-lg p-4 text-center"
                  style={{
                    background: 'var(--moni-surface-50)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                >
                  <p className="text-sm text-stone-500">
                    Nenhuma atividade encontrada para os filtros selecionados
                  </p>
                </div>
              )}

              {/* Formulário para Adicionar Nova Atividade */}
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={novaAtividade.titulo}
                      onChange={(e) => setNovaAtividade({ ...novaAtividade, titulo: e.target.value })}
                      placeholder="Atividade (o que fazer)"
                      className="w-full px-3 py-2 text-xs focus:outline-none"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'var(--moni-surface-0)',
                      }}
                    />
                  </div>

                  <div>
                    <input
                      type="date"
                      value={novaAtividade.data}
                      onChange={(e) => setNovaAtividade({ ...novaAtividade, data: e.target.value })}
                      className="w-full px-3 py-2 text-xs focus:outline-none"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'var(--moni-surface-0)',
                      }}
                    />
                  </div>

                  <div>
                    <select
                      value={novaAtividade.time}
                      onChange={(e) => setNovaAtividade({ ...novaAtividade, time: e.target.value })}
                      className="w-full px-3 py-2 text-xs focus:outline-none"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'var(--moni-surface-0)',
                      }}
                    >
                      <option value="">Time</option>
                      <option value="comercial">Comercial</option>
                      <option value="operacoes">Operações</option>
                      <option value="juridico">Jurídico</option>
                      <option value="financeiro">Financeiro</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={novaAtividade.responsavel}
                      onChange={(e) => setNovaAtividade({ ...novaAtividade, responsavel: e.target.value })}
                      className="w-full px-3 py-2 text-xs focus:outline-none"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: 'var(--moni-surface-0)',
                      }}
                    >
                      <option value="">Responsável</option>
                      {/* Será populado dinamicamente */}
                    </select>
                  </div>

                  <div>
                    <button
                      onClick={handleAdicionarAtividade}
                      disabled={loading || !novaAtividade.titulo.trim()}
                      className="w-full px-4 py-2 text-xs font-medium transition hover:bg-stone-800 disabled:opacity-50"
                      style={{
                        background: 'var(--moni-text-primary)',
                        color: 'white',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      {loading ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de ação no rodapé */}
            <div className="mt-auto flex flex-col gap-3 border-t pt-4 sm:flex-row" style={{ borderColor: 'var(--moni-border-default)' }}>
              <button
                onClick={handleAvancarFase}
                disabled={loading}
                className="flex-1 px-6 py-2.5 text-sm font-medium transition hover:bg-stone-100 disabled:opacity-50"
                style={{
                  background: 'var(--moni-surface-0)',
                  color: 'var(--moni-green-800)',
                  border: '0.5px solid var(--moni-green-400)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                {loading ? 'Avançando...' : 'Avançar para próxima fase'}
              </button>
              <button
                onClick={handleArquivar}
                disabled={loading}
                className="px-6 py-2.5 text-sm font-medium transition hover:bg-red-50 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  color: 'var(--moni-status-overdue-text)',
                  border: '0.5px solid var(--moni-status-overdue-border)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                Arquivar
              </button>
            </div>
          </div>

          {/* COLUNA ESQUERDA (40%) — Mobile: aparece depois */}
          <div
            className="moni-card-modal-left order-2 h-full w-full overflow-y-auto border-t p-6 sm:order-1 sm:w-[40%] sm:border-r sm:border-t-0"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
          >
            {/* Título "Histórico" */}
            <h3 className="mb-4 text-lg font-bold" style={{ color: 'var(--moni-text-primary)' }}>
              Histórico
            </h3>

            {/* Responsável */}
            {isAdmin && card.profiles && (
              <div
                className="mb-4 rounded-lg bg-white p-4"
                style={{
                  border: '0.5px solid var(--moni-border-subtle)',
                  boxShadow: 'var(--moni-shadow-sm)',
                }}
              >
                <p className="text-xs font-medium text-stone-500">RESPONSÁVEL</p>
                <p className="mt-1 text-sm font-semibold text-stone-800">
                  {card.profiles.full_name || 'Não informado'}
                </p>
              </div>
            )}

            {/* Fases Anteriores (minimizadas por padrão) */}
            {fasesAnteriores.length > 0 ? (
              <div className="space-y-2">
                {fasesAnteriores.map((fase) => {
                  const isMinimizada = abasMinimizadas.has(fase.id);
                  return (
                    <div
                      key={fase.id}
                      className="overflow-hidden rounded-lg bg-white"
                      style={{
                        border: '0.5px solid var(--moni-border-default)',
                        boxShadow: 'var(--moni-shadow-sm)',
                      }}
                    >
                      <button
                        onClick={() => toggleAba(fase.id)}
                        className="flex w-full items-center justify-between p-3 text-left transition hover:bg-stone-50"
                      >
                        <span className="text-sm font-medium text-stone-700">
                          {fase.nome}
                        </span>
                        {isMinimizada ? (
                          <ChevronRight className="h-4 w-4 text-stone-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-stone-400" />
                        )}
                      </button>

                      {!isMinimizada && (
                        <div
                          className="border-t p-3 text-sm text-stone-600"
                          style={{ borderColor: 'var(--moni-border-subtle)' }}
                        >
                          <p className="text-xs italic text-stone-400">
                            Campos preenchidos e comentários desta fase serão exibidos aqui
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-stone-500">Nenhuma fase anterior concluída.</p>
            )}

            {/* Separador */}
            {fasesAnteriores.length > 0 && (
              <div className="my-4" style={{ borderTop: '0.5px solid var(--moni-border-default)' }} />
            )}

            {/* Aba fixa "Comentários gerais" */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-stone-700">
                Comentários gerais
              </h4>
              <div
                className="rounded-lg bg-white p-4"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  boxShadow: 'var(--moni-shadow-sm)',
                }}
              >
                <p className="text-sm text-stone-500">
                  Em desenvolvimento - comentários gerais do card
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
