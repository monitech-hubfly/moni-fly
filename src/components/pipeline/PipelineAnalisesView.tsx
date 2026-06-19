'use client';

import { useMemo } from 'react';
import type { PipelineCardsDataset } from '@/lib/kanban/pipeline-cards-types';
import { enriquecerPipelineCard } from '@/lib/kanban/pipeline-cards-utils';
import { computePipelineAnalises } from '@/lib/kanban/pipeline-franqueadora-compute';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

function DataTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-[11px]">
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
            {headers.map((h) => (
              <th
                key={h}
                className="pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0"
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="py-2 pr-3 last:pr-0"
                  style={{ color: j === 0 ? 'var(--moni-text-primary)' : 'var(--moni-text-secondary)' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelBox({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4" style={panelStyle}>
      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
        {title}
      </h3>
      {hint ? (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {hint}
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}


type Props = {
  dataset: PipelineCardsDataset;
};

export function PipelineAnalisesView({ dataset }: Props) {
  const analises = useMemo(() => {
    const cards = dataset.cards.map(enriquecerPipelineCard);
    return computePipelineAnalises(dataset.franqueados, cards, dataset.enrichment);
  }, [dataset]);

  return (
    <div className="space-y-4">
      <PanelBox title="Franquias travadas" hint="Cards com 20+ dias na fase e sem movimentação (7+ dias).">
        <DataTable
          headers={['Unidade', 'Card', 'Fase', 'Dias parado']}
          rows={analises.franquiasTravadas.map((r) => [
            r.unidade,
            r.titulo,
            r.fase,
            String(r.diasParado),
          ])}
          emptyMessage="Nenhum card parado acima do limiar."
        />
      </PanelBox>

      <PanelBox
        title="Fases com mais atrasos na rede"
        hint="Se concentrado numa fase, é problema de processo."
      >
        <DataTable
          headers={['Fase', 'Funil', 'Atrasados', '% dos atrasos']}
          rows={analises.fasesComAtrasos.map((r) => [
            r.fase,
            r.funil,
            String(r.totalAtrasados),
            `${r.pctTotalAtrasos.toFixed(1).replace('.', ',')}%`,
          ])}
          emptyMessage="Nenhum card atrasado na rede."
        />
      </PanelBox>

      <PanelBox title="Benchmark por unidade" hint="Score = 100 − (% atrasados × 60) − (% parados × 40). FK0000 excluída.">
        <DataTable
          headers={['Unidade', 'Ativos', 'Atrasados', 'Taxa atraso', 'Score', '']}
          rows={analises.benchmarkUnidades.map((r) => [
            r.unidade,
            String(r.cardsAtivos),
            String(r.atrasados),
            `${r.taxaAtraso.toFixed(1).replace('.', ',')}%`,
            String(r.score),
            r.badge === 'verde' ? 'Alto' : r.badge === 'ambar' ? 'Médio' : 'Baixo',
          ])}
          emptyMessage="Sem unidades elegíveis."
        />
        <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Legenda: <span className="moni-tag-concluido text-[10px]">≥70</span>{' '}
          <span className="moni-tag-atencao text-[10px]">40–69</span>{' '}
          <span className="moni-tag-atrasado text-[10px]">&lt;40</span>
        </p>
      </PanelBox>

      <PanelBox
        title="Volume vs. conversão"
        hint="Unidades com muito Step One e pouco Portfólio aparecem no topo."
      >
        <DataTable
          headers={['Unidade', 'Step One', 'Portfólio', 'Operações', 'Contratos']}
          rows={analises.volumeConversao.map((r) => [
            r.unidade,
            String(r.stepOne),
            String(r.portfolio),
            String(r.operacoes),
            String(r.conversoes),
          ])}
          emptyMessage="Sem dados de volume."
        />
      </PanelBox>

      <PanelBox title="Silêncio no Sirene" hint="Unidades sem chamado nos últimos 30 dias.">
        <DataTable
          headers={['Unidade', 'Status', 'Último chamado']}
          rows={analises.sireneSilencio.map((r) => [
            r.unidade,
            r.ativo ? 'Ativo' : 'Sem chamado',
            r.ultimoChamadoEm
              ? new Date(r.ultimoChamadoEm).toLocaleDateString('pt-BR')
              : '—',
          ])}
          emptyMessage="Sem unidades na rede."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="moni-tag-atrasado text-[10px]">sem chamado</span>
          <span className="moni-tag-concluido text-[10px]">ativo</span>
        </div>
      </PanelBox>
    </div>
  );
}
