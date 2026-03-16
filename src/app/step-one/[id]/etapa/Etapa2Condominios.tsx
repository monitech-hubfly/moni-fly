"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  buscarCondominiosViaZap,
  saveChecklistCondominio,
  saveEtapa2,
  type CondominioEtapa2,
  type ChecklistCondominioInput,
} from "./actions";

type ChecklistFormState = ChecklistCondominioInput;

export function Etapa2Condominios({
  processoId,
  condominios,
  initialConcluida,
}: {
  processoId: string;
  condominios: CondominioEtapa2[];
  initialConcluida: boolean;
}) {
  const router = useRouter();
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [concluida, setConcluida] = useState(initialConcluida);
  const [savingEtapa, setSavingEtapa] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, ChecklistFormState>>({});

  const handleBuscar = async () => {
    setError("");
    setLoadingBusca(true);
    const res = await buscarCondominiosViaZap(processoId);
    setLoadingBusca(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  const handleChangeField = (condominioId: string, field: keyof ChecklistFormState, value: string) => {
    setForms((prev) => {
      const current = prev[condominioId] ?? {};
      let parsed: string | number | null = value;
      if (
        [
          "lotes_total",
          "lotes_disponiveis",
          "lotes_tamanho_medio",
          "lotes_preco_m2",
          "casas_prontas",
          "casas_construindo",
          "casas_construindo_venda",
          "casas_construindo_cliente",
          "casas_para_venda",
          "casas_preco_m2",
          "casas_tempo_medio_venda",
          "casas_vendidas_12m",
        ].includes(field)
      ) {
        const num = value.trim() === "" ? null : Number(value.replace(/\./g, "").replace(",", "."));
        parsed = Number.isFinite(num as number) ? (num as number) : null;
      }
      return {
        ...prev,
        [condominioId]: {
          ...current,
          [field]: parsed,
        },
      };
    });
  };

  const handleSalvarChecklist = async (condominioId: string) => {
    setError("");
    setSavingChecklistId(condominioId);
    const input = forms[condominioId] ?? {};
    const res = await saveChecklistCondominio(processoId, condominioId, input);
    setSavingChecklistId(null);
    if (!res.ok) {
      setError(res.error);
    }
  };

  const handleConcluir = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSavingEtapa(true);
    const res = await saveEtapa2(processoId, { concluida });
    setSavingEtapa(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  };

  const hasCondominios = condominios.length > 0;

  return (
    <div className="mt-6 space-y-8">
      {/* Seção 1 — Busca de condomínios */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800">Seção 1 — Busca de condomínios</h2>
        <p className="mt-1 text-sm text-stone-600">
          Reutiliza a integração ZAP para listar condomínios da cidade com casas <strong>&gt; 5 MM</strong>. A busca usa apenas cidade e estado do processo (sem filtro de bairro/condomínio).
        </p>
        <button
          type="button"
          onClick={handleBuscar}
          disabled={loadingBusca}
          className="mt-4 btn-primary text-sm"
        >
          {loadingBusca ? "Buscando condomínios…" : "Buscar condomínios"}
        </button>

        {hasCondominios && (
          <div className="mt-4 rounded-lg border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200">
                  <th className="p-2 text-left">Condomínio</th>
                  <th className="p-2 text-center w-32">Qtd. casas</th>
                  <th className="p-2 text-center w-40">Preço médio</th>
                  <th className="p-2 text-center w-40">m² médio</th>
                  <th className="p-2 w-32" />
                </tr>
              </thead>
              <tbody>
                {condominios.map((c) => (
                  <tr key={c.id} className="border-b border-stone-100">
                    <td className="p-2 text-sm font-medium text-moni-dark">{c.nome}</td>
                    <td className="p-2 text-center">
                      {c.qtd_casas ?? "—"}
                    </td>
                    <td className="p-2 text-center">
                      {c.preco_medio != null
                        ? c.preco_medio.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 0,
                          })
                        : "—"}
                    </td>
                    <td className="p-2 text-center">
                      {c.m2_medio != null
                        ? `${c.m2_medio.toLocaleString("pt-BR", {
                            maximumFractionDigits: 1,
                          })} m²`
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === c.id ? null : c.id))
                        }
                        className="text-xs font-medium text-moni-accent hover:underline"
                      >
                        {expandedId === c.id ? "Fechar checklist" : "Abrir checklist"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Seção 2 — Checklist por condomínio */}
      {hasCondominios && (
        <section className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
          <h2 className="text-lg font-semibold text-stone-800">Seção 2 — Checklist por condomínio</h2>
          <p className="mt-1 text-sm text-stone-600">
            Para cada condomínio, preencha o checklist com informações de lotes, casas e locação.
          </p>

          <div className="mt-4 space-y-4">
            {condominios.map((c) => {
              const form = forms[c.id] ?? {};
              const isOpen = expandedId === c.id;
              return (
                <div key={c.id} className="rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((prev) => (prev === c.id ? null : c.id))
                    }
                    className="flex w-full items-center justify-between px-4 py-2 text-left"
                  >
                    <span className="font-medium text-stone-800">{c.nome}</span>
                    <span className="text-xs text-stone-500">
                      {isOpen ? "Recolher" : "Expandir"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-stone-200 px-4 py-3 space-y-5">
                      {/* Bloco A — Lotes */}
                      <div>
                        <h3 className="text-sm font-semibold text-stone-800 mb-2">
                          Bloco A — Lotes
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quantos lotes o condomínio tem?
                            </label>
                            <input
                              type="number"
                              value={form.lotes_total ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "lotes_total", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quantos estão disponíveis para venda?
                            </label>
                            <input
                              type="number"
                              value={form.lotes_disponiveis ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "lotes_disponiveis", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Tamanho médio dos lotes (m²)
                            </label>
                            <input
                              type="number"
                              value={form.lotes_tamanho_medio ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "lotes_tamanho_medio", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Preço médio do m² de venda (R$)
                            </label>
                            <input
                              type="number"
                              value={form.lotes_preco_m2 ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "lotes_preco_m2", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Qual a área mais valorizada e com maior demanda?
                          </label>
                          <textarea
                            rows={2}
                            value={form.lotes_area_valorizada ?? ""}
                            onChange={(e) =>
                              handleChangeField(c.id, "lotes_area_valorizada", e.target.value)
                            }
                            className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      {/* Bloco B — Casas e construções */}
                      <div>
                        <h3 className="text-sm font-semibold text-stone-800 mb-2">
                          Bloco B — Casas e construções
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quantas casas estão prontas?
                            </label>
                            <input
                              type="number"
                              value={form.casas_prontas ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "casas_prontas", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quantas casas estão sendo construídas?
                            </label>
                            <input
                              type="number"
                              value={form.casas_construindo ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "casas_construindo", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Dessas, quantas para venda?
                            </label>
                            <input
                              type="number"
                              value={form.casas_construindo_venda ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_construindo_venda",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Dessas, quantas para cliente final?
                            </label>
                            <input
                              type="number"
                              value={form.casas_construindo_cliente ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_construindo_cliente",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quantas casas estão para venda?
                            </label>
                            <input
                              type="number"
                              value={form.casas_para_venda ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "casas_para_venda", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Preço do m² de venda das casas (R$)
                            </label>
                            <input
                              type="number"
                              value={form.casas_preco_m2 ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "casas_preco_m2", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Tempo médio de venda após pronta (meses)
                            </label>
                            <input
                              type="number"
                              value={form.casas_tempo_medio_venda ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_tempo_medio_venda",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Casas vendidas nos últimos 12 meses
                            </label>
                            <input
                              type="number"
                              value={form.casas_vendidas_12m ?? ""}
                              onChange={(e) =>
                                handleChangeField(c.id, "casas_vendidas_12m", e.target.value)
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              O que fez as casas remanescentes demorarem para vender?
                            </label>
                            <textarea
                              rows={2}
                              value={form.casas_remanescentes_motivo ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_remanescentes_motivo",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quais características impactaram negativamente a liquidez?
                            </label>
                            <textarea
                              rows={2}
                              value={form.casas_impacto_negativo ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_impacto_negativo",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Quais erros de projeto você identificou?
                            </label>
                            <textarea
                              rows={2}
                              value={form.casas_erros_projeto ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_erros_projeto",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Características mais elogiadas pelos clientes que compraram
                            </label>
                            <textarea
                              rows={2}
                              value={form.casas_caracteristicas_elogiadas ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_caracteristicas_elogiadas",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Características que clientes buscam mas não encontram
                            </label>
                            <textarea
                              rows={2}
                              value={form.casas_caracteristicas_buscadas ?? ""}
                              onChange={(e) =>
                                handleChangeField(
                                  c.id,
                                  "casas_caracteristicas_buscadas",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bloco C — Locação */}
                      <div>
                        <h3 className="text-sm font-semibold text-stone-800 mb-2">
                          Bloco C — Locação
                        </h3>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Qual o valor das casas para locação? (Frank adiciona exemplos)
                        </label>
                        <textarea
                          rows={2}
                          value={form.locacao_exemplos ?? ""}
                          onChange={(e) =>
                            handleChangeField(c.id, "locacao_exemplos", e.target.value)
                          }
                          className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSalvarChecklist(c.id)}
                        disabled={savingChecklistId === c.id}
                        className="mt-3 btn-primary text-sm"
                      >
                        {savingChecklistId === c.id ? "Salvando checklist…" : "Salvar checklist"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleConcluir} className="pt-4 border-t border-stone-200">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={concluida}
            onChange={(e) => setConcluida(e.target.checked)}
            className="rounded border-stone-300"
          />
          Marcar etapa 2 como concluída
        </label>
        <button type="submit" disabled={savingEtapa} className="mt-2 btn-primary text-sm">
          Salvar e avançar
        </button>
      </form>
    </div>
  );
}
