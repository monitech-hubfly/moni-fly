import {
  decimalInputFromValue,
  integerInputFromValue,
  parseDecimalInput,
  type CondominioRow,
} from '@/lib/condominios';
import {
  parseLotesDisponiveisCondominio,
  type LinhaLoteDisponivel,
} from '@/lib/kanban/lotes-disponiveis-condominio';

export type FaixaCondominioId = 'premium' | 'intermediaria' | 'entrada';

/** Rascunho sugerido (placeholder) — editável livremente pelo usuário. */
export const PLACEHOLDER_CASAS_EM_CONSTRUCAO = `Existem atualmente 24 casas únicas à venda no [ ], distribuídas em [0] anúncios totais ([0] casas com múltiplos corretores anunciando simultaneamente). [0]% das casas que entraram em catálogo já foram desativadas, levando em média [0] meses e [0] dias até sair do mercado (considerando apenas o tracking de anúncios, sem considerar a média dada pelos corretores).

De todas as casas a venda [0] estão pronta e [0] estão sendo construídas, sendo [0] para venda e [0] para cliente final`;

export const PLACEHOLDER_COMO_SAO_ESSAS_CASAS =
  '[0] casas na faixa de preço de R$[0.00]M. As áreas variam de [000]m² a [000]m². O grupo está listado há entre [00] e [00] meses, com média de ~[00] meses.';

export const PLACEHOLDER_FAIXAS_PRECO_CASAS =
  'Produto a R$ [0.00]M está no centro do cluster. Os preços ficam entre R$ [0.00]M e R$ [0.00]M, todas próximas ao ticket do produto. O R$/m² oscila entre R$[00.000] e R$ [00.000].';

export const FAIXAS_CONDOMINIO: { id: FaixaCondominioId; label: string }[] = [
  { id: 'premium', label: 'Faixa Premium' },
  { id: 'intermediaria', label: 'Faixa Intermediária' },
  { id: 'entrada', label: 'Faixa de Entrada' },
];

/** Campos globais do condomínio (fora das faixas): caracterização + lotes. */
export type ChaveGlobalCondominio =
  | 'localizacao_contexto'
  | 'caracteristicas_condominio'
  | 'tempo_condominio'
  | 'oferta_estoque'
  | 'q_casas_caracteristicas_buscadas'
  | 'q_casas_caracteristicas_elogiadas'
  | 'mapa_condominio_path'
  | 'volume_velocidade_compra'
  | 'recuo_frontal_m'
  | 'recuo_fundo_m'
  | 'recuo_lateral_m'
  | 'recuo_diferenca_esquina_muros'
  | 'tamanho_lote_padrao'
  | 'q_lotes_total_disponiveis'
  | 'q_lotes_tamanho_medio'
  | 'q_lotes_preco_m2'
  | 'q_lotes_area_maior_demanda';

/** @deprecated Use ChaveGlobalCondominio. */
export type ChaveCaracterizacaoGlobal = ChaveGlobalCondominio;

/** Campos repetidos em cada faixa (Premium, Intermediária, Entrada). */
export type ChaveFaixaCondominio =
  | 'q_casas_em_construcao'
  | 'q_casas_como_sao'
  | 'q_casas_prontas'
  | 'q_casas_faixas_preco'
  | 'q_casas_preco_m2'
  | 'q_casas_tempo_venda'
  | 'q_casas_vendidas_12m'
  | 'q_casas_remanescentes_demora'
  | 'q_locacao_valores';

/** @deprecated Use ChaveCaracterizacaoGlobal ou ChaveFaixaCondominio. */
export type ChaveCaracterizacaoCondominio = ChaveCaracterizacaoGlobal | ChaveFaixaCondominio;

/** @deprecated Campos de faixa — use ChaveFaixaCondominio. */
export type ChavePesquisaCondominio = ChaveFaixaCondominio;

export type ChaveLinhaProspectCondominio = ChaveGlobalCondominio | ChaveFaixaCondominio;

export type CampoGlobalCondominio = {
  chave: ChaveGlobalCondominio;
  label: string;
  tipo: 'texto' | 'texto_longo' | 'anexo' | 'numero';
  placeholder?: string;
  grupo: 'caracterizacao' | 'lotes';
  obrigatorio?: boolean;
};

/** @deprecated Use CampoGlobalCondominio. */
export type CampoCaracterizacaoGlobal = CampoGlobalCondominio;

