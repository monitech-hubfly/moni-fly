"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  addCasaListing,
  saveZapItemsEtapa4,
  updateCasaStatus,
  validarStatusCasasManuais,
  saveCasasEscolhidasEtapa5,
  saveBatalhaCasasEtapa5,
  saveScoreBatalhaPdfUrl,
  type BatalhaCasaRow,
} from "./actions";
import { ScoreBatalhaPDFContent, type ScoreBatalhaRow } from "./ScoreBatalhaPDFContent";
import {
  ATRIBUTOS_LOTE,
  notaAtributosLote,
  notaFinalBatalha,
  type AtributosLoteRespostas,
  CATEGORIAS_REFORMA,
  valorInvestimento,
  notaEsforco,
  notaIncertezaPreco,
  notaPrecoPorPercentual,
  notaPrecoPonderada,
  notaTamanhoM2,
  notaQuartos,
  DESIGN_OPCOES,
  notaIdade,
  notaAmenidades,
  notaProdutoMedia,
  type ChecklistReforma,
} from "./REGRAS_BATALHA";
import { createClient } from "@/lib/supabase/client";

export type CasaRow = {
  id: string;
  cidade: string | null;
  foto_url: string | null;
  status: string | null;
  condominio: string | null;
  localizacao_condominio: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  piscina: boolean | null;
  marcenaria: boolean | null;
  preco: number | null;
  area_casa_m2: number | null;
  preco_m2: number | null;
  estado: string | null;
  compatibilidade_moni: string | null;
  data_publicacao: string | null;
  data_despublicado?: string | null;
  link: string | null;
  manual?: boolean | null;
};

