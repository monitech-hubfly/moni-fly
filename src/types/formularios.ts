export const FORMULARIO_CAMPO_TIPOS = [
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'moeda',
  'numero',
  'data',
  'link',
  'arquivo_multiplo',
  'link_ou_arquivo',
  'select',
  'checkbox',
] as const;

export type FormularioCampoTipo = (typeof FORMULARIO_CAMPO_TIPOS)[number];

export type FormularioStatusResposta = 'rascunho' | 'enviado';

export type FormularioOpcao = {
  valor: string;
  rotulo: string;
};

export type FormularioCampo = {
  id: string;
  secao_id: string;
  nome: string;
  tipo: FormularioCampoTipo;
  ordem: number;
  obrigatorio: boolean;
  opcoes: FormularioOpcao[];
  condicional_campo_id: string | null;
  condicional_valor: string | null;
};

export type FormularioSecao = {
  id: string;
  formulario_id: string;
  nome: string;
  ordem: number;
  condicional_campo_id: string | null;
  condicional_valor: string | null;
  campos: FormularioCampo[];
};

export type FormularioListaItem = {
  id: string;
  nome: string;
  descricao: string | null;
};

export type FormularioRespostaListaItem = {
  id: string;
  formulario_id: string;
  formulario_nome: string;
  status: FormularioStatusResposta;
  created_at: string;
  enviado_em: string | null;
  card_id: string | null;
  rede_franqueado_id: string | null;
  numero_franquia: string | null;
  nome_franqueado: string | null;
};

export type FormularioValorGravado = {
  campo_id: string;
  campo_nome: string;
  tipo: FormularioCampoTipo;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_data: string | null;
  valor_json: unknown;
};

export type FormularioArquivoGravado = {
  id: string;
  campo_id: string;
  nome_arquivo: string;
  url: string | null;
};

export type FormularioRespostaDetalhe = FormularioRespostaListaItem & {
  valores: FormularioValorGravado[];
  arquivos: FormularioArquivoGravado[];
};

export type FormularioValorSubmit = {
  campoId: string;
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorData?: string | null;
  valorJson?: unknown;
};