export type CampoFaixaCondominio = {
  chave: ChaveFaixaCondominio;
  label: string;
  tipo: 'texto' | 'texto_longo';
  placeholder?: string;
  obrigatorio?: boolean;
};

export const CARACTERIZACAO_GLOBAL_CAMPOS: CampoGlobalCondominio[] = [
  {
    chave: 'localizacao_contexto',
    label: 'Localização – Condomínio e Contexto',
    tipo: 'texto_longo',
    placeholder: 'Posicionamento do condomínio, público e dinâmica de mercado.',
    grupo: 'caracterizacao',
  },
  {
    chave: 'caracteristicas_condominio',
    label: 'Características do Condomínio',
    tipo: 'texto_longo',
    placeholder: 'Infraestrutura, padrão de produto e maturidade.',
    grupo: 'caracterizacao',
  },
  {
    chave: 'tempo_condominio',
    label: 'Tempo de Condomínio',
    tipo: 'texto',
    placeholder: 'Tempo de existência ou maturação do empreendimento.',
    grupo: 'caracterizacao',
  },
  {
    chave: 'oferta_estoque',
    label: 'Oferta Atual (Estoque)',
    tipo: 'texto_longo',
    grupo: 'caracterizacao',
    obrigatorio: true,
  },
  {
    chave: 'q_casas_caracteristicas_buscadas',
    label: 'Quais as características os clientes estão buscando nas casas desse condomínio?',
    tipo: 'texto_longo',
    grupo: 'caracterizacao',
  },
  {
    chave: 'q_casas_caracteristicas_elogiadas',
    label:
      'E das casas vendidas ultimamente, quais eram as características mais elogiadas pelos compradores?',
    tipo: 'texto_longo',
    grupo: 'caracterizacao',
  },
  {
    chave: 'mapa_condominio_path',
    label: 'Mapa do Condomínio (cole o mapa com a infraestrutura demarcada por Pins)',
    tipo: 'anexo',
    grupo: 'caracterizacao',
  },
  {
    chave: 'volume_velocidade_compra',
    label: 'Volume, velocidade e comportamento de compra do condomínio',
    tipo: 'texto_longo',
    grupo: 'caracterizacao',
    obrigatorio: true,
  },
  {
    chave: 'recuo_frontal_m',
    label: 'Recuo frontal',
    tipo: 'numero',
    placeholder: 'Metros (decimal)',
    grupo: 'caracterizacao',
  },
  {
    chave: 'recuo_fundo_m',
    label: 'Recuo de fundo',
    tipo: 'numero',
    placeholder: 'Metros (decimal)',
    grupo: 'caracterizacao',
  },
  {
    chave: 'recuo_lateral_m',
    label: 'Recuo lateral',
    tipo: 'numero',
    placeholder: 'Metros (decimal)',
    grupo: 'caracterizacao',
  },
  {
    chave: 'recuo_diferenca_esquina_muros',
    label:
      'Há diferença no padrão de recuo para lotes de esquina? Lotes junto aos muros do condomínio?',
    tipo: 'texto_longo',
    grupo: 'caracterizacao',
  },
];

export const LOTES_GLOBAL_CAMPOS: CampoGlobalCondominio[] = [
  {
    chave: 'tamanho_lote_padrao',
    label: 'Tamanho lote padrão',
    tipo: 'texto',
    grupo: 'lotes',
    obrigatorio: true,
  },
  {
    chave: 'q_lotes_total_disponiveis',
    label: 'Quantos lotes esse condomínio tem? Quantos estão disponíveis para venda?',
    tipo: 'texto',
    grupo: 'lotes',
    obrigatorio: true,
  },
  {
    chave: 'q_lotes_tamanho_medio',
    label: 'Qual o tamanho médio dos lotes?',
    tipo: 'texto',
    grupo: 'lotes',
    obrigatorio: true,
  },
  {
    chave: 'q_lotes_preco_m2',
    label: 'Qual o preço médio do m² de venda dos lotes?',
    tipo: 'texto',
    grupo: 'lotes',
    obrigatorio: true,
  },
  {
    chave: 'q_lotes_area_maior_demanda',
    label: 'Qual a área onde os lotes são mais valorizados e tem maior demanda?',
    tipo: 'texto',
    grupo: 'lotes',
    obrigatorio: true,
  },
];

