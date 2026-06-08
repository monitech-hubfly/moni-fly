import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import { linhaProspectTemNome } from '@/lib/kanban/condominio-prospect-pesquisa';

export type ChaveLoteDisponivel =
  | 'quadra'
  | 'lote'
  | 'area_m2'
  | 'valor'
  | 'situacao_documental'
  | 'fotos_path'
  | 'vista_privilegiada'
  | 'perto_area_verde'
  | 'muro'
  | 'perto_area_convivencia'
  | 'perto_lixeira'
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
  { chave: 'vista_privilegiada', label: 'Vista privilegiada', tipo: 'checkbox' },
  { chave: 'perto_area_verde', label: 'Perto de área verde', tipo: 'checkbox' },
  { chave: 'muro', label: 'Muro', tipo: 'checkbox' },
  { chave: 'perto_area_convivencia', label: 'Perto de área de convivência', tipo: 'checkbox' },
  { chave: 'perto_lixeira', label: 'Perto de lixeira', tipo: 'checkbox' },
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
  vista_privilegiada: string;
  perto_area_verde: string;
  muro: string;
  perto_area_convivencia: string;
  perto_lixeira: string;
  observacoes: string;
  /** FK em `condominios_lotes` após sync com cadastro. */
  cadastro_lote_id?: string | null;
};

export const LOTE_DISPONIVEL_VAZIO: Omit<LinhaLoteDisponivel, 'lote_id'> = {
  quadra: '',
  lote: '',
  area_m2: '',
  valor: '',
  situacao_documental: '',
  fotos_path: '',
  vista_privilegiada: 'false',
  perto_area_verde: 'false',
  muro: 'false',
  perto_area_convivencia: 'false',
  perto_lixeira: 'false',
  observacoes: '',
  cadastro_lote_id: null,
};

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

export function normalizarLinhaLote(raw: unknown, fallbackIndex = 0): LinhaLoteDisponivel {
  const o = isRecord(raw) ? raw : {};
  const loteId =
    typeof o.lote_id === 'string' && o.lote_id.trim()
      ? o.lote_id.trim()
      : gerarLoteId() + (fallbackIndex > 0 ? `-${fallbackIndex}` : '');

  return {
    lote_id: loteId,
    quadra: strField(o, 'quadra'),
    lote: strField(o, 'lote'),
    area_m2: strField(o, 'area_m2'),
    valor: strField(o, 'valor'),
    situacao_documental: strField(o, 'situacao_documental'),
    fotos_path: strField(o, 'fotos_path'),
    vista_privilegiada: strField(o, 'vista_privilegiada', 'false') === 'true' ? 'true' : 'false',
    perto_area_verde: strField(o, 'perto_area_verde', 'false') === 'true' ? 'true' : 'false',
    muro: strField(o, 'muro', 'false') === 'true' ? 'true' : 'false',
    perto_area_convivencia: strField(o, 'perto_area_convivencia', 'false') === 'true' ? 'true' : 'false',
    perto_lixeira: strField(o, 'perto_lixeira', 'false') === 'true' ? 'true' : 'false',
    observacoes: strField(o, 'observacoes'),
    cadastro_lote_id:
      typeof o.cadastro_lote_id === 'string' && o.cadastro_lote_id.trim() ? o.cadastro_lote_id.trim() : null,
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

/** Pelo menos um lote com todos os campos obrigatórios na sessão do condomínio. */
export function sessaoLotesCondominioCompleta(lotes: LinhaLoteDisponivel[] | undefined): boolean {
  if (!lotes?.length) return false;
  return lotes.some(loteDisponivelCompleto);
}

export function linhaLotesCondominioCompleta(linha: LinhaProspectCondominio): boolean {
  return sessaoLotesCondominioCompleta(linha.lotes_disponiveis);
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
