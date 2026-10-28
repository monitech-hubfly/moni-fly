/** Espelho Dados Pré Obra (Funil Pré Obra e Obra) ↔ checklist da fase. Chave `preobra:<campo>`. */

export const PREOBRA_CHECKLIST_PREFIX = 'preobra:';

const CAMPOS_TEXTO = ['docs_condominio', 'docs_lote', 'link_projeto_legal'] as const;

/** Slug do checklist → coluna em kanban_cards. As três primeiras são timestamptz já existentes. */
const CAMPOS_DATA: Record<string, string> = {
  data_aprovacao_condominio: 'condominio_aprovada_em',
  data_aprovacao_prefeitura: 'prefeitura_aprovada_em',
  data_emissao_alvara: 'alvara_emitido_em',
  data_envio_credito_obra: 'data_envio_credito_obra',
  data_aprovacao_credito_obra: 'data_aprovacao_credito_obra',
  data_inicio_obra: 'data_inicio_obra',
};

const CAMPOS_DATAS_MULTI = ['datas_comunique_se_condominio', 'datas_comunique_se_prefeitura'] as const;

const COLUNAS_DATA_TIMESTAMP = new Set([
  'condominio_aprovada_em',
  'prefeitura_aprovada_em',
  'alvara_emitido_em',
]);

export function chavePreobraChecklist(campo: string): string {
  return `${PREOBRA_CHECKLIST_PREFIX}${campo}`;
}

export function campoPreobraFromChave(chave: string): string | null {
  const c = chave.trim();
  if (!c.startsWith(PREOBRA_CHECKLIST_PREFIX)) return null;
  const campo = c.slice(PREOBRA_CHECKLIST_PREFIX.length);
  return campo || null;
}

export function datasPreObraFromValor(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item ?? '').trim().slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  }
  const s = String(raw ?? '').trim();
  if (!s) return [];
  try {
    return datasPreObraFromValor(JSON.parse(s) as unknown);
  } catch {
    return [];
  }
}

export function valorChecklistDatasPreObra(datas: readonly string[]): string {
  const filled = datasPreObraFromValor([...datas]);
  return filled.length > 0 ? JSON.stringify(filled) : '';
}

function ymd(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const head = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
}

export type PreObraCardPatch = {
  docs_condominio?: string | null;
  docs_lote?: string | null;
  link_projeto_legal?: string | null;
  condominio_aprovada_em?: string | null;
  prefeitura_aprovada_em?: string | null;
  alvara_emitido_em?: string | null;
  data_envio_credito_obra?: string | null;
  data_aprovacao_credito_obra?: string | null;
  data_inicio_obra?: string | null;
  datas_comunique_se_condominio?: string[];
  datas_comunique_se_prefeitura?: string[];
};

export function preobraEspelhoFromCard(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const campo of CAMPOS_TEXTO) {
    const v = raw[campo];
    out[chavePreobraChecklist(campo)] = v == null ? '' : String(v);
  }
  for (const [campo, coluna] of Object.entries(CAMPOS_DATA)) {
    out[chavePreobraChecklist(campo)] = ymd(raw[coluna]);
  }
  for (const campo of CAMPOS_DATAS_MULTI) {
    out[chavePreobraChecklist(campo)] = valorChecklistDatasPreObra(datasPreObraFromValor(raw[campo]));
  }
  return out;
}

export function preobraCardPatchFromChecklist(chave: string, valor: string | null): PreObraCardPatch | null {
  const campo = campoPreobraFromChave(chave);
  if (!campo) return null;
  const raw = String(valor ?? '').trim();
  if ((CAMPOS_TEXTO as readonly string[]).includes(campo)) {
    return { [campo]: raw || null } as PreObraCardPatch;
  }
  if (campo in CAMPOS_DATA) {
    const coluna = CAMPOS_DATA[campo];
    return { [coluna]: ymd(raw) || null } as PreObraCardPatch;
  }
  if ((CAMPOS_DATAS_MULTI as readonly string[]).includes(campo)) {
    return { [campo]: datasPreObraFromValor(raw) } as PreObraCardPatch;
  }
  return null;
}

export function checklistLinhasFromPreObraCard(
  raw: Record<string, unknown>,
): { chave: string; valor: string | null }[] {
  const espelho = preobraEspelhoFromCard(raw);
  return Object.entries(espelho).map(([chave, valor]) => ({
    chave,
    valor: valor.trim() ? valor : null,
  }));
}

const PATCH_COLUNA_CHECKLIST: Record<string, string> = {
  docs_condominio: 'docs_condominio',
  docs_lote: 'docs_lote',
  link_projeto_legal: 'link_projeto_legal',
  condominio_aprovada_em: 'data_aprovacao_condominio',
  prefeitura_aprovada_em: 'data_aprovacao_prefeitura',
  alvara_emitido_em: 'data_emissao_alvara',
  data_envio_credito_obra: 'data_envio_credito_obra',
  data_aprovacao_credito_obra: 'data_aprovacao_credito_obra',
  data_inicio_obra: 'data_inicio_obra',
  datas_comunique_se_condominio: 'datas_comunique_se_condominio',
  datas_comunique_se_prefeitura: 'datas_comunique_se_prefeitura',
};

/** Espelha só as colunas presentes no patch. Não emite as demais como vazio. */
export function checklistLinhasFromPreObraPatch(
  patch: PreObraCardPatch,
): { chave: string; valor: string | null }[] {
  const rec = patch as Record<string, unknown>;
  const linhas: { chave: string; valor: string | null }[] = [];
  for (const [coluna, campo] of Object.entries(PATCH_COLUNA_CHECKLIST)) {
    if (!Object.prototype.hasOwnProperty.call(rec, coluna) || rec[coluna] === undefined) continue;
    const raw = rec[coluna];
    if (coluna === 'datas_comunique_se_condominio' || coluna === 'datas_comunique_se_prefeitura') {
      const v = valorChecklistDatasPreObra(datasPreObraFromValor(raw));
      linhas.push({ chave: chavePreobraChecklist(campo), valor: v.trim() ? v : null });
      continue;
    }
    if (coluna in CAMPOS_DATA || COLUNAS_DATA_TIMESTAMP.has(coluna)) {
      const v = ymd(raw);
      linhas.push({ chave: chavePreobraChecklist(campo), valor: v || null });
      continue;
    }
    const v = raw == null ? '' : String(raw).trim();
    linhas.push({ chave: chavePreobraChecklist(campo), valor: v || null });
  }
  return linhas;
}

export function colunaDataPreObraEhTimestamp(coluna: string): boolean {
  return COLUNAS_DATA_TIMESTAMP.has(coluna);
}
