import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import { linhaProspectTemNome } from '@/lib/kanban/condominio-prospect-pesquisa';

export const LOTES_DISPONIVEIS_CHECKBOXES = [
  { chave: 'vista_privilegiada', label: 'Vista privilegiada' },
  { chave: 'terreno_plano', label: 'Terreno plano' },
  { chave: 'terreno_aclive', label: 'Terreno aclive' },
  { chave: 'terreno_aclive_acentuado', label: 'Terreno aclive acentuado' },
  { chave: 'terreno_declive', label: 'Terreno declive' },
  { chave: 'terreno_declive_acentuado', label: 'Terreno declive acentuado' },
  { chave: 'fundo_mata', label: 'Fundo mata' },
  { chave: 'frente_mata', label: 'Frente mata' },
  { chave: 'perto_area_verde', label: 'Perto de área verde' },
  { chave: 'perto_lago', label: 'Perto do lago' },
  { chave: 'fundo_lago', label: 'Fundo lago' },
  { chave: 'frente_lago', label: 'Frente lago' },
  { chave: 'perto_area_convivencia', label: 'Perto de área de convivência' },
  { chave: 'perto_lixeira', label: 'Perto de lixeira' },
  { chave: 'perto_portaria', label: 'Perto da portaria' },
  { chave: 'muro', label: 'Muro' },
] as const;

export type ChaveLoteCheckbox = (typeof LOTES_DISPONIVEIS_CHECKBOXES)[number]['chave'];

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
  return strField(o, chave, 'false') === 'true' ? 'true' : 'false';
}

export function normalizarLinhaLote(raw: unknown, fallbackIndex = 0): LinhaLoteDisponivel {
  const o = isRecord(raw) ? raw : {};
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
