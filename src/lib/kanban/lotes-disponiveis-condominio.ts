import { parseDecimalInput } from '@/lib/condominios';
import {
  isColunaAtributoCondominioLote,
  type CondominioLoteAtributos,
  type CondominioLoteColunaAtributo,
} from '@/lib/condominios-lotes';
import { formatMoedaDigitosPtBr } from '@/lib/kanban/ticket-medio-faixa';
import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import { linhaProspectTemNome } from '@/lib/kanban/condominio-prospect-pesquisa';

export const LOTES_DISPONIVEIS_CHECKBOXES = [
  { chave: 'vista', label: 'Vista privilegiada' },
  { chave: 'plano', label: 'Terreno plano' },
  { chave: 'aclive', label: 'Terreno aclive' },
  { chave: 'declive', label: 'Terreno declive' },
  { chave: 'fundo_mata', label: 'Fundo de mata' },
  { chave: 'frente_mata', label: 'Frente de mata' },
  { chave: 'area_verde', label: 'Perto de área verde' },
  { chave: 'perto_lago', label: 'Perto do lago' },
  { chave: 'fundo_lago', label: 'Fundo de lago' },
  { chave: 'frente_lago', label: 'Frente de lago' },
  { chave: 'area_convivencia', label: 'Perto de área de convivência' },
  { chave: 'lixeira', label: 'Perto de lixeira' },
  { chave: 'portaria', label: 'Perto de portaria' },
  { chave: 'muro_rodovia', label: 'Muro com rodovia' },
  { chave: 'muro_comunidade', label: 'Muro com comunidade' },
  { chave: 'muro_vegetacao', label: 'Muro com vegetação' },
] as const;

export type ChaveLoteCheckbox = (typeof LOTES_DISPONIVEIS_CHECKBOXES)[number]['chave'];

/** Topografia: mutuamente exclusivos (plano / aclive / declive). */
export const CHAVES_TOPOGRAFIA_LOTE = ['plano', 'aclive', 'declive'] as const satisfies readonly ChaveLoteCheckbox[];

export function isChaveTopografiaLote(chave: ChaveLoteCheckbox): boolean {
  return (CHAVES_TOPOGRAFIA_LOTE as readonly string[]).includes(chave);
}

export const LOTES_DISPONIVEIS_CHECKBOXES_TOPOGRAFIA = LOTES_DISPONIVEIS_CHECKBOXES.filter((c) =>
  isChaveTopografiaLote(c.chave),
);

export const LOTES_DISPONIVEIS_CHECKBOXES_LOCALIZACAO = LOTES_DISPONIVEIS_CHECKBOXES.filter(
  (c) => !isChaveTopografiaLote(c.chave),
);

/** Aliases de chaves legadas no JSON de `lotes_disponiveis` → id canônico (ATRIBUTOS_LOTE). */
const LEGACY_CHAVE_ALIASES: Partial<Record<ChaveLoteCheckbox, readonly string[]>> = {
  vista: ['vista_privilegiada'],
  plano: ['terreno_plano'],
  aclive: ['terreno_aclive', 'terreno_aclive_acentuado'],
  declive: ['terreno_declive', 'terreno_declive_acentuado'],
  area_verde: ['perto_area_verde'],
  area_convivencia: ['perto_area_convivencia'],
  lixeira: ['perto_lixeira'],
  portaria: ['perto_portaria'],
};

/** Mapeia id canônico → coluna boolean em `condominios_lotes` (nomenclatura legada no Postgres). */
export const CHAVE_LOTE_PARA_COLUNA_DB = {
  vista: 'vista_privilegiada',
  plano: 'terreno_plano',
  aclive: 'terreno_aclive',
  declive: 'terreno_declive',
  fundo_mata: 'fundo_mata',
  frente_mata: 'frente_mata',
  area_verde: 'perto_area_verde',
  perto_lago: 'perto_lago',
  fundo_lago: 'fundo_lago',
  frente_lago: 'frente_lago',
  area_convivencia: 'perto_area_convivencia',
  lixeira: 'perto_lixeira',
  portaria: 'perto_portaria',
  muro_rodovia: 'muro_rodovia',
  muro_comunidade: 'muro_comunidade',
  muro_vegetacao: 'muro_vegetacao',
} as const satisfies Record<ChaveLoteCheckbox, CondominioLoteColunaAtributo>;

