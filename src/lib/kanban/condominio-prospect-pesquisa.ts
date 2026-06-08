import {
  decimalInputFromValue,
  integerInputFromValue,
  type CondominioRow,
} from '@/lib/condominios';

export type FontePesquisaCondominio = 'online' | 'corretor' | 'destaque';

export type ChavePesquisaCondominio =
  | 'q_lotes_total_disponiveis'
  | 'q_lotes_tamanho_medio'
  | 'q_lotes_preco_m2'
  | 'q_lotes_area_maior_demanda'
  | 'q_casas_prontas'
  | 'q_casas_em_construcao'
  | 'q_casas_para_venda'
  | 'q_casas_preco_m2'
  | 'q_casas_tempo_venda'
  | 'q_casas_vendidas_12m'
  | 'q_casas_remanescentes_demora'
  | 'q_casas_caracteristicas_elogiadas'
  | 'q_casas_caracteristicas_buscadas'
  | 'q_locacao_valores';

export type LinhaProspectCondominio = {
  row_id: string;
  /** FK do cadastro em `condominios`, quando vinculado. */
  condominio_id?: string | null;
  condominio: string;
  ticket_lote: string;
  ticket_casas: string;
  ticket_m2: string;
  /** Legado — coluna da tabela editável anterior. */
  estimativa_giro?: string;
  /** ISO — usuário confirmou ou salvou os dados no cadastro. */
  cadastro_confirmado_em?: string | null;
  /** Snapshot dos campos da linha no momento da última confirmação. */
  cadastro_snapshot?: string | null;
  /** Snapshot ao carregar do cadastro (detecta edição vs. concordância). */
  cadastro_carregado_snapshot?: string | null;
  q_lotes_total_disponiveis?: string;
  q_lotes_tamanho_medio?: string;
  q_lotes_preco_m2?: string;
  q_lotes_area_maior_demanda?: string;
  q_casas_prontas?: string;
  q_casas_em_construcao?: string;
  q_casas_para_venda?: string;
  q_casas_preco_m2?: string;
  q_casas_tempo_venda?: string;
  q_casas_vendidas_12m?: string;
  q_casas_remanescentes_demora?: string;
  q_casas_caracteristicas_elogiadas?: string;
  q_casas_caracteristicas_buscadas?: string;
  q_locacao_valores?: string;
  pesquisa_preenchida_em?: string | null;
};

export type SecaoPesquisaCondominio = {
  id: string;
  titulo: string;
  perguntas: PerguntaPesquisaCondominio[];
};

export type PerguntaPesquisaCondominio = {
  chave: ChavePesquisaCondominio;
  label: string;
  fonte: FontePesquisaCondominio;
  tipo: 'texto' | 'texto_longo';
  destaque?: boolean;
};

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
};

export const CAMPOS_CADASTRO_LINHA_PROSPECT = [
  'condominio',
  'ticket_lote',
  'ticket_casas',
  'ticket_m2',
  'estimativa_giro',
] as const;

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
    cadastro_confirmado_em: null,
    cadastro_snapshot: null,
    cadastro_carregado_snapshot: null,
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

export const PESQUISA_CONDOMINIO_SECOES: SecaoPesquisaCondominio[] = [
  {
    id: 'lotes',
    titulo: 'Sobre os lotes',
    perguntas: [
      {
        chave: 'q_lotes_total_disponiveis',
        label: 'Quantos lotes esse condomínio tem? Quantos estão disponíveis para venda?',
        fonte: 'online',
        tipo: 'texto',
      },
      {
        chave: 'q_lotes_tamanho_medio',
        label: 'Qual o tamanho médio dos lotes?',
        fonte: 'online',
        tipo: 'texto',
      },
      {
        chave: 'q_lotes_preco_m2',
        label: 'Qual o preço médio do m² de venda dos lotes?',
        fonte: 'online',
        tipo: 'texto',
      },
      {
        chave: 'q_lotes_area_maior_demanda',
        label: 'Qual a área onde os lotes são mais valorizados e tem maior demanda?',
        fonte: 'corretor',
        tipo: 'texto',
      },
    ],
  },
  {
    id: 'casas',
    titulo: 'Sobre as casas e construções',
    perguntas: [
      {
        chave: 'q_casas_prontas',
        label: 'Quantas casas estão prontas?',
        fonte: 'online',
        tipo: 'texto',
      },
      {
        chave: 'q_casas_em_construcao',
        label:
          'Quantas casas estão sendo construídas? Dessas, quantas estão para venda e quantas são para cliente final?',
        fonte: 'corretor',
        tipo: 'texto',
      },
      {
        chave: 'q_casas_para_venda',
        label: 'Quantas casas estão para venda?',
        fonte: 'online',
        tipo: 'texto',
      },
      {
        chave: 'q_casas_preco_m2',
        label: 'Qual o preço do m² de venda das casas?',
        fonte: 'online',
        tipo: 'texto',
      },
      {
        chave: 'q_casas_tempo_venda',
        label: 'Quanto tempo leva, em média, para uma casa ser vendida depois de pronta?',
        fonte: 'corretor',
        tipo: 'texto',
      },
      {
        chave: 'q_casas_vendidas_12m',
        label: 'Quantas casas foram vendidas nos últimos 12 meses?',
        fonte: 'destaque',
        tipo: 'texto',
        destaque: true,
      },
      {
        chave: 'q_casas_remanescentes_demora',
        label:
          'O que fez as casas remanescentes demorarem tanto para serem vendidas? (preço, acabamento, localização, etc.)',
        fonte: 'corretor',
        tipo: 'texto_longo',
      },
      {
        chave: 'q_casas_caracteristicas_elogiadas',
        label:
          'E das casas vendidas ultimamente, quais eram as características mais elogiadas pelos compradores?',
        fonte: 'corretor',
        tipo: 'texto_longo',
      },
      {
        chave: 'q_casas_caracteristicas_buscadas',
        label: 'Quais as características os clientes estão buscando nas casas desse condomínio?',
        fonte: 'corretor',
        tipo: 'texto_longo',
      },
    ],
  },
  {
    id: 'locacao',
    titulo: 'Locação',
    perguntas: [
      {
        chave: 'q_locacao_valores',
        label: 'Qual valor das casas para locação? Dê alguns exemplos abaixo',
        fonte: 'online',
        tipo: 'texto',
      },
    ],
  },
];

