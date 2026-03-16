"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveEtapa3,
  type ResumoCondominioRow,
  type ConclusaoEtapa3,
} from "./actions";

type Condominio = { id: string; nome: string; ordem: number };

const CONCLUSAO_CAMPOS: { key: keyof ConclusaoEtapa3; label: string }[] = [
  { key: "mais_promissores", label: "Condomínios mais promissores e por quê" },
  { key: "faixa_preco", label: "Faixa de preço (R$/m²) com maior liquidez" },
  { key: "produto_mais_vende", label: "Produto que mais vende atualmente" },
  { key: "erros", label: "Principais erros observados no mercado local" },
  { key: "oportunidade", label: "Oportunidade clara para novo projeto" },
];

export function Etapa3Resumo({
  processoId,
  condominios,
  initialResumo,
  initialConclusao,
  initialConcluida,
}: {
  processoId: string;
  condominios: Condominio[];
  initialResumo: Record<string, ResumoCondominioRow>;
  initialConclusao: ConclusaoEtapa3;
  initialConcluida: boolean;
}) {
  const router = useRouter();
  const [resumo, setResumo] = useState<Record<string, ResumoCondominioRow>>(initialResumo);
  const [conclusao, setConclusao] = useState<ConclusaoEtapa3>(initialConclusao);
  const [concluida, setConcluida] = useState(initialConcluida);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateResumo = (condominioId: string, field: keyof ResumoCondominioRow, value: string) => {
    setResumo((prev) => ({
      ...prev,
      [condominioId]: { ...(prev[condominioId] ?? {}), [field]: value },
    }));
  };

  const handleSaveResumo = async () => {
    setError("");
    setLoading(true);
    const res = await saveEtapa3(processoId, { resumo_condominios: resumo });
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  };

  const handleSaveConclusao = async () => {
    setError("");
    setLoading(true);
    const res = await saveEtapa3(processoId, { conclusao });
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  };

  const handleConcluir = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await saveEtapa3(processoId, { resumo_condominios: resumo, conclusao, concluida: true });
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  };

  if (condominios.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Conclua a Etapa 2 (Condomínios e checklist) adicionando ao menos um condomínio para preencher a tabela resumo aqui.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-stone-600">
        Tabela resumo por condomínio e conclusão (ranking, faixa de preço, produto que mais vende, erros, oportunidade).
      </p>

      <section>
        <h3 className="font-medium text-stone-800 mb-2">Tabela por condomínio</h3>
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200">
                <th className="p-2 text-left">Condomínio</th>
                <th className="p-2 text-left">Estoque casas à venda</th>
                <th className="p-2 text-left">Ticket médio lote (R$)</th>
                <th className="p-2 text-left">Ticket médio casas (R$)</th>
                <th className="p-2 text-left">Ticket casas (R$/m²)</th>
                <th className="p-2 text-left">Estimativa vendidas/ano</th>
              </tr>
            </thead>
            <tbody>
              {condominios.map((c) => (
                <tr key={c.id} className="border-b border-stone-100">
                  <td className="p-2 font-medium">{c.nome}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={resumo[c.id]?.estoque_casas ?? ""}
                      onChange={(e) => updateResumo(c.id, "estoque_casas", e.target.value)}
                      className="w-full max-w-[120px] rounded border border-stone-300 p-1.5 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={resumo[c.id]?.ticket_lote ?? ""}
                      onChange={(e) => updateResumo(c.id, "ticket_lote", e.target.value)}
                      className="w-full max-w-[120px] rounded border border-stone-300 p-1.5 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={resumo[c.id]?.ticket_casas ?? ""}
                      onChange={(e) => updateResumo(c.id, "ticket_casas", e.target.value)}
                      className="w-full max-w-[120px] rounded border border-stone-300 p-1.5 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={resumo[c.id]?.ticket_casas_m2 ?? ""}
                      onChange={(e) => updateResumo(c.id, "ticket_casas_m2", e.target.value)}
                      className="w-full max-w-[120px] rounded border border-stone-300 p-1.5 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={resumo[c.id]?.estimativa_vendidas_ano ?? ""}
                      onChange={(e) => updateResumo(c.id, "estimativa_vendidas_ano", e.target.value)}
                      className="w-full max-w-[120px] rounded border border-stone-300 p-1.5 text-sm"
                      placeholder="—"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={handleSaveResumo}
          disabled={loading}
          className="mt-2 btn-primary text-sm"
        >
          Salvar tabela
        </button>
      </section>

      <section>
        <h3 className="font-medium text-stone-800 mb-2">Conclusão</h3>
        <div className="space-y-3">
          {CONCLUSAO_CAMPOS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
              <textarea
                value={conclusao[key] ?? ""}
                onChange={(e) => setConclusao((prev) => ({ ...prev, [key]: e.target.value }))}
                rows={2}
                className="w-full rounded border border-stone-300 p-2 text-sm"
                placeholder="—"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSaveConclusao}
          disabled={loading}
          className="mt-2 btn-primary text-sm"
        >
          Salvar conclusão
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleConcluir} className="pt-4 border-t border-stone-200">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={concluida}
            onChange={(e) => setConcluida(e.target.checked)}
            className="rounded border-stone-300"
          />
          Marcar etapa 3 como concluída
        </label>
        <button type="submit" disabled={loading} className="mt-2 btn-primary text-sm">
          Salvar e avançar para Etapa 4
        </button>
      </form>
    </div>
  );
}