let mapeamentoAtributosLoteVerificado = false;

/**
 * Em dev/diagnóstico: alerta se algum id de LOTES_DISPONIVEIS_CHECKBOXES não tiver
 * coluna correspondente em `condominios_lotes` via CHAVE_LOTE_PARA_COLUNA_DB.
 */
export function verificarMapeamentoAtributosLote(): void {
  if (mapeamentoAtributosLoteVerificado) return;
  mapeamentoAtributosLoteVerificado = true;

  for (const { chave } of LOTES_DISPONIVEIS_CHECKBOXES) {
    const coluna = CHAVE_LOTE_PARA_COLUNA_DB[chave];
    if (!coluna) {
      console.warn(
        `[lotes-disponiveis] Atributo "${chave}" sem mapeamento em CHAVE_LOTE_PARA_COLUNA_DB.`,
      );
      continue;
    }
    if (!isColunaAtributoCondominioLote(coluna)) {
      console.warn(
        `[lotes-disponiveis] Atributo "${chave}" mapeado para coluna "${coluna}" inexistente em condominios_lotes — adicione migration ou JSONB de extras.`,
      );
    }
  }
}

export type ChaveLoteDisponivel =
  | ChaveLoteCheckbox
  | 'quadra'
  | 'lote'
  | 'dimensao_frente_m'
  | 'dimensao_fundo_m'
  | 'dimensao_lado_direito_m'
  | 'dimensao_lado_esquerdo_m'
  | 'area_m2'
  | 'valor'
  | 'situacao_documental'
  | 'fotos_path'
  | 'observacoes';

export type CampoLoteDisponivel = {
  chave: ChaveLoteDisponivel;
  label: string;
  tipo: 'texto' | 'numero' | 'checkbox' | 'anexo' | 'texto_longo';
  obrigatorio?: boolean;
  placeholder?: string;
};

export const LOTES_DISPONIVEIS_CAMPOS: CampoLoteDisponivel[] = [
  { chave: 'quadra', label: 'Quadra', tipo: 'texto', placeholder: 'Ex.: 12' },
  { chave: 'lote', label: 'Lote', tipo: 'texto', placeholder: 'Ex.: 34' },
  {
    chave: 'dimensao_frente_m',
    label: 'Dimensão Frente Lote (m)',
    tipo: 'numero',
    placeholder: 'Ex.: 12,5',
  },
  {
    chave: 'dimensao_fundo_m',
    label: 'Dimensão Fundo Lote (m)',
    tipo: 'numero',
    placeholder: 'Ex.: 25',
  },
  {
    chave: 'dimensao_lado_direito_m',
    label: 'Dimensão Lado Direito Lote (m)',
    tipo: 'numero',
    placeholder: 'Ex.: 30',
  },
  {
    chave: 'dimensao_lado_esquerdo_m',
    label: 'Dimensão Lado Esquerdo Lote (m)',
    tipo: 'numero',
    placeholder: 'Ex.: 28',
  },
  { chave: 'area_m2', label: 'Área m²', tipo: 'numero' },
  { chave: 'valor', label: 'Valor do lote', tipo: 'numero', placeholder: '0,00' },
  { chave: 'situacao_documental', label: 'Situação documental', tipo: 'texto' },
  { chave: 'fotos_path', label: 'Fotos do lote', tipo: 'anexo' },
  ...LOTES_DISPONIVEIS_CHECKBOXES.map((c) => ({
    chave: c.chave,
    label: c.label,
    tipo: 'checkbox' as const,
  })),
  { chave: 'observacoes', label: 'Observações adicionais sobre o lote', tipo: 'texto_longo' },
];

export const CHAVES_LOTE_OBRIGATORIAS: ChaveLoteDisponivel[] = LOTES_DISPONIVEIS_CAMPOS.filter(
  (c) => c.obrigatorio,
).map((c) => c.chave);

export type LinhaLoteDisponivel = {
  lote_id: string;
  quadra: string;
  lote: string;
  dimensao_frente_m: string;
  dimensao_fundo_m: string;
  dimensao_lado_direito_m: string;
  dimensao_lado_esquerdo_m: string;
  area_m2: string;
  valor: string;
  situacao_documental: string;
  fotos_path: string;
  observacoes: string;
  /** FK em `condominios_lotes` após sync com cadastro. */
  cadastro_lote_id?: string | null;
} & Record<ChaveLoteCheckbox, string>;

