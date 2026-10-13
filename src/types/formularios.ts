import type { CategoriaHub } from '@/lib/constants/categorias-hub';

export type FormularioCampoGrupoDef = {
  key: string;
  label: string;
  tipo: string;
  obrigatorio?: boolean;
  opcoes?: string[];
};

export type FormularioCampoConfig = {
  estado_campo_id?: string;
  label_adicionar?: string;
  campos?: FormularioCampoGrupoDef[];
};

export type FormularioCampoTipo =
  | 'texto'
  | 'texto_curto'
  | 'texto_longo'
  | 'email'
  | 'telefone'
  | 'moeda'
  | 'numero'
  | 'data'
  | 'link'
  | 'select'
  | 'select_estado'
  | 'select_cidade'
  | 'checkbox'
  | 'arquivo_multiplo'
  | 'link_ou_arquivo'
  | 'grupo_repetivel';

export interface FormularioCampo {
  id: string;
  secao_id: string;
  label: string;
  tipo: FormularioCampoTipo;
  obrigatorio: boolean;
  ordem: number;
  placeholder: string | null;
  descricao: string | null;
  opcoes: string[];
  config: FormularioCampoConfig | null;
  condicional_campo_id: string | null;
  condicional_valor: string | null;
  ativo: boolean;
}

export interface FormularioSecao {
  id: string;
  formulario_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  condicional_campo_id: string | null;
  condicional_valor: string | null;
  campos: FormularioCampo[];
}

export interface Formulario {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
  categoria: CategoriaHub | null;
  visivel_franqueado: boolean;
  secoes: FormularioSecao[];
}

export interface FormularioToken {
  id: string;
  formulario_id: string;
  token: string;
  card_id: string | null;
  rede_franqueado_id: string | null;
  usado: boolean;
  criado_em: string;
  criado_por: string | null;
  expira_em: string | null;
}

export type FormularioRespostaStatus = 'rascunho' | 'iniciado' | 'em_preenchimento' | 'enviado' | 'arquivado';

export interface FormularioRespostaCampo {
  campo_id: string;
  valor: string | string[] | null;
  arquivos?: FormularioArquivo[];
}

export interface FormularioArquivo {
  nome: string;
  url: string;
  tamanho: number;
  tipo: string;
}

export interface FormularioResposta {
  id: string;
  formulario_id: string;
  token_id: string | null;
  card_id: string | null;
  kanban_id: string | null;
  rede_franqueado_id: string | null;
  nome_franqueado: string | null;
  numero_franquia: string | null;
  status: FormularioRespostaStatus;
  enviado_em: string | null;
  criado_em: string;
  dados: Record<string, FormularioRespostaCampo>;
}

export interface FormularioRespostaListaItem {
  id: string;
  formulario_id: string;
  formulario_nome: string;
  status: FormularioRespostaStatus;
  enviado_em: string | null;
  criado_em: string;
  nome_franqueado: string | null;
  numero_franquia: string | null;
  card_id: string | null;
  rede_franqueado_id: string | null;
}

export interface RespostaLocal {
  [campoId: string]: string | string[];
}

export interface ArquivoLocal {
  [campoId: string]: File[];
}
