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
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  mini?: { label: string; value: string | number; highlight?: boolean }[];
}) {
  return (
    <div className="min-w-[130px] flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
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
  const aferidos = rows.filter((r) => r.diag_d !== null && r.diag_d !== undefined).length;

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
      />

      <Card
        label="Engajamento médio"
        value={engValue}
        sub={m.avgEng !== null ? m.engLabel : 'Sem dados'}
        color={engColor}
      />

      <Card
        label="Saúde da Relação"
        value={m.relStatus}
        sub={
          m.avgNps !== null || m.avgCsat !== null
            ? `NPS ${m.avgNps?.toFixed(1) ?? '—'} · CSAT ${m.avgCsat?.toFixed(1) ?? '—'}`
            : 'Sem dados'
        }
        color={m.relColor}
      />

      <Card
        label="Contratos 12m"
        value={`${m.totalContratos}/${m.totalMeta}`}
        sub={`${indPct} da meta agregada`}
        color={m.totalMeta > 0 ? indColor : undefined}
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
      />

      <Card
        label="Diagnóstico"
        value={aferidos}
        sub={`de ${rows.length} aferidos`}
      />
    </div>
  );
}
