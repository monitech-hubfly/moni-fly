/** Formulário compartilhado do cadastro de condomínios (rede + cards kanban). */

import type { SlaTipo } from '@/lib/dias-uteis';
import {
  integerInputFromValue,
  parseIntegerInput,
  type CondominioPatch,
  type CondominioRow,
} from '@/lib/condominios';
import {
  emptyCondominioPrazosAprovacaoDraft,
  prazosAprovacaoDraftFromRow,
  prazosAprovacaoPatchFromDraft,
  type CondominioPrazosAprovacaoDraft,
} from '@/lib/kanban/condominio-prazos-aprovacao';

export type CondominioFormDraft = {
  nome: string;
  endereco: string;
  numero: string;
  cep: string;
  cidade: string;
  estado: string;
  descricao_breve: string;
  ticket_medio_lote: string;
  ticket_medio_casas: string;
  estimativa_casas_vendidas_ano: string;
  extrato_como_eram_casas: string;
  extrato_tempo_venda: string;
  data_lancamento_vendas: string;
  data_liberacao_tvo: string;
  quantidade_lotes: string;
  metragem_lotes: string;
  metragem_casas: string;
  planta_cadastral: string;
  manual_obras: string;
  casas_concorrentes: string;
  prazo_aprovacao_condominio_dias: string;
  prazo_aprovacao_condominio_sla_tipo: SlaTipo;
  prazo_aprovacao_prefeitura_dias: string;
  prazo_aprovacao_prefeitura_sla_tipo: SlaTipo;
};

export function emptyCondominioFormDraft(): CondominioFormDraft {
  return {
    nome: '',
    endereco: '',
    numero: '',
    cep: '',
    cidade: '',
    estado: '',
    descricao_breve: '',
    ticket_medio_lote: '',
    ticket_medio_casas: '',
    estimativa_casas_vendidas_ano: '',
    extrato_como_eram_casas: '',
    extrato_tempo_venda: '',
    data_lancamento_vendas: '',
    data_liberacao_tvo: '',
    quantidade_lotes: '',
    metragem_lotes: '',
    metragem_casas: '',
    planta_cadastral: '',
    manual_obras: '',
    casas_concorrentes: '',
    ...emptyCondominioPrazosAprovacaoDraft(),
  };
}

export function condominioRowToFormDraft(r: CondominioRow): CondominioFormDraft {
  return {
    nome: r.nome ?? '',
    endereco: r.endereco ?? '',
    numero: r.numero ?? '',
    cep: r.cep ?? '',
    cidade: r.cidade ?? '',
    estado: r.estado ?? '',
    descricao_breve: r.descricao_breve ?? '',
    ticket_medio_lote: r.ticket_medio_lote ?? '',
    ticket_medio_casas: r.ticket_medio_casas ?? '',
    estimativa_casas_vendidas_ano: integerInputFromValue(r.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: r.extrato_como_eram_casas ?? '',
    extrato_tempo_venda: r.extrato_tempo_venda ?? '',
    data_lancamento_vendas: r.data_lancamento_vendas ?? '',
    data_liberacao_tvo: r.data_liberacao_tvo ?? '',
    quantidade_lotes: integerInputFromValue(r.quantidade_lotes),
    metragem_lotes: r.metragem_lotes ?? '',
    metragem_casas: r.metragem_casas ?? '',
    planta_cadastral: r.planta_cadastral ?? '',
    manual_obras: r.manual_obras ?? '',
    casas_concorrentes: r.casas_concorrentes ?? '',
    ...prazosAprovacaoDraftFromRow(r),
  };
}

export function condominioFormDraftToPatch(d: CondominioFormDraft): CondominioPatch {
  return {
    nome: d.nome.trim(),
    endereco: d.endereco.trim() || null,
    numero: d.numero.trim() || null,
    cep: d.cep.trim() || null,
    cidade: d.cidade.trim() || null,
    estado: d.estado.trim() || null,
    descricao_breve: d.descricao_breve.trim() || null,
    ticket_medio_lote: d.ticket_medio_lote.trim() || null,
    ticket_medio_casas: d.ticket_medio_casas.trim() || null,
    estimativa_casas_vendidas_ano: parseIntegerInput(d.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: d.extrato_como_eram_casas.trim() || null,
    extrato_tempo_venda: d.extrato_tempo_venda.trim() || null,
    data_lancamento_vendas: d.data_lancamento_vendas.trim() || null,
    data_liberacao_tvo: d.data_liberacao_tvo.trim() || null,
    quantidade_lotes: parseIntegerInput(d.quantidade_lotes),
    metragem_lotes: d.metragem_lotes.trim() || null,
    metragem_casas: d.metragem_casas.trim() || null,
    planta_cadastral: d.planta_cadastral.trim() || null,
    manual_obras: d.manual_obras.trim() || null,
    casas_concorrentes: d.casas_concorrentes.trim() || null,
    ...prazosAprovacaoPatchFromDraft({
      prazo_aprovacao_condominio_dias: d.prazo_aprovacao_condominio_dias,
      prazo_aprovacao_condominio_sla_tipo: d.prazo_aprovacao_condominio_sla_tipo,
      prazo_aprovacao_prefeitura_dias: d.prazo_aprovacao_prefeitura_dias,
      prazo_aprovacao_prefeitura_sla_tipo: d.prazo_aprovacao_prefeitura_sla_tipo,
    }),
  };
}

export type { CondominioPrazosAprovacaoDraft };
