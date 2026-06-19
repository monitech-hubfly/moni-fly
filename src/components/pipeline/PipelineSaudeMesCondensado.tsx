'use client';

import type { PipelineUnidadeSaudeMes } from '@/lib/kanban/pipeline-cards-types';
import { metaAtingidaSaude } from '@/lib/kanban/pipeline-unidade-compute';

type Props = {
  saude: PipelineUnidadeSaudeMes;
  className?: string;
};

function MetaMiniBar({
  valor,
  meta,
  atingida,
}: {
  valor: number;
  meta: number;
  atingida: boolean;
}) {
  const pct = meta <= 0 ? 0 : Math.min(100, Math.round((valor / meta) * 100));
  return (
    <div
      className="h-1.5 min-w-[4.5rem] flex-1 overflow-hidden rounded-full"
      style={{ background: 'var(--moni-rede-chart-track)', maxHeight: '6px', height: '6px' }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: atingida ? 'var(--moni-kanban-portfolio)' : 'var(--moni-gold-400)',
        }}
      />
    </div>
  );
}

export function PipelineSaudeMesCondensado({ saude, className }: Props) {
  const metas = metaAtingidaSaude(saude);
  const metaGeralAtingida = metas.entradas && metas.contratos;

  const metaCor = (atingida: boolean): string =>
    atingida ? 'var(--moni-kanban-portfolio)' : 'var(--moni-gold-400)';

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span style={{ color: 'var(--moni-text-secondary)' }}>
          Entradas:{' '}
          <span className="tabular-nums font-medium" style={{ color: metaCor(metas.entradas) }}>
            {saude.entradasMes}/{saude.metaEntradas}
          </span>
          <span style={{ color: 'var(--moni-text-tertiary)' }}> · </span>
          Contratos:{' '}
          <span className="tabular-nums font-medium" style={{ color: metaCor(metas.contratos) }}>
            {saude.contratosMes}/{saude.metaContratos}
          </span>
        </span>
        {metaGeralAtingida ? (
          <span className="moni-tag-concluido text-[10px]">meta atingida</span>
        ) : (
          <span className="moni-tag-atencao text-[10px]">abaixo da meta</span>
        )}
      </div>
      <div className="mt-1.5 flex gap-2">
        <MetaMiniBar valor={saude.entradasMes} meta={saude.metaEntradas} atingida={metas.entradas} />
        <MetaMiniBar valor={saude.contratosMes} meta={saude.metaContratos} atingida={metas.contratos} />
      </div>
    </div>
  );
}

/** Meta inline no header colapsado — "Entradas X/5" + "Contratos X/1". */
export function PipelineSaudeMesInline({ saude }: { saude: PipelineUnidadeSaudeMes }) {
  const metas = metaAtingidaSaude(saude);
  const metaCor = (atingida: boolean): string =>
    atingida ? 'var(--moni-kanban-portfolio)' : 'var(--moni-gold-400)';

  return (
    <span className="text-[10px] tabular-nums" style={{ color: 'var(--moni-text-tertiary)' }}>
      Entradas{' '}
      <span style={{ color: metaCor(metas.entradas) }}>
        {saude.entradasMes}/{saude.metaEntradas}
      </span>
      <span style={{ color: 'var(--moni-text-tertiary)' }}> · </span>
      Contratos{' '}
      <span style={{ color: metaCor(metas.contratos) }}>
        {saude.contratosMes}/{saude.metaContratos}
      </span>
    </span>
  );
}
