/** Campos que o Frank pode enviar no UPDATE de `rede_franqueados` (contato + endereço + documentos pessoais). */
export type RedeFrankCadastroPayload = {
  email_frank: string;
  telefone_frank: string;
  data_nasc_frank: string | null;
  cpf_frank: string;
  endereco_casa_frank: string;
  endereco_casa_frank_numero: string;
  endereco_casa_frank_complemento: string;
  cep_casa_frank: string;
  tamanho_camisa_frank: string;
};

/** Dados da franquia exibidos como somente leitura — nunca entram no PATCH do Frank. */
export type RedeFrankFranquiaSomenteLeitura = {
  n_franquia: string | null;
  modalidade: string | null;
  nome_completo: string | null;
  status_franquia: string | null;
  regional: string | null;
  area_atuacao: string | null;
  responsavel_comercial: string | null;
};

/** Pré-preenchimento vindo do banco (convite / validação). */
export type RedeFrankPrefill = Partial<RedeFrankCadastroPayload> & Partial<RedeFrankFranquiaSomenteLeitura>;

export const NOTIFICACAO_VALIDACAO_TIPO = 'validacao_dados_frank' as const;

export const EMPTY_FRANQUIA_SOMENTE_LEITURA: RedeFrankFranquiaSomenteLeitura = {
  n_franquia: null,
  modalidade: null,
  nome_completo: null,
  status_franquia: null,
  regional: null,
  area_atuacao: null,
  responsavel_comercial: null,
};

export const EMPTY_REDE_FRANK_CADASTRO: RedeFrankCadastroPayload = {
  email_frank: '',
  telefone_frank: '',
  data_nasc_frank: null,
  cpf_frank: '',
  endereco_casa_frank: '',
  endereco_casa_frank_numero: '',
  endereco_casa_frank_complemento: '',
  cep_casa_frank: '',
  tamanho_camisa_frank: '',
};

/** Só campos editáveis, a partir do pré-preenchimento. */
export function redePrefillParaPayload(pref: RedeFrankPrefill | null | undefined): RedeFrankCadastroPayload {
  const b: RedeFrankCadastroPayload = { ...EMPTY_REDE_FRANK_CADASTRO };
  if (!pref) return b;
  if (pref.email_frank != null && pref.email_frank !== '') b.email_frank = String(pref.email_frank);
  if (pref.telefone_frank != null && pref.telefone_frank !== '') b.telefone_frank = String(pref.telefone_frank);
  if (pref.data_nasc_frank != null && pref.data_nasc_frank !== '') {
    b.data_nasc_frank = String(pref.data_nasc_frank).slice(0, 10);
  }
  if (pref.endereco_casa_frank != null && pref.endereco_casa_frank !== '') {
    b.endereco_casa_frank = String(pref.endereco_casa_frank);
  }
  if (pref.endereco_casa_frank_numero != null && pref.endereco_casa_frank_numero !== '') {
    b.endereco_casa_frank_numero = String(pref.endereco_casa_frank_numero);
  }
  if (pref.endereco_casa_frank_complemento != null && pref.endereco_casa_frank_complemento !== '') {
    b.endereco_casa_frank_complemento = String(pref.endereco_casa_frank_complemento);
  }
  if (pref.cep_casa_frank != null && pref.cep_casa_frank !== '') b.cep_casa_frank = String(pref.cep_casa_frank);
  if (pref.tamanho_camisa_frank != null && pref.tamanho_camisa_frank !== '') {
    b.tamanho_camisa_frank = String(pref.tamanho_camisa_frank);
  }
  if (pref.cpf_frank != null && pref.cpf_frank !== '') b.cpf_frank = String(pref.cpf_frank);
  return b;
}

export function redePrefillParaFranquiaSomenteLeitura(
  pref: RedeFrankPrefill | null | undefined,
): RedeFrankFranquiaSomenteLeitura {
  if (!pref) return { ...EMPTY_FRANQUIA_SOMENTE_LEITURA };
  return {
    n_franquia: pref.n_franquia != null ? String(pref.n_franquia) : null,
    modalidade: pref.modalidade != null ? String(pref.modalidade) : null,
    nome_completo: pref.nome_completo != null ? String(pref.nome_completo) : null,
    status_franquia: pref.status_franquia != null ? String(pref.status_franquia) : null,
    regional: pref.regional != null ? String(pref.regional) : null,
    area_atuacao: pref.area_atuacao != null ? String(pref.area_atuacao) : null,
    responsavel_comercial:
      pref.responsavel_comercial != null ? String(pref.responsavel_comercial) : null,
  };
}

export const REDE_SELECT_FIELDS =
  'n_franquia, modalidade, nome_completo, status_franquia, regional, area_atuacao, responsavel_comercial, email_frank, telefone_frank, data_nasc_frank, endereco_casa_frank, endereco_casa_frank_numero, endereco_casa_frank_complemento, cep_casa_frank, tamanho_camisa_frank, cpf_frank' as const;

/** Linha `rede_franqueados` (subset do select) → pré-preenchimento de formulários Frank. */
export function redeSqlRowParaPrefill(rr: Record<string, unknown> | null | undefined): RedeFrankPrefill | null {
  if (!rr || typeof rr !== 'object') return null;
  return {
    n_franquia: rr.n_franquia != null ? String(rr.n_franquia) : null,
    modalidade: rr.modalidade != null ? String(rr.modalidade) : null,
    nome_completo: rr.nome_completo != null ? String(rr.nome_completo) : null,
    status_franquia: rr.status_franquia != null ? String(rr.status_franquia) : null,
    regional: rr.regional != null ? String(rr.regional) : null,
    area_atuacao: rr.area_atuacao != null ? String(rr.area_atuacao) : null,
    responsavel_comercial: rr.responsavel_comercial != null ? String(rr.responsavel_comercial) : null,
    email_frank: rr.email_frank != null ? String(rr.email_frank) : undefined,
    telefone_frank: rr.telefone_frank != null ? String(rr.telefone_frank) : '',
    data_nasc_frank: rr.data_nasc_frank != null ? String(rr.data_nasc_frank).slice(0, 10) : null,
    endereco_casa_frank: rr.endereco_casa_frank != null ? String(rr.endereco_casa_frank) : '',
    endereco_casa_frank_numero: rr.endereco_casa_frank_numero != null ? String(rr.endereco_casa_frank_numero) : '',
    endereco_casa_frank_complemento:
      rr.endereco_casa_frank_complemento != null ? String(rr.endereco_casa_frank_complemento) : '',
    cep_casa_frank: rr.cep_casa_frank != null ? String(rr.cep_casa_frank) : '',
    tamanho_camisa_frank: rr.tamanho_camisa_frank != null ? String(rr.tamanho_camisa_frank) : '',
    cpf_frank: rr.cpf_frank != null ? String(rr.cpf_frank) : '',
  } satisfies RedeFrankPrefill;
}
