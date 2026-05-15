export type UniModuloTipo = 'video' | 'checklist' | 'quiz' | 'template' | 'leitura';

export type ConteudoVideo = {
  url: string;
  duracao_min: number;
  thumbnail?: string;
};

export type ConteudoChecklist = {
  itens: Array<{ id: string; texto: string; dica?: string }>;
};

export type ConteudoQuiz = {
  perguntas: Array<{ id: string; texto: string; opcoes: string[]; correta: string }>;
};

export type ConteudoTemplate = {
  titulo: string;
  url_drive: string;
  url_download?: string;
};

export type ConteudoLeitura = {
  markdown: string;
  tempo_leitura_min: number;
};

export type UniCasa = {
  id: string;
  slug: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  cor_tema: string | null;
  ativa: boolean | null;
  criado_em: string | null;
};

export type UniModuloBase = {
  id: string;
  casa_id: string;
  titulo: string;
  ordem: number;
  obrigatorio: boolean | null;
  criado_em: string | null;
};

export type UniModuloVideo = UniModuloBase & { tipo: 'video'; conteudo: ConteudoVideo | null };
export type UniModuloChecklist = UniModuloBase & { tipo: 'checklist'; conteudo: ConteudoChecklist | null };
export type UniModuloQuiz = UniModuloBase & { tipo: 'quiz'; conteudo: ConteudoQuiz | null };
export type UniModuloTemplate = UniModuloBase & { tipo: 'template'; conteudo: ConteudoTemplate | null };
export type UniModuloLeitura = UniModuloBase & { tipo: 'leitura'; conteudo: ConteudoLeitura | null };

export type UniModulo = UniModuloVideo | UniModuloChecklist | UniModuloQuiz | UniModuloTemplate | UniModuloLeitura;

export type UniProgressoStatus = 'pendente' | 'em_progresso' | 'concluido';

export type UniProgresso = {
  id: string;
  user_id: string;
  modulo_id: string;
  casa_id: string | null;
  status: UniProgressoStatus;
  dados: Record<string, unknown> | null;
  nota: number | null;
  concluido_em: string | null;
  criado_em: string | null;
};

export type UniEntregaTipo = 'arquivo' | 'link' | 'texto';

export type UniEntrega = {
  id: string;
  user_id: string;
  casa_id: string | null;
  modulo_id: string | null;
  tipo: UniEntregaTipo | null;
  valor: string | null;
  aprovado: boolean | null;
  aprovado_por: string | null;
  criado_em: string | null;
};

export type UniCertificado = {
  id: string;
  user_id: string;
  nivel: number;
  titulo: string;
  emitido_em: string | null;
};

export type UniBibliotecaItem = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  tipo: 'arquivo' | 'link' | 'video' | null;
  url: string | null;
  tags: string[] | null;
  visivel_para: string[] | null;
  criado_em: string | null;
};

export type CasaComProgressoStatus = 'bloqueada' | 'disponivel' | 'em_progresso' | 'concluida';

export type CasaComProgresso = UniCasa & {
  percentual: number;
  modulos_concluidos: number;
  total_obrigatorios: number;
  status: CasaComProgressoStatus;
};

export type CasaComModulos = UniCasa & {
  modulos: UniModulo[];
};
