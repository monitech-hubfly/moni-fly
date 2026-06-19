'use client';

import type { PipelineUnidadeSaudeMes } from '@/lib/kanban/pipeline-cards-types';
import { metaAtingidaSaude } from '@/lib/kanban/pipeline-unidade-compute';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

function MetaBar({
  label,
  valor,
  meta,
  atingida,
}: {
  label: string;
  valor: number;
  meta: number;
  atingida: boolean;
}) {
  const pct = meta <= 0 ? 0 : Math.min(100, Math.round((valor / meta) * 100));
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
            {valor}/{meta}
          </span>
          {atingida ? (
            <span className="moni-tag-concluido text-[10px]">meta atingida</span>
          ) : (
            <span className="moni-tag-atencao text-[10px]">abaixo da meta</span>
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--moni-rede-chart-track)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: atingida ? 'var(--moni-kanban-portfolio)' : 'var(--moni-gold-400)',
          }}
        />
      </div>
    </div>
  );
}

export function PipelineUnidadeSaudeCard({ saude }: { saude: PipelineUnidadeSaudeMes }) {
  const metas = metaAtingidaSaude(saude);

  return (
    <div className="mb-6 px-4 py-4" style={panelStyle}>
      <h3
        className="text-[13px] font-semibold"
        style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
      >
        Pipeline de saúde — mês atual
      </h3>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Meta: {saude.metaEntradas} entradas / {saude.metaContratos} contrato assinado
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <MetaBar label="Entradas no mês" valor={saude.entradasMes} meta={saude.metaEntradas} atingida={metas.entradas} />
        <MetaBar
          label="Contratos assinados"
          valor={saude.contratosMes}
          meta={saude.metaContratos}
          atingida={metas.contratos}
        />
      </div>
    </div>
  );
}
