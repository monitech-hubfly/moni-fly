import assert from 'node:assert/strict';
import {
  buildConversaoContext,
  classificarConversaoCard,
  type ClassificacaoConversaoCard,
  type ConversaoContext,
} from './painel-conversao-classify';
import type { PainelCardDTO, PainelFaseDTO } from './painel-performance-types';

/** Funil fixture: 4 fases; conversão na ordem 3. */
export const FASES_FIXTURE_CONVERSAO: PainelFaseDTO[] = [
  { id: 'f1', nome: 'Entrada', ordem: 1, sla_dias: 7, fase_conversao: false },
  { id: 'f2', nome: 'Qualificação', ordem: 2, sla_dias: 7, fase_conversao: false },
  { id: 'f3', nome: 'Conversão', ordem: 3, sla_dias: 14, fase_conversao: true },
  { id: 'f4', nome: 'Pós-conversão', ordem: 4, sla_dias: 14, fase_conversao: false },
];

export const CTX_FIXTURE = buildConversaoContext(FASES_FIXTURE_CONVERSAO);

type CasoValidacao = {
  id: string;
  descricao: string;
  card: Partial<PainelCardDTO> & Pick<PainelCardDTO, 'fase_id'>;
  expect: Pick<
    ClassificacaoConversaoCard,
    'status' | 'posicaoFase' | 'converteu' | 'inconsistencia' | 'momentoArquivamento'
  >;
};

function cardBase(
  faseId: string,
  extra: Partial<PainelCardDTO> = {},
): PainelCardDTO {
  return {
    id: `card-${faseId}`,
    titulo: 'Card teste',
    fase_id: faseId,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    entered_fase_at: '2025-01-01T00:00:00.000Z',
    franqueado_id: 'franq-1',
    arquivado: false,
    arquivado_em: null,
    concluido: false,
    concluido_em: null,
    status: 'ativo',
    ...extra,
  };
}

/** Casos alinhados às 9 regras finais de conversão. */
export const CASOS_VALIDACAO_CONVERSAO: CasoValidacao[] = [
  {
    id: 'ativo_antes',
    descricao: 'Card ativo antes da fase de conversão: ainda não converteu',
    card: cardBase('f1'),
    expect: {
      status: 'ativo',
      posicaoFase: 'antes',
      converteu: false,
      inconsistencia: false,
      momentoArquivamento: 'nao_aplicavel',
    },
  },
  {
    id: 'ativo_na_conversao',
    descricao: 'Card ativo na fase de conversão: converteu',
    card: cardBase('f3'),
    expect: {
      status: 'ativo',
      posicaoFase: 'na_conversao',
      converteu: true,
      inconsistencia: false,
      momentoArquivamento: 'nao_aplicavel',
    },
  },
  {
    id: 'ativo_depois',
    descricao: 'Card ativo depois da fase de conversão: converteu',
    card: cardBase('f4'),
    expect: {
      status: 'ativo',
      posicaoFase: 'depois',
      converteu: true,
      inconsistencia: false,
      momentoArquivamento: 'nao_aplicavel',
    },
  },
  {
    id: 'concluido_antes',
    descricao: 'Card concluído antes da fase de conversão: não converteu + inconsistência',
    card: cardBase('f2', { concluido: true, concluido_em: '2025-02-01T00:00:00.000Z' }),
    expect: {
      status: 'concluido',
      posicaoFase: 'antes',
      converteu: false,
      inconsistencia: true,
      momentoArquivamento: 'nao_aplicavel',
    },
  },
  {
    id: 'concluido_na_conversao',
    descricao: 'Card concluído na fase de conversão: converteu',
    card: cardBase('f3', { concluido: true, concluido_em: '2025-02-01T00:00:00.000Z' }),
    expect: {
      status: 'concluido',
      posicaoFase: 'na_conversao',
      converteu: true,
      inconsistencia: false,
      momentoArquivamento: 'nao_aplicavel',
    },
  },
  {
    id: 'concluido_depois',
    descricao: 'Card concluído depois da fase de conversão: converteu',
    card: cardBase('f4', { concluido: true, concluido_em: '2025-02-01T00:00:00.000Z' }),
    expect: {
      status: 'concluido',
      posicaoFase: 'depois',
      converteu: true,
      inconsistencia: false,
      momentoArquivamento: 'nao_aplicavel',
    },
  },
  {
    id: 'arquivado_antes',
    descricao: 'Card arquivado antes da fase de conversão: perda antes da conversão',
    card: cardBase('f1', { arquivado: true, arquivado_em: '2025-02-01T00:00:00.000Z' }),
    expect: {
      status: 'arquivado',
      posicaoFase: 'antes',
      converteu: false,
      inconsistencia: false,
      momentoArquivamento: 'antes',
    },
  },
  {
    id: 'arquivado_na_conversao',
    descricao: 'Card arquivado na fase de conversão: converteu, arquivou na conversão',
    card: cardBase('f3', { arquivado: true, arquivado_em: '2025-02-01T00:00:00.000Z' }),
    expect: {
      status: 'arquivado',
      posicaoFase: 'na_conversao',
      converteu: true,
      inconsistencia: false,
      momentoArquivamento: 'na_conversao',
    },
  },
  {
    id: 'arquivado_depois',
    descricao: 'Card arquivado depois da fase de conversão: converteu, perda pós-conversão',
    card: cardBase('f4', { arquivado: true, arquivado_em: '2025-02-01T00:00:00.000Z' }),
    expect: {
      status: 'arquivado',
      posicaoFase: 'depois',
      converteu: true,
      inconsistencia: false,
      momentoArquivamento: 'depois',
    },
  },
];

/** Caso extra: retrocesso — visitou conversão no passado, mas arquivado antes → perda antes. */
export const CASO_RETROCESSO_ARQUIVADO_ANTES: CasoValidacao = {
  id: 'retrocesso_arquivado_antes',
  descricao:
    'Card arquivado em fase anterior (mesmo com histórico posterior ignorado): perda antes da conversão',
  card: cardBase('f1', { arquivado: true, arquivado_em: '2025-03-01T00:00:00.000Z' }),
  expect: {
    status: 'arquivado',
    posicaoFase: 'antes',
    converteu: false,
    inconsistencia: false,
    momentoArquivamento: 'antes',
  },
};

export function runCasosValidacaoConversao(ctx: ConversaoContext = CTX_FIXTURE): {
  ok: boolean;
  total: number;
  falhas: string[];
} {
  const todos = [...CASOS_VALIDACAO_CONVERSAO, CASO_RETROCESSO_ARQUIVADO_ANTES];
  const falhas: string[] = [];

  for (const caso of todos) {
    const card = cardBase(caso.card.fase_id, caso.card);
    const got = classificarConversaoCard(card, ctx);
    for (const key of Object.keys(caso.expect) as (keyof typeof caso.expect)[]) {
      const esperado = caso.expect[key];
      const valor = got[key];
      if (valor !== esperado) {
        falhas.push(
          `[${caso.id}] ${caso.descricao} — campo "${key}": esperado ${String(esperado)}, obteve ${String(valor)}`,
        );
      }
    }
  }

  return { ok: falhas.length === 0, total: todos.length, falhas };
}

/** Executável via `npx tsx src/lib/kanban/painel-conversao-classify.test-cases.ts` */
export function assertCasosValidacaoConversao(): void {
  const r = runCasosValidacaoConversao();
  assert.equal(r.ok, true, r.falhas.join('\n'));
}
