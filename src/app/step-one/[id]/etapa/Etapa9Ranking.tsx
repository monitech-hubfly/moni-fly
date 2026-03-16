'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveEtapa9 } from './actions';

type BatalhaRow = {
  listing_casa_id: string;
  catalogo_casa_id: string;
  nota_preco: number | null;
  nota_produto: number | null;
  nota_localizacao: number | null;
};

type CatalogoEscolhido = { catalogo_casa_id: string; ordem: number };

type CasaCatalogo = {
  id: string;
  nome: string | null;
  area_m2: number | null;
  quartos: number | null;
  preco_venda: number | null;
  preco_venda_m2?: number | null;
};

function computeRanking(
  batalhas: BatalhaRow[],
  catalogoEscolhidos: CatalogoEscolhido[],
  catalogo: CasaCatalogo[],
) {
  const ids = catalogoEscolhidos.sort((a, b) => a.ordem - b.ordem).map((ce) => ce.catalogo_casa_id);

  const byCatalogo = ids.map((catalogoId) => {
    const rows = batalhas.filter((b) => b.catalogo_casa_id === catalogoId);
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const p = r.nota_preco ?? 0;
      const pr = r.nota_produto ?? 0;
      const l = r.nota_localizacao ?? 0;
      sum += p + pr + l;
      count += 1;
    }
    const media = count > 0 ? sum / count : 0;
    const casa = catalogo.find((c) => c.id === catalogoId);
    return {
      catalogo_casa_id: catalogoId,
      nome: casa?.nome ?? '—',
      media,
      batalhasCount: count,
    };
  });

  byCatalogo.sort((a, b) => b.media - a.media);
  return byCatalogo.map((item, index) => ({ ...item, posicao: index + 1 }));
}

export function Etapa9Ranking({
  processoId,
  batalhas,
  catalogoEscolhidos,
  catalogo,
  initialJustificativas = {},
}: {
  processoId: string;
  batalhas: BatalhaRow[];
  catalogoEscolhidos: CatalogoEscolhido[];
  catalogo: CasaCatalogo[];
  initialJustificativas?: Record<string, string>;
}) {
  const router = useRouter();
  const [justificativas, setJustificativas] =
    useState<Record<string, string>>(initialJustificativas);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ranking = computeRanking(batalhas, catalogoEscolhidos, catalogo);

  const handleJustificativaChange = useCallback(
    (catalogoId: string, value: string) => {
      const next = { ...justificativas, [catalogoId]: value };
      setJustificativas(next);
      setSaving(true);
      saveEtapa9(processoId, { justificativas: next })
        .then((r) => {
          if (!r.ok) setError(r.error);
        })
        .finally(() => setSaving(false));
    },
    [justificativas, processoId],
  );

  const handleConcluir = async () => {
    setError('');
    setSaving(true);
    const res = await saveEtapa9(processoId, { justificativas, concluida: true });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  };

  if (catalogoEscolhidos.length !== 3) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Conclua a Etapa 8 escolhendo 3 modelos do catálogo para ver o ranking aqui.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-stone-600">
        Ranking dos 3 modelos do catálogo com base na média das notas (preço + produto +
        localização) nas batalhas contra as casas ZAP.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border border-stone-200 text-sm">
          <thead>
            <tr className="bg-stone-100">
              <th className="w-16 p-2 text-left">Posição</th>
              <th className="p-2 text-left">Modelo</th>
              <th className="p-2 text-right">Média (notas)</th>
              <th className="p-2 text-right">Batalhas</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.catalogo_casa_id} className="border-t border-stone-200">
                <td className="p-2 font-medium">{r.posicao}º</td>
                <td className="p-2">{r.nome}</td>
                <td className="p-2 text-right">{r.media.toFixed(2)}</td>
                <td className="p-2 text-right">{r.batalhasCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-stone-800">Por quê? (opcional)</h3>
        {ranking.map((r) => (
          <div key={r.catalogo_casa_id}>
            <label className="mb-1 block text-sm text-stone-600">
              {r.posicao}º — {r.nome}
            </label>
            <textarea
              className="min-h-[80px] w-full rounded border border-stone-300 p-2 text-sm"
              value={justificativas[r.catalogo_casa_id] ?? ''}
              onChange={(e) => handleJustificativaChange(r.catalogo_casa_id, e.target.value)}
              placeholder="Breve justificativa..."
            />
          </div>
        ))}
      </div>

      {saving && <p className="text-sm text-stone-500">Salvando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={handleConcluir} disabled={saving} className="btn-primary">
        {saving ? 'Salvando...' : 'Marcar etapa como concluída'}
      </button>
    </div>
  );
}
