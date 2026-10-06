/** Campos do formulário de novo card do Funil Loteadores (staff e link externo). */

export type NovoCardLoteadoresFormulario = {
  nomeLoteadora: string;
  cnpjLoteadora: string;
  cidadeLoteadora: string;
  estadoLoteadora: string;
  /** Condomínio já cadastrado. Vazio quando a pessoa vai cadastrar um novo. */
  condominioId: string;
  cadastrarCondominioNovo: boolean;
  nomeCondominio: string;
  endereco: string;
  numero: string;
  cep: string;
  cidadeCondominio: string;
  estadoCondominio: string;
  descricaoBreve: string;
  ticketMedioLote: string;
  ticketMedioCasas: string;
  dataLancamentoVendas: string;
  dataLiberacaoTvo: string;
  metragemLotes: string;
  metragemCasas: string;
  plantaCadastral: string;
  manualObras: string;
  lotesDisponiveis: string;
  informacoesAdicionais: string;
};

export function emptyNovoCardLoteadoresFormulario(): NovoCardLoteadoresFormulario {
  return {
    nomeLoteadora: '',
    cnpjLoteadora: '',
    cidadeLoteadora: '',
    estadoLoteadora: '',
    condominioId: '',
    cadastrarCondominioNovo: false,
    nomeCondominio: '',
    endereco: '',
    numero: '',
    cep: '',
    cidadeCondominio: '',
    estadoCondominio: '',
    descricaoBreve: '',
    ticketMedioLote: '',
    ticketMedioCasas: '',
    dataLancamentoVendas: '',
    dataLiberacaoTvo: '',
    metragemLotes: '',
    metragemCasas: '',
    plantaCadastral: '',
    manualObras: '',
    lotesDisponiveis: '',
    informacoesAdicionais: '',
  };
}

function texto(v: string | null | undefined): string {
  return String(v ?? '').trim();
}

function dataOk(v: string): boolean {
  return v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function validarNovoCardLoteadoresFormulario(f: NovoCardLoteadoresFormulario): string | null {
  if (!texto(f.nomeLoteadora)) return 'Informe o nome da loteadora.';
  if (!texto(f.cidadeLoteadora)) return 'Informe a cidade da loteadora.';
  if (texto(f.estadoLoteadora).length !== 2) return 'Informe o estado da loteadora.';
  if (texto(f.condominioId) && !f.cadastrarCondominioNovo) {
    // vínculo com condomínio já cadastrado
  } else if (f.cadastrarCondominioNovo) {
    if (!texto(f.nomeCondominio)) return 'Informe o nome do condomínio.';
    if (!texto(f.endereco)) return 'Informe o endereço do condomínio.';
    if (!texto(f.numero)) return 'Informe o número do condomínio.';
    if (!texto(f.cep)) return 'Informe o CEP do condomínio.';
    if (!texto(f.cidadeCondominio)) return 'Informe a cidade do condomínio.';
    if (texto(f.estadoCondominio).length !== 2) return 'Informe o estado do condomínio.';
    if (!dataOk(texto(f.dataLancamentoVendas))) return 'Data de lançamento inválida.';
    if (!dataOk(texto(f.dataLiberacaoTvo))) return 'Data de liberação TVO inválida.';
  } else {
    return 'Busque um condomínio cadastrado ou indique que não encontrou.';
  }
  const lotes = texto(f.lotesDisponiveis);
  if (lotes && !/^\d+$/.test(lotes)) return 'Quantos lotes tem disponíveis para venda deve ser um número inteiro.';
  return null;
}
