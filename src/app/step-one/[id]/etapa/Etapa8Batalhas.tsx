'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveBatalha, saveCatalogoEscolhidos } from './actions';

type CasaZap = {
  id: string;
  condominio: string | null;
  area_casa_m2: number | null;
  quartos: number | null;
  preco: number | null;
};

type CasaCatalogo = {
  id: string;
  nome: string | null;
  area_m2: number | null;
  quartos: number | null;
  preco_venda: number | null;
};

type BatalhaRow = {
  listing_casa_id: string;
  catalogo_casa_id: string;
  nota_preco: number | null;
  nota_produto: number | null;
  nota_localizacao: number | null;
};

type CatalogoEscolhido = { catalogo_casa_id: string; ordem: number };

const NOTAS = [-2, -1, 0, 1, 2] as const;

function labelCatalogo(c: CasaCatalogo) {
  return `${c.nome ?? '—'} • ${c.area_m2 ?? '—'} m² • R$ ${c.preco_venda != null ? c.preco_venda.toLocaleString('pt-BR') : '—'}`;
}

export function Etapa8Batalhas({
  processoId,
  casas,
  catalogoEscolhidos,
  catalogo,
  batalhas,
}: {
  processoId: string;
  casas: CasaZap[];
  catalogoEscolhidos: CatalogoEscolhido[];
  catalogo: CasaCatalogo[];
  batalhas: BatalhaRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [selecao, setSelecao] = useState<[string, string, string] | null>(() => {
    if (catalogoEscolhidos.length === 3) {
      const ord = [...catalogoEscolhidos].sort((a, b) => a.ordem - b.ordem);
      return [ord[0].catalogo_casa_id, ord[1].catalogo_casa_id, ord[2].catalogo_casa_id];
    }
    return null;
  });

  const tresModelosEscolhidos = catalogoEscolhidos.length === 3;
  const modelosParaBatalhas = tresModelosEscolhidos
    ? catalogoEscolhidos
        .sort((a, b) => a.ordem - b.ordem)
        .map((ce) => catalogo.find((c) => c.id === ce.catalogo_casa_id))
        .filter((c): c is CasaCatalogo => c != null)
    : [];

  const getNotas = (listingId: string, catalogoId: string) => {
    const b = batalhas.find(
      (x) => x.listing_casa_id === listingId && x.catalogo_casa_id === catalogoId,
    );
    return {
      nota_preco: b?.nota_preco ?? null,
      nota_produto: b?.nota_produto ?? null,
      nota_localizacao: b?.nota_localizacao ?? null,
    };
  };

  const handleChange = async (
    listingCasaId: string,
    catalogoCasaId: string,
    campo: 'nota_preco' | 'nota_produto' | 'nota_localizacao',
    valor: number | null,
  ) => {
    const atuais = getNotas(listingCasaId, catalogoCasaId);
    const payload = { ...atuais, [campo]: valor };
    setError('');
    setSaving(`${listingCasaId}-${catalogoCasaId}`);
    const result = await saveBatalha(processoId, listingCasaId, catalogoCasaId, {
      nota_preco: payload.nota_preco ?? undefined,
      nota_produto: payload.nota_produto ?? undefined,
      nota_localizacao: payload.nota_localizacao ?? undefined,
    });
    setSaving(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  const handleSalvarTresModelos = async () => {
    const ids = selecao;
    if (!ids || ids[0] === '' || ids[1] === '' || ids[2] === '') {
      setError('Selecione 3 modelos do catálogo diferentes.');
      return;
    }
    const uniq = [...new Set(ids)];
    if (uniq.length !== 3) {
      setError('Os 3 modelos devem ser diferentes.');
      return;
    }
    setError('');
    setLoadingSalvar(true);
    const result = await saveCatalogoEscolhidos(processoId, [ids[0], ids[1], ids[2]]);
    setLoadingSalvar(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  if (casas.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Nenhuma casa listada na Etapa 5. Adicione casas à venda na Etapa 5 e volte aqui para
        escolher 3 modelos do catálogo e preencher as batalhas (preço, produto, localização).
      </div>
    );
  }

  if (catalogo.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Nenhum modelo no catálogo Moní. Configure a tabela <code>catalogo_casas</code> no Supabase.
      </div>
    );
  }

  if (catalogo.length < 3) {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        O catálogo Moní precisa ter pelo menos <strong>3 modelos</strong> para você escolher os 3
        que vão batalhar com as casas da ZAP. Cadastre mais modelos no Supabase (tabela{' '}
        <code>catalogo_casas</code>).
      </div>
    );
  }

  if (!tresModelosEscolhidos) {
    const sel = selecao ?? ['', '', ''];
    return (
      <div className="mt-6 space-y-6">
        <p className="text-sm text-stone-600">
          Escolha <strong>3 modelos do catálogo Moní</strong> que vão batalhar com{' '}
          <strong>todas as casas listadas na ZAP</strong>. Depois você preenche as notas (preço,
          produto, localização) para cada casa ZAP × cada um desses 3 modelos. Os mesmos 3 modelos
          serão usados no BCA.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/80 p-4">
          <h3 className="font-medium text-stone-800">
            Selecione 3 modelos do catálogo (ordem 1, 2 e 3)
          </h3>
          {([0, 1, 2] as const).map((i) => (
            <div key={i}>
              <label className="mb-1 block text-xs text-stone-600">Modelo {i + 1}</label>
              <select
                value={sel[i]}
                onChange={(e) => {
                  const v = e.target.value;
                  const next: [string, string, string] = [...sel];
                  next[i] = v;
                  setSelecao(next);
                }}
                className="w-full max-w-md rounded border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="">— Escolha —</option>
                {catalogo.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={sel.filter((x) => x === c.id).length >= 1 && sel[i] !== c.id}
                  >
                    {labelCatalogo(c)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={handleSalvarTresModelos}
            disabled={
              loadingSalvar ||
              sel[0] === '' ||
              sel[1] === '' ||
              sel[2] === '' ||
              new Set(sel).size !== 3
            }
            className="btn-primary"
          >
            {loadingSalvar ? 'Salvando…' : 'Salvar 3 modelos escolhidos'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-stone-600">
        Batalhas: <strong>todas as casas listadas na ZAP</strong> ×{' '}
        <strong>3 modelos do catálogo Moní</strong> escolhidos. Notas de -2 a +2 (preço, produto,
        localização). As alterações são salvas automaticamente.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-6 overflow-x-auto">
        {casas.map((casa) => {
          const mediaPorModelo = modelosParaBatalhas.map((cat) => {
            const n = getNotas(casa.id, cat.id);
            const vals = [n.nota_preco, n.nota_produto, n.nota_localizacao].filter(
              (v): v is number => v != null,
            );
            const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            return { cat, notas: n, media };
          });
          const mediasValidas = mediaPorModelo
            .map((x) => x.media)
            .filter((v): v is number => v != null);
          const mediaGeral =
            mediasValidas.length > 0
              ? mediasValidas.reduce((a, b) => a + b, 0) / mediasValidas.length
              : null;

          return (
            <div key={casa.id} className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
              <h3 className="mb-2 font-medium text-stone-800">
                Casa ZAP — {casa.condominio || '—'} • {casa.area_casa_m2 ?? '—'} m² •{' '}
                {casa.quartos ?? '—'} quartos • R${' '}
                {casa.preco != null ? casa.preco.toLocaleString('pt-BR') : '—'}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modelosParaBatalhas.map((cat) => {
                  const n = getNotas(casa.id, cat.id);
                  const cellKey = `${casa.id}-${cat.id}`;
                  const isSaving = saving === cellKey;
                  return (
                    <div
                      key={cat.id}
                      className="rounded border border-stone-200 bg-white p-3 text-sm"
                    >
                      <p className="mb-2 font-medium text-stone-700">{cat.nome ?? '—'}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-stone-500">Preço</label>
                          <select
                            value={n.nota_preco ?? ''}
                            onChange={(e) =>
                              handleChange(
                                casa.id,
                                cat.id,
                                'nota_preco',
                                e.target.value === '' ? null : parseInt(e.target.value, 10),
                              )
                            }
                            disabled={isSaving}
                            className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm"
                          >
                            <option value="">—</option>
                            {NOTAS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500">Produto</label>
                          <select
                            value={n.nota_produto ?? ''}
                            onChange={(e) =>
                              handleChange(
                                casa.id,
                                cat.id,
                                'nota_produto',
                                e.target.value === '' ? null : parseInt(e.target.value, 10),
                              )
                            }
                            disabled={isSaving}
                            className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm"
                          >
                            <option value="">—</option>
                            {NOTAS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500">Local.</label>
                          <select
                            value={n.nota_localizacao ?? ''}
                            onChange={(e) =>
                              handleChange(
                                casa.id,
                                cat.id,
                                'nota_localizacao',
                                e.target.value === '' ? null : parseInt(e.target.value, 10),
                              )
                            }
                            disabled={isSaving}
                            className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm"
                          >
                            <option value="">—</option>
                            {NOTAS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {isSaving && <p className="mt-1 text-xs text-stone-500">Salvando…</p>}
                    </div>
                  );
                })}
              </div>
              {mediaGeral != null && !Number.isNaN(mediaGeral) && (
                <p className="mt-2 text-xs text-stone-600">
                  Média desta casa ZAP vs. os 3 modelos: <strong>{mediaGeral.toFixed(2)}</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
