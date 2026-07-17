'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import {
  buscarFunisParaNovoChamadoSirene,
  buscarCardsParaNovoChamadoSirene,
  type SireneVinculoCardBuscaItem,
  type SireneFunilItem,
} from './actions';
import { criarChamadoSireneComAtividade, criarSubInteracao } from '@/lib/actions/card-actions';
import { createClient } from '@/lib/supabase/client';
import {
  MONI_TODOS_EMAILS,
  responsaveisFiltradosPorTimesIds,
  timesOpcoesReceberChamado,
} from '@/lib/times-responsaveis';
import {
  ATIVIDADE_FORM_DRAFT_VAZIO,
  KanbanAtividadeFormFields,
  type AtividadeFormDraft,
} from '@/components/kanban-shared/KanbanAtividadeFormFields';
import { uploadAnexosAtividadePendentes } from '@/lib/kanban/upload-anexos-atividade';

const GRUPOS_FUNIL: { label: string; nomes: string[] }[] = [
  {
    label: 'Novos Negócios',
    nomes: ['Funil Step One', 'Funil Loteadores', 'Funil Acoplamento', 'Funil Portfólio', 'Funil Cash Me', 'Funil Divify'],
  },
  {
    label: 'Operações',
    nomes: ['Funil Operações', 'Funil Projeto Legal', 'Funil Projetos Legais', 'Funil Projetos Locais', 'Funil Modelo Virtual'],
  },
  {
    label: 'Crédito & Contabilidade',
    nomes: ['Funil Contabilidade', 'Funding'],
  },
  {
    label: 'Interno',
    nomes: ['Funil Jurídico', 'Funil Contratações', 'Funil Homologações', 'Funil Produto'],
  },
];

function grupoDoFunil(nome: string): string {
  for (const g of GRUPOS_FUNIL) {
    if (g.nomes.includes(nome)) return g.label;
  }
  return 'Outros';
}

type Props = { onClose: () => void; onSuccess?: () => void; initialCard?: SireneVinculoCardBuscaItem };

