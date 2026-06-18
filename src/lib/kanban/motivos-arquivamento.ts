/** Categorias canônicas de motivo de arquivamento (Kanban cards). */
export const MOTIVOS_ARQUIVAMENTO_CATEGORIAS = [
  'Terreno inviável',
  'Crédito inviável',
  'Documentação incompleta',
  'Produto não encaixou',
  'Desistência do franqueado',
  'Desistência do terrenista/parceiro',
  'Duplicado',
  'Erro operacional',
  'Fora do escopo',
  'Outro',
] as const;

export type MotivoArquivamentoCategoria = (typeof MOTIVOS_ARQUIVAMENTO_CATEGORIAS)[number];

export const MOTIVO_ARQUIVAMENTO_OUTRO: MotivoArquivamentoCategoria = 'Outro';

export const MOTIVO_ARQUIVAMENTO_OUTRO_PREFIX = 'Outro:';

export const MOTIVO_ARQUIVAMENTO_OBS_MIN = 5;
export const MOTIVO_ARQUIVAMENTO_OBS_MAX = 280;

const CATEGORIAS_FIXAS = new Set<string>(
  MOTIVOS_ARQUIVAMENTO_CATEGORIAS.filter((c) => c !== MOTIVO_ARQUIVAMENTO_OUTRO),
);

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Monta o valor persistido em `motivo_arquivamento`. */
export function formatMotivoArquivamento(
  categoria: string,
  observacaoOutro?: string,
): string {
  const cat = normalizeSpaces(categoria);
  if (cat === MOTIVO_ARQUIVAMENTO_OUTRO) {
    const obs = normalizeSpaces(observacaoOutro ?? '');
    return `${MOTIVO_ARQUIVAMENTO_OUTRO_PREFIX} ${obs}`;
  }
  return cat;
}

export type ValidacaoMotivoArquivamento =
  | { ok: true; motivo: string }
  | { ok: false; error: string };

/** Valida motivo antes de arquivar (novos arquivamentos). Preserva textos legados não vazios. */
export function validarMotivoArquivamento(motivoRaw: string): ValidacaoMotivoArquivamento {
  const motivo = normalizeSpaces(motivoRaw);
  if (!motivo) {
    return { ok: false, error: 'Informe o motivo do arquivamento.' };
  }

  if (CATEGORIAS_FIXAS.has(motivo)) {
    return { ok: true, motivo };
  }

  if (motivo === MOTIVO_ARQUIVAMENTO_OUTRO) {
    return {
      ok: false,
      error: 'Para "Outro", descreva brevemente o motivo do arquivamento.',
    };
  }

  const outroPrefix = `${MOTIVO_ARQUIVAMENTO_OUTRO_PREFIX} `;
  if (motivo.startsWith(outroPrefix)) {
    const obs = motivo.slice(outroPrefix.length).trim();
    if (obs.length < MOTIVO_ARQUIVAMENTO_OBS_MIN) {
      return {
        ok: false,
        error: `A observação deve ter ao menos ${MOTIVO_ARQUIVAMENTO_OBS_MIN} caracteres.`,
      };
    }
    if (obs.length > MOTIVO_ARQUIVAMENTO_OBS_MAX) {
      return {
        ok: false,
        error: `A observação deve ter no máximo ${MOTIVO_ARQUIVAMENTO_OBS_MAX} caracteres.`,
      };
    }
    return { ok: true, motivo: `${MOTIVO_ARQUIVAMENTO_OUTRO_PREFIX} ${obs}` };
  }

  /** Categorias canônicas obrigatórias em novos arquivamentos. */
  return {
    ok: false,
    error: 'Selecione um motivo válido de arquivamento.',
  };
}

export function isMotivoArquivamentoOutro(categoria: string): boolean {
  return normalizeSpaces(categoria) === MOTIVO_ARQUIVAMENTO_OUTRO;
}

export function motivoArquivamentoProntoParaEnviar(
  categoria: string,
  observacaoOutro: string,
): boolean {
  const cat = normalizeSpaces(categoria);
  if (!cat) return false;
  if (cat === MOTIVO_ARQUIVAMENTO_OUTRO) {
    const obs = normalizeSpaces(observacaoOutro);
    return obs.length >= MOTIVO_ARQUIVAMENTO_OBS_MIN && obs.length <= MOTIVO_ARQUIVAMENTO_OBS_MAX;
  }
  return CATEGORIAS_FIXAS.has(cat);
}

/** Agrupa motivo para analytics (ex.: "Outro: foo" → categoria Outro). */
export function categoriaMotivoArquivamento(motivo: string): string {
  const m = normalizeSpaces(motivo);
  if (!m) return '';
  if (CATEGORIAS_FIXAS.has(m)) return m;
  if (m === MOTIVO_ARQUIVAMENTO_OUTRO || m.startsWith(`${MOTIVO_ARQUIVAMENTO_OUTRO_PREFIX} `)) {
    return MOTIVO_ARQUIVAMENTO_OUTRO;
  }
  return m;
}