function checkboxDefaults(): Record<ChaveLoteCheckbox, string> {
  return Object.fromEntries(LOTES_DISPONIVEIS_CHECKBOXES.map((c) => [c.chave, 'false'])) as Record<
    ChaveLoteCheckbox,
    string
  >;
}

export const LOTE_DISPONIVEL_VAZIO: Omit<LinhaLoteDisponivel, 'lote_id'> = {
  quadra: '',
  lote: '',
  dimensao_frente_m: '',
  dimensao_fundo_m: '',
  dimensao_lado_direito_m: '',
  dimensao_lado_esquerdo_m: '',
  area_m2: '',
  valor: '',
  situacao_documental: '',
  fotos_path: '',
  observacoes: '',
  cadastro_lote_id: null,
  ...checkboxDefaults(),
};

export function loteDisponivelParaAtributosBoolean(
  lote: LinhaLoteDisponivel,
): Record<ChaveLoteCheckbox, boolean> {
  const out = {} as Record<ChaveLoteCheckbox, boolean>;
  for (const { chave } of LOTES_DISPONIVEIS_CHECKBOXES) {
    out[chave] = lote[chave] === 'true';
  }
  return out;
}

/** Converte atributos canônicos (ATRIBUTOS_LOTE) → colunas de `condominios_lotes`. */
export function loteDisponivelParaCondominioLoteDb(lote: LinhaLoteDisponivel): CondominioLoteAtributos {
  verificarMapeamentoAtributosLote();
  const attrs = loteDisponivelParaAtributosBoolean(lote);
  const out: CondominioLoteAtributos = {};
  for (const { chave } of LOTES_DISPONIVEIS_CHECKBOXES) {
    const coluna = CHAVE_LOTE_PARA_COLUNA_DB[chave];
    if (!coluna) {
      console.warn(
        `[lotes-disponiveis] Atributo "${chave}" sem coluna em condominios_lotes — valor ignorado na sync.`,
      );
      continue;
    }
    if (!isColunaAtributoCondominioLote(coluna)) {
      console.warn(
        `[lotes-disponiveis] Coluna "${coluna}" (chave "${chave}") não reconhecida em condominios_lotes — valor ignorado na sync.`,
      );
      continue;
    }
    out[coluna] = attrs[chave];
  }
  return out;
}

export function gerarLoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function strField(o: Record<string, unknown>, k: string, fallback = ''): string {
  const v = o[k];
  if (typeof v === 'string') return v;
  if (v != null && v !== '') return String(v);
  return fallback;
}

function normalizarCheckbox(o: Record<string, unknown>, chave: ChaveLoteCheckbox): string {
  if (strField(o, chave, 'false') === 'true') return 'true';
  for (const leg of LEGACY_CHAVE_ALIASES[chave] ?? []) {
    if (strField(o, leg, 'false') === 'true') return 'true';
  }
  return 'false';
}

/** Valor do lote formatado para exibição no campo (sem prefixo R$). */
export function formatValorLoteCampo(raw: string | null | undefined): string {
  const t = String(raw ?? '')
    .trim()
    .replace(/^R\$\s*/i, '');
  if (!t) return '';
  const n = parseDecimalInput(t);
  if (n != null) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return t;
}

/** Normaliza digitação do valor do lote (pontos e vírgulas automáticos). */
export function normalizarValorLoteDigitacao(raw: string): string {
  return formatMoedaDigitosPtBr(raw);
}

/** Lê paths de fotos: JSON array ou path único legado. */
export function parseFotosLotePaths(valor: string | null | undefined): string[] {
  const t = String(valor ?? '').trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((p) => String(p ?? '').trim()).filter(Boolean);
      }
    } catch {
      /* legado: trata como path único */
    }
  }
  return [t];
}

/** Serializa lista de fotos (path único se 1 item; JSON se vários). */
export function serializarFotosLotePaths(paths: readonly string[]): string {
  const limpos = paths.map((p) => String(p).trim()).filter(Boolean);
  if (limpos.length === 0) return '';
  if (limpos.length === 1) return limpos[0]!;
  return JSON.stringify(limpos);
}

export function rotuloArquivoFoto(path: string): string {
  return path.split('/').pop() ?? path;
}

