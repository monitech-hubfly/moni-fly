/** Campos da rede editáveis no cadastro / validação trimestral do portal Frank. */
export type RedeFrankCadastroPayload = {
  telefone_frank: string;
  data_nasc_frank: string | null;
  endereco_casa_frank: string;
  endereco_casa_frank_numero: string;
  endereco_casa_frank_complemento: string;
  cep_casa_frank: string;
  tamanho_camisa_frank: string;
  socios: string;
  cpf_frank: string;
};

export type RedeFrankPrefill = Partial<RedeFrankCadastroPayload> & {
  nome_completo?: string | null;
  email_frank?: string | null;
};

export const NOTIFICACAO_VALIDACAO_TIPO = 'validacao_dados_frank' as const;

export const EMPTY_REDE_FRANK_CADASTRO: RedeFrankCadastroPayload = {
  telefone_frank: '',
  data_nasc_frank: null,
  endereco_casa_frank: '',
  endereco_casa_frank_numero: '',
  endereco_casa_frank_complemento: '',
  cep_casa_frank: '',
  tamanho_camisa_frank: '',
  socios: '',
  cpf_frank: '',
};

/** Monta payload de formulário a partir do pré-preenchimento da rede (cadastro ou modal). */
export function redePrefillParaPayload(pref: RedeFrankPrefill | null | undefined): RedeFrankCadastroPayload {
  const b: RedeFrankCadastroPayload = { ...EMPTY_REDE_FRANK_CADASTRO };
  if (!pref) return b;
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
  if (pref.socios != null && pref.socios !== '') b.socios = String(pref.socios);
  if (pref.cpf_frank != null && pref.cpf_frank !== '') b.cpf_frank = String(pref.cpf_frank);
  return b;
}

export const REDE_SELECT_FIELDS =
  'nome_completo, email_frank, telefone_frank, data_nasc_frank, endereco_casa_frank, endereco_casa_frank_numero, endereco_casa_frank_complemento, cep_casa_frank, tamanho_camisa_frank, socios, cpf_frank' as const;

/** Linha `rede_franqueados` (subset do select) → pré-preenchimento de formulários Frank. */
export function redeSqlRowParaPrefill(rr: Record<string, unknown> | null | undefined): RedeFrankPrefill | null {
  if (!rr || typeof rr !== 'object') return null;
  return {
    nome_completo: rr.nome_completo != null ? String(rr.nome_completo) : null,
    email_frank: rr.email_frank != null ? String(rr.email_frank) : null,
    telefone_frank: rr.telefone_frank != null ? String(rr.telefone_frank) : '',
    data_nasc_frank: rr.data_nasc_frank != null ? String(rr.data_nasc_frank).slice(0, 10) : null,
    endereco_casa_frank: rr.endereco_casa_frank != null ? String(rr.endereco_casa_frank) : '',
    endereco_casa_frank_numero: rr.endereco_casa_frank_numero != null ? String(rr.endereco_casa_frank_numero) : '',
    endereco_casa_frank_complemento:
      rr.endereco_casa_frank_complemento != null ? String(rr.endereco_casa_frank_complemento) : '',
    cep_casa_frank: rr.cep_casa_frank != null ? String(rr.cep_casa_frank) : '',
    tamanho_camisa_frank: rr.tamanho_camisa_frank != null ? String(rr.tamanho_camisa_frank) : '',
    socios: rr.socios != null ? String(rr.socios) : '',
    cpf_frank: rr.cpf_frank != null ? String(rr.cpf_frank) : '',
  };
}
