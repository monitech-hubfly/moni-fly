'use client';

import dynamic from 'next/dynamic';

const MapaPraca = dynamic(() => import('@/app/step-one/[id]/etapa/MapaPraca').then((m) => m.MapaPraca), {
  ssr: false,
});

type Props = {
  cidade: string;
  estado: string | null;
  /** Exibe título "Seção 2 — Mapa interativo" (padrão step-one legado). */
  showHeading?: boolean;
};

export function MapaInterativoSecao({ cidade, estado, showHeading = true }: Props) {
  if (!cidade.trim()) {
    return (
      <p className="text-sm italic text-stone-500">
        Informe cidade e estado no processo para exibir o mapa interativo.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      {showHeading ? (
        <h2 className="text-lg font-semibold text-stone-800">Seção 2 — Mapa interativo</h2>
      ) : null}
      <div className={showHeading ? 'mt-4' : ''}>
        <MapaPraca cidade={cidade} estado={estado} />
      </div>
    </section>
  );
}
