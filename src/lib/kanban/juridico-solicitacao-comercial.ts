import { JURIDICO_TIPO_DOCUMENTO_LABEL } from '@/lib/kanban/juridico-tipo-documento';

/** Origem das solicitações COF e Cto de Franquia. Não há card pai no Hub Fly. */
export const JURIDICO_ORIGEM_COMERCIAL = 'comercial' as const;

export const TIPOS_SOLICITACAO_COMERCIAL = ['cof', 'franquia'] as const;

export type TipoSolicitacaoComercial = (typeof TIPOS_SOLICITACAO_COMERCIAL)[number];

/** Mesma submissão reenviada neste intervalo não cria outro card. */
export const JANELA_SUBMISSAO_IGUAL_MS = 20_000;

export const TIPO_NOTIFICACAO_SOLICITACAO_COMERCIAL = 'solicitacao_juridica_comercial';

export function isTipoSolicitacaoComercial(
  valor: string | null | undefined,
): valor is TipoSolicitacaoComercial {
  const v = String(valor ?? '').trim();
  return (TIPOS_SOLICITACAO_COMERCIAL as readonly string[]).includes(v);
}

export function rotuloTipoSolicitacaoComercial(tipo: TipoSolicitacaoComercial): string {
  return JURIDICO_TIPO_DOCUMENTO_LABEL[tipo];
}

export function tituloSolicitacaoComercial(tipo: TipoSolicitacaoComercial, candidato: string): string {
  const nome = String(candidato ?? '').trim();
  return `${rotuloTipoSolicitacaoComercial(tipo)} — ${nome}`;
}

export function mensagemConclusaoSolicitacaoComercial(
  tipo: TipoSolicitacaoComercial,
  candidato: string,
): string {
  return `Solicitação jurídica concluída: ${tituloSolicitacaoComercial(tipo, candidato)}.`;
}

/**
 * Comercial não tem card pai. Fases 5 e 7 não avançam Portfólio nem Loteadores.
 */
export function solicitacaoComercialEvitaBastaoDeOrigem(
  juridicoOrigem: string | null | undefined,
): boolean {
  return String(juridicoOrigem ?? '').trim() === JURIDICO_ORIGEM_COMERCIAL;
}

/** Duplo envio do mesmo formulário: mesmo tipo, candidato e texto. */
export function mesmaSubmissaoComercial(
  a: { tipo: string; candidato: string; observacao: string },
  b: { tipo: string; candidato: string; observacao: string },
): boolean {
  return (
    String(a.tipo).trim() === String(b.tipo).trim() &&
    String(a.candidato).trim() === String(b.candidato).trim() &&
    String(a.observacao).trim() === String(b.observacao).trim()
  );
}
