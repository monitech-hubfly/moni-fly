'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  upsertFaseChecklistResposta,
  type ActionResult,
  type FaseChecklistItem,
  type FaseChecklistResposta,
} from '@/lib/actions/card-actions';
import { listarCondominiosCadastro } from '@/lib/actions/kanban-card-condominio';
import {
  formatCidadeEstadoCondominio,
  formatCondominioInteiro,
  formatCondominioMoeda,
  formatEnderecoNumero,
  ordenarCondominiosPorNome,
  type CondominioRow,
} from '@/lib/condominios';
import { KanbanCardModalCondominio } from '@/components/kanban-shared/KanbanCardModalCondominio';
import { PesquisaCondominioProspect } from '@/components/kanban-shared/PesquisaCondominioProspect';
import { LotesCondominioDisponiveis } from '@/components/kanban-shared/LotesCondominioDisponiveis';
import { TabelaCondominiosProspect } from '@/components/kanban-shared/TabelaCondominiosProspect';
import { sincronizarLoteChecklistComCadastro } from '@/lib/actions/kanban-lotes-condominio';
import { CondominioLotesAnexados } from '@/components/kanban-shared/CondominioLotesAnexados';
import { DadosCidadeIbgeChecklist } from '@/components/kanban-shared/DadosCidadeIbgeChecklist';
import { MapaPracaChecklist } from '@/components/kanban-shared/MapaPracaChecklist';
import { MapaCompetidoresChecklist } from '@/components/kanban-shared/MapaCompetidoresChecklist';
import { ChecklistAreaAtuacaoSelect } from '@/components/kanban-shared/ChecklistAreaAtuacaoSelect';
import { DadosCidadePracaTabs } from '@/components/kanban-shared/DadosCidadePracaTabs';
import { isDadosCandidatoFaseSlug, isDadosCidadeFaseSlug, isLotesDisponiveisFaseSlug, isPreBatalhaFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import {
  PRE_BATALHA_CHECKLIST_LABEL_APLICADA,
  PRE_BATALHA_CHECKLIST_LABEL_RANKING,
  PRE_BATALHA_TEXTO_EXPLICATIVO_RANKING,
} from '@/lib/kanban/pre-batalha-checklist';
import { sincronizarChecklistPreBatalhaKanban } from '@/app/step-one/[id]/etapa/actions';
import { PreBatalhaRankingLeaderboard } from '@/components/kanban-shared/PreBatalhaRankingLeaderboard';
import type { RankingPorFaixaMercado } from '@/lib/kanban/pre-batalha-compatibilidade';
import {
  isLabelDadosCandidatoRede,
  valorDadosCandidatoFromRede,
  type RedeDadosCandidatoSource,
} from '@/lib/kanban/dados-candidato-rede';
import { ChecklistDocumentDiffModal } from '@/components/kanban-shared/ChecklistDocumentDiffModal';
import { parseAreaAtuacao, parCidadeEstadoValidoNaArea } from '@/lib/rede-area-atuacao';
import { sincronizarPracaChecklistComProcesso } from '@/lib/actions/kanban-dados-cidade-praca';
import {
  CHECKLIST_ITENS_OCULTOS_MULTI_PRACA,
  CHECKLIST_LABEL_CIDADE,
  CHECKLIST_LABEL_ESTADO,
  chavePracaCidade,
  inferirChaveLegadoPraca,
  mergeArquivoMultiPraca,
  mergeValorMultiPraca,
  ordenarItensChecklistDadosCidade,
  parseChavePracaCidade,
  resolverArquivoMultiPraca,
  resolverValorMultiPraca,
  type PracaCidade,
} from '@/lib/kanban/dados-cidade-praca-multi';

export type CondominioChecklistContext = {
  origem: 'nativo' | 'legado';
  basePath: string;
  condominioId: string | null;
  quadra: string | null;
  lote: string | null;
  nomeCondominioLegado: string | null;
  podeEditar: boolean;
  podeCadastrarNovo: boolean;
  onSalvo: () => void;
};

type Props = {
  faseId: string;
  faseSlug?: string | null;
  cardId: string;
  isFrank: boolean;
  isAdmin: boolean;
  /** Quando true e não há itens de fase, não mostra mensagem vazia (ex.: Checklist Legal no mesmo bloco). */
  ocultarVazio?: boolean;
  condominioContext?: CondominioChecklistContext;
  /** `processo_step_one.id` — necessário para listagem ZAP na fase Mapa de Competidores. */
  processoId?: string | null;
  /** Área de atuação da rede vinculada ao card (`UF - Cidade; …`). */
  areaAtuacao?: string | null;
  /** Dados do franqueado na rede — auto-preenche Nome, E-mail, Telefone e Idade em Dados do Candidato. */
  redeFranqueado?: RedeDadosCandidatoSource | null;
};

type EstadoResposta = {
  valor: string;
  arquivo_path: string | null;
  salvando: boolean;
  erro: string | null;
};

export function FaseChecklistCard({
  faseId,
  faseSlug,
  cardId,
  isFrank,
  isAdmin,
  ocultarVazio = false,
  condominioContext,
  processoId = null,
  areaAtuacao = null,
  redeFranqueado = null,
}: Props) {
  const [itens, setItens] = useState<FaseChecklistItem[] | null>(null);
  const [respostas, setRespostas] = useState<Map<string, EstadoResposta>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [pracaReloadKey, setPracaReloadKey] = useState(0);
  const [abaPracaAtiva, setAbaPracaAtiva] = useState('');
  const [diffModal, setDiffModal] = useState<{ open: boolean; lines: string[] }>({ open: false, lines: [] });
  const redeSyncFeitoRef = useRef('');
  const preBatalhaSyncFeitoRef = useRef('');
  const [preBatalhaGrupos, setPreBatalhaGrupos] = useState<RankingPorFaixaMercado[]>([]);

  const areasAtuacao = parseAreaAtuacao(areaAtuacao);
  const multiPracaAtivo = isDadosCidadeFaseSlug(faseSlug) && areasAtuacao.length >= 1;
  const itemEstadoId = itens?.find((i) => i.label.trim() === CHECKLIST_LABEL_ESTADO)?.id ?? null;
  const itemCidadeId = itens?.find((i) => i.label.trim() === CHECKLIST_LABEL_CIDADE)?.id ?? null;
  const estadoChecklistValor = itemEstadoId ? (respostas.get(itemEstadoId)?.valor ?? '') : '';
  const cidadeChecklistValor = itemCidadeId ? (respostas.get(itemCidadeId)?.valor ?? '') : '';
  const chaveLegadoPraca = inferirChaveLegadoPraca(areasAtuacao, cidadeChecklistValor, estadoChecklistValor);
  const pracaAtiva = parseChavePracaCidade(abaPracaAtiva) ?? areasAtuacao[0] ?? null;

  useEffect(() => {
    if (!multiPracaAtivo || areasAtuacao.length === 0) return;
    const chaves = areasAtuacao.map(chavePracaCidade);
    if (abaPracaAtiva && chaves.includes(abaPracaAtiva)) return;
    const inicial = chaveLegadoPraca && chaves.includes(chaveLegadoPraca) ? chaveLegadoPraca : chaves[0];
    setAbaPracaAtiva(inicial);
  }, [multiPracaAtivo, areasAtuacao, abaPracaAtiva, chaveLegadoPraca]);

  useEffect(() => {
    redeSyncFeitoRef.current = '';
    preBatalhaSyncFeitoRef.current = '';
  }, [cardId, faseId]);

  useEffect(() => {
    if (!faseId || !cardId) {
      setCarregando(false);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const supabase = createClient();
        const checklistItemCols =
          'id, fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder';
        const checklistRespCols = 'id, item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em';

        const [{ data: itensData, error: itensError }, { data: respostasData, error: respostasError }] =
          await Promise.all([
            supabase
              .from('kanban_fase_checklist_itens')
              .select(checklistItemCols)
              .eq('fase_id', faseId)
              .order('ordem', { ascending: true }),
            supabase
              .from('kanban_fase_checklist_respostas')
              .select(checklistRespCols)
              .eq('card_id', cardId),
          ]);

        if (cancelado) return;

        const itemRows = (itensData ?? []) as FaseChecklistItem[];
        const itensOrdenados = isDadosCidadeFaseSlug(faseSlug)
          ? ordenarItensChecklistDadosCidade(itemRows)
          : itemRows;
        const respRows = (respostasData ?? []) as FaseChecklistResposta[];

        if (itensError || respostasError) {
          setItens([]);
          setRespostas(new Map());
          setCarregando(false);
          return;
        }

        setItens(itensOrdenados);
        const map = new Map<string, EstadoResposta>();
        const respPorItem = new Map<string, FaseChecklistResposta>();
        for (const r of respRows) respPorItem.set(r.item_id, r);
        for (const it of itensOrdenados) {
          const resp = respPorItem.get(it.id);
          map.set(it.id, {
            valor: resp?.valor ?? '',
            arquivo_path: resp?.arquivo_path ?? null,
            salvando: false,
            erro: null,
          });
        }
        setRespostas(map);
        setCarregando(false);
      } catch {
        if (!cancelado) {
          setItens([]);
          setRespostas(new Map());
          setCarregando(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [faseId, cardId, faseSlug]);

  useEffect(() => {
    if (carregando || !itens?.length) return;
    if (!isDadosCandidatoFaseSlug(faseSlug) || !redeFranqueado) return;

    const syncKey = `${cardId}:${faseId}`;
    if (redeSyncFeitoRef.current === syncKey) return;

    const pendencias: { itemId: string; valor: string }[] = [];
    for (const item of itens) {
      if (!isLabelDadosCandidatoRede(item.label)) continue;
      const fromRede = valorDadosCandidatoFromRede(item.label, redeFranqueado);
      if (!fromRede) continue;
      const atual = respostas.get(item.id)?.valor?.trim() ?? '';
      if (!atual) pendencias.push({ itemId: item.id, valor: fromRede });
    }

    redeSyncFeitoRef.current = syncKey;
    if (pendencias.length === 0) return;

    void (async () => {
      for (const p of pendencias) {
        setResposta(p.itemId, { valor: p.valor });
        await salvar(p.itemId, p.valor);
      }
    })();
  }, [carregando, faseSlug, cardId, faseId, itens, redeFranqueado, respostas]);

  /** Pré Batalha: calcula ranking e preenche checklist ao abrir o modal (idempotente). */
  useEffect(() => {
    if (carregando || !itens?.length) return;
    if (!isPreBatalhaFaseSlug(faseSlug) || !processoId?.trim()) return;

    const syncKey = `${cardId}:${faseId}:${processoId.trim()}`;
    if (preBatalhaSyncFeitoRef.current === syncKey) return;

    const itemAplicada = itens.find(
      (i) => i.label.trim() === PRE_BATALHA_CHECKLIST_LABEL_APLICADA,
    );
    const itemRanking = itens.find((i) => i.label.trim() === PRE_BATALHA_CHECKLIST_LABEL_RANKING);

    preBatalhaSyncFeitoRef.current = syncKey;

    void (async () => {
      const res = await sincronizarChecklistPreBatalhaKanban({
        cardId,
        processoId: processoId.trim(),
        faseId,
      });
      if (!res.ok) {
        console.warn('[pre-batalha] sync kanban:', res.error);
        preBatalhaSyncFeitoRef.current = '';
        return;
      }
      if (res.grupos.length > 0) {
        setPreBatalhaGrupos(res.grupos);
      }
      if (res.rankingCount === 0) return;

      const itemIds = [itemAplicada?.id, itemRanking?.id].filter(Boolean) as string[];
      if (itemIds.length === 0) return;

      try {
        const supabase = createClient();
        const { data: rows } = await supabase
          .from('kanban_fase_checklist_respostas')
          .select('item_id, valor, arquivo_path')
          .eq('card_id', cardId)
          .in('item_id', itemIds);
        for (const r of rows ?? []) {
          const row = r as { item_id: string; valor: string | null; arquivo_path: string | null };
          setResposta(row.item_id, {
            valor: row.valor ?? '',
            arquivo_path: row.arquivo_path ?? null,
          });
        }
      } catch {
        /* UI atualiza na próxima abertura do modal */
      }
    })();
  }, [carregando, faseSlug, cardId, faseId, processoId, itens, respostas]);

  function setResposta(itemId: string, patch: Partial<EstadoResposta>) {
    setRespostas((prev) => {
      const atual = prev.get(itemId) ?? { valor: '', arquivo_path: null, salvando: false, erro: null };
      return new Map(prev).set(itemId, { ...atual, ...patch });
    });
  }

  async function syncPracaSeValido(cidade: string, uf: string) {
    const pid = processoId?.trim();
    const estado = uf.trim().toUpperCase().slice(0, 2);
    if (!pid || !parCidadeEstadoValidoNaArea(areasAtuacao, cidade, estado)) return;
    const sync = await sincronizarPracaChecklistComProcesso({ processoId: pid, cidade, estado });
    if (sync.ok) setPracaReloadKey((k) => k + 1);
  }

  async function tentarSyncPracaComProcesso(itemIdSalvo: string, valorSalvo?: string) {
    if (!itemCidadeId || !itemEstadoId) return;
    const cidade =
      itemIdSalvo === itemCidadeId
        ? String(valorSalvo ?? '').trim()
        : String(respostas.get(itemCidadeId)?.valor ?? '').trim();
    const estadoRaw =
      itemIdSalvo === itemEstadoId
        ? String(valorSalvo ?? '').trim()
        : String(respostas.get(itemEstadoId)?.valor ?? '').trim();
    await syncPracaSeValido(cidade, estadoRaw);
  }

  async function salvarCidadeComEstado(cidade: string, uf: string) {
    if (!itemCidadeId || !itemEstadoId) return;
    setResposta(itemCidadeId, { valor: cidade });
    setResposta(itemEstadoId, { valor: uf });
    const r1 = await salvar(itemCidadeId, cidade);
    if (!r1.ok) return;
    const r2 = await salvar(itemEstadoId, uf);
    if (!r2.ok) return;
    await syncPracaSeValido(cidade, uf);
  }

  async function salvarEstadoComValidacao(uf: string) {
    if (!itemEstadoId || !itemCidadeId) return;
    setResposta(itemEstadoId, { valor: uf });
    await salvar(itemEstadoId, uf);
    const cidadeAtual = String(respostas.get(itemCidadeId)?.valor ?? '').trim();
    if (cidadeAtual && !parCidadeEstadoValidoNaArea(areasAtuacao, cidadeAtual, uf)) {
      setResposta(itemCidadeId, { valor: '' });
      await salvar(itemCidadeId, '');
    }
  }

  function getEstadoRespostaScoped(itemId: string, chave: string): EstadoResposta {
    const raw = respostas.get(itemId) ?? { valor: '', arquivo_path: null, salvando: false, erro: null };
    if (!multiPracaAtivo) return raw;
    return {
      ...raw,
      valor: resolverValorMultiPraca(raw.valor, chave, chaveLegadoPraca),
      arquivo_path: resolverArquivoMultiPraca(raw.arquivo_path, chave, chaveLegadoPraca),
    };
  }

  function getEstadoRespostaItem(item: FaseChecklistItem, chave?: string): EstadoResposta {
    const chaveUse = chave ?? abaPracaAtiva;
    const base =
      multiPracaAtivo && chaveUse
        ? getEstadoRespostaScoped(item.id, chaveUse)
        : (respostas.get(item.id) ?? { valor: '', arquivo_path: null, salvando: false, erro: null });

    if (
      isDadosCandidatoFaseSlug(faseSlug) &&
      redeFranqueado &&
      isLabelDadosCandidatoRede(item.label) &&
      !base.valor.trim()
    ) {
      const fromRede = valorDadosCandidatoFromRede(item.label, redeFranqueado);
      if (fromRede) return { ...base, valor: fromRede };
    }
    return base;
  }

  async function salvar(
    itemId: string,
    valor?: string,
    arquivo_path?: string | null,
    chavePraca?: string,
  ): Promise<ActionResult> {
    const chave = chavePraca ?? abaPracaAtiva;
    const rawAtual = respostas.get(itemId);
    let valorFinal = valor ?? rawAtual?.valor ?? null;
    let arquivoFinal =
      arquivo_path !== undefined ? arquivo_path : (rawAtual?.arquivo_path ?? null);

    if (multiPracaAtivo && chave) {
      if (valor !== undefined) {
        valorFinal = mergeValorMultiPraca(rawAtual?.valor, chave, valor, chaveLegadoPraca);
      } else if (valorFinal !== null && valorFinal !== undefined) {
        valorFinal = mergeValorMultiPraca(
          rawAtual?.valor,
          chave,
          resolverValorMultiPraca(rawAtual?.valor, chave, chaveLegadoPraca),
          chaveLegadoPraca,
        );
      }
      if (arquivo_path !== undefined) {
        arquivoFinal = mergeArquivoMultiPraca(rawAtual?.arquivo_path, chave, arquivo_path, chaveLegadoPraca);
      }
    }

    setResposta(itemId, { salvando: true, erro: null });
    const res = await upsertFaseChecklistResposta({
      item_id: itemId,
      card_id: cardId,
      valor: valorFinal,
      arquivo_path: arquivoFinal,
    });
    let erroFinal = res.ok ? null : res.error;
    if (res.ok && isLotesDisponiveisFaseSlug(faseSlug) && condominioContext) {
      const itensLotes = itens?.filter((i) => i.tipo !== 'lotes_condominio') ?? [];
      const usaChecklistLegado = itensLotes.some(
        (i) => i.tipo === 'condominio' || i.label.trim() === 'Quadra' || i.label.trim() === 'Lote',
      );
      if (usaChecklistLegado) {
        const sync = await sincronizarLoteChecklistComCadastro({
          cardId,
          origem: condominioContext.origem,
          basePath: condominioContext.basePath,
        });
        if (!sync.ok) erroFinal = sync.error;
        else condominioContext.onSalvo();
      }
    }
    if (res.ok && !erroFinal && isDadosCidadeFaseSlug(faseSlug) && !multiPracaAtivo) {
      const label = itens?.find((i) => i.id === itemId)?.label.trim();
      if (label === CHECKLIST_LABEL_CIDADE || label === CHECKLIST_LABEL_ESTADO) {
        await tentarSyncPracaComProcesso(itemId, valor);
      }
    }
    setResposta(itemId, {
      salvando: false,
      erro: erroFinal,
      valor: String(valorFinal ?? ''),
      arquivo_path: arquivoFinal,
    });
    return res.ok && !erroFinal ? { ok: true } : { ok: false, error: erroFinal ?? (!res.ok ? res.error : 'Erro ao salvar') };
  }

  async function compararAposAssinado(itemId: string) {
    try {
      const r = await fetch('/api/candidato/comparar-documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item_id: itemId, card_id: cardId }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        diferencas?: string[];
        temDiferencasRelevantes?: boolean;
        error?: string;
      };
      if (!r.ok || !j.ok) return;
      if (j.temDiferencasRelevantes && Array.isArray(j.diferencas) && j.diferencas.length > 0) {
        setDiffModal({ open: true, lines: j.diferencas });
      }
    } catch {
      /* comparação é auxiliar; falhas silenciosas */
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 size={14} className="animate-spin" />
        Carregando itens...
      </div>
    );
  }

  if (!itens || itens.length === 0) {
    if (ocultarVazio) return null;
    return (
      <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
        Nenhum item configurado para esta fase.
      </p>
    );
  }

  const itensFiltrados = isFrank ? itens.filter((it) => it.visivel_candidato) : itens;
  const itensDadosCidade = multiPracaAtivo
    ? itensFiltrados.filter((it) => !CHECKLIST_ITENS_OCULTOS_MULTI_PRACA.has(it.label.trim()))
    : itensFiltrados;

  function resolverPracaSessao(chavePraca?: string): PracaCidade | null {
    if (multiPracaAtivo) {
      const chave = chavePraca ?? abaPracaAtiva;
      return parseChavePracaCidade(chave) ?? pracaAtiva;
    }
    const uf = estadoChecklistValor.trim().toUpperCase();
    const cidade = cidadeChecklistValor.trim();
    if (cidade && uf.length === 2) return { uf, cidade };
    return null;
  }

  function renderItemField(item: FaseChecklistItem, chavePraca?: string) {
    const chave = chavePraca ?? abaPracaAtiva;
    const praca = resolverPracaSessao(chave);
    const itemKey = multiPracaAtivo ? `${item.id}-${chave}` : item.id;
    return (
      <div key={itemKey} className="kanban-fase-checklist-item">
        <ItemField
          item={item}
        faseSlug={faseSlug}
        estado={getEstadoRespostaItem(item, chave)}
        cardId={cardId}
        isAdmin={isAdmin}
        processoId={processoId}
        pracaReloadKey={pracaReloadKey}
        pracaCidade={praca}
        areasAtuacao={areasAtuacao}
        estadoChecklistValor={estadoChecklistValor}
        preBatalhaGrupos={preBatalhaGrupos}
        onCidadeComUfSelected={(cidade, uf) => void salvarCidadeComEstado(cidade, uf)}
        condominioContext={condominioContext}
        onChange={(valor) => {
          if (multiPracaAtivo && chave) {
            const raw = respostas.get(item.id)?.valor;
            setResposta(item.id, {
              valor: mergeValorMultiPraca(raw, chave, valor, chaveLegadoPraca),
            });
            return;
          }
          setResposta(item.id, { valor });
        }}
        onBlur={(valor) => {
          if (
            !multiPracaAtivo &&
            isDadosCidadeFaseSlug(faseSlug) &&
            item.label.trim() === CHECKLIST_LABEL_ESTADO
          ) {
            void salvarEstadoComValidacao(valor);
            return;
          }
          void salvar(item.id, valor, undefined, chave);
        }}
        onArquivo={async (path) => {
          if (multiPracaAtivo && chave) {
            const raw = respostas.get(item.id)?.arquivo_path;
            const merged = mergeArquivoMultiPraca(raw, chave, path, chaveLegadoPraca);
            setResposta(item.id, { arquivo_path: merged });
            const res = await salvar(item.id, undefined, path, chave);
            if (res.ok && item.tipo === 'anexo_template') await compararAposAssinado(item.id);
            return;
          }
          setResposta(item.id, { arquivo_path: path });
          const res = await salvar(item.id, undefined, path);
          if (res.ok && item.tipo === 'anexo_template') await compararAposAssinado(item.id);
        }}
        onChecklistValor={async (valor) => {
          if (multiPracaAtivo && chave) {
            setResposta(item.id, {
              valor: mergeValorMultiPraca(respostas.get(item.id)?.valor, chave, valor, chaveLegadoPraca),
            });
          } else {
            setResposta(item.id, { valor });
          }
          await salvar(item.id, valor, undefined, chave);
        }}
        />
      </div>
    );
  }

  return (
    <div className="kanban-fase-checklist-list">
      <ChecklistDocumentDiffModal
        open={diffModal.open}
        diferencas={diffModal.lines}
        onClose={() => setDiffModal({ open: false, lines: [] })}
      />
      {multiPracaAtivo && pracaAtiva ? (
        <>
          {areasAtuacao.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Cadastre a área de atuação do franqueado em Rede de Franqueados e vincule este card ao franqueado.
            </p>
          ) : (
            <DadosCidadePracaTabs
              pracas={areasAtuacao}
              abaAtiva={abaPracaAtiva}
              onAbaChange={setAbaPracaAtiva}
            >
              {itensDadosCidade.map((item) => renderItemField(item, abaPracaAtiva))}
            </DadosCidadePracaTabs>
          )}
        </>
      ) : (
        itensFiltrados.map((item) => renderItemField(item))
      )}
      {isLotesDisponiveisFaseSlug(faseSlug) &&
      condominioContext &&
      itensFiltrados.every((i) => i.tipo !== 'lotes_condominio') ? (
        <CondominioLotesAnexados
          condominioId={condominioContext.condominioId}
          cardIdAtual={cardId}
        />
      ) : null}
    </div>
  );
}

type ItemFieldProps = {
  item: FaseChecklistItem;
  faseSlug?: string | null;
  estado: EstadoResposta;
  cardId: string;
  isAdmin: boolean;
  processoId?: string | null;
  pracaReloadKey?: number;
  pracaCidade?: PracaCidade | null;
  areasAtuacao: { uf: string; cidade: string }[];
  estadoChecklistValor: string;
  preBatalhaGrupos?: RankingPorFaixaMercado[];
  onCidadeComUfSelected: (cidade: string, uf: string) => void;
  condominioContext?: CondominioChecklistContext;
  onChange: (valor: string) => void;
  onBlur: (valor: string) => void;
  onArquivo: (path: string) => void | Promise<void>;
  onChecklistValor: (valor: string) => void | Promise<void>;
};

function ItemField({
  item,
  faseSlug,
  estado,
  cardId,
  isAdmin,
  processoId,
  pracaReloadKey = 0,
  pracaCidade = null,
  areasAtuacao,
  estadoChecklistValor,
  preBatalhaGrupos = [],
  onCidadeComUfSelected,
  condominioContext,
  onChange,
  onBlur,
  onArquivo,
  onChecklistValor,
}: ItemFieldProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);
  const [erroModelo, setErroModelo] = useState<string | null>(null);

  const labelEl = (
    <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
      {item.label}
      {item.obrigatorio && <span className="ml-1 text-red-500">*</span>}
      {estado.salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
    </span>
  );

  const inputClass =
    'w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1' +
    ' bg-white border-[var(--moni-border-default)] text-[var(--moni-text-primary)]' +
    ' focus:ring-[var(--moni-primary-500)] focus:border-[var(--moni-primary-500)]';

  const erroEl =
    estado.erro || erroModelo ? (
      <p className="mt-1 text-xs text-red-500">{erroModelo ?? estado.erro}</p>
    ) : null;

  async function handleUpload(file: File) {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `respostas/${cardId}/${item.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documentos-templates').upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return;
    await onArquivo(path);
  }

  if (item.tipo === 'checkbox') {
    return (
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--moni-text-primary)' }}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded"
            checked={estado.valor === 'true'}
            onChange={(e) => {
              const v = e.target.checked ? 'true' : 'false';
              onChange(v);
              onBlur(v);
            }}
          />
          {item.label}
          {item.obrigatorio && <span className="text-red-500">*</span>}
          {estado.salvando && <Loader2 size={10} className="animate-spin" />}
        </label>
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'texto_longo') {
    const isRankingPreBatalha =
      isPreBatalhaFaseSlug(faseSlug) &&
      item.label.trim() === PRE_BATALHA_CHECKLIST_LABEL_RANKING;
    return (
      <div>
        {labelEl}
        {isRankingPreBatalha ? (
          <p
            className="mb-2 whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950"
            role="note"
          >
            {PRE_BATALHA_TEXTO_EXPLICATIVO_RANKING}
          </p>
        ) : null}
        {isRankingPreBatalha && preBatalhaGrupos.length > 0 ? (
          <div className="mb-4">
            <PreBatalhaRankingLeaderboard grupos={preBatalhaGrupos} />
          </div>
        ) : null}
        <textarea
          rows={isRankingPreBatalha ? Math.max(6, Math.min(estado.valor.split('\n').length + 1, 16)) : 3}
          className={inputClass + ' resize-y'}
          placeholder={
            isRankingPreBatalha
              ? 'Preenchido automaticamente com todos os modelos compatíveis…'
              : (item.placeholder ?? '')
          }
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {isRankingPreBatalha ? (
          <p className="mt-1 text-[11px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
            Lista gerada automaticamente; pode ser atualizada ao reabrir o card nesta fase.
          </p>
        ) : null}
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'data') {
    return (
      <div>
        {labelEl}
        <input
          type="date"
          className={inputClass}
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'hora') {
    return (
      <div>
        {labelEl}
        <input
          type="time"
          className={inputClass}
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'anexo') {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputFileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"
            style={{
              borderColor: 'var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
              background: 'var(--moni-surface-100)',
            }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Enviando...' : 'Enviar arquivo'}
          </button>
          {estado.arquivo_path && (
            <span className="truncate text-xs" style={{ color: 'var(--moni-primary-600)', maxWidth: 180 }}>
              {estado.arquivo_path.split('/').pop()}
            </span>
          )}
        </div>
        <input
          ref={inputFileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'anexo_template') {
    const temModelo = Boolean(item.template_storage_path?.trim());

    async function baixarModelo() {
      if (!temModelo) return;
      setErroModelo(null);
      setBaixandoModelo(true);
      try {
        const r = await fetch(`/api/candidato/download-template?item_id=${encodeURIComponent(item.id)}`);
        const j = (await r.json()) as { url?: string; error?: string };
        if (!r.ok || !j.url) {
          setErroModelo(j.error ?? 'Não foi possível baixar o modelo.');
          return;
        }
        window.open(j.url, '_blank', 'noopener,noreferrer');
      } catch {
        setErroModelo('Erro ao baixar o modelo.');
      } finally {
        setBaixandoModelo(false);
      }
    }

    return (
      <div>
        {labelEl}
        <div className="flex flex-wrap items-center gap-2">
          {temModelo && (
            <button
              type="button"
              disabled={baixandoModelo}
              onClick={() => void baixarModelo()}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
              style={{
                borderColor: 'var(--moni-border-default)',
                color: 'var(--moni-text-secondary)',
                background: 'var(--moni-surface-100)',
              }}
            >
              {baixandoModelo ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Baixar template
            </button>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputFileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"
            style={{
              borderColor: 'var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
              background: 'var(--moni-surface-100)',
            }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Enviando...' : 'Enviar assinado'}
          </button>
          {estado.arquivo_path && (
            <span className="truncate text-xs" style={{ color: 'var(--moni-primary-600)', maxWidth: 180 }}>
              {estado.arquivo_path.split('/').pop()}
            </span>
          )}
        </div>
        <input
          ref={inputFileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'condominio') {
    if (!condominioContext) {
      return (
        <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
          Item de condomínio indisponível neste contexto.
        </p>
      );
    }
    return (
      <div>
        <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {item.label}
          {item.obrigatorio && <span className="ml-1 text-red-500">*</span>}
          {estado.salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
        </span>
        {item.placeholder ? (
          <p className="mb-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            {item.placeholder}
          </p>
        ) : null}
        <KanbanCardModalCondominio
          key={`${cardId}-checklist-cond-${condominioContext.condominioId ?? 'none'}`}
          cardId={cardId}
          origem={condominioContext.origem}
          basePath={condominioContext.basePath}
          condominioIdInicial={condominioContext.condominioId}
          quadraInicial={condominioContext.quadra}
          loteInicial={condominioContext.lote}
          nomeCondominioLegado={condominioContext.nomeCondominioLegado}
          podeEditar={condominioContext.podeEditar}
          podeCadastrarNovo={condominioContext.podeCadastrarNovo}
          apenasVinculo={isLotesDisponiveisFaseSlug(faseSlug)}
          onChecklistValor={(valor) => void onChecklistValor(valor)}
          onSalvo={condominioContext.onSalvo}
        />
        {erroEl}
      </div>
    );
  }

  if (item.tipo === 'pesquisa_condominio') {
    return (
      <PesquisaCondominioProspect
        cardId={cardId}
        processoId={processoId}
        itemLabel={item.label}
        obrigatorio={item.obrigatorio}
      />
    );
  }

  if (item.tipo === 'lotes_condominio') {
    return (
      <LotesCondominioDisponiveis cardId={cardId} itemLabel={item.label} obrigatorio={item.obrigatorio} />
    );
  }

  if (item.tipo === 'listagem_casas_zap') {
    const pid = processoId?.trim();
    const podeEditar = condominioContext?.podeEditar ?? isAdmin;
    // Mapa de Competidores: só listagem ZAP + faixas (catálogo Moní fica na Pré Batalha).
    return (
      <MapaCompetidoresChecklist
        cardId={cardId}
        processoId={pid ?? ''}
        itemLabel={item.label}
        podeEditar={podeEditar}
      />
    );
  }

  if (item.tipo === 'dados_cidade_ibge') {
    return (
      <DadosCidadeIbgeChecklist
        processoId={processoId?.trim() ?? ''}
        cidade={pracaCidade?.cidade}
        estado={pracaCidade?.uf ?? null}
        itemLabel={item.label}
        obrigatorio={item.obrigatorio}
        reloadKey={pracaReloadKey}
      />
    );
  }

  if (item.tipo === 'mapa_praca') {
    return (
      <MapaPracaChecklist
        processoId={processoId?.trim() ?? ''}
        cidade={pracaCidade?.cidade}
        estado={pracaCidade?.uf ?? null}
        itemLabel={item.label}
        obrigatorio={item.obrigatorio}
        reloadKey={pracaReloadKey}
      />
    );
  }

  if (
    isDadosCidadeFaseSlug(faseSlug) &&
    !pracaCidade &&
    (item.label.trim() === CHECKLIST_LABEL_CIDADE || item.label.trim() === CHECKLIST_LABEL_ESTADO)
  ) {
    const podeEditar = condominioContext?.podeEditar ?? isAdmin;
    return (
      <ChecklistAreaAtuacaoSelect
        modo={item.label.trim() === CHECKLIST_LABEL_ESTADO ? 'estado' : 'cidade'}
        label={item.label}
        obrigatorio={item.obrigatorio}
        areas={areasAtuacao}
        valor={estado.valor}
        estadoReferencia={estadoChecklistValor}
        salvando={estado.salvando}
        erro={estado.erro}
        podeEditar={podeEditar}
        onChange={onChange}
        onBlur={onBlur}
        onSelectCidadeComUf={(cidade, uf) => onCidadeComUfSelected(cidade, uf)}
      />
    );
  }

  if (item.tipo === 'tabela') {
    if (item.label.trim() === 'Tabela de Condomínios') {
      if (!isDadosCidadeFaseSlug(faseSlug)) {
        return (
          <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
            A Tabela de Condomínios é preenchida na fase <strong>Dados da Cidade</strong>.
          </p>
        );
      }
      return (
        <TabelaCondominiosProspect
          item={item}
          estado={estado}
          onChange={onChange}
          onBlur={onBlur}
          pracaCidade={pracaCidade}
        />
      );
    }
    const modoVinculado = Boolean(condominioContext && item.label.trim() === 'Dados do cadastro');
    return (
      <TabelaCondominiosCadastro
        item={item}
        estado={estado}
        onChange={onChange}
        onBlur={onBlur}
        condominioIdFiltro={modoVinculado ? condominioContext?.condominioId ?? null : null}
      />
    );
  }

  if (item.tipo === 'url') {
    return (
      <div>
        {labelEl}
        <input
          type="url"
          className={inputClass}
          placeholder={item.placeholder ?? 'https://…'}
          value={estado.valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
        />
        {erroEl}
      </div>
    );
  }

  // texto_curto | email | telefone | numero
  const inputType =
    item.tipo === 'email' ? 'email' : item.tipo === 'telefone' ? 'tel' : item.tipo === 'numero' ? 'number' : 'text';

  return (
    <div>
      {labelEl}
      <input
        type={inputType}
        className={inputClass}
        placeholder={item.placeholder ?? ''}
        value={estado.valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
      {erroEl}
    </div>
  );
}

// ─── Dados do cadastro (somente leitura — tabela `condominios`) ───────────────

const COLUNAS_TABELA_CONDOMINIOS = [
  { key: 'nome', header: 'Nome' },
  { key: 'endereco', header: 'Endereço + Nº' },
  { key: 'cep', header: 'CEP' },
  { key: 'cidade_estado', header: 'Cidade / Estado' },
  { key: 'ticket_medio_lote', header: 'Ticket Médio Lote' },
  { key: 'ticket_medio_casas', header: 'Ticket Médio Casas' },
  { key: 'ticket_medio_casas_rsm2', header: 'Ticket Médio Casas (R$/m²)' },
  { key: 'estimativa_casas_vendidas_ano', header: 'Est. casas vendidas/ano' },
  { key: 'extrato_como_eram_casas', header: 'Extrato — Como eram' },
  { key: 'extrato_tempo_venda', header: 'Extrato — Tempo venda' },
] as const;

function condominioRowToSnapshot(r: CondominioRow) {
  return {
    id: r.id,
    nome: r.nome,
    endereco: r.endereco,
    numero: r.numero,
    cep: r.cep,
    cidade: r.cidade,
    estado: r.estado,
    ticket_medio_lote: r.ticket_medio_lote,
    ticket_medio_casas: r.ticket_medio_casas,
    ticket_medio_casas_rsm2: r.ticket_medio_casas_rsm2,
    estimativa_casas_vendidas_ano: r.estimativa_casas_vendidas_ano,
    extrato_como_eram_casas: r.extrato_como_eram_casas,
    extrato_tempo_venda: r.extrato_tempo_venda,
  };
}

function valorJsonCondominios(rows: CondominioRow[]): string {
  const comNome = rows.filter((r) => r.nome?.trim());
  return JSON.stringify(comNome.map(condominioRowToSnapshot));
}

function celulaCondominio(row: CondominioRow, key: (typeof COLUNAS_TABELA_CONDOMINIOS)[number]['key']): string {
  switch (key) {
    case 'nome':
      return row.nome?.trim() || '—';
    case 'endereco':
      return formatEnderecoNumero(row.endereco, row.numero);
    case 'cep':
      return row.cep?.trim() || '—';
    case 'cidade_estado':
      return formatCidadeEstadoCondominio(row.cidade, row.estado);
    case 'ticket_medio_lote':
      return formatCondominioMoeda(row.ticket_medio_lote);
    case 'ticket_medio_casas':
      return formatCondominioMoeda(row.ticket_medio_casas);
    case 'ticket_medio_casas_rsm2':
      return formatCondominioMoeda(row.ticket_medio_casas_rsm2);
    case 'estimativa_casas_vendidas_ano':
      return formatCondominioInteiro(row.estimativa_casas_vendidas_ano);
    case 'extrato_como_eram_casas':
      return row.extrato_como_eram_casas?.trim() || '—';
    case 'extrato_tempo_venda':
      return row.extrato_tempo_venda?.trim() || '—';
    default:
      return '—';
  }
}

function TabelaCondominiosCadastro({
  item,
  estado,
  onChange,
  onBlur,
  condominioIdFiltro = null,
}: {
  item: FaseChecklistItem;
  estado: EstadoResposta;
  onChange: (valor: string) => void;
  onBlur: (valor: string) => void;
  condominioIdFiltro?: string | null;
}) {
  const [rows, setRows] = useState<CondominioRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const syncRef = useRef<string | null>(null);
  const modoVinculado = Boolean(condominioIdFiltro?.trim());

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      setCarregando(true);
      setErroCarregar(null);
      try {
        const data = ordenarCondominiosPorNome(await listarCondominiosCadastro());
        if (cancelado) return;
        const filtradas = modoVinculado
          ? data.filter((r) => r.id === condominioIdFiltro)
          : data;
        setRows(filtradas);
        setCarregando(false);

        if (modoVinculado) {
          if (filtradas.length === 0) return;
          const json = valorJsonCondominios(filtradas);
          if (!json || json === '[]') return;
          if (syncRef.current === json) return;
          syncRef.current = json;
          if (estado.valor !== json) {
            onChange(json);
            onBlur(json);
          }
          return;
        }

        const json = valorJsonCondominios(data);
        if (!json || json === '[]') return;
        if (syncRef.current === json) return;
        syncRef.current = json;
        if (estado.valor !== json) {
          onChange(json);
          onBlur(json);
        }
      } catch {
        if (!cancelado) {
          setErroCarregar('Não foi possível carregar os condomínios.');
          setCarregando(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync inicial / condomínio vinculado
  }, [condominioIdFiltro, modoVinculado]);

  const thStyle: CSSProperties = {
    border: '1px solid var(--moni-border-default)',
    padding: '6px 8px',
    textAlign: 'left',
    fontWeight: 600,
    background: 'var(--moni-surface-100)',
    whiteSpace: 'nowrap',
    color: 'var(--moni-text-secondary)',
  };

  const tdStyle: CSSProperties = {
    border: '1px solid var(--moni-border-default)',
    padding: '6px 8px',
    color: 'var(--moni-text-primary)',
    verticalAlign: 'top',
  };

  return (
    <div>
      <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
        {item.label}
        {item.obrigatorio && <span className="ml-1 text-red-500">*</span>}
        {estado.salvando && <Loader2 size={10} className="ml-1 inline animate-spin" />}
      </span>
      <p className="mb-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        {modoVinculado
          ? 'Dados do condomínio vinculado ao card (cadastro em Rede → Condomínios, somente leitura).'
          : 'Dados do cadastro em Rede → Condomínios (somente leitura).'}
      </p>
      {carregando ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          <Loader2 size={12} className="animate-spin" />
          Carregando condomínios...
        </div>
      ) : erroCarregar ? (
        <p className="text-xs text-red-500">{erroCarregar}</p>
      ) : modoVinculado && !condominioIdFiltro ? (
        <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
          Selecione um condomínio no item acima para exibir os dados do cadastro.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
          {modoVinculado ? 'Condomínio não encontrado no cadastro.' : 'Nenhum condomínio cadastrado.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr>
                {COLUNAS_TABELA_CONDOMINIOS.map((col) => (
                  <th key={col.key} style={thStyle}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {COLUNAS_TABELA_CONDOMINIOS.map((col) => {
                    const texto = celulaCondominio(row, col.key);
                    const isExtrato =
                      col.key === 'extrato_como_eram_casas' || col.key === 'extrato_tempo_venda';
                    return (
                      <td
                        key={col.key}
                        style={{
                          ...tdStyle,
                          ...(col.key === 'nome' ? { fontWeight: 500 } : {}),
                          ...(col.key.startsWith('ticket_') || col.key === 'estimativa_casas_vendidas_ano'
                            ? { fontVariantNumeric: 'tabular-nums' }
                            : {}),
                          ...(isExtrato ? { maxWidth: '12rem' } : {}),
                        }}
                        title={isExtrato ? texto : undefined}
                      >
                        {isExtrato ? (
                          <span className="line-clamp-2 text-xs">{texto}</span>
                        ) : (
                          texto
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {estado.erro && <p className="mt-1 text-xs text-red-500">{estado.erro}</p>}
    </div>
  );
}