export const FAIXA_CONDOMINIO_CAMPOS: CampoFaixaCondominio[] = [
  {
    chave: 'q_casas_em_construcao',
    label:
      'Quantas casas estão sendo construídas? Dessas, quantas estão para venda e quantas são para cliente final?',
    tipo: 'texto_longo',
    placeholder: PLACEHOLDER_CASAS_EM_CONSTRUCAO,
  },
  {
    chave: 'q_casas_como_sao',
    label: 'Como são essas casas?',
    tipo: 'texto_longo',
    placeholder: PLACEHOLDER_COMO_SAO_ESSAS_CASAS,
  },
  {
    chave: 'q_casas_prontas',
    label: 'Quantas casas estão prontas?',
    tipo: 'texto',
    obrigatorio: true,
  },
  {
    chave: 'q_casas_faixas_preco',
    label: 'Quais as faixas de preço dessas casas?',
    tipo: 'texto_longo',
    placeholder: PLACEHOLDER_FAIXAS_PRECO_CASAS,
  },
  {
    chave: 'q_casas_preco_m2',
    label: 'Qual o preço do m² de venda das casas?',
    tipo: 'texto',
    obrigatorio: true,
  },
  {
    chave: 'q_casas_tempo_venda',
    label: 'Quanto tempo leva, em média, para uma casa ser vendida depois de pronta?',
    tipo: 'texto',
    obrigatorio: true,
  },
  {
    chave: 'q_casas_vendidas_12m',
    label: 'Quantas casas foram vendidas nos últimos 12 meses?',
    tipo: 'texto',
    obrigatorio: true,
  },
  {
    chave: 'q_casas_remanescentes_demora',
    label:
      'O que fez as casas remanescentes demorarem tanto para serem vendidas? (preço, acabamento, localização, etc.)',
    tipo: 'texto_longo',
    obrigatorio: true,
  },
  {
    chave: 'q_locacao_valores',
    label: 'Qual valor das casas para locação? Dê alguns exemplos abaixo',
    tipo: 'texto_longo',
    obrigatorio: true,
  },
];

/** @deprecated Use CARACTERIZACAO_GLOBAL_CAMPOS. */
export const CARACTERIZACAO_CONDOMINIO_CAMPOS = CARACTERIZACAO_GLOBAL_CAMPOS;

export const GLOBAL_CONDOMINIO_CAMPOS: CampoGlobalCondominio[] = [
  ...CARACTERIZACAO_GLOBAL_CAMPOS,
  ...LOTES_GLOBAL_CAMPOS,
];

export const CHAVES_TODAS_GLOBAL: ChaveGlobalCondominio[] = GLOBAL_CONDOMINIO_CAMPOS.map((c) => c.chave);

export const CHAVES_RECUO_CONDOMINIO = [
  'recuo_frontal_m',
  'recuo_fundo_m',
  'recuo_lateral_m',
] as const satisfies readonly ChaveGlobalCondominio[];

export type ChaveRecuoCondominioDb = (typeof CHAVES_RECUO_CONDOMINIO)[number];

export const CHAVES_GLOBAL_OBRIGATORIAS: ChaveGlobalCondominio[] = GLOBAL_CONDOMINIO_CAMPOS.filter(
  (c) => c.obrigatorio,
).map((c) => c.chave);

/** @deprecated Use CHAVES_GLOBAL_OBRIGATORIAS. */
export const CHAVES_CARACTERIZACAO_OBRIGATORIAS: ChaveGlobalCondominio[] = CHAVES_GLOBAL_OBRIGATORIAS;

export const CHAVES_FAIXA_TODAS: ChaveFaixaCondominio[] = FAIXA_CONDOMINIO_CAMPOS.map((c) => c.chave);

export const CHAVES_FAIXA_OBRIGATORIAS: ChaveFaixaCondominio[] = FAIXA_CONDOMINIO_CAMPOS.filter(
  (c) => c.obrigatorio,
).map((c) => c.chave);

/** @deprecated Use CHAVES_FAIXA_OBRIGATORIAS. */
export const CHAVES_PESQUISA_OBRIGATORIAS: ChaveFaixaCondominio[] = CHAVES_FAIXA_OBRIGATORIAS;

export type DadosFaixaCondominio = Partial<Record<ChaveFaixaCondominio, string>>;

