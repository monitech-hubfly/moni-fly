/** Formulário compartilhado do cadastro de condomínios (rede + cards kanban). */

import {
  decimalInputFromValue,
  integerInputFromValue,
  parseDecimalInput,
  parseIntegerInput,
  type CondominioPatch,
  type CondominioRow,
} from '@/lib/condominios';

export type CondominioFormDraft = {
  nome: string;
  endereco: string;
  numero: string;
  cep: string;
  cidade: string;
  estado: string;
  ticket_medio_lote: string;
  ticket_medio_casas: string;
  ticket_medio_casas_rsm2: string;
  estimativa_casas_vendidas_ano: string;
  extrato_como_eram_casas: string;
  extrato_tempo_venda: string;
};

export function emptyCondominioFormDraft(): CondominioFormDraft {
  return {
    nome: '',
    endereco: '',
    numero: '',
    cep: '',
    cidade: '',
    estado: '',
    ticket_medio_lote: '',
    ticket_medio_casas: '',
    ticket_medio_casas_rsm2: '',
    estimativa_casas_vendidas_ano: '',
    extrato_como_eram_casas: '',
    extrato_tempo_venda: '',
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
    ticket_medio_lote: decimalInputFromValue(r.ticket_medio_lote),
    ticket_medio_casas: decimalInputFromValue(r.ticket_medio_casas),
    ticket_medio_casas_rsm2: decimalInputFromValue(r.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: integerInputFromValue(r.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: r.extrato_como_eram_casas ?? '',
    extrato_tempo_venda: r.extrato_tempo_venda ?? '',
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
    ticket_medio_lote: parseDecimalInput(d.ticket_medio_lote),
    ticket_medio_casas: parseDecimalInput(d.ticket_medio_casas),
    ticket_medio_casas_rsm2: parseDecimalInput(d.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: parseIntegerInput(d.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: d.extrato_como_eram_casas.trim() || null,
    extrato_tempo_venda: d.extrato_tempo_venda.trim() || null,
  };
}
