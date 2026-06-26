'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  cadastrarCondominioEVincularCard,
  salvarPrazosAprovacaoCondominio,
  vincularCondominioAoCard,
  salvarQuadraLoteCard,
} from '@/lib/actions/kanban-card-condominio';
import { snapshotCondominioChecklist } from '@/lib/condominios-checklist';
import {
  condominioRowMatchesBusca,
  fetchCondominiosRows,
  normalizarParaBuscaCondominio,
  type CondominioRow,
} from '@/lib/condominios';
import {
  emptyCondominioFormDraft,
  type CondominioFormDraft,
} from '@/lib/condominios-form';
import { CondominioCamposForm } from './CondominioCamposForm';
import { CondominioPrazosAprovacaoFields } from './CondominioPrazosAprovacaoFields';
import {
  prazosAprovacaoDraftFromRow,
  type CondominioPrazosAprovacaoDraft,
} from '@/lib/kanban/condominio-prazos-aprovacao';

type Props = {
  cardId: string;
  origem: 'nativo' | 'legado';
  basePath: string;
  condominioIdInicial: string | null;
  quadraInicial: string | null;
  loteInicial: string | null;
  nomeCondominioLegado: string | null;
  podeEditar: boolean;
  podeCadastrarNovo: boolean;
  /** Espelho somente leitura (ex.: painel esquerdo na fase Dados dos Condomínios). */
  somenteLeitura?: boolean;
  /** Só vincula condomínio — quadra/lote vêm de outros campos do checklist (fase Lotes disponíveis). */
  apenasVinculo?: boolean;
  /** Callback para sincronizar resposta do checklist da fase. */
  onChecklistValor?: (valor: string) => void;
  onSalvo: () => void;
};