export type FaixasCondominioPorId = Record<FaixaCondominioId, DadosFaixaCondominio>;

export type LinhaProspectCondominio = {
  row_id: string;
  condominio_id?: string | null;
  condominio: string;
  ticket_lote: string;
  ticket_casas: string;
  ticket_m2: string;
  estimativa_giro?: string;
  cadastro_confirmado_em?: string | null;
  cadastro_snapshot?: string | null;
  cadastro_carregado_snapshot?: string | null;
  localizacao_contexto?: string;
  caracteristicas_condominio?: string;
  tempo_condominio?: string;
  oferta_estoque?: string;
  q_casas_caracteristicas_buscadas?: string;
  q_casas_caracteristicas_elogiadas?: string;
  mapa_condominio_path?: string;
  volume_velocidade_compra?: string;
  recuo_frontal_m?: string;
  recuo_fundo_m?: string;
  recuo_lateral_m?: string;
  recuo_diferenca_esquina_muros?: string;
  tamanho_lote_padrao?: string;
  q_lotes_total_disponiveis?: string;
  q_lotes_tamanho_medio?: string;
  q_lotes_preco_m2?: string;
  q_lotes_area_maior_demanda?: string;
  faixas?: FaixasCondominioPorId;
  pesquisa_preenchida_em?: string | null;
  lotes_disponiveis?: LinhaLoteDisponivel[];
  lotes_preenchidos_em?: string | null;
  /** `lote_id` do lote marcado como escolhido nesta sessão (obrigatório para concluir a fase). */
  lote_escolhido_id?: string | null;
};

/** @deprecated Use FAIXA_CONDOMINIO_CAMPOS agrupados por secao. */
export type SecaoPesquisaCondominio = {
  id: string;
  titulo: string;
  perguntas: { chave: ChaveFaixaCondominio; label: string; tipo: 'texto' | 'texto_longo' }[];
};

/** @deprecated Use FAIXA_CONDOMINIO_CAMPOS. */
export const PESQUISA_CONDOMINIO_SECOES: SecaoPesquisaCondominio[] = [
  {
    id: 'liquidez',
    titulo: 'Liquidez e Valorização Exponencial',
    perguntas: FAIXA_CONDOMINIO_CAMPOS.map((c) => ({
      chave: c.chave,
      label: c.label,
      tipo: c.tipo,
    })),
  },
];

export const CAMPOS_CADASTRO_LINHA_PROSPECT = [
  'condominio',
  'ticket_lote',
  'ticket_casas',
  'ticket_m2',
  'estimativa_giro',
] as const;

export function criarFaixasVazias(): FaixasCondominioPorId {
  return { premium: {}, intermediaria: {}, entrada: {} };
}

export const LINHA_PROSPECT_VAZIA: Omit<LinhaProspectCondominio, 'row_id'> = {
  condominio_id: null,
  condominio: '',
  ticket_lote: '',
  ticket_casas: '',
  ticket_m2: '',
  estimativa_giro: '',
  cadastro_confirmado_em: null,
  cadastro_snapshot: null,
  cadastro_carregado_snapshot: null,
  faixas: criarFaixasVazias(),
};

export function valorFaixaCondominio(
  linha: LinhaProspectCondominio,
  faixaId: FaixaCondominioId,
  chave: ChaveFaixaCondominio,
): string {
  return String(linha.faixas?.[faixaId]?.[chave] ?? '').trim();
}

export function faixaCondominioCompleta(
  linha: LinhaProspectCondominio,
  faixaId: FaixaCondominioId,
): boolean {
  return CHAVES_FAIXA_OBRIGATORIAS.every((chave) =>
    Boolean(valorFaixaCondominio(linha, faixaId, chave)),
  );
}

export function todasFaixasCondominioCompletas(linha: LinhaProspectCondominio): boolean {
  return FAIXAS_CONDOMINIO.every((f) => faixaCondominioCompleta(linha, f.id));
}

const CHAVES_GLOBAL_MIGRADAS_DE_FAIXA: ChaveGlobalCondominio[] = [
  'oferta_estoque',
  'volume_velocidade_compra',
  'tamanho_lote_padrao',
  'q_lotes_total_disponiveis',
  'q_lotes_tamanho_medio',
  'q_lotes_preco_m2',
  'q_lotes_area_maior_demanda',
];

