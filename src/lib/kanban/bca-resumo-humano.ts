import type { BcaInputs, BcaResults } from '@/lib/bca-calc';

export type BcaElegibilidadeStatus = 'viavel' | 'limite' | 'inelegivel';

export type BcaCriterioElegibilidade = {
  label: string;
  ok: boolean;
  detalhe: string;
};

export type BcaResumoHumano = {
  status: BcaElegibilidadeStatus;
  titulo: string;
  paragrafo: string;
  criterios: BcaCriterioElegibilidade[];
  pctVgvTarget: number;
  margemTargetLiquidacao: number;
  tirTerrenistaPctCdi: number;
};

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function fmtPct(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`;
}

/** Resultado BCA em linguagem não técnica para o franqueado. */
export function gerarResumoBcaHumano(
  inputs: BcaInputs,
  results: BcaResults,
): BcaResumoHumano {
  const target = results.target;
  const pctVgv = target.pct_vgv_alavancado;
  const margem = results.margem_target_liquidacao;
  const tirCdi = target.tir_terrenista_pct_cdi;
  const modelo = inputs.nome_casa?.trim() || 'O modelo escolhido';
  const vgv = inputs.vgv_target ?? target.vgv;

  const criterios: BcaCriterioElegibilidade[] = [
    {
      label: '%VGV Target ≥ 10%',
      ok: pctVgv >= 10,
      detalhe: fmtPct(pctVgv),
    },
    {
      label: 'Margem Target vs Liquidação ≥ 10%',
      ok: margem >= 10,
      detalhe: fmtPct(margem),
    },
    {
      label: 'TIR terrenista ≥ 3× CDI',
      ok: tirCdi >= 300,
      detalhe: `${(tirCdi / 100).toFixed(1).replace('.', ',')}× CDI`,
    },
  ];

  const okCount = criterios.filter((c) => c.ok).length;
  let status: BcaElegibilidadeStatus = 'inelegivel';
  let titulo = 'Operação não elegível';
  if (okCount === 3) {
    status = 'viavel';
    titulo = 'Operação viável';
  } else if (okCount >= 1) {
    status = 'limite';
    titulo = 'Operação no limite';
  }

  const paragrafo =
    status === 'viavel'
      ? `${modelo} apresenta uma operação sólida com VGV Target de ${fmtMoeda(vgv)}. A margem de ${fmtPct(pctVgv)} sobre o VGV no cenário Target e a gordura de ${fmtPct(margem)} entre Target e Liquidação indicam boa absorção de risco. A TIR do terrenista (${(tirCdi / 100).toFixed(1).replace('.', ',')}× CDI) está dentro do padrão Moní.`
      : status === 'limite'
        ? `${modelo} tem VGV Target de ${fmtMoeda(vgv)}, mas um ou mais indicadores ficaram abaixo do ideal. Revise preço de venda, custo da casa ou estrutura do terreno antes de levar ao comitê.`
        : `${modelo} não atinge os critérios mínimos de viabilidade neste lote. Ajuste VGV, custos ou permuta — ou considere outro modelo do ranking da Pré Batalha.`;

  return {
    status,
    titulo,
    paragrafo,
    criterios,
    pctVgvTarget: pctVgv,
    margemTargetLiquidacao: margem,
    tirTerrenistaPctCdi: tirCdi,
  };
}