export function KanbanCardModalCondominio({
  cardId,
  origem,
  basePath,
  condominioIdInicial,
  quadraInicial,
  loteInicial,
  nomeCondominioLegado,
  podeEditar,
  podeCadastrarNovo,
  somenteLeitura = false,
  apenasVinculo = false,
  onChecklistValor,
  onSalvo,
}: Props) {
  const [lista, setLista] = useState<CondominioRow[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [busca, setBusca] = useState('');
  const [condominioId, setCondominioId] = useState(condominioIdInicial ?? '');
  const [condominioRow, setCondominioRow] = useState<CondominioRow | null>(null);
  const [quadra, setQuadra] = useState(quadraInicial ?? '');
  const [lote, setLote] = useState(loteInicial ?? '');
  const [modoNovo, setModoNovo] = useState(false);
  const [draftNovo, setDraftNovo] = useState<CondominioFormDraft>(emptyCondominioFormDraft());
  const [prazoDraft, setPrazoDraft] = useState<CondominioPrazosAprovacaoDraft>(
    prazosAprovacaoDraftFromRow(null),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarLista = useCallback(async () => {
    setLoadingLista(true);
    try {
      const supabase = createClient();
      const rows = await fetchCondominiosRows(supabase);
      setLista(rows ?? []);
    } catch {
      setLista([]);
    } finally {
      setLoadingLista(false);
    }
  }, []);

  const resolverCondominio = useCallback(
    async (id: string) => {
      if (!id) {
        setCondominioRow(null);
        return;
      }
      const found = lista.find((r) => r.id === id);
      if (found) {
        setCondominioRow(found);
        return;
      }
      const supabase = createClient();
      const rows = await fetchCondominiosRows(supabase);
      setCondominioRow(rows?.find((r) => r.id === id) ?? null);
    },
    [lista],
  );

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    setCondominioId(condominioIdInicial ?? '');
    setQuadra(quadraInicial ?? '');
    setLote(loteInicial ?? '');
  }, [condominioIdInicial, quadraInicial, loteInicial, cardId]);

  useEffect(() => {
    if (condominioId) {
      void resolverCondominio(condominioId);
      setModoNovo(false);
    } else if (!modoNovo && nomeCondominioLegado?.trim() && lista.length) {
      const alvo = normalizarParaBuscaCondominio(nomeCondominioLegado);
      const match = lista.find((r) => normalizarParaBuscaCondominio(r.nome) === alvo);
      if (match) {
        setCondominioId(match.id);
        setCondominioRow(match);
      } else {
        setCondominioRow(null);
      }
    } else if (!condominioId) {
      setCondominioRow(null);
    }
  }, [condominioId, lista, modoNovo, nomeCondominioLegado, resolverCondominio]);

  useEffect(() => {
    setPrazoDraft(prazosAprovacaoDraftFromRow(condominioRow));
  }, [condominioRow?.id, condominioRow?.prazo_aprovacao_condominio_dias, condominioRow?.prazo_aprovacao_prefeitura_dias]);

  const opcoesFiltradas = useMemo(() => {
    const q = busca.trim();
    if (!q) return [];
    return lista.filter((r) => condominioRowMatchesBusca(r, q)).slice(0, 40);
  }, [lista, busca]);

  const notificarChecklist = useCallback(
    (id: string, q: string, l: string) => {
      if (!onChecklistValor || !id || !q.trim() || !l.trim()) return;
      onChecklistValor(snapshotCondominioChecklist(id, q, l));
    },
    [onChecklistValor],
  );

  useEffect(() => {
    if (!onChecklistValor || !condominioId) return;
    if (apenasVinculo) {
      onChecklistValor(snapshotCondominioChecklist(condominioId, '', ''));
      return;
    }
    notificarChecklist(condominioId, quadra, lote);
  }, [condominioId, quadra, lote, onChecklistValor, notificarChecklist, apenasVinculo]);

  async function handleVincular(id: string) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await vincularCondominioAoCard({
        cardId,
        origem,
        condominioId: id,
        quadra,
        lote,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setCondominioId(id);
      setModoNovo(false);
      notificarChecklist(id, quadra, lote);
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  async function handleCadastrarEVincular() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await cadastrarCondominioEVincularCard({
        cardId,
        origem,
        draft: draftNovo,
        quadra,
        lote,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      if (res.condominioId) setCondominioId(res.condominioId);
      setModoNovo(false);
      await carregarLista();
      notificarChecklist(res.condominioId ?? condominioId, quadra, lote);
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarPrazosAprovacao() {
    if (!condominioId) {
      setErro('Selecione um condomínio cadastrado antes de salvar os prazos.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await salvarPrazosAprovacaoCondominio({
        condominioId,
        draft: prazoDraft,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await carregarLista();
      await resolverCondominio(condominioId);
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarQuadraLote() {
    if (!condominioId) {
      setErro('Selecione um condomínio cadastrado antes de salvar quadra e lote.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await salvarQuadraLoteCard({
        cardId,
        origem,
        quadra,
        lote,
        nomeCondominio: condominioRow?.nome ?? nomeCondominioLegado,
        basePath,
      });
      if (!res.ok) setErro(res.error);
      else {
        notificarChecklist(condominioId, quadra, lote);
        onSalvo();
      }
    } finally {
      setSalvando(false);
    }
  }

  if (loadingLista) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando cadastro de condomínios…
      </div>
    );
  }

  const vinculado = Boolean(condominioId && condominioRow);
  const editavel = podeEditar && !somenteLeitura;

  return (
    <div className="space-y-2">
      {somenteLeitura ? (
        <p className="text-[10px] text-stone-500">
          Espelho dos dados preenchidos no checklist. Edite na área central da fase.
        </p>
      ) : null}
      {!vinculado && nomeCondominioLegado?.trim() ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          Texto legado &quot;{nomeCondominioLegado}&quot; — selecione o condomínio no cadastro ou cadastre um novo.
        </p>
      ) : null}

      {editavel ? (
        <>
          {!modoNovo ? (
            <div className="space-y-2">
              <label className="block">
                <span className="text-[11px] font-medium text-stone-500">Buscar no cadastro *</span>
                <div className="relative mt-0.5">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Nome, cidade, endereço…"
                    className="w-full rounded border border-stone-200 bg-white py-1 pl-7 pr-2 text-xs"
                  />
                </div>
              </label>
              {busca.trim() ? (
              <div className="max-h-32 overflow-y-auto rounded border border-stone-100">
                {opcoesFiltradas.length === 0 ? (
                  <p className="px-2 py-2 text-[10px] text-stone-500">Nenhum condomínio encontrado.</p>
                ) : (
                  <ul>
                    {opcoesFiltradas.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => void handleVincular(r.id)}
                          className={`w-full px-2 py-1.5 text-left text-xs hover:bg-stone-50 ${
                            condominioId === r.id ? 'bg-violet-50 font-semibold text-violet-900' : 'text-stone-800'
                          }`}
                        >
                          {r.nome}
                          {r.cidade ? (
                            <span className="ml-1 text-[10px] font-normal text-stone-500">
                              — {r.cidade}
                              {r.estado ? `/${r.estado}` : ''}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              ) : null}
              {podeCadastrarNovo ? (
                <button
                  type="button"
                  onClick={() => {
                    setModoNovo(true);
                    setDraftNovo(emptyCondominioFormDraft());
                    setErro(null);
                  }}
                  className="text-[11px] font-medium text-moni-primary underline"
                >
                  Condomínio não está na lista? Cadastrar novo
                </button>
              ) : (
                <p className="text-[10px] text-stone-500">
                  Condomínio ausente? Peça ao time administrativo cadastrar em Rede → Condomínios.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded border border-dashed border-stone-200 p-2">
              <p className="text-[11px] font-semibold text-stone-700">Novo condomínio</p>
              <CondominioCamposForm
                draft={draftNovo}
                onChange={(p) => setDraftNovo((d) => ({ ...d, ...p }))}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void handleCadastrarEVincular()}
                  className="rounded bg-moni-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {salvando ? 'Cadastrando…' : 'Cadastrar e vincular'}
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => {
                    setModoNovo(false);
                    setDraftNovo(emptyCondominioFormDraft());
                  }}
                  className="rounded border border-stone-200 px-3 py-1 text-xs text-stone-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!apenasVinculo ? (
            <>
              <div className="grid grid-cols-2 gap-x-2 border-t border-stone-100 pt-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-500">Quadra</span>
                  <input
                    type="text"
                    value={quadra}
                    onChange={(e) => setQuadra(e.target.value)}
                    className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-500">Lote</span>
                  <input
                    type="text"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs"
                  />
                </label>
              </div>
              {vinculado ? (
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void handleSalvarQuadraLote()}
                  className="rounded border border-stone-200 px-3 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Salvar quadra e lote
                </button>
              ) : null}
            </>
          ) : (
            <p className="border-t border-stone-100 pt-2 text-[10px] text-stone-500">
              Quadra e lote são informados nos campos abaixo do checklist. O lote será anexado ao cadastro deste
              condomínio ao salvar.
            </p>
          )}
        </>
      ) : null}

      {vinculado && condominioRow ? (
        <div className="border-t border-stone-100 pt-2 space-y-2">
          <p className="mb-1 text-[11px] font-semibold text-stone-600">Dados do cadastro</p>
          <CondominioCamposForm readOnly row={condominioRow} draft={draftNovo} onChange={() => {}} />
          <div className="border-t border-stone-100 pt-2">
            <p className="mb-2 text-[11px] font-semibold text-stone-600">Prazos de aprovação</p>
            <CondominioPrazosAprovacaoFields
              draft={prazoDraft}
              onChange={(p) => setPrazoDraft((d) => ({ ...d, ...p }))}
              readOnly={!editavel}
              row={condominioRow}
              disabled={salvando}
            />
            {editavel ? (
              <button
                type="button"
                disabled={salvando}
                onClick={() => void handleSalvarPrazosAprovacao()}
                className="mt-2 rounded border border-stone-200 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50 min-h-[44px] sm:min-h-0"
              >
                {salvando ? 'Salvando…' : 'Salvar prazos de aprovação'}
              </button>
            ) : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-2">
            <div>
              <div className="text-[11px] font-medium text-stone-500">Quadra</div>
              <div className="text-xs text-stone-800">{quadra.trim() || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-stone-500">Lote</div>
              <div className="text-xs text-stone-800">{lote.trim() || '—'}</div>
            </div>
          </div>
        </div>
      ) : !editavel && !vinculado ? (
        <p className="text-xs text-stone-500">
          {somenteLeitura ? 'Nenhum condomínio vinculado — preencha no checklist.' : 'Nenhum condomínio vinculado ao card.'}
        </p>
      ) : !vinculado ? (
        <p className="text-[10px] text-stone-500">Selecione um condomínio do cadastro para preencher os dados.</p>
      ) : null}

      {erro ? <p className="text-[10px] text-red-600">{erro}</p> : null}
    </div>
  );
}