const CHAVES_FAIXA_MIGRADAS_DE_GLOBAL: ChaveFaixaCondominio[] = [
  'q_casas_em_construcao',
  'q_casas_como_sao',
  'q_casas_faixas_preco',
];

const CHAVES_OBSOLETAS_FAIXA = [
  'oferta_estoque',
  'demanda_historico_vendas',
  'volume_velocidade_compra',
  'tamanho_lote_padrao',
  'q_lotes_total_disponiveis',
  'q_lotes_tamanho_medio',
  'q_lotes_preco_m2',
  'q_lotes_area_maior_demanda',
] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function strField(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v === 'string') return v;
  if (v != null && v !== '') return String(v);
  return '';
}

function normalizarDadosFaixa(raw: unknown): DadosFaixaCondominio {
  if (!isRecord(raw)) return {};
  const out: DadosFaixaCondominio = {};
  for (const chave of CHAVES_FAIXA_TODAS) {
    const v = strField(raw, chave);
    if (v.trim()) out[chave] = v;
  }
  return out;
}

function aplicarMigracaoLegadoEstrutura(
  linha: LinhaProspectCondominio,
  raw: Record<string, unknown>,
): LinhaProspectCondominio {
  const out: LinhaProspectCondominio = { ...linha };
  const faixas: FaixasCondominioPorId = { ...criarFaixasVazias(), ...out.faixas };
  const linhaRec = out as Record<string, unknown>;

  for (const k of CHAVES_GLOBAL_MIGRADAS_DE_FAIXA) {
    const linhaVal = strField(linhaRec, k);
    const top = strField(raw, k);
    const faixaVal = strField(faixas.premium as Record<string, unknown>, k);
    if (!linhaVal.trim()) {
      if (top.trim()) linhaRec[k] = top;
      else if (faixaVal.trim()) linhaRec[k] = faixaVal;
    }
  }

  for (const { id } of FAIXAS_CONDOMINIO) {
    const dados = { ...(faixas[id] ?? {}) };
    for (const obs of CHAVES_OBSOLETAS_FAIXA) {
      delete (dados as Record<string, unknown>)[obs];
    }
    faixas[id] = dados;
  }

  for (const k of CHAVES_FAIXA_MIGRADAS_DE_GLOBAL) {
    const top = strField(raw, k) || strField(linhaRec, k);
    if (top.trim()) {
      for (const { id } of FAIXAS_CONDOMINIO) {
        const dados = faixas[id] ?? {};
        if (!strField(dados as Record<string, unknown>, k)) {
          faixas[id] = { ...dados, [k]: top };
        }
      }
    }
    delete linhaRec[k];
  }

  out.faixas = faixas;
  return out;
}

function normalizarFaixas(raw: unknown, legado: Record<string, unknown>): FaixasCondominioPorId {
  const base = criarFaixasVazias();
  if (isRecord(raw)) {
    for (const { id } of FAIXAS_CONDOMINIO) {
      base[id] = normalizarDadosFaixa(raw[id]);
    }
    const temDado = FAIXAS_CONDOMINIO.some((f) => Object.keys(base[f.id]).length > 0);
    if (temDado) return base;
  }

  const legadoFaixa: DadosFaixaCondominio = {};
  for (const chave of CHAVES_FAIXA_TODAS) {
    const v = strField(legado, chave);
    if (v.trim()) legadoFaixa[chave] = v;
  }

  if (Object.keys(legadoFaixa).length > 0) {
    base.premium = { ...legadoFaixa };
  }

  return base;
}

export function snapshotCamposCadastroLinha(linha: LinhaProspectCondominio): string {
  return JSON.stringify({
    condominio: linha.condominio.trim(),
    ticket_lote: linha.ticket_lote.trim(),
    ticket_casas: linha.ticket_casas.trim(),
    ticket_m2: linha.ticket_m2.trim(),
    estimativa_giro: (linha.estimativa_giro ?? '').trim(),
  });
}

export function linhaProspectAlteradaDesdeCarregamento(linha: LinhaProspectCondominio): boolean {
  if (!linha.cadastro_carregado_snapshot) return true;
  return linha.cadastro_carregado_snapshot !== snapshotCamposCadastroLinha(linha);
}

export function linhaProspectCadastroPendente(linha: LinhaProspectCondominio): boolean {
  if (!linha.condominio?.trim()) return false;
  if (!linha.cadastro_confirmado_em) return true;
  if (linha.cadastro_snapshot !== snapshotCamposCadastroLinha(linha)) return true;
  return false;
}

