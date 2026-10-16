'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FaseChecklistItem, FaseChecklistResposta } from '@/lib/actions/card-actions';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { parseChecklistCompartilhadoValor } from '@/lib/kanban/checklist-compartilhado';
import { NEGOCIO_CHECKLIST_PREFIX } from '@/lib/kanban/negocio-checklist-sync';
import { PREOBRA_CHECKLIST_PREFIX } from '@/lib/kanban/preobra-checklist-sync';
import {
  CHECKLIST_ITENS_OCULTOS_MULTI_PRACA,
  ordenarItensChecklistDadosCidade,
} from '@/lib/kanban/dados-cidade-praca-multi';
import { isDadosCidadeFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import { fetchFaseChecklistItensIn } from '@/lib/kanban/fase-checklist-select';
import {
  isChecklistItemOcultoUi,
  isLoteadoresPrimeiroContatoCampoVisivel,
  isLoteadoresPrimeiroContatoFaseSlug,
} from '@/lib/kanban/loteadores-primeiro-contato';
import {
  isLoteadoresExecucaoMaterialCampoVisivel,
  isLoteadoresExecucaoMaterialFaseSlug,
} from '@/lib/kanban/loteadores-execucao-material';
import {
  isLoteadoresComiteCampoVisivel,
  isLoteadoresComiteFaseSlug,
} from '@/lib/kanban/loteadores-comite';
import {
  isLoteadoresRevisoesCampoVisivel,
  isLoteadoresRevisoesFaseSlug,
} from '@/lib/kanban/loteadores-revisoes';
import {
  isLoteadoresR3AjustesFinaisCampoVisivel,
  isLoteadoresR3AjustesFinaisFaseSlug,
} from '@/lib/kanban/loteadores-r3-ajustes-finais';
import {
  isLoteadoresContratoCampoVisivel,
  isLoteadoresContratoFaseSlug,
} from '@/lib/kanban/loteadores-contrato';
import {
  isLoteadoresNdaCampoVisivel,
  isLoteadoresNdaFaseSlug,
} from '@/lib/kanban/loteadores-nda';
import {
  isLoteadoresOpcaoCampoVisivel,
  isLoteadoresOpcaoFaseSlug,
} from '@/lib/kanban/loteadores-opcao';
import {
  isLoteadoresAguardandoFichaCampoVisivel,
  isLoteadoresAguardandoFichaFaseSlug,
} from '@/lib/kanban/loteadores-aguardando-ficha';
import {
  isLoteadoresNovoProdutoCampoVisivel,
  isLoteadoresNovoProdutoFaseSlug,
} from '@/lib/kanban/loteadores-novo-produto';
import {
  isLoteadoresViabilidadeCampoVisivel,
  isLoteadoresViabilidadeFaseSlug,
} from '@/lib/kanban/loteadores-viabilidade';
import {
  isLoteadoresAcoplamentoCampoVisivel,
  isLoteadoresAcoplamentoFaseSlug,
} from '@/lib/kanban/loteadores-acoplamento';
import {
  isLoteadoresDiligenciaCampoVisivel,
  isLoteadoresDiligenciaFaseSlug,
} from '@/lib/kanban/loteadores-diligencia';
import {
  isLoteadoresContratoParceriaCampoVisivel,
  isLoteadoresContratoParceriaFaseSlug,
} from '@/lib/kanban/loteadores-contrato-parceria';
import {
  isLoteadoresValidacaoCampoVisivel,
  isLoteadoresValidacaoFaseSlug,
} from '@/lib/kanban/loteadores-validacao';
import {
  isLoteadoresAcoplamentoGboxCampoVisivel,
  isLoteadoresAcoplamentoGboxFaseSlug,
} from '@/lib/kanban/loteadores-acoplamento-gbox';
import {
  isLoteadoresRevisoesPosComiteCampoVisivel,
  isLoteadoresRevisoesPosComiteFaseSlug,
} from '@/lib/kanban/loteadores-revisoes-pos-comite';
import {
  isLoteadoresCtoPrecedentesCampoVisivel,
  isLoteadoresCtoPrecedentesFaseSlug,
} from '@/lib/kanban/loteadores-cto-precedentes';
import {
  isLoteadoresPassagemWaysersCampoVisivel,
  isLoteadoresPassagemWaysersFaseSlug,
} from '@/lib/kanban/loteadores-passagem-waysers';
import {
  isLoteadoresR2PlanoTeoricoCampoVisivel,
  isLoteadoresR2PlanoTeoricoFaseSlug,
} from '@/lib/kanban/loteadores-r2-plano-teorico';
import {
  isLoteadoresR1ConceitoCampoVisivel,
  isLoteadoresR1ConceitoFaseSlug,
} from '@/lib/kanban/loteadores-r1-conceito';
import { resumoChecklistItem } from '@/lib/kanban/fase-checklist-resumo-display';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import { carregarMapaCompetidoresChecklist } from '@/lib/actions/kanban-mapa-competidores';
import { carregarProspectsCondominioCard } from '@/lib/actions/kanban-condominio-pesquisa';
import { LISTINGS_CASAS_MUTATED_EVENT } from '@/lib/kanban/listings-casas-events';
import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';

type Props = {
  cardId: string;
  /** Fases ativas deste kanban. A seção não lê checklist de funil vinculado. */
  fases: KanbanFase[];
  faseAtualId: string;
  areaAtuacao?: string | null;
  isFrank?: boolean;
  /** Espelho já carregado deste card (negócio e pré-obra). Não busca card irmão. */
  negocioEspelho?: Record<string, string> | null;
  refreshKey?: string;
};

type LinhaGrupo = ReturnType<typeof resumoChecklistItem> & { itemId: string };

type GrupoFase = {
  faseId: string;
  faseNome: string;
  ordem: number;
  atual: boolean;
  linhas: LinhaGrupo[];
};

function valorPersistidoDoItem(
  item: FaseChecklistItem,
  resp: FaseChecklistResposta | undefined,
  compartilhado: Map<string, unknown>,
  espelho: Record<string, string> | null | undefined,
): { valor: string; arquivo_path: string | null } {
  const chave = String(item.chave_compartilhada ?? '').trim();
  if (chave) {
    const parsed = parseChecklistCompartilhadoValor(item.tipo, compartilhado.get(chave));
    const espelhado =
      (chave.startsWith(NEGOCIO_CHECKLIST_PREFIX) || chave.startsWith(PREOBRA_CHECKLIST_PREFIX)) &&
      espelho &&
      Object.prototype.hasOwnProperty.call(espelho, chave);
    if (espelhado) return { valor: espelho[chave] ?? '', arquivo_path: parsed.arquivo_path };
    return parsed;
  }
  return {
    valor: resp?.valor ?? '',
    arquivo_path: resp?.arquivo_path ?? null,
  };
}

export function FaseChecklistSidebarResumo({
  cardId,
  fases,
  faseAtualId,
  areaAtuacao,
  isFrank = false,
  negocioEspelho = null,
  refreshKey,
}: Props) {
  const [grupos, setGrupos] = useState<GrupoFase[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [listagensMutatedTick, setListagensMutatedTick] = useState(0);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ cardId?: string | null }>).detail;
      if (!detail?.cardId || detail.cardId === cardId) {
        setListagensMutatedTick((t) => t + 1);
      }
    };
    window.addEventListener(LISTINGS_CASAS_MUTATED_EVENT, handler);
    return () => window.removeEventListener(LISTINGS_CASAS_MUTATED_EVENT, handler);
  }, [cardId]);

  const areasAtuacao = useMemo(() => parseAreaAtuacao(areaAtuacao), [areaAtuacao]);

  const fasesDoFunil = useMemo(
    () => [...fases].filter((f) => f.id).sort((a, b) => a.ordem - b.ordem),
    [fases],
  );

  const faseSlugPorId = useMemo(() => new Map(fasesDoFunil.map((f) => [f.id, f.slug ?? ''])), [fasesDoFunil]);

  const espelhoKey = useMemo(() => JSON.stringify(negocioEspelho ?? null), [negocioEspelho]);

  useEffect(() => {
    const faseIds = fasesDoFunil.map((f) => f.id);
    if (!cardId || faseIds.length === 0) {
      setGrupos([]);
      return;
    }

    let cancelado = false;
    void (async () => {
      setCarregando(true);
      try {
        const supabase = createClient();
        const respCols = 'id, item_id, card_id, valor, arquivo_path';
        const chunks: string[][] = [];
        for (let i = 0; i < faseIds.length; i += 8) chunks.push(faseIds.slice(i, i + 8));

        const [itensParts, respostasRes, compartilhadoRes] = await Promise.all([
          Promise.all(chunks.map((ids) => fetchFaseChecklistItensIn(supabase, ids))),
          supabase.from('kanban_fase_checklist_respostas').select(respCols).eq('card_id', cardId).limit(5000),
          supabase.from('kanban_card_checklist_compartilhado').select('chave, valor').eq('card_id', cardId).limit(5000),
        ]);

        const itensError = itensParts.find((p) => p.error)?.error ?? null;
        const itens = itensParts.flatMap((p) => p.data);
        const respostasData = respostasRes.data;
        const compartilhadoPorChave = new Map<string, unknown>();
        for (const row of compartilhadoRes.data ?? []) {
          const chave = String((row as { chave?: string }).chave ?? '').trim();
          if (chave) compartilhadoPorChave.set(chave, (row as { valor?: unknown }).valor);
        }
        const espelho = negocioEspelho;

        if (cancelado) return;
        if (itensError) {
          setGrupos([]);
          return;
        }

        const respostas = (respostasData ?? []) as FaseChecklistResposta[];
        const respPorItem = new Map(respostas.map((r) => [r.item_id, r]));

        let listagemCasasMapa:
          | { casas: Pick<CasaRow, 'condominio'>[]; prospects: Pick<LinhaProspectCondominio, 'condominio'>[] }
          | undefined;

        const precisaListagens = (itens ?? []).some((i) => i.tipo === 'listagem_casas_zap');
        if (precisaListagens) {
          const [mapaRes, prospectsRes] = await Promise.all([
            carregarMapaCompetidoresChecklist(null, cardId),
            carregarProspectsCondominioCard(cardId),
          ]);
          if (cancelado) return;
          if (mapaRes.ok) {
            listagemCasasMapa = {
              casas: mapaRes.casas,
              prospects: prospectsRes.ok ? prospectsRes.linhas : [],
            };
          }
        }

        const itensPorFase = new Map<string, FaseChecklistItem[]>();
        for (const item of itens) {
          if (isFrank && !item.visivel_candidato) continue;
          if (isChecklistItemOcultoUi(item)) continue;
          const slug = faseSlugPorId.get(item.fase_id) ?? '';
          if (isLoteadoresPrimeiroContatoFaseSlug(slug) && !isLoteadoresPrimeiroContatoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresR1ConceitoFaseSlug(slug) && !isLoteadoresR1ConceitoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresNdaFaseSlug(slug) && !isLoteadoresNdaCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresOpcaoFaseSlug(slug) && !isLoteadoresOpcaoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresAguardandoFichaFaseSlug(slug) && !isLoteadoresAguardandoFichaCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresNovoProdutoFaseSlug(slug) && !isLoteadoresNovoProdutoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresViabilidadeFaseSlug(slug) && !isLoteadoresViabilidadeCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresAcoplamentoFaseSlug(slug) && !isLoteadoresAcoplamentoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresExecucaoMaterialFaseSlug(slug) && !isLoteadoresExecucaoMaterialCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresValidacaoFaseSlug(slug) && !isLoteadoresValidacaoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresR2PlanoTeoricoFaseSlug(slug) && !isLoteadoresR2PlanoTeoricoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresAcoplamentoGboxFaseSlug(slug) && !isLoteadoresAcoplamentoGboxCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresRevisoesPosComiteFaseSlug(slug) && !isLoteadoresRevisoesPosComiteCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresCtoPrecedentesFaseSlug(slug) && !isLoteadoresCtoPrecedentesCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresPassagemWaysersFaseSlug(slug) && !isLoteadoresPassagemWaysersCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresComiteFaseSlug(slug) && !isLoteadoresComiteCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresRevisoesFaseSlug(slug) && !isLoteadoresRevisoesCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresR3AjustesFinaisFaseSlug(slug) && !isLoteadoresR3AjustesFinaisCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresContratoFaseSlug(slug) && !isLoteadoresContratoCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresDiligenciaFaseSlug(slug) && !isLoteadoresDiligenciaCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresContratoParceriaFaseSlug(slug) && !isLoteadoresContratoParceriaCampoVisivel(item)) {
            continue;
          }
          const list = itensPorFase.get(item.fase_id) ?? [];
          list.push(item);
          itensPorFase.set(item.fase_id, list);
        }

        const out: GrupoFase[] = [];
        for (const fase of fasesDoFunil) {
          const slug = faseSlugPorId.get(fase.id) ?? '';
          const multiPraca = isDadosCidadeFaseSlug(slug) && areasAtuacao.length > 1;
          let faseItens = itensPorFase.get(fase.id) ?? [];
          if (faseItens.length === 0) continue;

          if (isDadosCidadeFaseSlug(slug)) {
            faseItens = ordenarItensChecklistDadosCidade(faseItens);
            if (multiPraca) {
              faseItens = faseItens.filter((it) => !CHECKLIST_ITENS_OCULTOS_MULTI_PRACA.has(it.label.trim()));
            }
          }

          const linhas = faseItens.map((item) => {
            const persistido = valorPersistidoDoItem(
              item,
              respPorItem.get(item.id),
              compartilhadoPorChave,
              espelho,
            );
            return {
              itemId: item.id,
              ...resumoChecklistItem(item, persistido.valor, persistido.arquivo_path, {
                multiPraca,
                areas: multiPraca ? areasAtuacao : undefined,
                listagemCasasMapa:
                  item.tipo === 'listagem_casas_zap' ? listagemCasasMapa : undefined,
              }),
            };
          });

          out.push({
            faseId: fase.id,
            faseNome: fase.nome,
            ordem: fase.ordem,
            atual: fase.id === faseAtualId,
            linhas,
          });
        }

        setGrupos(out);
      } catch {
        if (!cancelado) setGrupos([]);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [
    cardId,
    fasesDoFunil,
    faseAtualId,
    faseSlugPorId,
    areasAtuacao,
    isFrank,
    negocioEspelho,
    espelhoKey,
    refreshKey,
    listagensMutatedTick,
  ]);

  if (carregando && grupos === null) {
    return <p className="text-xs text-stone-400">Carregando checklist…</p>;
  }

  if (!grupos || grupos.length === 0) {
    return <p className="text-xs text-stone-400">Nenhum campo de checklist neste funil.</p>;
  }

  const totalItens = grupos.reduce((acc, g) => acc + g.linhas.length, 0);
  const preenchidos = grupos.reduce((acc, g) => acc + g.linhas.filter((l) => l.preenchido).length, 0);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-stone-500">
        Checklist deste funil · {preenchidos}/{totalItens} preenchidos
      </p>
      {grupos.map((grupo) => (
        <div key={grupo.faseId} className="rounded border border-stone-100 bg-stone-50/60 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
            {grupo.faseNome}
            {grupo.atual ? ' · fase atual' : ''}
          </p>
          <ul className="space-y-1">
            {grupo.linhas.map((linha) => (
              <li key={linha.itemId} className="text-[10px] leading-snug">
                <span className="font-medium text-stone-700">{linha.label}</span>
                <span className="text-stone-400"> · </span>
                <span className={linha.preenchido ? 'text-stone-600' : 'text-amber-700'}>{linha.valorExibicao}</span>
                {linha.subLinhas?.length ? (
                  <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-stone-200 pl-2">
                    {linha.subLinhas.map((sub) => (
                      <li key={sub.prefixo}>
                        <span className="text-stone-500">{sub.prefixo}: </span>
                        <span className={sub.valor !== '—' ? 'text-stone-600' : 'text-amber-700'}>{sub.valor}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
