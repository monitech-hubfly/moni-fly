'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { buscarCardsParaNovoChamadoSirene, type SireneVinculoCardBuscaItem } from './actions';
import { criarChamadoSireneComAtividade } from '@/lib/actions/card-actions';
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
import { ChamadoAtividadeCollapsibleSection } from '@/components/kanban-shared/ChamadoAtividadeCollapsibleSection';
import { uploadAnexosAtividadePendentes } from '@/lib/kanban/upload-anexos-atividade';

type Props = { onClose: () => void; onSuccess?: () => void };

export function ModalNovoChamado({ onClose, onSuccess }: Props) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<'chamado' | 'melhoria'>('chamado');
  const [atividade, setAtividade] = useState<AtividadeFormDraft>({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
  const [atividadeAberta, setAtividadeAberta] = useState(false);
  const [kanbanTimes, setKanbanTimes] = useState<{ id: string; nome: string }[]>([]);
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<{ id: string; nome: string }[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [uploaderNome, setUploaderNome] = useState('Usuário');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscaCard, setBuscaCard] = useState('');
  const [cardOpcoes, setCardOpcoes] = useState<SireneVinculoCardBuscaItem[]>([]);
  const [cardVinculo, setCardVinculo] = useState<SireneVinculoCardBuscaItem | null>(null);
  const [abertoBuscaCard, setAbertoBuscaCard] = useState(false);
  const [buscandoCards, setBuscandoCards] = useState(false);

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
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
    })();
  }, []);

  const timesChips = useMemo(() => timesOpcoesReceberChamado(kanbanTimes), [kanbanTimes]);
  const responsaveisFiltrados = useMemo(
    () => responsaveisFiltradosPorTimesIds(atividade.timesIds, kanbanTimes, responsaveisOpcoes),
    [atividade.timesIds, kanbanTimes, responsaveisOpcoes],
  );

  useEffect(() => {
    const q = buscaCard.trim();
    if (q.length < 2) {
      setCardOpcoes([]);
      return;
    }
    const t = window.setTimeout(() => {
      setBuscandoCards(true);
      buscarCardsParaNovoChamadoSirene(q).then((r) => {
        setBuscandoCards(false);
        if (r.ok) setCardOpcoes(r.items);
        else setCardOpcoes([]);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [buscaCard]);

  function limparRascunho() {
    setTitulo('');
    setDescricao('');
    setCategoria('chamado');
    setAtividade({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
    setAtividadeAberta(false);
    setCardVinculo(null);
    setBuscaCard('');
    setError(null);
  }

  function fecharAtividade() {
    setAtividade({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
    setAtividadeAberta(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) {
      setError('Informe o título do chamado.');
      return;
    }
    if (!descricao.trim()) {
      setError('Informe a descrição do chamado.');
      return;
    }
    if (!atividadeAberta || !atividade.nome.trim()) {
      setError('Abra "+ Atividade" e preencha a primeira atividade.');
      setAtividadeAberta(true);
      return;
    }
    if (atividade.timesIds.length === 0) {
      setError('Selecione ao menos um time na atividade.');
      return;
    }
    if (atividade.responsaveisIds.length === 0) {
      setError('Selecione ao menos um responsável na atividade.');
      return;
    }
    setLoading(true);
    const pendingAnexos = atividade.pendingAnexos ?? [];
    const result = await criarChamadoSireneComAtividade({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      categoria,
      status: 'pendente',
      atividade: {
        nome: atividade.nome.trim(),
        descricao_detalhe: atividade.descricaoDetalhe.trim() || null,
        times_ids: atividade.timesIds,
        responsaveis_ids: atividade.responsaveisIds,
        data_fim: atividade.data.trim() || null,
        trava: atividade.trava,
        status: atividade.status,
        pastel: atividade.pastel,
      },
      card_id: cardVinculo?.card_id ?? null,
      card_kanban_nome: cardVinculo?.kanban_nome ?? null,
      card_titulo: cardVinculo?.titulo ?? null,
    });
    if (!result.ok) {
      setLoading(false);
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
    setLoading(false);
    onSuccess?.();
    onClose();
  }

  const temRascunho =
    titulo.trim() ||
    descricao.trim() ||
    cardVinculo ||
    atividadeAberta ||
    atividade.nome.trim() ||
    (atividade.pendingAnexos?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Vincular a um card (opcional)</label>
            {cardVinculo ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {cardVinculo.titulo} — {cardVinculo.kanban_nome}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => {
                    setCardVinculo(null);
                    setBuscaCard('');
                  }}
                >
                  Remover
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={buscaCard}
                  onChange={(e) => {
                    setBuscaCard(e.target.value);
                    setAbertoBuscaCard(true);
                  }}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="Buscar card aberto por título…"
                />
                {abertoBuscaCard && buscaCard.trim().length >= 2 ? (
                  <ul className="mt-1 max-h-40 overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow">
                    {buscandoCards ? (
                      <li className="px-3 py-2 text-sm text-stone-500">Buscando…</li>
                    ) : (
                      cardOpcoes.map((c) => (
                        <li key={`${c.origem}-${c.card_id}`}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100"
                            onClick={() => {
                              setCardVinculo(c);
                              setBuscaCard('');
                              setAbertoBuscaCard(false);
                            }}
                          >
                            {c.titulo}
                            <span className="block text-xs text-stone-500">{c.kanban_nome}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
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
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição *"
            rows={3}
            className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm"
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

          <ChamadoAtividadeCollapsibleSection
            aberto={atividadeAberta}
            onAbrir={() => setAtividadeAberta(true)}
            onFechar={fecharAtividade}
            obrigatorio
          >
            <KanbanAtividadeFormFields
              draft={atividade}
              setDraft={setAtividade}
              kanbanTimes={timesChips}
              responsaveisOpcoes={responsaveisFiltrados}
              sessionUserId={sessionUserId}
              showPastel={false}
              idPrefix="sirene-nova"
              onDelete={fecharAtividade}
              deleteTitle="Limpar atividade"
            />
          </ChamadoAtividadeCollapsibleSection>

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
              disabled={loading || !titulo.trim() || !descricao.trim()}
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
