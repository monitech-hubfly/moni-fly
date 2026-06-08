'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Etapa4Casas } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import {
  carregarMapaCompetidoresChecklist,
  type MapaCompetidoresChecklistData,
} from '@/lib/actions/kanban-mapa-competidores';

type Props = {
  processoId: string;
  itemLabel: string;
  podeEditar: boolean;
};

export function MapaCompetidoresChecklist({ processoId, itemLabel, podeEditar }: Props) {
  const [dados, setDados] = useState<MapaCompetidoresChecklistData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const pid = processoId?.trim();
    if (!pid) {
      setDados({ ok: false, error: 'Processo Step One não vinculado a este card.' });
      setCarregando(false);
      return;
    }

    let cancelado = false;
    void (async () => {
      setCarregando(true);
      try {
        const res = await carregarMapaCompetidoresChecklist(pid);
        if (!cancelado) setDados(res);
      } catch {
        if (!cancelado) setDados({ ok: false, error: 'Falha ao carregar listagem de casas.' });
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [processoId, tick]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 size={14} className="animate-spin" />
        Carregando {itemLabel.toLowerCase()}…
      </div>
    );
  }

  if (!dados?.ok) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {itemLabel}
        </p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {dados?.error ?? 'Processo Step One não vinculado a este card.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
        {itemLabel}
        <span className="ml-1 text-red-500">*</span>
      </p>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <Etapa4Casas
          listagemOnly
          readOnly={!podeEditar}
          processoId={dados.processoId}
          casas={dados.casas}
          cidadeInicial={dados.cidadeInicial}
          estadoInicial={dados.estadoInicial}
          ultimaValidacaoCasasManuaisEm={dados.ultimaValidacaoCasasManuaisEm}
          casasEscolhidas={[]}
          catalogo={[]}
          batalhasIniciais={[]}
          onMutate={recarregar}
        />
      </div>
    </div>
  );
}
