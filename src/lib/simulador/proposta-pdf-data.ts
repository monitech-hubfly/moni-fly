import type { LinhaFluxo, ResultadoCalculo } from '@/lib/simulador/calcular-oferta';

export type PropostaPdfPayload = {
  simulacaoId: string;
  loteamento: string;
  loteCodigo: string | null;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  valorLote: number;
  valorCasa: number;
  valorCustomizacao: number;
  valorEmpreendimento: number;
  entradaConfirmada: number;
  mensalConfirmada: number;
  qtdParcelasMensais: number;
  parcelaUnicaConfirmada: number;
  saldoFinanciar: number;
  prazoFinanciamentoAnos: number;
  taxaJurosAnualPct: number;
  parcelaFinanciamento: number;
  rendaMinima: number;
  fluxo: LinhaFluxo[];
};

export function montarPropostaPdfPayload(args: {
  simulacaoId: string;
  loteamento: string;
  loteCodigo: string | null;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  valorLote: number;
  valorCasa: number;
  valorCustomizacao: number;
  resultado: ResultadoCalculo;
  entradaConfirmada: number;
  mensalConfirmada: number;
  parcelaUnicaConfirmada: number;
  qtdParcelasMensais: number;
  prazoFinanciamentoAnos: number;
  taxaJurosAnualPct: number;
}): PropostaPdfPayload {
  return {
    simulacaoId: args.simulacaoId,
    loteamento: args.loteamento,
    loteCodigo: args.loteCodigo,
    clienteNome: args.clienteNome,
    clienteTelefone: args.clienteTelefone,
    clienteEmail: args.clienteEmail,
    valorLote: args.valorLote,
    valorCasa: args.valorCasa,
    valorCustomizacao: args.valorCustomizacao,
    valorEmpreendimento: args.resultado.vte_avista,
    entradaConfirmada: args.entradaConfirmada,
    mensalConfirmada: args.mensalConfirmada,
    qtdParcelasMensais: args.qtdParcelasMensais,
    parcelaUnicaConfirmada: args.parcelaUnicaConfirmada,
    saldoFinanciar: args.resultado.saldo_financiar,
    prazoFinanciamentoAnos: args.prazoFinanciamentoAnos,
    taxaJurosAnualPct: args.taxaJurosAnualPct,
    parcelaFinanciamento: args.resultado.parcela_sac_primeira,
    rendaMinima: args.resultado.parcela_sac_primeira * 3,
    fluxo: args.resultado.fluxo,
  };
}
