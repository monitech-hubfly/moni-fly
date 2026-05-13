'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  addLoteListing,
  deleteLoteListing,
  saveZapItemsEtapa5,
  saveLoteEscolhidoEtapa4,
} from './actions';

export type LoteRow = {
  id: string;
  condominio: string | null;
  area_lote_m2: number | null;
  preco: number | null;
  preco_m2: number | null;
  link: string | null;
  valor_condominio: number | null;
  iptu: number | null;
  caracteristicas_condominio: string | null;
  caracteristicas: string | null;
  manual: boolean | null;
};

export function Etapa5Lotes(props: {
  processoId: string;
  lotes: LoteRow[];
  loteEscolhidoId: string | null;
  cidadeInicial: string;
  estadoInicial: string;
  /** Step 1: só listagem (sem escolher lote). Step 2 (etapa 7) usa false. */
  listagemOnly?: boolean;
}) {
  const {
    processoId,
    lotes,
    loteEscolhidoId,
    cidadeInicial,
    estadoInicial,
    listagemOnly = false,
  } = props;
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(loteEscolhidoId);
  const [savingEscolha, setSavingEscolha] = useState(false);
  useEffect(() => setSelectedLoteId(loteEscolhidoId), [loteEscolhidoId]);
  const router = useRouter();
  const [cidade, setCidade] = useState(cidadeInicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [condominio, setCondominio] = useState('');
  const [zapError, setZapError] = useState('');
  const [zapLoading, setZapLoading] = useState(false);
  const [zapResult, setZapResult] = useState<{ inserted: number } | null>(null);

  const [condominioManual, setCondominioManual] = useState('');
  const [areaLote, setAreaLote] = useState('');
  const [preco, setPreco] = useState('');
  const [valorCondominio, setValorCondominio] = useState('');
  const [iptu, setIptu] = useState('');
  const [caracteristicasCondominio, setCaracteristicasCondominio] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ROWS_PER_PAGE = 15;
  const totalPages = Math.max(1, Math.ceil(lotes.length / ROWS_PER_PAGE));
  const [pageLotes, setPageLotes] = useState(1);
  const lotesPaginated = useMemo(() => {
    const start = (pageLotes - 1) * ROWS_PER_PAGE;
    return lotes.slice(start, start + ROWS_PER_PAGE);
  }, [lotes, pageLotes]);
  useEffect(() => setPageLotes(1), [lotes.length]);

  const handleBuscar = async () => {
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
      const res = await fetch('/api/apify-zap-lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cidade: city,
          estado: state,
          condominio: condominio.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setZapError(data.error ?? 'Erro ao buscar lotes na ZAP.');
        setZapLoading(false);
        return;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      const saveResult = await saveZapItemsEtapa5(processoId, items);

      if (saveResult.ok) {
        setZapResult({ inserted: saveResult.inserted });
        router.refresh();
      } else {
        setZapError(saveResult.error);
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
    const areaNum = areaLote ? parseFloat(String(areaLote).replace(',', '.')) : undefined;
    const precoNum = preco ? parseFloat(String(preco).replace(',', '.')) : undefined;
    const valorCondNum = valorCondominio
      ? parseFloat(String(valorCondominio).replace(',', '.'))
      : undefined;
    const iptuNum = iptu ? parseFloat(String(iptu).replace(',', '.')) : undefined;
    const result = await addLoteListing(processoId, {
      condominio: condominioManual || undefined,
      area_lote_m2: Number.isFinite(areaNum) ? areaNum : undefined,
      preco: Number.isFinite(precoNum) ? precoNum : undefined,
      valor_condominio: Number.isFinite(valorCondNum) ? valorCondNum : undefined,
      iptu: Number.isFinite(iptuNum) ? iptuNum : undefined,
      caracteristicas_condominio: caracteristicasCondominio.trim() || undefined,
      link: link.trim() || undefined,
    });
    setLoading(false);
    if (result.ok) {
      router.refresh();
      setCondominioManual('');
      setAreaLote('');
      setPreco('');
      setValorCondominio('');
      setIptu('');
      setCaracteristicasCondominio('');
      setLink('');
    } else setError(result.error);
  };

  const handleExcluirManual = async (loteId: string) => {
    if (!confirm('Excluir este lote?')) return;
    setDeletingId(loteId);
    const result = await deleteLoteListing(processoId, loteId);
    setDeletingId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  const handleConfirmarEscolha = async () => {
    if (!selectedLoteId) return;
    setSavingEscolha(true);
    const result = await saveLoteEscolhidoEtapa4(processoId, selectedLoteId);
    setSavingEscolha(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  return (
    <div className="mt-6 space-y-8">
      <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Buscando lotes na ZAP…
          </p>
        ) : null}
        {zapError ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            <strong>Erro ao buscar lotes:</strong> {zapError}
          </div>
        ) : null}
        {zapResult ? (
          <p className="text-sm text-green-700">Inseridos: {zapResult.inserted}.</p>
        ) : null}
        <button
          type="button"
          onClick={handleBuscar}
          disabled={zapLoading}
          className="btn-primary text-sm"
        >
          {zapLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </section>

      {lotes.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-stone-200">
          {!listagemOnly && (
            <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-sm font-medium text-stone-800">
                Escolha <strong>1 lote</strong> da listagem para o estudo de viabilidade (marque na
                tabela e confirme).
              </p>
              {loteEscolhidoId && (
                <span className="text-sm text-stone-600">
                  Lote escolhido: {lotes.find((l) => l.id === loteEscolhidoId)?.condominio ?? '—'}
                </span>
              )}
              <button
                type="button"
                onClick={handleConfirmarEscolha}
                disabled={!selectedLoteId || savingEscolha}
                className="btn-primary text-sm disabled:pointer-events-none disabled:opacity-60"
              >
                {savingEscolha ? 'Salvando…' : 'Confirmar escolha'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100">
                  {!listagemOnly && <th className="w-10 p-2 text-left">Escolher</th>}
                  <th className="p-2 text-left">Condomínio</th>
                  <th className="p-2 text-right">Área (m²)</th>
                  <th className="p-2 text-right">Preço</th>
                  <th className="p-2 text-right">R$/m²</th>
                  <th className="p-2 text-right">$ Condomínio</th>
                  <th className="p-2 text-right">IPTU</th>
                  <th className="p-2 text-left">Características do condomínio</th>
                  <th className="p-2 text-left">Link</th>
                  <th className="p-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lotesPaginated.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-stone-100 hover:bg-stone-50 ${!listagemOnly && selectedLoteId === l.id ? 'bg-emerald-50/50' : ''}`}
                  >
                    {!listagemOnly && (
                      <td className="p-2">
                        <label className="flex cursor-pointer items-center justify-center">
                          <input
                            type="radio"
                            name="lote-escolhido"
                            checked={selectedLoteId === l.id}
                            onChange={() => setSelectedLoteId(l.id)}
                            className="rounded-full border-stone-300 text-moni-primary"
                          />
                        </label>
                      </td>
                    )}
                    <td className="p-2">{l.condominio ?? '—'}</td>
                    <td className="p-2 text-right">
                      {l.area_lote_m2 != null ? l.area_lote_m2.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="p-2 text-right">
                      {l.preco != null ? `R$ ${l.preco.toLocaleString('pt-BR')}` : '—'}
                    </td>
                    <td className="p-2 text-right">
                      {l.preco_m2 != null ? `R$ ${l.preco_m2.toLocaleString('pt-BR')}` : '—'}
                    </td>
                    <td className="p-2 text-right">
                      {l.valor_condominio != null
                        ? `R$ ${l.valor_condominio.toLocaleString('pt-BR')}/mês`
                        : '—'}
                    </td>
                    <td className="p-2 text-right">
                      {l.iptu != null ? `R$ ${l.iptu.toLocaleString('pt-BR')}` : '—'}
                    </td>
                    <td
                      className="max-w-[200px] truncate p-2"
                      title={l.caracteristicas ?? l.caracteristicas_condominio ?? undefined}
                    >
                      {l.caracteristicas ?? l.caracteristicas_condominio ?? '—'}
                    </td>
                    <td className="p-2">
                      {l.link ? (
                        <a
                          href={l.link}
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
                    <td className="p-2">
                      {l.manual ? (
                        <button
                          type="button"
                          onClick={() => handleExcluirManual(l.id)}
                          disabled={deletingId === l.id}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingId === l.id ? 'Excluindo…' : 'Excluir'}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {lotes.length > ROWS_PER_PAGE && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm">
          <span className="text-stone-600">
            Página {pageLotes} de {totalPages} ({lotes.length} lotes)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPageLotes((p) => Math.max(1, p - 1))}
              disabled={pageLotes <= 1}
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPageLotes((p) => Math.min(totalPages, p + 1))}
              disabled={pageLotes >= totalPages}
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Adicionar lote manual — dropdown: campos só aparecem ao expandir */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        <button
          type="button"
          onClick={() => setManualFormOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-stone-800 transition-colors hover:bg-stone-100"
          aria-expanded={manualFormOpen}
        >
          <span>Adicionar lote manualmente</span>
          <span className="text-lg leading-none text-stone-500">{manualFormOpen ? '−' : '+'}</span>
        </button>
        {manualFormOpen && (
          <form
            onSubmit={handleSubmitManual}
            className="space-y-3 border-t border-stone-200 p-4 pt-0"
          >
            <p className="text-sm text-stone-600">
              Campos específicos para lotes/terrenos. Lotes adicionados manualmente só podem ser
              alterados ou excluídos por aqui (não vêm da ZAP).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-stone-700">Condomínio</span>
                <input
                  type="text"
                  value={condominioManual}
                  onChange={(e) => setCondominioManual(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-stone-700">Área do lote (m²)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={areaLote}
                  onChange={(e) => setAreaLote(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-stone-700">Preço (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-stone-700">$ Condomínio (R$/mês)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={valorCondominio}
                  onChange={(e) => setValorCondominio(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="Ex.: 1450"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-stone-700">IPTU (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={iptu}
                  onChange={(e) => setIptu(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="Ex.: 900"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">
                  Características do condomínio
                </span>
                <input
                  type="text"
                  value={caracteristicasCondominio}
                  onChange={(e) => setCaracteristicasCondominio(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="Ex.: Salão de festas, Piscina, Academia, Quadra"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">Link (opcional)</span>
                <input
                  type="url"
                  placeholder="URL do anúncio"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" disabled={loading} className="btn-primary text-sm">
              {loading ? 'Salvando…' : 'Adicionar lote'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