export function linhaProspectCadastroOk(linha: LinhaProspectCondominio): boolean {
  return linhaProspectTemNome(linha) && !linhaProspectCadastroPendente(linha);
}

export function todasLinhasProspectCadastroOk(linhas: LinhaProspectCondominio[]): boolean {
  const comNome = linhas.filter(linhaProspectTemNome);
  if (comNome.length === 0) return false;
  return comNome.every(linhaProspectCadastroOk);
}

export function marcarLinhaProspectCadastroPendente(
  linha: LinhaProspectCondominio,
): LinhaProspectCondominio {
  return {
    ...linha,
    cadastro_confirmado_em: null,
    cadastro_snapshot: null,
  };
}

export function confirmarLinhaProspectCadastroLocal(
  linha: LinhaProspectCondominio,
  condominioId?: string | null,
): LinhaProspectCondominio {
  const snap = snapshotCamposCadastroLinha(linha);
  return {
    ...linha,
    condominio_id: condominioId ?? linha.condominio_id ?? null,
    cadastro_confirmado_em: new Date().toISOString(),
    cadastro_snapshot: snap,
    cadastro_carregado_snapshot: snap,
  };
}

export function linhaProspectDeCondominioRow(
  row: CondominioRow,
  rowId: string,
  pesquisa?: Partial<LinhaProspectCondominio>,
): LinhaProspectCondominio {
  const base: LinhaProspectCondominio = {
    row_id: rowId,
    condominio_id: row.id,
    condominio: row.nome,
    ticket_lote: decimalInputFromValue(row.ticket_medio_lote),
    ticket_casas: decimalInputFromValue(row.ticket_medio_casas),
    ticket_m2: decimalInputFromValue(row.ticket_medio_casas_rsm2),
    estimativa_giro: integerInputFromValue(row.estimativa_casas_vendidas_ano),
    recuo_frontal_m: decimalInputFromValue(row.recuo_frontal_m),
    recuo_fundo_m: decimalInputFromValue(row.recuo_fundo_m),
    recuo_lateral_m: decimalInputFromValue(row.recuo_lateral_m),
    cadastro_confirmado_em: null,
    cadastro_snapshot: null,
    cadastro_carregado_snapshot: null,
    faixas: criarFaixasVazias(),
    ...pesquisa,
  };
  const snap = snapshotCamposCadastroLinha(base);
  return { ...base, cadastro_carregado_snapshot: snap };
}

export const COLUNAS_TABELA_PROSPECT = [
  { key: 'condominio' as const, header: 'Condomínio', type: 'text' as const },
  { key: 'ticket_lote' as const, header: 'Ticket Médio lote R$', type: 'text' as const },
  { key: 'ticket_casas' as const, header: 'Ticket Médio casas R$', type: 'text' as const },
  { key: 'ticket_m2' as const, header: 'Ticket Médio casas R$/m²', type: 'text' as const },
  {
    key: 'estimativa_giro' as const,
    header: 'Estimativa de Casas Vendidas/Ano',
    type: 'number' as const,
  },
];

