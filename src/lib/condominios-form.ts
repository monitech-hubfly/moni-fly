/** Formulário compartilhado do cadastro de condomínios (rede + cards kanban). */

import type { SlaTipo } from '@/lib/dias-uteis';
import {
  decimalInputFromValue,
  integerInputFromValue,
  parseDecimalInput,
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
  ticket_medio_casas_rsm2: string;
  estimativa_casas_vendidas_ano: string;
  extrato_como_eram_casas: string;
  extrato_tempo_venda: string;
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
    ticket_medio_casas_rsm2: '',
    estimativa_casas_vendidas_ano: '',
    extrato_como_eram_casas: '',
    extrato_tempo_venda: '',
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
    ticket_medio_lote: decimalInputFromValue(r.ticket_medio_lote),
    ticket_medio_casas: decimalInputFromValue(r.ticket_medio_casas),
    ticket_medio_casas_rsm2: decimalInputFromValue(r.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: integerInputFromValue(r.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: r.extrato_como_eram_casas ?? '',
    extrato_tempo_venda: r.extrato_tempo_venda ?? '',
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
    ticket_medio_lote: parseDecimalInput(d.ticket_medio_lote),
    ticket_medio_casas: parseDecimalInput(d.ticket_medio_casas),
    ticket_medio_casas_rsm2: parseDecimalInput(d.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: parseIntegerInput(d.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: d.extrato_como_eram_casas.trim() || null,
    extrato_tempo_venda: d.extrato_tempo_venda.trim() || null,
    ...prazosAprovacaoPatchFromDraft({
      prazo_aprovacao_condominio_dias: d.prazo_aprovacao_condominio_dias,
      prazo_aprovacao_condominio_sla_tipo: d.prazo_aprovacao_condominio_sla_tipo,
      prazo_aprovacao_prefeitura_dias: d.prazo_aprovacao_prefeitura_dias,
      prazo_aprovacao_prefeitura_sla_tipo: d.prazo_aprovacao_prefeitura_sla_tipo,
    }),
  };
}

export type { CondominioPrazosAprovacaoDraft };
