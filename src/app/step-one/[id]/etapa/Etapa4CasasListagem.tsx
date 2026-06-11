'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addCasaListing,
  updateCasaStatus,
  validarStatusCasasManuais,
} from './actions';
import {
  ordenarCasasPorFaixaMercado,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';
import type { CasaRow } from './Etapa4Casas';

export type { CasaRow };

type Props = {
  processoId: string;
  cardId?: string;
  casas: CasaRow[];
  cidadeInicial: string;
  estadoInicial: string;
  ultimaValidacaoCasasManuaisEm: string | null;
  readOnly?: boolean;
  condominioInicial?: string;
  painelAposBuscar?: React.ReactNode;
  onMutate?: () => void;
};

/** Listagem ZAP + cadastro manual — usado no Mapa de Competidores (sem catálogo/batalha). */
export function Etapa4CasasListagem({
  processoId,
  cardId,
  casas,
  cidadeInicial,
  estadoInicial,
  ultimaValidacaoCasasManuaisEm,
  readOnly = false,
  condominioInicial = '',
  painelAposBuscar,
  onMutate,
}: Props) {
  const router = useRouter();
  const casasManuais = useMemo(() => casas.filter((c) => c.manual === true), [casas]);
  const precisaAlertaValidacao = useMemo(() => {
    if (casasManuais.length === 0) return false;
    if (!ultimaValidacaoCasasManuaisEm) return true;
    const ultima = new Date(ultimaValidacaoCasasManuaisEm);
    const hoje = new Date();
    const diffDays = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  }, [casasManuais.length, ultimaValidacaoCasasManuaisEm]);

  const [cidade, setCidade] = useState(cidadeInicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [condominio, setCondominio] = useState(condominioInicial);
  const [zapError, setZapError] = useState('');
  const [zapLoading, setZapLoading] = useState(false);
  const [zapResult, setZapResult] = useState<{
    inserted: number;
    updated: number;
    despublicados: number;
    itemCount: number;
  } | null>(null);

  const [cidadeManual, setCidadeManual] = useState(cidadeInicial);
  const [estadoManual, setEstadoManual] = useState(estadoInicial);
  const [statusManual, setStatusManual] = useState<'a_venda' | 'despublicado'>('a_venda');
  const [condominioManual, setCondominioManual] = useState(condominioInicial);
  const [enderecoManual, setEnderecoManual] = useState('');
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [vagas, setVagas] = useState('');
  const [piscina, setPiscina] = useState(false);
  const [marcenaria, setMarcenaria] = useState(false);
  const [preco, setPreco] = useState('');
  const [areaCasa, setAreaCasa] = useState('');
  const [dataLevantamento, setDataLevantamento] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [validandoStatus, setValidandoStatus] = useState(false);

  const precoM2Auto = useMemo(() => {
    const p = preco ? parseFloat(String(preco).replace(/\D/g, '').replace(',', '.')) : NaN;
    const a = areaCasa ? parseFloat(areaCasa.replace(',', '.')) : NaN;
    if (Number.isFinite(p) && Number.isFinite(a) && a > 0) return (p / a).toFixed(2);
    return '';
  }, [preco, areaCasa]);

  useEffect(() => {
    setCidade(cidadeInicial);
    setEstado(estadoInicial);
    setCidadeManual(cidadeInicial);
    setEstadoManual(estadoInicial);
  }, [cidadeInicial, estadoInicial]);

  useEffect(() => {
    const c = condominioInicial.trim();
    setCondominio(c);
    setCondominioManual(c);
  }, [condominioInicial]);

  const campoTexto = 'text-[11px] leading-tight';
  const campoPadding = 'px-2 py-1';
  const campoInputClass = `rounded-lg border border-stone-300 ${campoPadding} ${campoTexto} disabled:cursor-not-allowed disabled:opacity-60`;
  const campoLabelClass = 'text-[10px] font-medium leading-tight text-stone-600';
  const tabelaTexto = 'text-[11px] leading-snug';
  const tabelaTh = 'px-1.5 py-1 text-left font-medium';
  const tabelaTd = 'px-1.5 py-1';

  const ROWS_PER_PAGE = 15;
  const casasExibicao = useMemo(() => {
    if (!casas.some((c) => c.preco != null)) return casas;
    return ordenarCasasPorFaixaMercado(casas);
  }, [casas]);
  const contagemPorFaixa = useMemo(() => {
    const m = new Map<FaixaMercado, number>();
    for (const c of casasExibicao) {
      if (c.faixa) m.set(c.faixa, (m.get(c.faixa) ?? 0) + 1);
    }
    return m;
  }, [casasExibicao]);
  const totalPages = Math.max(1, Math.ceil(casasExibicao.length / ROWS_PER_PAGE));
  const [pageCasas, setPageCasas] = useState(1);
  const casasPaginated = useMemo(() => {
    const start = (pageCasas - 1) * ROWS_PER_PAGE;
    return casasExibicao.slice(start, start + ROWS_PER_PAGE);
  }, [casasExibicao, pageCasas]);
  useEffect(() => setPageCasas(1), [casasExibicao.length]);

  const handleVarrerZap = async () => {
    setZapError('');
    setZapResult(null);
    setZapLoading(true);

    const city = cidade.trim();
    const state = estado.trim();
    if (!city || !state) {
      setZapError('Preencha cidade e estado.');
      setZapLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/apify-zap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cidade: city,
          estado: state,
          condominio: condominio.trim() || undefined,
          processoId: processoId?.trim() || undefined,
          cardId: cardId?.trim() || undefined,
          ...(condominioInicial.trim() ? { condominioVinculo: condominioInicial.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setZapError(data.error ?? 'Erro ao buscar listagens na ZAP.');
        setZapLoading(false);
        return;
      }

      if (data.saved) {
        setZapResult({
          inserted: data.inserted ?? 0,
          updated: data.updated ?? 0,
          despublicados: data.despublicados ?? 0,
          itemCount: data.itemCount ?? 0,
        });
        router.refresh();
        onMutate?.();
      } else {
        setZapError('Resposta inesperada da API (dados não salvos).');
      }
    } catch (err) {
      setZapError(err instanceof Error ? err.message : 'Falha ao chamar a API.');
    } finally {
      setZapLoading(false);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const precoNum = preco
      ? parseFloat(String(preco).replace(/\D/g, '').replace(',', '.'))
      : undefined;
    const areaNum = areaCasa ? parseFloat(areaCasa.replace(',', '.')) : undefined;
    const precoM2FromAuto = precoM2Auto ? parseFloat(String(precoM2Auto).replace(',', '.')) : NaN;
    const precoM2Num = Number.isFinite(precoM2FromAuto)
      ? precoM2FromAuto
      : precoNum != null && areaNum != null && areaNum > 0
        ? precoNum / areaNum
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
      data_coleta: dataLevantamento || undefined,
      link: link || undefined,
    });
    setLoading(false);
    if (result.ok) {
      router.refresh();
      onMutate?.();
      setCidadeManual(cidadeInicial);
      setEstadoManual(estadoInicial);
      setCondominioManual(condominioInicial.trim());
      setEnderecoManual('');
      setQuartos('');
      setBanheiros('');
      setVagas('');
      setPreco('');
      setAreaCasa('');
      setDataLevantamento('');
      setLink('');
      setPiscina(false);
      setMarcenaria(false);
      setStatusManual('a_venda');
    } else setError(result.error);
  };

  const handleStatusChange = async (casaId: string, status: 'a_venda' | 'despublicado') => {
    const result = await updateCasaStatus(casaId, status);
    if (result.ok) {
      router.refresh();
      onMutate?.();
    }
  };

  const handleValidarStatusCasasManuais = async () => {
    setValidandoStatus(true);
    const result = await validarStatusCasasManuais(processoId);
    setValidandoStatus(false);
    if (result.ok) {
      router.refresh();
      onMutate?.();
    }
  };

  return (
    <div className="space-y-8 p-3 sm:p-4">
      <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className={campoLabelClass}>Cidade</span>
            <input
              type="text"
              placeholder="Ex.: Salto"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              disabled={readOnly}
              className={campoInputClass}
            />
          </label>
          <label className="grid gap-1">
            <span className={campoLabelClass}>Estado</span>
            <input
              type="text"
              placeholder="Ex.: SP"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              disabled={readOnly}
              className={campoInputClass}
              maxLength={2}
            />
          </label>
          <label className="grid gap-1">
            <span className={campoLabelClass}>Condomínio</span>
            <input
              type="text"
              placeholder="Nome do condomínio"
              value={condominio}
              onChange={(e) => setCondominio(e.target.value)}
              disabled={readOnly}
              className={campoInputClass}
            />
          </label>
        </div>
        {condominioInicial.trim() &&
        condominio.trim().toLowerCase() !== condominioInicial.trim().toLowerCase() ? (
          <p className={`${campoTexto} text-stone-500`}>
            Termo na ZAP para &quot;{condominioInicial.trim()}&quot; — ajuste se necessário.
          </p>
        ) : null}
        {zapLoading ? (
          <p
            className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 ${campoTexto}`}
          >
            Buscando imóveis no ZAP via Apify… pode levar até 4 minutos. Não feche a página.
          </p>
        ) : null}
        {zapError ? (
          <div
            className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 ${campoTexto}`}
            role="alert"
          >
            <strong>Erro ao varrer ZAP:</strong> {zapError}
          </div>
        ) : null}
        {zapResult ? (
          zapResult.itemCount === 0 ? (
            <p
              className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 ${campoTexto}`}
            >
              Nenhum imóvel encontrado na ZAP com estes filtros (casas/sobrados acima de R$
              4.000.000). Confira se o termo do condomínio corresponde ao bairro/loteamento na ZAP
              ou cadastre manualmente.
            </p>
          ) : (
            <p className={`${campoTexto} text-green-700`}>
              {zapResult.itemCount} {zapResult.itemCount === 1 ? 'imóvel' : 'imóveis'} na ZAP —
              inseridos: {zapResult.inserted}, atualizados: {zapResult.updated}, marcados
              despublicados: {zapResult.despublicados}.
            </p>
          )
        ) : null}
        <button
          type="button"
          onClick={handleVarrerZap}
          disabled={zapLoading || readOnly}
          className="btn-primary !px-2.5 !py-1 !text-[11px] !font-normal disabled:cursor-not-allowed disabled:opacity-60"
        >
          {zapLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </section>

      {painelAposBuscar}

      {casasManuais.length > 0 && precisaAlertaValidacao && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
          role="alert"
        >
          <p className="text-sm text-amber-900">
            <strong>Validação mensal:</strong> Você tem {casasManuais.length} casa(s) cadastrada(s)
            manualmente. Confira se o status (à venda / despublicado) ainda está correto.
            {ultimaValidacaoCasasManuaisEm ? (
              <>
                {' '}
                Última validação:{' '}
                {new Date(ultimaValidacaoCasasManuaisEm).toLocaleDateString('pt-BR')}.
              </>
            ) : (
              ' Nenhuma validação registrada ainda.'
            )}
          </p>
          <button
            type="button"
            onClick={handleValidarStatusCasasManuais}
            disabled={validandoStatus || readOnly}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {validandoStatus ? 'Salvando…' : 'Validar status'}
          </button>
        </div>
      )}

      {casas.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-stone-200">
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[900px] ${tabelaTexto}`}>
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100">
                  <th className={tabelaTh}>Cidade</th>
                  <th className={tabelaTh}>Fotos</th>
                  <th className={tabelaTh}>Status</th>
                  <th className={tabelaTh}>Condomínio</th>
                  <th className={tabelaTh}>Endereço</th>
                  <th className={tabelaTh}>Quartos</th>
                  <th className={tabelaTh}>Banheiros</th>
                  <th className={tabelaTh}>Vagas</th>
                  <th className={tabelaTh}>Piscina</th>
                  <th className={tabelaTh}>Móveis planej.</th>
                  <th className={tabelaTh}>Preço</th>
                  <th className={tabelaTh}>m²</th>
                  <th className={tabelaTh}>R$/m²</th>
                  <th className={tabelaTh}>Estado</th>
                  <th className={tabelaTh}>Data criação ZAP</th>
                  <th className={tabelaTh}>Duração anúncio</th>
                  <th className={tabelaTh}>Listing</th>
                </tr>
              </thead>
              <tbody>
                {casasPaginated.map((c, idx) => {
                  const prevFaixa = idx > 0 ? casasPaginated[idx - 1]?.faixa : undefined;
                  const showFaixaHeader =
                    c.faixa != null && (idx === 0 || c.faixa !== prevFaixa);
                  const qtdFaixa =
                    showFaixaHeader && c.faixa ? (contagemPorFaixa.get(c.faixa) ?? 0) : 0;
                  const colCountListagem = 17;
                  return (
                    <React.Fragment key={c.id}>
                      {showFaixaHeader ? (
                        <tr className="border-b border-stone-200 bg-stone-50/90">
                          <td colSpan={colCountListagem} className={`${tabelaTd} py-1.5`}>
                            <div className="flex items-center gap-2">
                              <BadgeFaixaMercado faixa={c.faixa} />
                              <span className="font-medium text-stone-600">
                                {qtdFaixa} {qtdFaixa === 1 ? 'casa' : 'casas'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      <tr className="border-b border-stone-100 hover:bg-stone-50">
                        <td className={tabelaTd}>{c.cidade ?? '—'}</td>
                        <td className={tabelaTd}>
                          {c.foto_url ? (
                            <a
                              href={c.foto_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-moni-accent hover:underline"
                            >
                              Link
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={tabelaTd}>
                          {c.manual ? (
                            <select
                              value={c.status ?? 'a_venda'}
                              onChange={(e) =>
                                handleStatusChange(c.id, e.target.value as 'a_venda' | 'despublicado')
                              }
                              disabled={readOnly}
                              className={`rounded border border-stone-300 ${campoPadding} ${campoTexto} disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <option value="a_venda">À venda</option>
                              <option value="despublicado">Despublicado</option>
                            </select>
                          ) : c.status === 'despublicado' ? (
                            'despublicado'
                          ) : (
                            'a venda'
                          )}
                        </td>
                        <td className={tabelaTd}>{c.condominio ?? '—'}</td>
                        <td
                          className={`${tabelaTd} max-w-[120px] truncate`}
                          title={c.localizacao_condominio ?? undefined}
                        >
                          {c.localizacao_condominio ?? '—'}
                        </td>
                        <td className={tabelaTd}>{c.quartos ?? '—'}</td>
                        <td className={tabelaTd}>{c.banheiros ?? '—'}</td>
                        <td className={tabelaTd}>{c.vagas ?? '—'}</td>
                        <td className={tabelaTd}>{c.piscina ? 'sim' : 'não'}</td>
                        <td className={tabelaTd}>{c.marcenaria ? 'sim' : 'não'}</td>
                        <td className={tabelaTd}>
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {c.preco != null ? `R$ ${c.preco.toLocaleString('pt-BR')}` : '—'}
                            <BadgeFaixaMercado faixa={c.faixa} />
                          </span>
                        </td>
                        <td className={tabelaTd}>{c.area_casa_m2 ?? '—'}</td>
                        <td className={tabelaTd}>
                          {c.preco_m2 != null ? `R$ ${c.preco_m2.toLocaleString('pt-BR')}` : '—'}
                        </td>
                        <td className={tabelaTd}>{c.estado ?? '—'}</td>
                        <td className={tabelaTd}>{c.data_publicacao ?? '—'}</td>
                        <td className={tabelaTd}>
                          {(() => {
                            const pub = c.data_publicacao ? new Date(c.data_publicacao) : null;
                            if (!pub || isNaN(pub.getTime())) return '—';
                            const hoje = new Date();
                            hoje.setHours(0, 0, 0, 0);
                            if (c.status === 'despublicado' && c.data_despublicado) {
                              const desp = new Date(c.data_despublicado);
                              if (!isNaN(desp.getTime())) {
                                const dias = Math.round(
                                  (desp.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24),
                                );
                                return `${dias} dias`;
                              }
                            }
                            pub.setHours(0, 0, 0, 0);
                            const dias = Math.round(
                              (hoje.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24),
                            );
                            return `${dias} dias`;
                          })()}
                        </td>
                        <td className={tabelaTd}>
                          {c.link ? (
                            <a
                              href={c.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-moni-accent hover:underline"
                            >
                              Abrir anúncio
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {casasExibicao.length > ROWS_PER_PAGE && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px]">
          <span className="text-stone-600">
            Página {pageCasas} de {totalPages} ({casasExibicao.length} casas)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPageCasas((p) => Math.max(1, p - 1))}
              disabled={pageCasas <= 1}
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPageCasas((p) => Math.min(totalPages, p + 1))}
              disabled={pageCasas >= totalPages}
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {!readOnly ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => setManualFormOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] font-medium text-stone-800 transition-colors hover:bg-stone-100"
            aria-expanded={manualFormOpen}
          >
            <span>Adicionar casa manualmente</span>
            <span className="text-xs leading-none text-stone-500">{manualFormOpen ? '−' : '+'}</span>
          </button>
          {manualFormOpen && (
            <form
              onSubmit={handleSubmitManual}
              className="space-y-3 border-t border-stone-200 p-4 pt-0"
            >
              <p className="text-sm text-stone-600">
                Use somente se alguma casa relevante não tiver sido puxada automaticamente pela ZAP.
                Casas manuais só têm o status editável na tabela.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Cidade</span>
                  <input
                    type="text"
                    value={cidadeManual}
                    onChange={(e) => setCidadeManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Status</span>
                  <select
                    value={statusManual}
                    onChange={(e) => setStatusManual(e.target.value as 'a_venda' | 'despublicado')}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="a_venda">À venda</option>
                    <option value="despublicado">Despublicado</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Condomínio</span>
                  <input
                    type="text"
                    value={condominioManual}
                    onChange={(e) => setCondominioManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Endereço</span>
                  <input
                    type="text"
                    value={enderecoManual}
                    onChange={(e) => setEnderecoManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Quartos</span>
                  <input
                    type="number"
                    min={0}
                    value={quartos}
                    onChange={(e) => setQuartos(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Banheiros</span>
                  <input
                    type="number"
                    min={0}
                    value={banheiros}
                    onChange={(e) => setBanheiros(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Vagas</span>
                  <input
                    type="number"
                    min={0}
                    value={vagas}
                    onChange={(e) => setVagas(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex items-end gap-4 pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={piscina}
                      onChange={(e) => setPiscina(e.target.checked)}
                      className="rounded"
                    />
                    Piscina
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={marcenaria}
                      onChange={(e) => setMarcenaria(e.target.checked)}
                      className="rounded"
                    />
                    Móveis planej.
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Preço</span>
                  <input
                    type="text"
                    placeholder="R$"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">m²</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={areaCasa}
                    onChange={(e) => setAreaCasa(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">R$/m²</span>
                  <input
                    type="text"
                    value={precoM2Auto}
                    readOnly
                    className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-600"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Estado</span>
                  <input
                    type="text"
                    placeholder="UF"
                    value={estadoManual}
                    onChange={(e) => setEstadoManual(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    maxLength={2}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-stone-700">Data levant.</span>
                  <input
                    type="date"
                    value={dataLevantamento}
                    onChange={(e) => setDataLevantamento(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium text-stone-700">Listing</span>
                  <input
                    type="url"
                    placeholder="Link do anúncio"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-primary text-sm">
                {loading ? 'Salvando…' : 'Adicionar casa'}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BadgeFaixaMercado({ faixa }: { faixa?: CasaRow['faixa'] }) {
  if (faixa === 'premium_plus3') {
    return (
      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-900">
        Premium+++
      </span>
    );
  }
  if (faixa === 'premium_plus2') {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
        Premium++
      </span>
    );
  }
  if (faixa === 'premium_plus') {
    return (
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
        Premium+
      </span>
    );
  }
  if (faixa === 'premium') {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Premium
      </span>
    );
  }
  if (faixa === 'intermediaria') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Intermediária
      </span>
    );
  }
  if (faixa === 'entrada') {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        Entrada
      </span>
    );
  }
  return null;
}