export function gerarRowIdProspect(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizarLinhaProspect(raw: unknown, fallbackIndex = 0): LinhaProspectCondominio {
  const o = isRecord(raw) ? raw : {};
  const rowId =
    typeof o.row_id === 'string' && o.row_id.trim()
      ? o.row_id.trim()
      : gerarRowIdProspect() + (fallbackIndex > 0 ? `-${fallbackIndex}` : '');

  const linha: LinhaProspectCondominio = {
    row_id: rowId,
    condominio_id:
      typeof o.condominio_id === 'string' && o.condominio_id.trim() ? o.condominio_id.trim() : null,
    condominio: strField(o, 'condominio'),
    ticket_lote: strField(o, 'ticket_lote'),
    ticket_casas: strField(o, 'ticket_casas'),
    ticket_m2: strField(o, 'ticket_m2'),
    estimativa_giro: strField(o, 'estimativa_giro') || undefined,
    cadastro_confirmado_em:
      typeof o.cadastro_confirmado_em === 'string' && o.cadastro_confirmado_em.trim()
        ? o.cadastro_confirmado_em.trim()
        : null,
    cadastro_snapshot:
      typeof o.cadastro_snapshot === 'string' && o.cadastro_snapshot.trim()
        ? o.cadastro_snapshot.trim()
        : null,
    cadastro_carregado_snapshot:
      typeof o.cadastro_carregado_snapshot === 'string' && o.cadastro_carregado_snapshot.trim()
        ? o.cadastro_carregado_snapshot.trim()
        : null,
    faixas: normalizarFaixas(o.faixas, o),
  };

  for (const chave of CHAVES_TODAS_GLOBAL) {
    const v = strField(o, chave);
    if (v.trim()) linha[chave] = v;
  }

  if (typeof o.pesquisa_preenchida_em === 'string' && o.pesquisa_preenchida_em.trim()) {
    linha.pesquisa_preenchida_em = o.pesquisa_preenchida_em.trim();
  } else if (o.pesquisa_preenchida_em === null) {
    linha.pesquisa_preenchida_em = null;
  }

  if (Array.isArray(o.lotes_disponiveis)) {
    linha.lotes_disponiveis = parseLotesDisponiveisCondominio(o.lotes_disponiveis);
  }

  if (typeof o.lotes_preenchidos_em === 'string' && o.lotes_preenchidos_em.trim()) {
    linha.lotes_preenchidos_em = o.lotes_preenchidos_em.trim();
  } else if (o.lotes_preenchidos_em === null) {
    linha.lotes_preenchidos_em = null;
  }

  if (typeof o.lote_escolhido_id === 'string' && o.lote_escolhido_id.trim()) {
    linha.lote_escolhido_id = o.lote_escolhido_id.trim();
  } else if (o.lote_escolhido_id === null) {
    linha.lote_escolhido_id = null;
  }

  return aplicarMigracaoLegadoEstrutura(linha, o);
}

export function ticketCasasProspectNumerico(linha: LinhaProspectCondominio): number | null {
  return parseDecimalInput(String(linha.ticket_casas ?? '').trim());
}

function normalizarNomeCondominioProspect(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function pontuacaoPreferenciaLinhaProspect(linha: LinhaProspectCondominio): number {
  let score = 0;
  if (linha.pesquisa_preenchida_em) score += 1000;
  if (linha.condominio_id) score += 100;
  if (linha.cadastro_confirmado_em) score += 50;
  for (const chave of CHAVES_TODAS_GLOBAL) {
    if (String(linha[chave] ?? '').trim()) score += 5;
  }
  for (const { id } of FAIXAS_CONDOMINIO) {
    for (const campo of FAIXA_CONDOMINIO_CAMPOS) {
      if (valorFaixaCondominio(linha, id, campo.chave).trim()) score += 1;
    }
  }
  const ticket = ticketCasasProspectNumerico(linha);
  if (ticket != null) score += ticket / 1_000_000;
  return score;
}

/** Remove linhas repetidas pelo nome do condomínio (ex.: legado multi-praça ou cadastro duplicado). */
export function deduplicarLinhasProspectPorCondominio(
  linhas: LinhaProspectCondominio[],
): LinhaProspectCondominio[] {
  const semNome: LinhaProspectCondominio[] = [];
  const melhorPorNome = new Map<string, LinhaProspectCondominio>();

  for (const linha of linhas) {
    const nome = linha.condominio?.trim();
    if (!nome) {
      semNome.push(linha);
      continue;
    }
    const chave = normalizarNomeCondominioProspect(nome);
    const atual = melhorPorNome.get(chave);
    if (!atual || pontuacaoPreferenciaLinhaProspect(linha) > pontuacaoPreferenciaLinhaProspect(atual)) {
      melhorPorNome.set(chave, linha);
    }
  }

  return [...melhorPorNome.values(), ...semNome];
}

export function ordenarLinhasProspectPorTicketCasas(
  linhas: LinhaProspectCondominio[],
): LinhaProspectCondominio[] {
  return [...linhas].sort((a, b) => {
    const vA = ticketCasasProspectNumerico(a);
    const vB = ticketCasasProspectNumerico(b);
    if (vA == null && vB == null) {
      return (a.condominio ?? '').localeCompare(b.condominio ?? '', 'pt-BR', { sensitivity: 'base' });
    }
    if (vA == null) return 1;
    if (vB == null) return -1;
    if (vB !== vA) return vB - vA;
    return (a.condominio ?? '').localeCompare(b.condominio ?? '', 'pt-BR', { sensitivity: 'base' });
  });
}

/** Condomínios com nome, ordenados por ticket médio de casas (maior primeiro). */
export function prospectsOrdenadosPorTicketCasas(
  linhas: LinhaProspectCondominio[],
): LinhaProspectCondominio[] {
  return ordenarLinhasProspectPorTicketCasas(linhas.filter(linhaProspectTemNome));
}

export function parseLinhasProspectCondominio(valor: string | null | undefined): LinhaProspectCondominio[] {
  if (!valor?.trim()) {
    return [{ row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }];
  }
  try {
    const parsed = JSON.parse(valor) as unknown;
    if (!Array.isArray(parsed)) {
      return [{ row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }];
    }
    if (parsed.length === 0) {
      return [{ row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }];
    }
    return deduplicarLinhasProspectPorCondominio(
      ordenarLinhasProspectPorTicketCasas(parsed.map((row, idx) => normalizarLinhaProspect(row, idx))),
    );
  } catch {
    return [{ row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }];
  }
}

export function serializarLinhasProspectCondominio(linhas: LinhaProspectCondominio[]): string {
  return JSON.stringify(linhas);
}

export function extrairCamposPesquisaGlobal(
  linha: LinhaProspectCondominio,
): Partial<Pick<LinhaProspectCondominio, ChaveGlobalCondominio>> {
  const out: Partial<Pick<LinhaProspectCondominio, ChaveGlobalCondominio>> = {};
  for (const chave of CHAVES_TODAS_GLOBAL) {
    const v = linha[chave];
    if (v?.trim()) out[chave] = v;
  }
  return out;
}

export function linhaProspectTemNome(linha: LinhaProspectCondominio): boolean {
  return Boolean(linha.condominio?.trim());
}

export function linhaCaracterizacaoGlobalCompleta(linha: LinhaProspectCondominio): boolean {
  return CHAVES_GLOBAL_OBRIGATORIAS.every((chave) => Boolean(String(linha[chave] ?? '').trim()));
}

/** @deprecated Use linhaCaracterizacaoGlobalCompleta. */
export function linhaCaracterizacaoCompleta(linha: LinhaProspectCondominio): boolean {
  return linhaCaracterizacaoGlobalCompleta(linha);
}

/** @deprecated Use todasFaixasCondominioCompletas. */
export function linhaPesquisaCompleta(linha: LinhaProspectCondominio): boolean {
  return todasFaixasCondominioCompletas(linha);
}

export function linhaSessaoCondominioCompleta(linha: LinhaProspectCondominio): boolean {
  return linhaCaracterizacaoGlobalCompleta(linha) && todasFaixasCondominioCompletas(linha);
}

export function atualizarPesquisaPreenchidaEm(linha: LinhaProspectCondominio): LinhaProspectCondominio {
  if (linhaSessaoCondominioCompleta(linha)) {
    return { ...linha, pesquisa_preenchida_em: linha.pesquisa_preenchida_em ?? new Date().toISOString() };
  }
  return { ...linha, pesquisa_preenchida_em: null };
}

export function todasPesquisasProspectCompletas(linhas: LinhaProspectCondominio[]): boolean {
  const comNome = linhas.filter(linhaProspectTemNome);
  if (comNome.length === 0) return false;
  return comNome.every(linhaSessaoCondominioCompleta);
}

/** @deprecated Fontes não usadas na UI por faixa. */
export type FontePesquisaCondominio = 'online' | 'corretor' | 'destaque';

/** @deprecated Fontes não usadas na UI por faixa. */
export function rotuloFontePesquisa(fonte: FontePesquisaCondominio): string {
  switch (fonte) {
    case 'online':
      return 'Online';
    case 'corretor':
      return 'Corretor';
    case 'destaque':
      return 'Destaque';
    default:
      return fonte;
  }
}

export function mesclarRespostasFaixaCondominio(
  linha: LinhaProspectCondominio,
  faixaId: FaixaCondominioId,
  respostas: Partial<Record<ChaveFaixaCondominio, string>>,
): LinhaProspectCondominio {
  const faixas = { ...criarFaixasVazias(), ...linha.faixas };
  faixas[faixaId] = { ...faixas[faixaId], ...respostas };
  return normalizarLinhaProspect({ ...linha, faixas });
}