export function normalizarLinhaLote(raw: unknown, fallbackIndex = 0): LinhaLoteDisponivel {
  const o = isRecord(raw) ? raw : {};
  // TODO: migrar respostas legadas de 'vista_privilegiada' e 'muro' no ponto de leitura do banco.
  if (isRecord(o) && String(o.muro ?? '') === 'true') {
    void o.muro;
  }
  const loteId =
    typeof o.lote_id === 'string' && o.lote_id.trim()
      ? o.lote_id.trim()
      : gerarLoteId() + (fallbackIndex > 0 ? `-${fallbackIndex}` : '');

  const checkboxes = {} as Record<ChaveLoteCheckbox, string>;
  for (const { chave } of LOTES_DISPONIVEIS_CHECKBOXES) {
    checkboxes[chave] = normalizarCheckbox(o, chave);
  }

  return {
    lote_id: loteId,
    quadra: strField(o, 'quadra'),
    lote: strField(o, 'lote'),
    dimensao_frente_m: strField(o, 'dimensao_frente_m'),
    dimensao_fundo_m: strField(o, 'dimensao_fundo_m'),
    dimensao_lado_direito_m: strField(o, 'dimensao_lado_direito_m'),
    dimensao_lado_esquerdo_m: strField(o, 'dimensao_lado_esquerdo_m'),
    area_m2: strField(o, 'area_m2'),
    valor: strField(o, 'valor'),
    situacao_documental: strField(o, 'situacao_documental'),
    fotos_path: strField(o, 'fotos_path'),
    observacoes: strField(o, 'observacoes'),
    cadastro_lote_id:
      typeof o.cadastro_lote_id === 'string' && o.cadastro_lote_id.trim() ? o.cadastro_lote_id.trim() : null,
    ...checkboxes,
  };
}

export function parseLotesDisponiveisCondominio(raw: unknown): LinhaLoteDisponivel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, idx) => normalizarLinhaLote(row, idx));
}

export function criarLoteDisponivelVazio(): LinhaLoteDisponivel {
  return { lote_id: gerarLoteId(), ...LOTE_DISPONIVEL_VAZIO };
}

export function rotuloLoteDisponivel(lote: LinhaLoteDisponivel): string {
  const q = lote.quadra.trim();
  const l = lote.lote.trim();
  if (q && l) return `Quadra ${q} / Lote ${l}`;
  if (q || l) return q || l;
  return 'Novo lote';
}

export function loteDisponivelCompleto(lote: LinhaLoteDisponivel): boolean {
  return CHAVES_LOTE_OBRIGATORIAS.every((chave) => Boolean(String(lote[chave] ?? '').trim()));
}

export function loteEscolhidoNaLinha(
  linha: LinhaProspectCondominio,
): LinhaLoteDisponivel | null {
  const escolhidoId = linha.lote_escolhido_id?.trim();
  if (!escolhidoId) return null;
  return linha.lotes_disponiveis?.find((l) => l.lote_id === escolhidoId) ?? null;
}

export function linhaTemLoteEscolhido(linha: LinhaProspectCondominio): boolean {
  return loteEscolhidoNaLinha(linha) != null;
}

/** Pelo menos um lote cadastrado na sessão do condomínio. */
export function sessaoLotesCondominioCompleta(lotes: LinhaLoteDisponivel[] | undefined): boolean {
  return (lotes?.length ?? 0) > 0;
}

export function linhaLotesCondominioCompleta(linha: LinhaProspectCondominio): boolean {
  if (!sessaoLotesCondominioCompleta(linha.lotes_disponiveis)) return false;
  return linhaTemLoteEscolhido(linha);
}

export function todasSessoesLotesCompletas(linhas: LinhaProspectCondominio[]): boolean {
  const comNome = linhas.filter(linhaProspectTemNome);
  if (comNome.length === 0) return false;
  return comNome.every(linhaLotesCondominioCompleta);
}

export function atualizarLotesPreenchidosEm(linha: LinhaProspectCondominio): LinhaProspectCondominio {
  if (linhaLotesCondominioCompleta(linha)) {
    return { ...linha, lotes_preenchidos_em: linha.lotes_preenchidos_em ?? new Date().toISOString() };
  }
  return { ...linha, lotes_preenchidos_em: null };
}