export const CHAVES_PESQUISA_OBRIGATORIAS: ChavePesquisaCondominio[] = PESQUISA_CONDOMINIO_SECOES.flatMap(
  (s) => s.perguntas.map((p) => p.chave),
);

export function gerarRowIdProspect(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function normalizarLinhaProspect(raw: unknown, fallbackIndex = 0): LinhaProspectCondominio {
  const o = isRecord(raw) ? raw : {};
  const rowId =
    typeof o.row_id === 'string' && o.row_id.trim()
      ? o.row_id.trim()
      : gerarRowIdProspect() + (fallbackIndex > 0 ? `-${fallbackIndex}` : '');

  const str = (k: string) => (typeof o[k] === 'string' ? String(o[k]) : o[k] != null ? String(o[k]) : '');

  const linha: LinhaProspectCondominio = {
    row_id: rowId,
    condominio_id:
      typeof o.condominio_id === 'string' && o.condominio_id.trim() ? o.condominio_id.trim() : null,
    condominio: str('condominio'),
    ticket_lote: str('ticket_lote'),
    ticket_casas: str('ticket_casas'),
    ticket_m2: str('ticket_m2'),
    estimativa_giro: str('estimativa_giro') || undefined,
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
  };

  for (const chave of CHAVES_PESQUISA_OBRIGATORIAS) {
    const v = o[chave];
    if (typeof v === 'string' && v.trim()) {
      linha[chave] = v;
    }
  }

  if (typeof o.pesquisa_preenchida_em === 'string' && o.pesquisa_preenchida_em.trim()) {
    linha.pesquisa_preenchida_em = o.pesquisa_preenchida_em.trim();
  } else if (o.pesquisa_preenchida_em === null) {
    linha.pesquisa_preenchida_em = null;
  }

  return linha;
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
    return parsed.map((row, idx) => normalizarLinhaProspect(row, idx));
  } catch {
    return [{ row_id: gerarRowIdProspect(), ...LINHA_PROSPECT_VAZIA }];
  }
}

export function serializarLinhasProspectCondominio(linhas: LinhaProspectCondominio[]): string {
  return JSON.stringify(linhas);
}

export function linhaProspectTemNome(linha: LinhaProspectCondominio): boolean {
  return Boolean(linha.condominio?.trim());
}

export function linhaPesquisaCompleta(linha: LinhaProspectCondominio): boolean {
  return CHAVES_PESQUISA_OBRIGATORIAS.every((chave) => Boolean(String(linha[chave] ?? '').trim()));
}

export function atualizarPesquisaPreenchidaEm(linha: LinhaProspectCondominio): LinhaProspectCondominio {
  if (linhaPesquisaCompleta(linha)) {
    return { ...linha, pesquisa_preenchida_em: linha.pesquisa_preenchida_em ?? new Date().toISOString() };
  }
  return { ...linha, pesquisa_preenchida_em: null };
}

export function todasPesquisasProspectCompletas(linhas: LinhaProspectCondominio[]): boolean {
  const comNome = linhas.filter(linhaProspectTemNome);
  if (comNome.length === 0) return false;
  return comNome.every(linhaPesquisaCompleta);
}

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
