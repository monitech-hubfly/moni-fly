"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveLoteEscolhido } from "./actions";

const DEBOUNCE_MS = 800;

type LoteEscolhido = {
  cidade: string | null;
  condominio: string | null;
  recuos_permitidos: string | null;
  localizacao_condominio: string | null;
  area_lote_m2: number | null;
  topografia: string | null;
  frente_m: number | null;
  fundo_m: number | null;
  preco: number | null;
  preco_m2: number | null;
} | null;

type LoteDisponivel = {
  id: string;
  condominio: string | null;
  area_lote_m2: number | null;
  preco: number | null;
  link: string | null;
};

export function Etapa7LoteEscolhido({
  processoId,
  cidade,
  estado,
  initial,
  lotesDisponiveis = [],
}: {
  processoId: string;
  cidade: string;
  estado: string | null;
  initial: LoteEscolhido;
  lotesDisponiveis?: LoteDisponivel[];
}) {
  const router = useRouter();
  const [condominio, setCondominio] = useState(initial?.condominio ?? "");
  const [recuos, setRecuos] = useState(initial?.recuos_permitidos ?? "");
  const [localizacao, setLocalizacao] = useState(initial?.localizacao_condominio ?? "");
  const [areaLote, setAreaLote] = useState(initial?.area_lote_m2?.toString() ?? "");
  const [topografia, setTopografia] = useState(initial?.topografia ?? "");
  const [frente, setFrente] = useState(initial?.frente_m?.toString() ?? "");
  const [fundo, setFundo] = useState(initial?.fundo_m?.toString() ?? "");
  const [preco, setPreco] = useState(initial?.preco?.toString() ?? "");
  const [precoM2, setPrecoM2] = useState(initial?.preco_m2?.toString() ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const isFirstMount = useRef(true);

  const persist = async () => {
    setError("");
    setLoading(true);
    const result = await saveLoteEscolhido(processoId, {
      cidade: cidade || undefined,
      condominio: condominio || undefined,
      recuos_permitidos: recuos || undefined,
      localizacao_condominio: localizacao || undefined,
      area_lote_m2: areaLote ? parseFloat(areaLote) : undefined,
      topografia: topografia || undefined,
      frente_m: frente ? parseFloat(frente) : undefined,
      fundo_m: fundo ? parseFloat(fundo) : undefined,
      preco: preco ? parseFloat(String(preco).replace(/\./g, "").replace(",", ".")) || undefined : undefined,
      preco_m2: precoM2 ? parseFloat(String(precoM2).replace(/\./g, "").replace(",", ".")) || undefined : undefined,
    });
    setLoading(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } else setError(result.error);
  };

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const t = setTimeout(persist, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [condominio, recuos, localizacao, areaLote, topografia, frente, fundo, preco, precoM2]);

  const escolherLote = (lote: LoteDisponivel) => {
    setCondominio(lote.condominio ?? "");
    setAreaLote(lote.area_lote_m2 != null ? String(lote.area_lote_m2) : "");
    setPreco(lote.preco != null ? String(lote.preco) : "");
    if (lote.area_lote_m2 != null && lote.area_lote_m2 > 0 && lote.preco != null) {
      setPrecoM2((lote.preco / lote.area_lote_m2).toFixed(2));
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-stone-600">
        Praça: <strong>{cidade}{estado ? `, ${estado}` : ""}</strong>. Selecione um lote da lista (Etapa 4) e preencha as informações adicionais abaixo.
      </p>

      {lotesDisponiveis.length > 0 && (
        <div>
          <h3 className="font-medium text-stone-800 mb-2">Lotes disponíveis (cadastrados na Etapa 4)</h3>
          <p className="text-xs text-stone-500 mb-3">Clique em &quot;Escolher este lote&quot; para preencher o formulário com os dados básicos. Depois complete recuos, localização, topografia e medidas.</p>
          <ul className="space-y-2">
            {lotesDisponiveis.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <span className="text-sm">
                  {l.condominio || "—"} — {l.area_lote_m2 ?? "—"} m² — R$ {l.preco != null ? l.preco.toLocaleString("pt-BR") : "—"}
                  {l.link && (
                    <a href={l.link} target="_blank" rel="noreferrer" className="ml-2 text-moni-accent hover:underline">Link</a>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => escolherLote(l)}
                  className="rounded-lg bg-moni-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-moni-secondary"
                >
                  Escolher este lote
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lotesDisponiveis.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Nenhum lote cadastrado ainda. Volte à <strong>Etapa 4</strong> para adicionar lotes à venda; depois retorne aqui para escolher um e preencher as informações adicionais.
        </p>
      )}

      <h3 className="font-medium text-stone-800">Informações do lote escolhido</h3>
      <p className="text-xs text-stone-500 mb-3">As alterações são salvas automaticamente após você parar de editar.</p>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700">Condomínio</label>
            <input type="text" value={condominio} onChange={(e) => setCondominio(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Recuos permitidos</label>
            <input type="text" value={recuos} onChange={(e) => setRecuos(e.target.value)} placeholder="Ex: 5m frente, 3m laterais" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Localização no condomínio</label>
            <input type="text" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex: perto da portaria, meio do condomínio" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Área do lote (m²)</label>
            <input type="number" step="0.01" value={areaLote} onChange={(e) => setAreaLote(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Topografia</label>
            <select value={topografia} onChange={(e) => setTopografia(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              <option value="plano">Plano</option>
              <option value="aclive">Aclive</option>
              <option value="declive">Declive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Frente (m)</label>
            <input type="number" step="0.01" value={frente} onChange={(e) => setFrente(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Fundo (m)</label>
            <input type="number" step="0.01" value={fundo} onChange={(e) => setFundo(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Preço oferta (R$)</label>
            <input type="text" value={preco} onChange={(e) => setPreco(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Preço/m² (R$)</label>
            <input type="text" value={precoM2} onChange={(e) => setPrecoM2(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Salvo automaticamente.</p>}
        {loading && <p className="text-sm text-stone-500">Salvando…</p>}
      </div>
    </div>
  );
}
