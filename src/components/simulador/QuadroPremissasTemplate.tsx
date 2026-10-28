'use client';

import { formatarMoeda, type TemplateConfig } from '@/lib/simulador/calcular-oferta';

const hintStyle = { color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' } as const;

function pctLabel(fracao: number, casas = 2): string {
  return `${(Number(fracao) * 100).toFixed(casas)}%`;
}

function textoEntradaMinima(entrada: TemplateConfig['entrada_minima_loteadora']): string {
  if (!entrada) return 'Não configurada';
  if (entrada.tipo === 'percentual') {
    return `${(entrada.valor * 100).toFixed(0)}% do valor do lote`;
  }
  return formatarMoeda(entrada.valor);
}

export function QuadroPremissasTemplate({ template }: { template: TemplateConfig }) {
  const linhas: Array<{ label: string; valor: string }> = [
    { label: 'ITBI', valor: pctLabel(template.percentual_itbi) },
    { label: 'Impostos', valor: pctLabel(template.percentual_impostos) },
    { label: 'Taxa de plataforma', valor: pctLabel(template.percentual_taxa_plataforma) },
    {
      label: 'Taxa de gestão',
      valor:
        template.tipo_taxa_gestao === 'fixo'
          ? formatarMoeda(template.percentual_taxa_gestao)
          : pctLabel(template.percentual_taxa_gestao),
    },
    ...(Number(template.percentual_plataforma_entrada ?? 0) > 0
      ? [
          {
            label: 'Plataforma na entrada',
            valor: pctLabel(template.percentual_plataforma_entrada ?? 0),
          },
        ]
      : []),
    { label: 'Lucro loteadora', valor: pctLabel(template.percentual_lucro_loteadora) },
    { label: 'Lucro Moní', valor: pctLabel(template.percentual_lucro_moni) },
    { label: 'Lucro Franqueado', valor: pctLabel(template.percentual_lucro_franqueado) },
    { label: 'Comissão corretor', valor: pctLabel(template.percentual_comissao_corretor) },
    { label: 'Prazo de obra', valor: `${template.prazo_obra_meses} meses` },
    {
      label: 'Juros crédito-ponte',
      valor: `${pctLabel(template.taxa_juros_credito_ponte)} ao mês`,
    },
    {
      label: 'Método juros CP',
      valor:
        template.tipo_juros_cp === 'total'
          ? 'Total (sobre valor da obra + buffer 3 meses)'
          : 'Mês a mês (sobre saldo + buffer 3 meses)',
    },
    {
      label: 'Juros parcelado (lote)',
      valor: `${pctLabel(template.taxa_juros_parcelado_mes)} ao mês`,
    },
    {
      label: 'Taxa de financiamento padrão',
      valor: `${pctLabel(template.taxa_juros_financiamento_anual)} ao ano`,
    },
    {
      label: 'Entrada mínima loteadora',
      valor: textoEntradaMinima(template.entrada_minima_loteadora),
    },
  ];

  return (
    <div
      className="mt-4 rounded-[var(--moni-radius-md)] p-3 sm:p-4"
      style={{
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-100)',
      }}
    >
      <h3
        className="text-xs font-medium"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Premissas do template
      </h3>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11px]" style={hintStyle}>
              {l.label}
            </dt>
            <dd
              className="text-[11px] font-medium"
              style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