export function Etapa4Casas(props: {
  processoId: string;
  casas: CasaRow[];
  cidadeInicial: string;
  estadoInicial: string;
  ultimaValidacaoCasasManuaisEm: string | null;
  casasEscolhidas: { id: string; catalogo_casa_id: string }[];
  catalogo: { id: string; nome: string | null; quartos: number | null; banheiros: number | null; vagas: number | null; preco_venda_m2: number | null; area_m2?: number | null; preco_venda?: number | null }[];
  batalhasIniciais: { casa_escolhida_id: string; listing_id: string; nota_preco: number | null; nota_produto: number | null; nota_localizacao: number | null; nota_final: number | null; atributos_lote_json?: Record<string, boolean> | null; preco_dados_json?: unknown; produto_dados_json?: unknown }[];
  resultadoPortalTargetId?: string;
  /** Step 1 — apenas listagem (sem modelo/batalha). Step 2 usa false. */
  listagemOnly?: boolean;
  /** URL do PDF Score & Batalha já armazenado na etapa 7 (etapa 6). */
  pdfScoreBatalhaUrl?: string | null;
}) {
  const { processoId, casas, cidadeInicial, estadoInicial, ultimaValidacaoCasasManuaisEm, casasEscolhidas, catalogo, batalhasIniciais, resultadoPortalTargetId, listagemOnly = false, pdfScoreBatalhaUrl = null } = props;
  const casasManuais = useMemo(() => casas.filter((c) => c.manual === true), [casas]);
  const precisaAlertaValidacao = useMemo(() => {
    if (casasManuais.length === 0) return false;
    if (!ultimaValidacaoCasasManuaisEm) return true;
    const ultima = new Date(ultimaValidacaoCasasManuaisEm);
    const hoje = new Date();
    const diffDays = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  }, [casasManuais.length, ultimaValidacaoCasasManuaisEm]);
  const router = useRouter();
  const [cidade, setCidade] = useState(cidadeInicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [condominio, setCondominio] = useState("");
  const [zapError, setZapError] = useState("");
  const [zapLoading, setZapLoading] = useState(false);
  const [zapResult, setZapResult] = useState<{ inserted: number; updated: number; despublicados: number } | null>(null);

  const [cidadeManual, setCidadeManual] = useState(cidadeInicial);
  const [estadoManual, setEstadoManual] = useState(estadoInicial);
  const [statusManual, setStatusManual] = useState<"a_venda" | "despublicado">("a_venda");
  const [condominioManual, setCondominioManual] = useState("");
  const [enderecoManual, setEnderecoManual] = useState("");
  const [quartos, setQuartos] = useState("");
  const [banheiros, setBanheiros] = useState("");
  const [vagas, setVagas] = useState("");
  const [piscina, setPiscina] = useState(false);
  const [marcenaria, setMarcenaria] = useState(false);
  const [preco, setPreco] = useState("");
  const [areaCasa, setAreaCasa] = useState("");
  const [compatibilidadeMoni, setCompatibilidadeMoni] = useState("");
  const [dataLevantamento, setDataLevantamento] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const precoM2Auto = useMemo(() => {
    const p = preco ? parseFloat(String(preco).replace(/\D/g, "").replace(",", ".")) : NaN;
    const a = areaCasa ? parseFloat(areaCasa.replace(",", ".")) : NaN;
    if (Number.isFinite(p) && Number.isFinite(a) && a > 0) return (p / a).toFixed(2);
    return "";
  }, [preco, areaCasa]);

  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [validandoStatus, setValidandoStatus] = useState(false);

  const ROWS_PER_PAGE = 15;
  const totalPages = Math.max(1, Math.ceil(casas.length / ROWS_PER_PAGE));
  const [pageCasas, setPageCasas] = useState(1);
  const casasPaginated = useMemo(() => {
    const start = (pageCasas - 1) * ROWS_PER_PAGE;
    return casas.slice(start, start + ROWS_PER_PAGE);
  }, [casas, pageCasas]);
  useEffect(() => setPageCasas(1), [casas.length]);

  // --- Seção 2: escolha de até 3 casas do catálogo para batalha ---
  const selectedLimit = 3;
  const [selectedCatalogoIds, setSelectedCatalogoIds] = useState<string[]>(() => casasEscolhidas.map((c) => c.catalogo_casa_id));
  const toggleCatalogoSelected = (id: string) => {
    setSelectedCatalogoIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= selectedLimit) return prev;
      return [...prev, id];
    });
  };

  const handleConfirmEscolhidas = async () => {
    const result = await saveCasasEscolhidasEtapa5(processoId, selectedCatalogoIds);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  // --- Seção 3: batalha de casas (cada casa do catálogo vs cada anúncio da listagem) ---
  const escolhidasComDados = useMemo(() => {
    return casasEscolhidas
      .map((ce, idx) => ({
        ...ce,
        ordem: idx + 1,
        catalogoRow: catalogo.find((c) => c.id === ce.catalogo_casa_id) || null,
      }))
      .filter((ce) => ce.catalogoRow !== null);
  }, [casasEscolhidas, catalogo]);

  const batalhaByKey = useMemo(() => {
    const map = new Map<string, { nota_preco: number | null; nota_produto: number | null; nota_localizacao: number | null; nota_final: number | null }>();
    for (const b of batalhasIniciais) {
      const key = `${b.casa_escolhida_id}__${b.listing_id}`;
      map.set(key, {
        nota_preco: b.nota_preco,
        nota_produto: b.nota_produto,
        nota_localizacao: b.nota_localizacao,
        nota_final: b.nota_final,
      });
    }
    return map;
  }, [batalhasIniciais]);

  /** Atributos do Lote: respostas SIM/NÃO por (casa_escolhida_id, listing_id). Nota = soma dos scores. */
  const [atributosLoteByKey, setAtributosLoteByKey] = useState<Record<string, AtributosLoteRespostas>>(() => {
    const obj: Record<string, AtributosLoteRespostas> = {};
    batalhasIniciais.forEach((b) => {
      const key = `${b.casa_escolhida_id}__${b.listing_id}`;
      if (b.atributos_lote_json && typeof b.atributos_lote_json === "object") {
        obj[key] = b.atributos_lote_json as AtributosLoteRespostas;
      }
    });
    return obj;
  });

  const diffToScore = (diff: number): number => {
    if (diff <= -2) return -2;
    if (diff === -1) return -1;
    if (diff === 0) return 0;
    if (diff === 1) return 1;
    return 2;
  };

  const calcularNotaPreco = (precoM2Casa: number | null, precoM2Anuncio: number | null): number => {
    if (precoM2Casa == null || precoM2Casa === 0 || precoM2Anuncio == null) return 0;
    const diffPerc = (precoM2Anuncio - precoM2Casa) / precoM2Casa;
    if (diffPerc <= -0.10) return -2;
    if (diffPerc <= -0.05) return -1;
    if (Math.abs(diffPerc) < 0.05) return 0;
    if (diffPerc < 0.10) return 1;
    return 2;
  };

  const calcularNotaProduto = (
    base: { quartos: number | null; banheiros: number | null; vagas: number | null },
    anuncio: CasaRow
  ): number => {
    const campos: Array<"quartos" | "banheiros" | "vagas"> = ["quartos", "banheiros", "vagas"];
    const notas: number[] = [];
    for (const campo of campos) {
      const baseVal = base[campo];
      const anuncioVal = anuncio[campo];
      if (baseVal == null || anuncioVal == null) continue;
      const diff = Number(baseVal) - Number(anuncioVal);
      notas.push(diffToScore(diff));
    }
    if (notas.length === 0) return 0;
    const media = notas.reduce((sum, n) => sum + n, 0) / notas.length;
    return Math.round(media);
  };

  /** Nota Atributos do Lote para um par (casa_escolhida, listing). Fallback para dado salvo se não houver respostas. */
  const getNotaAtributosLote = (key: string): number => {
    const resp = atributosLoteByKey[key];
    if (resp) return notaAtributosLote(resp);
    return batalhaByKey.get(key)?.nota_localizacao ?? 0;
  };

  const handleChangeAtributoLote = (key: string, atributoId: string, value: boolean) => {
    setAtributosLoteByKey((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [atributoId]: value },
    }));
  };

  const [openAtributosKey, setOpenAtributosKey] = useState<string | null>(null);
  /** Checklist de reforma: um por listagem (listing_id). Alimenta os 4 sub-itens de Preço. */
  const [reformaChecklistByListingId, setReformaChecklistByListingId] = useState<Record<string, ChecklistReforma>>(() => {
    const obj: Record<string, ChecklistReforma> = {};
    batalhasIniciais.forEach((b) => {
      const preco = b.preco_dados_json as { checklist?: ChecklistReforma } | undefined;
      if (preco?.checklist && typeof preco.checklist === "object") {
        obj[b.listing_id] = preco.checklist;
      }
    });
    return obj;
  });
  /** Produto: design e idade por (casa_escolhida_id, listing_id). */
  const [produtoDadosByKey, setProdutoDadosByKey] = useState<Record<string, { designId?: string; idade?: number | null }>>(() => {
    const obj: Record<string, { designId?: string; idade?: number | null }> = {};
    batalhasIniciais.forEach((b) => {
      const prod = b.produto_dados_json as { designId?: string; idade?: number | null } | undefined;
      if (prod && (prod.designId != null || prod.idade != null)) {
        const key = `${b.casa_escolhida_id}__${b.listing_id}`;
        obj[key] = { designId: prod.designId, idade: prod.idade };
      }
    });
    return obj;
  });
  const [openPrecoKey, setOpenPrecoKey] = useState<string | null>(null);
  const [openProdutoKey, setOpenProdutoKey] = useState<string | null>(null);

  /** Valor da nossa casa (modelo) para comparação de preço. */
  const getValorNossaCasa = (ce: (typeof escolhidasComDados)[0]): number | null => {
    const cat = ce.catalogoRow as { preco_venda?: number | null; preco_venda_m2?: number | null; area_m2?: number | null };
    if (cat.preco_venda != null && Number.isFinite(cat.preco_venda)) return cat.preco_venda;
    if (cat.preco_venda_m2 != null && cat.area_m2 != null && cat.area_m2 > 0)
      return cat.preco_venda_m2 * cat.area_m2;
    return null;
  };

  /** Nota Preço: se houver checklist de reforma para a listagem, usa 4 sub-itens; senão usa fórmula antiga (preço/m²). */
  const getNotaPrecoCompleta = (
    ce: (typeof escolhidasComDados)[0],
    listing: CasaRow
  ): number => {
    const checklist = reformaChecklistByListingId[listing.id];
    const cat = ce.catalogoRow as { preco_venda_m2: number | null; area_m2?: number | null; preco_venda?: number | null };
    const valorNossa = getValorNossaCasa(ce);
    const valorListing = listing.preco ?? null;
    if (checklist && valorNossa != null && valorNossa > 0 && valorListing != null) {
      const inv = valorInvestimento(checklist);
      const totalComparativo = valorListing + inv;
      const diffPercDist = (totalComparativo - valorNossa) / valorNossa;
      const diffPercNominal = (valorListing - valorNossa) / valorNossa;
      const D = notaPrecoPorPercentual(diffPercDist);
      const P = notaPrecoPorPercentual(diffPercNominal);
      const E = notaEsforco(checklist);
      const I = notaIncertezaPreco(checklist);
      return notaPrecoPonderada(D, E, I, P);
    }
    return calcularNotaPreco(cat.preco_venda_m2, listing.preco_m2);
  };

  /** Nota Produto: se houver design ou idade preenchidos, usa 5 sub-itens; senão fórmula antiga (quartos/banheiros/vagas). */
  const getNotaProdutoCompleta = (
    ce: (typeof escolhidasComDados)[0],
    listing: CasaRow
  ): number => {
    const key = `${ce.id}__${listing.id}`;
    const dados = produtoDadosByKey[key];
    const cat = ce.catalogoRow as { quartos: number | null; banheiros: number | null; vagas: number | null; area_m2?: number | null };
    if (dados && (dados.designId != null || dados.idade != null)) {
      const T = notaTamanhoM2(listing.area_casa_m2, cat.area_m2 ?? null);
      const A = notaAmenidades(listing);
      const Q = notaQuartos(listing.quartos);
      const designOpt = DESIGN_OPCOES.find((o) => o.id === dados.designId);
      const D = designOpt?.nota ?? 0;
      const I = notaIdade(dados.idade ?? null);
      return notaProdutoMedia(T, A, Q, D, I);
    }
    return calcularNotaProduto(cat, listing);
  };

  /** Cores por modelo (seções de colunas na tabela) */
  const CORES_POR_MODELO = ["bg-sky-50", "bg-emerald-50", "bg-amber-50"] as const;
  const CORES_HEADER_POR_MODELO = ["bg-sky-100", "bg-emerald-100", "bg-amber-100"] as const;

  /** Ranking por modelo: pontuação total = soma das notas finais. Desempate: Atributos do Lote > Preço > Produto. */
  const rankingPorModelo = useMemo(() => {
    if (escolhidasComDados.length === 0) return [];
    const scores: { ce: (typeof escolhidasComDados)[0]; pontuacaoTotal: number; sumAtributos: number; sumPreco: number; sumProduto: number }[] = [];
    for (const ce of escolhidasComDados) {
      let total = 0;
      let sumAtributos = 0;
      let sumPreco = 0;
      let sumProduto = 0;
      for (const c of casas) {
        const key = `${ce.id}__${c.id}`;
        const notaAtrib = getNotaAtributosLote(key);
        const notaPreco = getNotaPrecoCompleta(ce, c);
        const notaProduto = getNotaProdutoCompleta(ce, c);
        const notaFinal = notaFinalBatalha(notaAtrib, notaPreco, notaProduto);
        total += notaFinal;
        sumAtributos += notaAtrib;
        sumPreco += notaPreco;
        sumProduto += notaProduto;
      }
      scores.push({ ce, pontuacaoTotal: Number(total.toFixed(1)), sumAtributos, sumPreco, sumProduto });
    }
    scores.sort((a, b) => {
      if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
      if (b.sumAtributos !== a.sumAtributos) return b.sumAtributos - a.sumAtributos;
      if (b.sumPreco !== a.sumPreco) return b.sumPreco - a.sumPreco;
      return b.sumProduto - a.sumProduto;
    });
    return scores;
  }, [casas, escolhidasComDados, atributosLoteByKey, batalhaByKey, reformaChecklistByListingId, produtoDadosByKey]);

  /** Ranking das casas pela nota final (média entre os modelos). Só entram listagens com Atributos do Lote preenchido. */
  const rankingBatalha = useMemo(() => {
    if (escolhidasComDados.length === 0) return [];
    const scores: { casa: CasaRow; notaMedia: number }[] = [];
    for (const c of casas) {
      let soma = 0;
      let count = 0;
      for (const ce of escolhidasComDados) {
        const key = `${ce.id}__${c.id}`;
        const notaAtrib = getNotaAtributosLote(key);
        const notaPreco = getNotaPrecoCompleta(ce, c);
        const notaProduto = getNotaProdutoCompleta(ce, c);
        const notaFinal = notaFinalBatalha(notaAtrib, notaPreco, notaProduto);
        if (atributosLoteByKey[key] !== undefined || batalhaByKey.get(key)?.nota_localizacao != null || reformaChecklistByListingId[c.id] !== undefined || produtoDadosByKey[key] !== undefined) {
          soma += notaFinal;
          count += 1;
        }
      }
      if (count > 0) scores.push({ casa: c, notaMedia: Number((soma / count).toFixed(1)) });
    }
    scores.sort((a, b) => b.notaMedia - a.notaMedia);
    return scores;
  }, [casas, escolhidasComDados, atributosLoteByKey, batalhaByKey, reformaChecklistByListingId, produtoDadosByKey]);

  /** Ranking final por pontuação total = soma das notas finais de cada modelo (para Seção 5). */
  // Mantido apenas se necessário futuramente; atualmente o ranking final detalhado foi removido.

  const handleSalvarBatalha = async () => {
    const rows: BatalhaCasaRow[] = [];
    for (const ce of escolhidasComDados) {
      for (const anuncio of casas) {
        const key = `${ce.id}__${anuncio.id}`;
        const respostas = atributosLoteByKey[key];
        const temReforma = reformaChecklistByListingId[anuncio.id] !== undefined;
        const temProduto = produtoDadosByKey[key] !== undefined;
        if (respostas === undefined && !temReforma && !temProduto) continue;
        const notaAtrib = respostas != null ? notaAtributosLote(respostas) : (batalhaByKey.get(key)?.nota_localizacao ?? 0);
        const notaPreco = getNotaPrecoCompleta(ce, anuncio);
        const notaProduto = getNotaProdutoCompleta(ce, anuncio);
        const notaFinal = notaFinalBatalha(notaAtrib, notaPreco, notaProduto);
        const checklistReforma = reformaChecklistByListingId[anuncio.id];
        let precoDados: Record<string, unknown> | null = null;
        if (checklistReforma) {
          const inv = valorInvestimento(checklistReforma);
          const valorNossa = getValorNossaCasa(ce);
          const valorListing = anuncio.preco ?? 0;
          const totalComp = valorListing + inv;
          const diffD = valorNossa != null && valorNossa > 0 ? (totalComp - valorNossa) / valorNossa : 0;
          const diffP = valorNossa != null && valorNossa > 0 ? (valorListing - valorNossa) / valorNossa : 0;
          precoDados = {
            checklist: checklistReforma,
            valor_investimento: inv,
            D: notaPrecoPorPercentual(diffD),
            E: notaEsforco(checklistReforma),
            I: notaIncertezaPreco(checklistReforma),
            P: notaPrecoPorPercentual(diffP),
            nota_preco: notaPreco,
          };
        }
        const prodDados = produtoDadosByKey[key];
        let produtoDados: Record<string, unknown> | null = null;
        if (prodDados) {
          const cat = ce.catalogoRow as { area_m2?: number | null };
          const T = notaTamanhoM2(anuncio.area_casa_m2, cat.area_m2 ?? null);
          const A = notaAmenidades(anuncio);
          const Q = notaQuartos(anuncio.quartos);
          const designOpt = DESIGN_OPCOES.find((o) => o.id === prodDados.designId);
          const D = designOpt?.nota ?? 0;
          const I = notaIdade(prodDados.idade ?? null);
          produtoDados = {
            designId: prodDados.designId,
            idade: prodDados.idade,
            nota_tamanho: T,
            nota_quartos: Q,
            nota_amenidades: A,
            nota_design: D,
            nota_idade: I,
            nota_produto: notaProduto,
          };
        }
        rows.push({
          casa_escolhida_id: ce.id,
          listing_id: anuncio.id,
          nota_preco: notaPreco,
          nota_produto: notaProduto,
          nota_localizacao: notaAtrib,
          nota_final: notaFinal,
          ...(respostas != null && { atributos_lote_json: respostas }),
          ...(precoDados && { preco_dados_json: precoDados }),
          ...(produtoDados && { produto_dados_json: produtoDados }),
        });
      }
    }

    if (rows.length === 0) {
      alert("Preencha pelo menos um Atributos do Lote, Preço (checklist reforma) ou Produto (design/idade) antes de salvar a batalha.");
      return;
    }

    const result = await saveBatalhaCasasEtapa5(processoId, rows);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const handleVarrerZap = async () => {
    setZapError("");
    setZapResult(null);
    setZapLoading(true);

    const city = cidade.trim();
    const state = estado.trim();
    if (!city || !state) {
      setZapError("Preencha cidade e estado.");
      setZapLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/apify-zap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cidade: city,
          estado: state,
          condominio: condominio.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setZapError(data.error ?? "Erro ao buscar listagens na ZAP.");
        setZapLoading(false);
        return;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      const saveResult = await saveZapItemsEtapa4(processoId, items, city, state);

      if (saveResult.ok) {
        setZapResult({
          inserted: saveResult.inserted,
          updated: saveResult.updated,
          despublicados: saveResult.despublicados,
        });
        router.refresh();
      } else {
        setZapError(saveResult.error);
      }
    } catch (err) {
      setZapError(err instanceof Error ? err.message : "Falha ao chamar a API.");
    } finally {
      setZapLoading(false);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const precoNum = preco ? parseFloat(String(preco).replace(/\D/g, "").replace(",", ".")) : undefined;
    const areaNum = areaCasa ? parseFloat(areaCasa.replace(",", ".")) : undefined;
    const precoM2Num =
      precoM2 ? parseFloat(String(precoM2).replace(/\D/g, "").replace(",", "."))
      : precoNum != null && areaNum != null && areaNum > 0 ? precoNum / areaNum
      : undefined;
    const result = await addCasaListing(processoId, {
      cidade: cidadeManual.trim() || undefined,
      estado: estadoManual.trim().slice(0, 2).toUpperCase() || undefined,
      status: statusManual,
      condominio: condominioManual || undefined,
      localizacao_condominio: enderecoManual.trim() || undefined,
      quartos: quartos ? parseInt(quartos, 10) : undefined,
      banheiros: banheiros ? parseInt(banheiros, 10) : undefined,
      vagas: vagas ? parseInt(vagas, 10) : undefined,
      piscina,
      marcenaria,
      preco: precoNum,
      area_casa_m2: areaNum,
      preco_m2: precoM2Num,
      compatibilidade_moni: compatibilidadeMoni.trim() || undefined,
      data_coleta: dataLevantamento || undefined,
      link: link || undefined,
    });
    setLoading(false);
    if (result.ok) {
      router.refresh();
      setCidadeManual(cidadeInicial);
      setEstadoManual(estadoInicial);
      setCondominioManual("");
      setEnderecoManual("");
      setQuartos("");
      setBanheiros("");
      setVagas("");
      setPreco("");
      setAreaCasa("");
      setCompatibilidadeMoni("");
      setDataLevantamento("");
      setLink("");
      setPiscina(false);
      setMarcenaria(false);
      setStatusManual("a_venda");
    } else setError(result.error);
  };

  const handleStatusChange = async (casaId: string, status: "a_venda" | "despublicado") => {
    const result = await updateCasaStatus(casaId, status);
    if (result.ok) router.refresh();
  };

  const handleValidarStatusCasasManuais = async () => {
    setValidandoStatus(true);
    const result = await validarStatusCasasManuais(processoId);
    setValidandoStatus(false);
    if (result.ok) router.refresh();
  };

  const labelCasa = (c: CasaRow) => [c.condominio ?? "Anúncio", c.localizacao_condominio].filter(Boolean).join(" · ") || c.id.slice(0, 8);

  const resultCardNode = (
    <div className="w-full sm:w-auto sm:min-w-[320px] sm:max-w-[400px] rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden sm:sticky sm:top-4">
      <div className="p-3">
        {escolhidasComDados.length === 0 ? (
          <p className="text-sm text-stone-500 italic">Selecione até 3 modelos e confirme para habilitar a batalha.</p>
        ) : rankingPorModelo.length === 0 ? (
          <p className="text-sm text-stone-500 italic">Preencha as notas de localização na tabela e salve a batalha para ver o ranking.</p>
        ) : (
          <div className="flex gap-3">
            {/* Quadro 1: melhor modelo */}
            <div className="flex-1 min-w-0 rounded-lg bg-emerald-50 border border-emerald-200 p-3 shrink-0">
              <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide">Melhor modelo</p>
              <p className="font-semibold text-stone-900 mt-0.5 truncate" title={(rankingPorModelo[0].ce.catalogoRow as { nome: string | null }).nome ?? ""}>
                {(rankingPorModelo[0].ce.catalogoRow as { nome: string | null }).nome ?? `Casa ${rankingPorModelo[0].ce.ordem}`}
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{rankingPorModelo[0].pontuacaoTotal}</p>
              <p className="text-xs text-stone-500">pontuação total</p>
            </div>
            {/* Quadro 2: demais modelos (ranking) */}
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-xs font-medium text-stone-500 mb-1">Demais modelos</p>
              <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {rankingPorModelo.slice(1).map((item, i) => {
                  const nome = (item.ce.catalogoRow as { nome: string | null }).nome ?? `Casa ${item.ce.ordem}`;
                  return (
                    <li key={item.ce.id} className="flex justify-between items-baseline text-sm text-stone-600 gap-2">
                      <span className="truncate" title={nome}>
                        {i + 2}. {nome}
                      </span>
                      <span className="font-medium text-stone-800 tabular-nums shrink-0">{item.pontuacaoTotal}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const pdfRef = useRef<HTMLDivElement>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  /** Dados para o PDF Score & Batalha: uma linha por competidor (casa), com notas do primeiro modelo e resultado G/E/P. */
  const pdfRows = useMemo((): ScoreBatalhaRow[] => {
    if (rankingBatalha.length === 0 || escolhidasComDados.length === 0) return [];
    const primeiroModelo = escolhidasComDados[0];
    return rankingBatalha.map(({ casa, notaMedia }) => {
      const key = `${primeiroModelo.id}__${casa.id}`;
      const notaAtrib = getNotaAtributosLote(key);
      const catRow = primeiroModelo.catalogoRow as { preco_venda_m2: number | null; quartos: number | null; banheiros: number | null; vagas: number | null };
      const notaPreco = calcularNotaPreco(catRow.preco_venda_m2, casa.preco_m2);
      const notaProduto = calcularNotaProduto(catRow, casa);
      const notaFinal = notaFinalBatalha(notaAtrib, notaPreco, notaProduto);
      const resultado: "G" | "E" | "P" = notaMedia >= 1 ? "G" : notaMedia <= -1 ? "P" : "E";
      const precoNum = casa.preco != null ? casa.preco / 1e6 : 0;
      const precoLabel = precoNum > 0 ? `R$ ${precoNum.toFixed(2).replace(".", ",")} MM` : "—";
      return {
        casa: { id: casa.id, foto_url: casa.foto_url, preco: casa.preco },
        precoLabel,
        notaPreco,
        notaProduto,
        notaLocalizacao: notaAtrib,
        notaFinal: Number(notaFinal.toFixed(1)),
        resultado,
      };
    });
  }, [rankingBatalha, escolhidasComDados, atributosLoteByKey, batalhaByKey]);

  const handleGerarPdf = () => {
    if (pdfRows.length === 0) return;
    setGerandoPdf(true);
  };

  // Quando o overlay do PDF está visível, capturamos após o paint para evitar PDF em branco
  useEffect(() => {
    if (!gerandoPdf || pdfRows.length === 0) return;
    const runCapture = async () => {
      const el = pdfRef.current;
      if (!el) {
        setGerandoPdf(false);
        return;
      }
      try {
        const html2pdf = (await import("html2pdf.js")).default;
        const blob = await html2pdf()
          .set({
            margin: 10,
            filename: "score-batalha.pdf",
            image: { type: "jpeg", quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .from(el)
          .outputPdf("blob");
        const supabase = createClient();
        const bucket = "processo-docs";
        const path = `${processoId}/score-batalha.pdf`;
        const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, blob, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (uploadErr) {
          alert("Erro ao enviar o PDF: " + uploadErr.message + ". Verifique se o bucket \"" + bucket + "\" existe no Supabase.");
        } else {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          const result = await saveScoreBatalhaPdfUrl(processoId, urlData.publicUrl);
          if (!result.ok) alert(result.error);
          else router.refresh();
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erro ao gerar o PDF.");
      } finally {
        setGerandoPdf(false);
      }
    };
    const t = setTimeout(runCapture, 400);
    return () => clearTimeout(t);
  }, [gerandoPdf, processoId, pdfRows.length]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const portalTarget =
    mounted && resultadoPortalTargetId && typeof document !== "undefined"
      ? document.getElementById(resultadoPortalTargetId)
      : null;

  return (
    <>
      {!listagemOnly && resultadoPortalTargetId && portalTarget ? createPortal(resultCardNode, portalTarget) : null}
      {!listagemOnly && !resultadoPortalTargetId && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-4 mt-6">
          <div className="hidden sm:block flex-1" aria-hidden />
          {resultCardNode}
        </div>
      )}
      <div className={resultadoPortalTargetId ? "space-y-8 p-4 sm:p-6" : "mt-6 space-y-8"}>
      {/* Bloco Varrer ZAP */}
      <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Estado (ex.: SP)"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            maxLength={2}
          />
          <input
            type="text"
            placeholder="Condomínio (opcional)"
            value={condominio}
            onChange={(e) => setCondominio(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        {zapLoading ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Chamando Apify (actor fatihtahta/zap-imoveis-scraper)… aguardando resultado (polling a cada 3 s). Não feche a página.
          </p>
        ) : null}
        {zapError ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
            <strong>Erro ao varrer ZAP:</strong> {zapError}
          </div>
        ) : null}
        {zapResult ? (
          <p className="text-sm text-green-700">
            Inseridos: {zapResult.inserted}, atualizados: {zapResult.updated}, marcados despublicados: {zapResult.despublicados}.
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleVarrerZap}
          disabled={zapLoading}
          className="btn-primary text-sm"
        >
          {zapLoading ? "Buscando…" : "Buscar"}
        </button>
      </section>

      {/* Alerta mensal: validar status das casas manuais */}
      {casasManuais.length > 0 && precisaAlertaValidacao && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3" role="alert">
          <p className="text-sm text-amber-900">
            <strong>Validação mensal:</strong> Você tem {casasManuais.length} casa(s) cadastrada(s) manualmente. Confira se o status (à venda / despublicado) ainda está correto.
            {ultimaValidacaoCasasManuaisEm ? (
              <> Última validação: {new Date(ultimaValidacaoCasasManuaisEm).toLocaleDateString("pt-BR")}.</>
            ) : (
              " Nenhuma validação registrada ainda."
            )}
          </p>
          <button
            type="button"
            onClick={handleValidarStatusCasasManuais}
            disabled={validandoStatus}
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-60"
          >
            {validandoStatus ? "Salvando…" : "Validar status"}
          </button>
        </div>
      )}

      {/* Seção 1 — Listagem (+ opcional: escolha dos 3 modelos e batalha) */}
      {casas.length > 0 && (
        <section className="rounded-xl border border-stone-200 overflow-hidden">
          {/* Bloco compacto: escolher 3 do catálogo para batalha — só no Step 2 (não listagemOnly) */}
          {!listagemOnly && catalogo.length > 0 && (
            <div className="bg-stone-50 border-b border-stone-200 px-4 py-3">
              <p className="text-sm font-medium text-stone-800 mb-2">
                Escolher até 3 modelos do catálogo para batalhar com a listagem abaixo:
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {catalogo.map((mod) => (
                  <label key={mod.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCatalogoIds.includes(mod.id)}
                      onChange={() => toggleCatalogoSelected(mod.id)}
                      disabled={!selectedCatalogoIds.includes(mod.id) && selectedCatalogoIds.length >= selectedLimit}
                      className="rounded"
                    />
                    <span>{mod.nome ?? mod.id.slice(0, 8)}</span>
                    {mod.preco_venda_m2 != null && (
                      <span className="text-stone-500 text-xs">R$ {mod.preco_venda_m2.toLocaleString("pt-BR")}/m²</span>
                    )}
                  </label>
                ))}
                <span className="text-stone-500 text-sm">
                  {selectedCatalogoIds.length} / {selectedLimit} selecionados
                </span>
                <button
                  type="button"
                  onClick={handleConfirmEscolhidas}
                  disabled={selectedCatalogoIds.length === 0}
                  className="btn-primary text-sm disabled:opacity-60 disabled:pointer-events-none"
                >
                  Confirmar seleção
                </button>
                {escolhidasComDados.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleSalvarBatalha}
                      className="btn-primary text-sm"
                    >
                      Salvar batalha
                    </button>
                    <button
                      type="button"
                      onClick={handleGerarPdf}
                      disabled={gerandoPdf || pdfRows.length === 0}
                      className="btn-primary text-sm"
                    >
                      {gerandoPdf ? "Gerando PDF…" : "Gerar e guardar PDF"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100">
                <th className="p-2 text-left">Cidade</th>
                <th className="p-2 text-left">Fotos</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Condomínio</th>
                <th className="p-2 text-left">Endereço</th>
                <th className="p-2 text-left">Quartos</th>
                <th className="p-2 text-left">Banheiros</th>
                <th className="p-2 text-left">Vagas</th>
                <th className="p-2 text-left">Piscina</th>
                <th className="p-2 text-left">Móveis planej.</th>
                <th className="p-2 text-left">Preço</th>
                <th className="p-2 text-left">m²</th>
                <th className="p-2 text-left">R$/m²</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-left">Data criação ZAP</th>
                <th className="p-2 text-left">Duração anúncio</th>
                <th className="p-2 text-left">Listing</th>
                {!listagemOnly && escolhidasComDados.map((ce, idx) => {
                  const cat = ce.catalogoRow as { nome: string | null };
                  const bg = CORES_HEADER_POR_MODELO[idx % CORES_HEADER_POR_MODELO.length];
                  return (
                    <th key={ce.id} colSpan={4} className={`p-2 text-center border-l border-stone-200 ${bg} text-stone-800`} title={`Modelo ${ce.ordem}: ${cat.nome ?? ""}`}>
                      {cat.nome ?? `Casa ${ce.ordem}`}
                    </th>
                  );
                })}
              </tr>
              {!listagemOnly && escolhidasComDados.length > 0 && (
                <tr className="border-b border-stone-200 bg-stone-100">
                  {/* Espaço embaixo das colunas fixas da listagem */}
                  <th colSpan={17} className="p-0" aria-hidden />
                  {escolhidasComDados.map((ce, idx) => {
                    const bg = CORES_HEADER_POR_MODELO[idx % CORES_HEADER_POR_MODELO.length];
                    return (
                      <React.Fragment key={ce.id}>
                        <th className={`p-1 px-2 text-center border-l border-stone-200 ${bg} text-xs font-medium min-w-[70px]`}>Nota Preço</th>
                        <th className={`p-1 px-2 text-center ${bg} text-xs font-medium min-w-[70px]`}>Nota Produto</th>
                        <th className={`p-1 px-2 text-center ${bg} text-xs font-medium min-w-[70px]`} title="Atributos do Lote">Atrib. Lote</th>
                        <th className={`p-1 px-2 text-center ${bg} text-xs font-medium min-w-[70px]`}>Nota Final</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              )}
            </thead>
            <tbody>
              {casasPaginated.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="p-2">{c.cidade ?? "—"}</td>
                  <td className="p-2">
                    {c.foto_url ? (
                      <a href={c.foto_url} target="_blank" rel="noreferrer" className="text-moni-accent hover:underline">Link</a>
                    ) : "—"}
                  </td>
                  <td className="p-2">
                    {c.manual ? (
                      <select
                        value={c.status ?? "a_venda"}
                        onChange={(e) => handleStatusChange(c.id, e.target.value as "a_venda" | "despublicado")}
                        className="rounded border border-stone-300 px-2 py-1 text-sm"
                      >
                        <option value="a_venda">À venda</option>
                        <option value="despublicado">Despublicado</option>
                      </select>
                    ) : (
                      c.status === "despublicado" ? "despublicado" : "a venda"
                    )}
                  </td>
                  <td className="p-2">{c.condominio ?? "—"}</td>
                  <td className="p-2 max-w-[120px] truncate" title={c.localizacao_condominio ?? undefined}>{c.localizacao_condominio ?? "—"}</td>
                  <td className="p-2">{c.quartos ?? "—"}</td>
                  <td className="p-2">{c.banheiros ?? "—"}</td>
                  <td className="p-2">{c.vagas ?? "—"}</td>
                  <td className="p-2">{c.piscina ? "sim" : "não"}</td>
                  <td className="p-2">{c.marcenaria ? "sim" : "não"}</td>
                  <td className="p-2">{c.preco != null ? `R$ ${c.preco.toLocaleString("pt-BR")}` : "—"}</td>
                  <td className="p-2">{c.area_casa_m2 ?? "—"}</td>
                  <td className="p-2">{c.preco_m2 != null ? `R$ ${c.preco_m2.toLocaleString("pt-BR")}` : "—"}</td>
                  <td className="p-2">{c.estado ?? "—"}</td>
                  <td className="p-2">{c.data_publicacao ?? "—"}</td>
                  <td className="p-2">
                    {(() => {
                      const pub = c.data_publicacao ? new Date(c.data_publicacao) : null;
                      if (!pub || isNaN(pub.getTime())) return "—";
                      const hoje = new Date();
                      hoje.setHours(0, 0, 0, 0);
                      if (c.status === "despublicado" && c.data_despublicado) {
                        const desp = new Date(c.data_despublicado);
                        if (!isNaN(desp.getTime())) {
                          const dias = Math.round((desp.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24));
                          return `${dias} dias`;
                        }
                      }
                      pub.setHours(0, 0, 0, 0);
                      const dias = Math.round((hoje.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24));
                      return `${dias} dias`;
                    })()}
                  </td>
                  <td className="p-2">
                    {c.link ? (
                      <a href={c.link} target="_blank" rel="noreferrer" className="text-moni-accent hover:underline">Abrir anúncio</a>
                    )                     : "—"}
                  </td>
                  {!listagemOnly && escolhidasComDados.map((ce, idx) => {
                    const key = `${ce.id}__${c.id}`;
                    const notaAtrib = getNotaAtributosLote(key);
                    const notaPreco = getNotaPrecoCompleta(ce, c);
                    const notaProduto = getNotaProdutoCompleta(ce, c);
                    const notaFinal = notaFinalBatalha(notaAtrib, notaPreco, notaProduto);
                    const bg = CORES_POR_MODELO[idx % CORES_POR_MODELO.length];
                    const borderLeft = "border-l border-stone-200";
                    const isOpenAtrib = openAtributosKey === key;
                    const isOpenPreco = openPrecoKey === key;
                    const isOpenProduto = openProdutoKey === key;
                    const resp = atributosLoteByKey[key] ?? {};
                    const checklistReforma = reformaChecklistByListingId[c.id] ?? {};
                    const prodDados = produtoDadosByKey[key] ?? {};
                    const precoManualPreenchido = Object.values(checklistReforma).some((m) => !!m?.marked);
                    const atribManualPreenchido = atributosLoteByKey[key] !== undefined && Object.keys(resp).length > 0;
                    const produtoManualPreenchido =
                      (prodDados.designId != null && prodDados.designId !== "") ||
                      (prodDados.idade != null && Number.isFinite(prodDados.idade));
                    return (
                      <React.Fragment key={ce.id}>
                        <td className={`p-1 px-2 text-center ${borderLeft} ${bg} min-w-[70px] relative`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPrecoKey((k) => (k === key ? null : key));
                                if (!reformaChecklistByListingId[c.id]) setReformaChecklistByListingId((p) => ({ ...p, [c.id]: {} }));
                              }}
                              className="rounded border border-stone-300 px-1 py-0.5 text-xs min-w-[2rem] bg-white hover:bg-stone-50"
                              title="Preço (checklist reforma + 4 sub-itens)"
                            >
                              {notaPreco}
                            </button>
                            {!precoManualPreenchido && (
                              <span className="text-amber-600 text-[10px] font-bold leading-none" title="Nota automática (preço/m²). Preencha o checklist de reforma para refinar.">!</span>
                            )}
                          </div>
                          {isOpenPreco && (
                            <>
                              <div className="absolute left-0 top-full z-30 mt-0.5 w-72 max-h-[70vh] overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                                <p className="text-xs font-semibold text-stone-800 mb-2">Preço — Checklist de reforma (listagem)</p>
                                {CATEGORIAS_REFORMA.map((cat) => {
                                  const m = checklistReforma[cat.id];
                                  return (
                                    <div key={cat.id} className="flex items-center gap-2 py-1 border-b border-stone-100 last:border-0">
                                      <input
                                        type="checkbox"
                                        checked={!!m?.marked}
                                        onChange={(e) => {
                                          setReformaChecklistByListingId((p) => ({
                                            ...p,
                                            [c.id]: {
                                              ...(p[c.id] ?? {}),
                                              [cat.id]: { marked: e.target.checked, valor: cat.valor },
                                            },
                                          }));
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-xs flex-1">{cat.nome}</span>
                                      <input
                                        type="number"
                                        value={m?.valor ?? cat.valor}
                                        onChange={(e) => {
                                          const v = e.target.value ? Number(e.target.value) : undefined;
                                          setReformaChecklistByListingId((p) => ({
                                            ...p,
                                            [c.id]: {
                                              ...(p[c.id] ?? {}),
                                              [cat.id]: { marked: !!p[c.id]?.[cat.id]?.marked, valor: v ?? cat.valor },
                                            },
                                          }));
                                        }}
                                        className="w-20 rounded border border-stone-300 px-1 py-0.5 text-xs"
                                      />
                                    </div>
                                  );
                                })}
                                <p className="text-xs text-stone-600 mt-2">
                                  Inv.: R$ {valorInvestimento(checklistReforma).toLocaleString("pt-BR")} — Nota: {notaPreco}
                                </p>
                              </div>
                              <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpenPrecoKey(null)} />
                            </>
                          )}
                        </td>
                        <td className={`p-1 px-2 text-center ${bg} min-w-[70px] relative`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenProdutoKey((k) => (k === key ? null : key));
                                if (!produtoDadosByKey[key]) setProdutoDadosByKey((p) => ({ ...p, [key]: {} }));
                              }}
                              className="rounded border border-stone-300 px-1 py-0.5 text-xs min-w-[2rem] bg-white hover:bg-stone-50"
                              title="Produto (5 sub-itens: tamanho, amenidades, quartos, design, idade)"
                            >
                              {notaProduto}
                            </button>
                            {!produtoManualPreenchido && (
                              <span className="text-amber-600 text-[10px] font-bold leading-none" title="Nota automática (quartos/banheiros/vagas). Preencha design e idade para refinar.">!</span>
                            )}
                          </div>
                          {isOpenProduto && (
                            <>
                              <div className="absolute left-0 top-full z-30 mt-0.5 w-64 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                                <p className="text-xs font-semibold text-stone-800 mb-2">Produto — 5 sub-itens</p>
                                <div className="space-y-1.5 text-xs">
                                  <p>Tamanho m²: auto ({notaTamanhoM2(c.area_casa_m2, (ce.catalogoRow as { area_m2?: number | null }).area_m2 ?? null)})</p>
                                  <p>Quartos: auto ({notaQuartos(c.quartos)})</p>
                                  <p>Amenidades: auto ({notaAmenidades(c)})</p>
                                  <label className="block">
                                    <span className="text-stone-600">Design:</span>
                                    <select
                                      value={prodDados.designId ?? ""}
                                      onChange={(e) => setProdutoDadosByKey((p) => ({ ...p, [key]: { ...p[key], designId: e.target.value || undefined } }))}
                                      className="ml-1 rounded border border-stone-300 px-1 py-0.5 w-full"
                                    >
                                      <option value="">—</option>
                                      {DESIGN_OPCOES.map((o) => (
                                        <option key={o.id} value={o.id}>{o.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block">
                                    <span className="text-stone-600">Idade (anos):</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={prodDados.idade ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value === "" ? null : Number(e.target.value);
                                        setProdutoDadosByKey((p) => ({ ...p, [key]: { ...p[key], idade: v } }));
                                      }}
                                      className="ml-1 rounded border border-stone-300 px-1 py-0.5 w-16"
                                    />
                                  </label>
                                </div>
                                <p className="text-xs text-stone-600 mt-2">Nota produto: {notaProduto}</p>
                              </div>
                              <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpenProdutoKey(null)} />
                            </>
                          )}
                        </td>
                        <td className={`p-1 px-2 text-center ${bg} min-w-[70px] relative`}>
                          <div className="relative inline-block flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenAtributosKey((k) => (k === key ? null : key));
                                if (!atributosLoteByKey[key]) setAtributosLoteByKey((p) => ({ ...p, [key]: {} }));
                              }}
                              className="rounded border border-stone-300 px-1 py-0.5 text-xs min-w-[2rem] bg-white hover:bg-stone-50"
                              title="Atributos do Lote (SIM/NÃO)"
                            >
                              {notaAtrib}
                            </button>
                            {!atribManualPreenchido && (
                              <span className="text-amber-600 text-[10px] font-bold leading-none" title="Nota padrão (0). Preencha os atributos do lote (SIM/NÃO) para refinar.">!</span>
                            )}
                            {isOpenAtrib && (
                              <>
                                <div className="absolute left-0 top-full z-20 mt-0.5 w-56 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                                  <p className="text-xs font-medium text-stone-700 mb-1.5">Atributos do Lote</p>
                                  {ATRIBUTOS_LOTE.map((a) => (
                                    <label key={a.id} className="flex items-center gap-2 py-0.5 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={!!resp[a.id]}
                                        onChange={(e) => handleChangeAtributoLote(key, a.id, e.target.checked)}
                                        className="rounded"
                                      />
                                      <span>{a.label}</span>
                                      <span className="text-stone-400">({a.nota >= 0 ? "+" : ""}{a.nota})</span>
                                    </label>
                                  ))}
                                  <p className="text-xs text-stone-500 mt-1">Soma: {notaAtributosLote(resp)}</p>
                                </div>
                                <div
                                  className="fixed inset-0 z-10"
                                  aria-hidden
                                  onClick={() => setOpenAtributosKey(null)}
                                />
                              </>
                            )}
                          </div>
                        </td>
                        <td className={`p-1 px-2 text-center ${bg} min-w-[70px]`}>{notaFinal.toFixed(1)}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
      {casas.length > ROWS_PER_PAGE && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm">
          <span className="text-stone-600">
            Página {pageCasas} de {totalPages} ({casas.length} casas)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPageCasas((p) => Math.max(1, p - 1))}
              disabled={pageCasas <= 1}
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:pointer-events-none"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPageCasas((p) => Math.min(totalPages, p + 1))}
              disabled={pageCasas >= totalPages}
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:pointer-events-none"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* PDF Score & Batalha — etapa 7: gerar e armazenar na etapa (só na página da batalha, resultadoPortalTargetId = etapa 6) */}
      {resultadoPortalTargetId != null && (
        <section className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-stone-800">PDF Score & Batalha</h3>
          <p className="text-sm text-stone-600">
            Após salvar a batalha, gere o PDF no formato do relatório. O arquivo ficará armazenado nesta etapa (Etapa 7).
          </p>
          {pdfScoreBatalhaUrl ? (
            <p className="text-sm">
              <a href={pdfScoreBatalhaUrl} target="_blank" rel="noreferrer" className="text-moni-accent font-medium hover:underline">
                Baixar PDF armazenado
              </a>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGerarPdf}
              disabled={gerandoPdf || pdfRows.length === 0}
              className="btn-primary text-sm"
            >
              {gerandoPdf ? "Gerando PDF…" : "Gerar e guardar PDF"}
            </button>
          </div>
          {/* Overlay visível só durante a geração: html2canvas precisa do conteúdo pintado na tela */}
          {gerandoPdf && pdfRows.length > 0 && (
            <div className="fixed inset-0 z-[9999] bg-white overflow-auto p-4" aria-hidden>
              <div
                ref={pdfRef}
                className="bg-white"
                style={{ width: "210mm", minHeight: "297mm" }}
              >
                <ScoreBatalhaPDFContent rows={pdfRows} omitImages />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Adicionar casa manual — dropdown */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setManualFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-stone-800 hover:bg-stone-100 transition-colors"
          aria-expanded={manualFormOpen}
        >
          <span>Adicionar casa manualmente</span>
          <span className="text-stone-500 text-lg leading-none">{manualFormOpen ? "−" : "+"}</span>
        </button>
        {manualFormOpen && (
      <form onSubmit={handleSubmitManual} className="p-4 pt-0 space-y-3 border-t border-stone-200">
        <p className="text-sm text-stone-600">
          Use somente se alguma casa relevante não tiver sido puxada automaticamente pela ZAP. Casas manuais só têm o status editável na tabela.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 grid gap-1">
            <span className="text-sm font-medium text-stone-700">Cidade</span>
            <input type="text" value={cidadeManual} onChange={(e) => setCidadeManual(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Status</span>
            <select value={statusManual} onChange={(e) => setStatusManual(e.target.value as "a_venda" | "despublicado")} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="a_venda">À venda</option>
              <option value="despublicado">Despublicado</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Condomínio</span>
            <input type="text" value={condominioManual} onChange={(e) => setCondominioManual(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="sm:col-span-2 grid gap-1">
            <span className="text-sm font-medium text-stone-700">Endereço</span>
            <input type="text" value={enderecoManual} onChange={(e) => setEnderecoManual(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Quartos</span>
            <input type="number" min={0} value={quartos} onChange={(e) => setQuartos(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Banheiros</span>
            <input type="number" min={0} value={banheiros} onChange={(e) => setBanheiros(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Vagas</span>
            <input type="number" min={0} value={vagas} onChange={(e) => setVagas(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex items-end gap-4 pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={piscina} onChange={(e) => setPiscina(e.target.checked)} className="rounded" />
              Piscina
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={marcenaria} onChange={(e) => setMarcenaria(e.target.checked)} className="rounded" />
              Móveis planej.
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Preço</span>
            <input type="text" placeholder="R$" value={preco} onChange={(e) => setPreco(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">m²</span>
            <input type="number" step="0.01" min={0} value={areaCasa} onChange={(e) => setAreaCasa(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">R$/m²</span>
            <input type="text" value={precoM2Auto} readOnly className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-600" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Estado</span>
            <input type="text" placeholder="UF" value={estadoManual} onChange={(e) => setEstadoManual(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" maxLength={2} />
          </label>
          <label className="sm:col-span-2 grid gap-1">
            <span className="text-sm font-medium text-stone-700">Compat. Moní</span>
            <input type="text" value={compatibilidadeMoni} onChange={(e) => setCompatibilidadeMoni(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">Data levant.</span>
            <input type="date" value={dataLevantamento} onChange={(e) => setDataLevantamento(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="sm:col-span-2 grid gap-1">
            <span className="text-sm font-medium text-stone-700">Listing</span>
            <input type="url" placeholder="Link do anúncio" value={link} onChange={(e) => setLink(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn-primary text-sm">{loading ? "Salvando…" : "Adicionar casa"}</button>
      </form>
        )}
      </div>
      </div>
    </>
  );
}
