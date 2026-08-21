export type AcaoAtaReuniao = {
  acao: string;
  responsavel: string;
  prazo: string;
};

export type ConteudoAtaReuniao = {
  participantes: string;
  assunto: string;
  pontos_chave: string;
  decisoes: string;
  acoes: AcaoAtaReuniao[];
  pendencias_riscos: string;
  proximos_passos: string;
};

export type AtaReuniaoRow = {
  id: string;
  card_id: string;
  card_origem: 'nativo' | 'legado';
  data_reuniao: string;
  assunto: string;
  conteudo: ConteudoAtaReuniao;
  preenchido_por: string | null;
  preenchido_nome: string | null;
  created_at: string;
};

export const CONTEUDO_ATA_VAZIO: ConteudoAtaReuniao = {
  participantes: '',
  assunto: '',
  pontos_chave: '',
  decisoes: '',
  acoes: [{ acao: '', responsavel: '', prazo: '' }],
  pendencias_riscos: '',
  proximos_passos: '',
};
