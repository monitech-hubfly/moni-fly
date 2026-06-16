'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FaseChecklistItem, FaseChecklistResposta } from '@/lib/actions/card-actions';
import type { KanbanFase } from '@/components/kanban-shared/types';
import type { LinhaCronologiaFase } from '@/lib/kanban/kanban-card-timeline';
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
  fases: KanbanFase[];
  linhasCronologia: LinhaCronologiaFase[];
  faseAtualId: string;
  areaAtuacao?: string | null;
  isFrank?: boolean;
  refreshKey?: string;
};

type GrupoFase = {
  faseId: string;
  faseNome: string;
  ordem: number;
  linhas: ReturnType<typeof resumoChecklistItem>[];
};

export function FaseChecklistSidebarResumo({
  cardId,
  fases,
  linhasCronologia,
  faseAtualId,
  areaAtuacao,
  isFrank = false,
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

  const fasesVisitadas = useMemo(() => {
    const visitadas = linhasCronologia.filter((l) => l.entrouEm);
    if (visitadas.length > 0) return visitadas;
    const atual = fases.find((f) => f.id === faseAtualId);
    if (atual) {
      return [{ faseId: atual.id, faseNome: atual.nome, ordem: atual.ordem, entrouEm: null, saiuEm: null }];
    }
    return [];
  }, [linhasCronologia, fases, faseAtualId]);

  const faseSlugPorId = useMemo(() => new Map(fases.map((f) => [f.id, f.slug ?? ''])), [fases]);

  useEffect(() => {
    const faseIds = fasesVisitadas.map((f) => f.faseId).filter(Boolean);
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

        const [{ data: itens, error: itensError }, { data: respostasData }] = await Promise.all([
          fetchFaseChecklistItensIn(supabase, faseIds),
          supabase.from('kanban_fase_checklist_respostas').select(respCols).eq('card_id', cardId),
        ]);

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
          if (isLoteadoresExecucaoMaterialFaseSlug(slug) && !isLoteadoresExecucaoMaterialCampoVisivel(item)) {
            continue;
          }
          if (isLoteadoresR2PlanoTeoricoFaseSlug(slug) && !isLoteadoresR2PlanoTeoricoCampoVisivel(item)) {
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
          const list = itensPorFase.get(item.fase_id) ?? [];
          list.push(item);
          itensPorFase.set(item.fase_id, list);
        }

        const out: GrupoFase[] = [];
        for (const fase of [...fasesVisitadas].sort((a, b) => a.ordem - b.ordem)) {
          const slug = faseSlugPorId.get(fase.faseId) ?? '';
          const multiPraca = isDadosCidadeFaseSlug(slug) && areasAtuacao.length > 1;
          let faseItens = itensPorFase.get(fase.faseId) ?? [];
          if (faseItens.length === 0) continue;

          if (isDadosCidadeFaseSlug(slug)) {
            faseItens = ordenarItensChecklistDadosCidade(faseItens);
            if (multiPraca) {
              faseItens = faseItens.filter((it) => !CHECKLIST_ITENS_OCULTOS_MULTI_PRACA.has(it.label.trim()));
            }
          }

          const linhas = faseItens.map((item) => {
            const resp = respPorItem.get(item.id);
            return resumoChecklistItem(item, resp?.valor, resp?.arquivo_path, {
              multiPraca,
              areas: multiPraca ? areasAtuacao : undefined,
              listagemCasasMapa:
                item.tipo === 'listagem_casas_zap' ? listagemCasasMapa : undefined,
            });
          });

          out.push({
            faseId: fase.faseId,
            faseNome: fase.faseNome,
            ordem: fase.ordem,
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
  }, [cardId, fasesVisitadas, faseSlugPorId, areasAtuacao, isFrank, refreshKey, listagensMutatedTick]);

  if (carregando && grupos === null) {
    return <p className="text-xs text-stone-400">Carregando checklist…</p>;
  }

  if (!grupos || grupos.length === 0) {
    return <p className="text-xs text-stone-400">Nenhum item estrutural nas fases percorridas.</p>;
  }

  const totalItens = grupos.reduce((acc, g) => acc + g.linhas.length, 0);
  const preenchidos = grupos.reduce((acc, g) => acc + g.linhas.filter((l) => l.preenchido).length, 0);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-stone-500">
        Itens estruturais · {preenchidos}/{totalItens} preenchidos
      </p>
      {grupos.map((grupo) => (
        <div key={grupo.faseId} className="rounded border border-stone-100 bg-stone-50/60 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-600">{grupo.faseNome}</p>
          <ul className="space-y-1">
            {grupo.linhas.map((linha) => (
              <li key={linha.label} className="text-[10px] leading-snug">
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
