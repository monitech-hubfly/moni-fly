'use client';

/**
 * 5 cards de resumo do diagnóstico da rede — exibidos acima da tabela.
 */

import { calcRedeMetricas, engajamentoHex } from '@/lib/rede-diagnostico-engine';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';

interface Props {
  rows: RedeFranqueadoRowDb[];
}

function Card({
  label,
  value,
  sub,
  color,
  mini,
  tooltip,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  mini?: { label: string; value: string | number; highlight?: boolean }[];
  tooltip?: string;
}) {
  return (
    <div className="group relative min-w-[130px] flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      {tooltip ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-stone-200 bg-white p-2.5 text-[10px] leading-relaxed text-stone-600 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {tooltip}
        </div>
      ) : null}
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
      <p
        className="text-[22px] font-extrabold leading-none"
        style={{ color: color ?? 'var(--moni-navy-800, #0C2633)' }}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-stone-400">{sub}</p> : null}
      {mini && mini.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
          {mini.map((item) => (
            <span key={item.label} className="text-[9.5px] text-stone-500">
              <span
                className="font-semibold"
                style={item.highlight ? { color: 'var(--moni-red-700, #b91c1c)' } : undefined}
              >
                {item.value}
              </span>{' '}
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DiagnosticoRedeSumario({ rows }: Props) {
  if (!rows || rows.length === 0) return null;

  const m = calcRedeMetricas(rows);

  const engValue = m.avgEng !== null ? `${m.avgEng}%` : '—';
  const engColor = m.avgEng !== null ? engajamentoHex(m.avgEng) : undefined;

  const indPct =
    m.totalMeta > 0 ? `${Math.round((m.totalContratos / m.totalMeta) * 100)}%` : '—';
  const indColor =
    m.totalMeta > 0 && m.totalContratos / m.totalMeta >= 1
      ? '#16a34a'
      : m.totalMeta > 0 && m.totalContratos / m.totalMeta >= 0.75
        ? '#d97706'
        : '#dc2626';

  const adimplenciaOk = m.inadimplentes === 0;
  const adimplenciaLabel = adimplenciaOk ? 'OK' : `${m.inadimplentes} inad.`;
  const adimplenciaColor = adimplenciaOk ? '#16a34a' : '#dc2626';

  return (
    <div className="flex flex-wrap gap-3 pb-4">
      <Card
        label="Rede Ativa"
        value={m.totalAtiva}
        sub={`de ${rows.length} total`}
        tooltip="Conta todos os franqueados, exceto os com operação encerrada, em transferência e adormecidos."
      />

      <Card
        label="Engajamento médio"
        value={engValue}
        sub={m.avgEng !== null ? m.engLabel : 'Sem dados'}
        color={engColor}
        mini={[
          { label: 'Dinheiro', value: m.avgD !== null ? `${m.avgD}%` : '—' },
          { label: 'Conhecimento', value: m.avgK !== null ? `${m.avgK}%` : '—' },
          { label: 'Comportamento', value: m.avgC !== null ? `${m.avgC}%` : '—' },
        ]}
        tooltip="Média do score de engajamento (D×40% + K×35% + C×25%). Inclui adormecidos. Exclui encerrados e em transferência."
      />

      <Card
        label="Saúde da Relação"
        value={m.relStatus}
        sub="NPS · CSAT"
        color={m.relColor}
        mini={[
          { label: 'NPS', value: m.avgNps !== null ? m.avgNps.toFixed(1) : '—' },
          { label: 'CSAT', value: m.avgCsat !== null ? m.avgCsat.toFixed(1) : '—' },
        ]}
        tooltip="Baseado em NPS e CSAT dos franqueados. Inclui adormecidos. Exclui encerrados e em transferência."
      />

      <Card
        label="Contratos 12m"
        value={`${m.totalContratos}/${m.totalMeta}`}
        sub={`${indPct} da meta agregada`}
        color={m.totalMeta > 0 ? indColor : undefined}
        mini={[
          { label: 'No ritmo', value: m.indRitmo },
          { label: 'Próximo', value: m.indProximo },
          { label: 'Regular', value: m.indRegular },
          { label: 'Abaixo', value: m.indAbaixo, highlight: m.indAbaixo > 0 },
        ]}
        tooltip="Soma dos contratos nos últimos 12 meses vs. soma das metas individuais. Inclui adormecidos. Exclui encerrados e em transferência."
      />

      <Card
        label="Alertas gerenciais"
        value={adimplenciaLabel}
        sub="Adimplência da rede"
        color={adimplenciaColor}
        mini={[
          { label: 'em transf.', value: m.emTransferencia },
          { label: 'adormecidas', value: m.adormecidas },
          { label: 'P1', value: m.p1Count, highlight: m.p1Count > 0 },
        ]}
        tooltip="Inadimplentes: franqueados com diag_adimplencia = 'inad'. Inclui adormecidos. Exclui encerrados e em transferência."
      />

      <Card
        label="Diagnóstico"
        value={m.aferidos}
        sub={`de ${m.totalDiagBase} elegíveis`}
        tooltip="Franqueados com diagnóstico preenchido (campo Dinheiro aferido). Exclui encerrados, em transferência e adormecidos."
      />
    </div>
  );
}
