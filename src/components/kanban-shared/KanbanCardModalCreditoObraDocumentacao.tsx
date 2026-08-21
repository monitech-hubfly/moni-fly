'use client';

import { useState } from 'react';
import { salvarCreditoObraDocumentacao } from '@/lib/actions/kanban-credito-obra-docs';
import { urlDocumentacaoCreditoObraPreenchida } from '@/lib/kanban/kanban-card-sla';

export function KanbanCardModalCreditoObraDocumentacao({
  cardId,
  alvaraUrl,
  docsTerrenoUrl,
  faseSlug,
  basePath,
  onSaved,
}: {
  cardId: string;
  alvaraUrl: string | null;
  docsTerrenoUrl: string | null;
  faseSlug: string | null;
  basePath: string;
  onSaved: () => void | Promise<void>;
}) {
  const [alvara, setAlvara] = useState(() => String(alvaraUrl ?? '').trim());
  const [docsTerreno, setDocsTerreno] = useState(() => String(docsTerrenoUrl ?? '').trim());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSalvar() {
    setErro(null);
    setSalvando(true);
    try {
      const res = await salvarCreditoObraDocumentacao({
        cardId,
        alvara_url: alvara.trim() || null,
        docs_terreno_url: docsTerreno.trim() || null,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await onSaved();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3 text-xs text-stone-700">
      <p className="text-[11px] leading-snug text-stone-500">
        Informe os links do alvará e da documentação do terreno SPE. O SLA de 1 dia útil só começa após
        os dois campos estarem preenchidos.
      </p>
      <label className="block">
        <span className="font-medium text-stone-600">Alvará</span>
        <input
          type="url"
          value={alvara}
          onChange={(e) => setAlvara(e.target.value)}
          placeholder="https://…"
          className="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
      </label>
      <label className="block">
        <span className="font-medium text-stone-600">Docs Terreno SPE</span>
        <input
          type="url"
          value={docsTerreno}
          onChange={(e) => setDocsTerreno(e.target.value)}
          placeholder="https://…"
          className="mt-0.5 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
      </label>
      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">{erro}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleSalvar()}
        disabled={salvando}
        className="w-full rounded-lg border border-moni-primary bg-moni-primary px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'Salvar documentação'}
      </button>
      {urlDocumentacaoCreditoObraPreenchida(alvara) && urlDocumentacaoCreditoObraPreenchida(docsTerreno) ? (
        <p className="text-[11px] text-green-800">Documentação completa — SLA em contagem.</p>
      ) : null}
    </div>
  );
}
