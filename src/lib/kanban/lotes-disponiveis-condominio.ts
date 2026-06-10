import type { CondominioLoteAtributos, CondominioLoteColunaAtributo } from '@/lib/condominios-lotes';
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

export type ChaveLoteDisponivel =
  | ChaveLoteCheckbox
  | 'quadra'
  | 'lote'
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
  { chave: 'quadra', label: 'Quadra', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: 12' },
  { chave: 'lote', label: 'Lote', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: 34' },
  { chave: 'area_m2', label: 'Área m²', tipo: 'numero', obrigatorio: true },
  { chave: 'valor', label: 'Valor do lote (R$)', tipo: 'numero', obrigatorio: true },
  { chave: 'situacao_documental', label: 'Situação documental', tipo: 'texto', obrigatorio: true },
  { chave: 'fotos_path', label: 'Fotos do lote', tipo: 'anexo', obrigatorio: true },
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
  const attrs = loteDisponivelParaAtributosBoolean(lote);
  const out: CondominioLoteAtributos = {};
  for (const { chave } of LOTES_DISPONIVEIS_CHECKBOXES) {
    out[CHAVE_LOTE_PARA_COLUNA_DB[chave]] = attrs[chave];
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

/** Pelo menos um lote com todos os campos obrigatórios na sessão do condomínio. */
export function sessaoLotesCondominioCompleta(lotes: LinhaLoteDisponivel[] | undefined): boolean {
  if (!lotes?.length) return false;
  return lotes.some(loteDisponivelCompleto);
}

export function linhaLotesCondominioCompleta(linha: LinhaProspectCondominio): boolean {
  if (!sessaoLotesCondominioCompleta(linha.lotes_disponiveis)) return false;
  const escolhido = loteEscolhidoNaLinha(linha);
  if (!escolhido) return false;
  return loteDisponivelCompleto(escolhido);
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
