import type { NegocioPrazoDraft } from '@/lib/kanban/dados-negocio-prazo';
import {
  NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO,
  NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO,
  negocioPrazoInstrumentoDraftFromProcesso,
  negocioPrazoOpcaoDraftFromProcesso,
} from '@/lib/kanban/dados-negocio-prazo';
import type { FaseNegocioPrazoOpcao } from '@/lib/kanban/dados-negocio-prazo';
import type { ProcessoModalNegocioPreObra } from '@/lib/kanban/kanban-card-modal-detalhes';
import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';
import {
  negociacaoLinhasDraftFromLinhas,
  negociacaoLinhasDraftPadrao,
  type NegociacaoLinhaDraft,
} from '@/lib/kanban/negociacao-linhas';

export type NegocioDraftKanban = {
  tipo_aquisicao_terreno: string;
  valor_terreno: string;
  vgv_pretendido: string;
  produto_modelo_casa: string;
  link_pasta_drive: string;
  link_bca: string;
  link_gbox: string;
  link_mapa_competidores: string;
  link_acoplamento: string;
  link_apresentacao_comite: string;
  link_moni_capital_seguro_garantia: string;
  comentario_moni_capital_seguro_garantia: string;
  link_moni_capital_gastos_aporte_inicial: string;
  comentario_moni_capital_gastos_aporte_inicial: string;
  prazo_opcao: NegocioPrazoDraft;
  prazo_instrumento_garantidor: NegocioPrazoDraft;
  negociacao_linhas: NegociacaoLinhaDraft[];
};

export function negocioDraftVazio(): NegocioDraftKanban {
  return {
    tipo_aquisicao_terreno: '',
    valor_terreno: '',
    vgv_pretendido: '',
    produto_modelo_casa: '',
    link_pasta_drive: '',
    link_bca: '',
    link_gbox: '',
    link_mapa_competidores: '',
    link_acoplamento: '',
    link_apresentacao_comite: '',
    link_moni_capital_seguro_garantia: '',
    comentario_moni_capital_seguro_garantia: '',
    link_moni_capital_gastos_aporte_inicial: '',
    comentario_moni_capital_gastos_aporte_inicial: '',
    prazo_opcao: { ...NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO },
    prazo_instrumento_garantidor: { ...NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO },
    negociacao_linhas: negociacaoLinhasDraftPadrao(),
  };
}

export function negocioDraftFromProcesso(
  proc: ProcessoModalNegocioPreObra | null | undefined,
  opcoes: FaseNegocioPrazoOpcao[] = [],
): NegocioDraftKanban {
  if (!proc) return negocioDraftVazio();
  return {
    tipo_aquisicao_terreno: proc.tipo_aquisicao_terreno ?? '',
    valor_terreno: moedaCampoValorInicial(proc.valor_terreno),
    vgv_pretendido: proc.vgv_pretendido != null ? String(proc.vgv_pretendido) : '',
    produto_modelo_casa: proc.produto_modelo_casa ?? '',
    link_pasta_drive: proc.link_pasta_drive ?? '',
    link_bca: proc.link_bca ?? '',
    link_gbox: proc.link_gbox ?? '',
    link_mapa_competidores: proc.link_mapa_competidores ?? '',
    link_acoplamento: proc.link_acoplamento ?? '',
    link_apresentacao_comite: proc.link_apresentacao_comite ?? '',
    link_moni_capital_seguro_garantia: proc.link_moni_capital_seguro_garantia ?? '',
    comentario_moni_capital_seguro_garantia: proc.comentario_moni_capital_seguro_garantia ?? '',
    link_moni_capital_gastos_aporte_inicial: proc.link_moni_capital_gastos_aporte_inicial ?? '',
    comentario_moni_capital_gastos_aporte_inicial:
      proc.comentario_moni_capital_gastos_aporte_inicial ?? '',
    prazo_opcao: negocioPrazoOpcaoDraftFromProcesso(proc, opcoes),
    prazo_instrumento_garantidor: negocioPrazoInstrumentoDraftFromProcesso(proc, opcoes),
    negociacao_linhas: negociacaoLinhasDraftFromLinhas(proc.negociacao_linhas ?? []),
  };
}