export function ModalNovoChamado({ onClose, onSuccess, initialCard }: Props) {
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<'chamado' | 'melhoria'>('chamado');
  const [trava, setTrava] = useState(false);
  const [atividades, setAtividades] = useState<AtividadeFormDraft[]>([]);
  const [kanbanTimes, setKanbanTimes] = useState<{ id: string; nome: string }[]>([]);
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<
    { id: string; nome: string; email?: string | null }[]
  >([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [uploaderNome, setUploaderNome] = useState('Usuário');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vinculo card — funil-first
  const [funisList, setFunisList] = useState<SireneFunilItem[]>([]);
  const [funilSelecionado, setFunilSelecionado] = useState<SireneFunilItem | null>(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null);
  const [carregandoFunis, setCarregandoFunis] = useState(false);
  const [cardOpcoes, setCardOpcoes] = useState<SireneVinculoCardBuscaItem[]>([]);
  const [carregandoCards, setCarregandoCards] = useState(false);
  const [cardVinculo, setCardVinculo] = useState<SireneVinculoCardBuscaItem | null>(initialCard ?? null);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSessionUserId(user?.id ?? null);
      if (user) {
        const { data: perf } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
        setUploaderNome(String((perf as { full_name?: string } | null)?.full_name ?? (perf as { email?: string } | null)?.email ?? 'Usuário').trim());
      }
      const { data: kt } = await supabase.from('kanban_times').select('id, nome').order('nome');
      setKanbanTimes((kt ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) })));
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('email', [...MONI_TODOS_EMAILS]);
      setResponsaveisOpcoes(
        (profs ?? [])
          .map((p) => ({
            id: String(p.id),
            nome: String(p.full_name ?? p.email ?? p.id).trim(),
            email: String(p.email ?? '').trim().toLowerCase() || null,
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
    })();
  }, []);

  // Carregar fúnis disponíveis
  useEffect(() => {
    setCarregandoFunis(true);
    buscarFunisParaNovoChamadoSirene().then((r) => {
      setCarregandoFunis(false);
      setFunisList(r.ok ? r.items : []);
    });
  }, []);

  // Carregar cards quando funil é selecionado
  useEffect(() => {
    if (!funilSelecionado) {
      setCardOpcoes([]);
      return;
    }
    setCarregandoCards(true);
    buscarCardsParaNovoChamadoSirene('', funilSelecionado.id).then((r) => {
      setCarregandoCards(false);
      setCardOpcoes(r.ok ? r.items : []);
    });
  }, [funilSelecionado]);

  const timesChips = useMemo(() => timesOpcoesReceberChamado(kanbanTimes), [kanbanTimes]);
  const responsaveisFiltrados = useMemo(
    () => responsaveisFiltradosPorTimesIds(atividades[0]?.timesIds ?? [], timesChips, responsaveisOpcoes),
    [atividades, timesChips, responsaveisOpcoes],
  );

  function adicionarAtividade() {
    setAtividades((prev) => [...prev, { ...ATIVIDADE_FORM_DRAFT_VAZIO }]);
  }

  function removerAtividade(i: number) {
    setAtividades((prev) => prev.filter((_, j) => j !== i));
  }

  function setAtividadeDraft(i: number, action: AtividadeFormDraft | ((prev: AtividadeFormDraft) => AtividadeFormDraft)) {
    setAtividades((prev) =>
      prev.map((a, j) => {
        if (j !== i) return a;
        return typeof action === 'function' ? action(a) : action;
      }),
    );
  }

  function limparRascunho() {
    setTitulo('');
    setCategoria('chamado');
    setTrava(false);
    setAtividades([]);
    setCardVinculo(null);
    setFunilSelecionado(null);
    setGrupoSelecionado(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) {
      setError('Informe o título do chamado.');
      return;
    }
    if (atividades.length === 0 || !atividades[0]!.nome.trim()) {
      setError('Adicione ao menos uma atividade e preencha o nome.');
      if (atividades.length === 0) setAtividades([{ ...ATIVIDADE_FORM_DRAFT_VAZIO }]);
      return;
    }
    if (atividades[0]!.timesIds.length === 0) {
      setError('Selecione ao menos um time na atividade.');
      return;
    }
    if (atividades[0]!.responsaveisIds.length === 0) {
      setError('Selecione ao menos um responsável na atividade.');
      return;
    }
    for (let i = 1; i < atividades.length; i++) {
      if (atividades[i]!.nome.trim() && atividades[i]!.responsaveisIds.length === 0) {
        setError(`Atividade ${i + 1}: selecione ao menos um responsável.`);
        return;
      }
    }

    setLoading(true);
    try {
      const primeiraAtiv = atividades[0]!;
      const pendingAnexos = primeiraAtiv.pendingAnexos ?? [];
      const result = await criarChamadoSireneComAtividade({
        titulo: titulo.trim(),
        descricao: '',
        categoria,
        status: 'pendente',
        trava,
        atividade: {
          nome: primeiraAtiv.nome.trim(),
          descricao_detalhe: primeiraAtiv.descricaoDetalhe.trim() || null,
          times_ids: primeiraAtiv.timesIds,
          responsaveis_ids: primeiraAtiv.responsaveisIds,
          data_fim: primeiraAtiv.data.trim() || null,
          status: primeiraAtiv.status,
          pastel: false,
        },
        ...(cardVinculo?.origem === 'legado'
          ? {
              card_id: null,
              processo_id: cardVinculo.processo_id ?? null,
              processo_kanban_nome: cardVinculo.kanban_nome ?? null,
              processo_titulo: cardVinculo.titulo ?? null,
            }
          : {
              card_id: cardVinculo?.card_id ?? null,
              card_kanban_nome: cardVinculo?.kanban_nome ?? null,
              card_titulo: cardVinculo?.titulo ?? null,
            }),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.interacaoId && pendingAnexos.length > 0) {
        const supabase = createClient();
        const { data: topico } = await supabase
          .from('sirene_topicos')
          .select('id')
          .eq('interacao_id', result.interacaoId)
          .order('ordem', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (topico) {
          await uploadAnexosAtividadePendentes(
            String((topico as { id: number }).id),
            pendingAnexos,
            uploaderNome,
            '/sirene/chamados',
          );
        }
      }

      // Atividades adicionais
      if (result.interacaoId && atividades.length > 1) {
        for (let i = 1; i < atividades.length; i++) {
          const ativ = atividades[i]!;
          if (!ativ.nome.trim()) continue;
          await criarSubInteracao({
            interacao_id: result.interacaoId,
            nome: ativ.nome.trim(),
            descricao_detalhe: ativ.descricaoDetalhe.trim() || null,
            times_ids: ativ.timesIds,
            responsaveis_ids: ativ.responsaveisIds,
            data_fim: ativ.data.trim() || null,
            status: 'nao_iniciado',
            pastel: false,
            basePath: '/sirene/chamados',
            viaSirene: true,
          });
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[ModalNovoChamado] erro ao salvar:', err);
      setError('Erro inesperado ao criar chamado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const temRascunho = titulo.trim() || cardVinculo || atividades.length > 0;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3">
          <h2 className="text-lg font-semibold text-stone-800">Novo Chamado</h2>
          {temRascunho ? (
            <button
              type="button"
              onClick={limparRascunho}
              className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
              title="Limpar formulário"
              aria-label="Limpar formulário"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {/* Vínculo de card — seleção por funil */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Vincular a um card (opcional)</label>
            {cardVinculo ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {cardVinculo.etapa ? (
                    <span className="mr-1 text-xs text-stone-500">[{cardVinculo.etapa}]</span>
                  ) : null}
                  {cardVinculo.titulo} — {cardVinculo.kanban_nome}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => {
                    setCardVinculo(null);
                    setFunilSelecionado(null);
                  }}
                >
                  Remover
                </button>
              </div>
            ) : (
              <>
                {/* Step 0: Selecionar grupo */}
                {!grupoSelecionado ? (
                  <select
                    value=""
                    onChange={(e) => setGrupoSelecionado(e.target.value || null)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecione o Grupo...</option>
                    {GRUPOS_FUNIL.map((g) => (
                      <option key={g.label} value={g.label}>{g.label}</option>
                    ))}
                  </select>
                ) : !funilSelecionado ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setGrupoSelecionado(null); setFunilSelecionado(null); setCardVinculo(null); }}
                        className="text-xs text-stone-500 hover:text-stone-700 hover:underline"
                      >
                        ← {grupoSelecionado}
                      </button>
                    </div>
                    <select
                      value={funilSelecionado ? (funilSelecionado as SireneFunilItem).id : ''}
                      onChange={(e) => {
                        const funil = funisList.find((f) => f.id === e.target.value) ?? null;
                        setFunilSelecionado(funil);
                        setCardVinculo(null);
                      }}
                      disabled={carregandoFunis}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    >
                      <option value="">{carregandoFunis ? 'Carregando fúnis…' : 'Selecione o Funil...'}</option>
                      {funisList
                        .filter((f) => grupoDoFunil(f.nome) === grupoSelecionado)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}{f.origem === 'legado' ? ' (legado)' : ''}
                          </option>
                        ))}
                    </select>
                  </>
                ) : (
                  /* Step 2: lista de cards do funil selecionado */
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => { setFunilSelecionado(null); setCardVinculo(null); }}
                        className="text-xs text-stone-500 hover:text-stone-700 hover:underline"
                      >
                        ← {funilSelecionado.nome}
                      </button>
                    </div>
                    <ul className="mt-1 max-h-48 overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow">
                      {carregandoCards ? (
                        <li className="px-3 py-2 text-sm text-stone-500">Carregando cards…</li>
                      ) : cardOpcoes.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-stone-400">Nenhum card encontrado.</li>
                      ) : (
                        cardOpcoes.map((c) => (
                          <li key={`${c.origem}-${c.card_id ?? c.processo_id}`}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100"
                              onClick={() => setCardVinculo(c)}
                            >
                              {c.etapa ? (
                                <span className="mr-1 text-xs text-stone-500">[{c.etapa}]</span>
                              ) : null}
                              {c.titulo}
                              <span className="block text-xs text-stone-400">{c.kanban_nome}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
            {cardVinculo ? (
              <p className="mt-1 text-xs text-amber-700">
                Com card vinculado, o chamado só poderá ser alterado no card do funil.
              </p>
            ) : null}
          </div>

          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título / assunto *"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as 'chamado' | 'melhoria')}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="chamado">Chamado</option>
            <option value="melhoria">Melhoria</option>
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone-300"
              checked={trava}
              onChange={(e) => setTrava(e.target.checked)}
            />
            Trava — bloqueia o avanço até concluir
          </label>

          {/* Atividades */}
          {atividades.length === 0 ? (
            <button
              type="button"
              onClick={adicionarAtividade}
              className="text-left text-xs font-medium text-stone-700 underline-offset-2 hover:underline"
            >
              + Atividade<span className="text-red-600"> *</span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {atividades.map((ativ, i) => {
                const respFiltrados = responsaveisFiltradosPorTimesIds(ativ.timesIds, kanbanTimes, responsaveisOpcoes);
                return (
                  <div key={i} className="rounded-md border border-stone-200 bg-white/80 p-2" style={{ borderColor: 'var(--moni-border-default)' }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                        Atividade {i + 1}{i === 0 ? ' *' : ''}
                      </p>
                      {i > 0 ? (
                        <button
                          type="button"
                          onClick={() => removerAtividade(i)}
                          className="text-[10px] font-medium text-red-500 hover:text-red-700"
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                    <KanbanAtividadeFormFields
                      draft={ativ}
                      setDraft={(action) => setAtividadeDraft(i, action as AtividadeFormDraft | ((prev: AtividadeFormDraft) => AtividadeFormDraft))}
                      kanbanTimes={timesChips}
                      responsaveisOpcoes={respFiltrados}
                      sessionUserId={sessionUserId}
                      idPrefix={`sirene-nova-${i}`}
                      showPastel={false}
                      maxResponsaveis={1}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={adicionarAtividade}
                className="text-left text-xs font-medium text-stone-700 underline-offset-2 hover:underline"
              >
                + Adicionar atividade
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !titulo.trim()}
              className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Salvando…' : 'Criar chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
