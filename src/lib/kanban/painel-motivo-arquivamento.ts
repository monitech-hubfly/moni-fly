import type {
  PainelArquivamentoMotivosAnalise,
  PainelCardDTO,
  PainelHistoricoMovimentoDTO,
  PainelMotivoArquivamentoRow,
} from '@/lib/kanban/painel-performance-types';

/** Rótulo canônico quando nenhum motivo estruturado foi encontrado. */
export const MOTIVO_ARQUIVAMENTO_SEM_INFORMADO = 'Sem motivo informado';

const DETALHE_MOTIVO_KEYS = [
  'motivo',
  'motivo_arquivamento',
  'archived_reason',
  'motivo_perda',
  'observacao_arquivamento',
] as const;

const CARD_MOTIVO_KEYS = ['motivo_arquivamento'] as const;

function normalizeMotivoKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function motivoKeyForGroup(label: string): string {
  return normalizeMotivoKey(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function pickMotivoFromDetalhe(d: Record<string, unknown> | null | undefined): string {
  if (!d) return '';
  for (const key of DETALHE_MOTIVO_KEYS) {
    const v = d[key];
    if (typeof v === 'string') {
      const t = normalizeMotivoKey(v);
      if (t) return t;
    }
  }
  return '';
}

/** Mapa card_id → motivo do histórico `card_arquivado` (evento mais recente). */
export function buildMotivoHistoricoPorCard(
  rows: PainelHistoricoMovimentoDTO[],
): Map<string, string> {
  const m = new Map<string, { motivo: string; ts: number }>();
  for (const r of rows) {
    if (r.acao !== 'card_arquivado') continue;
    const motivo = pickMotivoFromDetalhe(r.detalhe);
    if (!motivo) continue;
    const ts = new Date(r.criado_em).getTime();
    const cur = m.get(r.card_id);
    if (!cur || (Number.isFinite(ts) && ts >= cur.ts)) {
      m.set(r.card_id, { motivo, ts: Number.isFinite(ts) ? ts : 0 });
    }
  }
  return new Map([...m.entries()].map(([id, v]) => [id, v.motivo]));
}

/**
 * Resolve o motivo de arquivamento a partir de campos do card e do histórico.
 * Prioridade: `motivo_arquivamento` no card → detalhe de `card_arquivado` no histórico.
 */
export function resolveMotivoArquivamento(
  card: PainelCardDTO,
  motivoHistoricoPorCard: Map<string, string>,
): string {
  for (const key of CARD_MOTIVO_KEYS) {
    const v = card[key];
    if (typeof v === 'string') {
      const t = normalizeMotivoKey(v);
      if (t) return t;
    }
  }
  const hist = motivoHistoricoPorCard.get(card.id);
  if (hist) return hist;
  return MOTIVO_ARQUIVAMENTO_SEM_INFORMADO;
}

type MotivoAgg = {
  display: string;
  total: number;
  antesConversao: number;
  depoisConversao: number;
};

function bumpMotivo(
  map: Map<string, MotivoAgg>,
  label: string,
  antesConversao: boolean,
): void {
  const key = motivoKeyForGroup(label);
  const cur = map.get(key) ?? {
    display: label,
    total: 0,
    antesConversao: 0,
    depoisConversao: 0,
  };
  cur.total += 1;
  if (antesConversao) cur.antesConversao += 1;
  else cur.depoisConversao += 1;
  map.set(key, cur);
}

function rowsFromMap(map: Map<string, MotivoAgg>): PainelMotivoArquivamentoRow[] {
  return [...map.values()]
    .map((g) => ({
      motivo: g.display,
      total: g.total,
      antesConversao: g.antesConversao,
      depoisConversao: g.depoisConversao,
    }))
    .sort((a, b) => b.total - a.total);
}

export type ComputeMotivosArquivamentoInput = {
  arquivados: PainelCardDTO[];
  fases: Array<{ id: string; nome: string; ordem: number }>;
  profiles: Record<string, string>;
  cardAntesConversao: (card: PainelCardDTO) => boolean;
  motivoHistoricoPorCard: Map<string, string>;
};

export function computeMotivosArquivamento(
  input: ComputeMotivosArquivamentoInput,
): PainelArquivamentoMotivosAnalise {
  const rankingMap = new Map<string, MotivoAgg>();
  const porFaseMap = new Map<string, Map<string, MotivoAgg>>();
  const porRespMap = new Map<string, { label: string; id: string | null; motivos: Map<string, MotivoAgg> }>();
  const porFranqMap = new Map<
    string,
    { label: string; redeFranqueadoId: string; motivos: Map<string, MotivoAgg> }
  >();

  let semMotivoInformado = 0;

  for (const c of input.arquivados) {
    const motivo = resolveMotivoArquivamento(c, input.motivoHistoricoPorCard);
    const antesConversao = input.cardAntesConversao(c);
    if (motivo === MOTIVO_ARQUIVAMENTO_SEM_INFORMADO) semMotivoInformado += 1;

    bumpMotivo(rankingMap, motivo, antesConversao);

    const faseMotivos = porFaseMap.get(c.fase_id) ?? new Map<string, MotivoAgg>();
    bumpMotivo(faseMotivos, motivo, antesConversao);
    porFaseMap.set(c.fase_id, faseMotivos);

    const rid = c.responsavel_fase_id ?? null;
    const respNome =
      c.responsavel_fase_nome?.trim() ||
      (rid ? input.profiles[rid] : null) ||
      'Sem responsável';
    const respKey = rid ?? `nome:${respNome}`;
    const respEntry = porRespMap.get(respKey) ?? {
      label: respNome,
      id: rid,
      motivos: new Map<string, MotivoAgg>(),
    };
    bumpMotivo(respEntry.motivos, motivo, antesConversao);
    porRespMap.set(respKey, respEntry);

    const redeId = c.rede_franqueado_id?.trim();
    if (redeId) {
      const nFranq = c.n_franquia?.trim();
      const nomeRede = c.franqueado_rede_nome?.trim();
      const label = [nFranq, nomeRede].filter(Boolean).join(' · ') || redeId.slice(0, 8);
      const franqEntry = porFranqMap.get(redeId) ?? {
        label,
        redeFranqueadoId: redeId,
        motivos: new Map<string, MotivoAgg>(),
      };
      bumpMotivo(franqEntry.motivos, motivo, antesConversao);
      porFranqMap.set(redeId, franqEntry);
    }
  }

  const total = input.arquivados.length;
  const ranking = rowsFromMap(rankingMap);
  const impactoPerdaAntesConversao = [...ranking]
    .filter((r) => r.antesConversao > 0)
    .sort((a, b) => b.antesConversao - a.antesConversao);

  const faseById = new Map(input.fases.map((f) => [f.id, f]));

  return {
    ranking,
    porFase: [...porFaseMap.entries()]
      .map(([faseId, motivos]) => ({
        faseId,
        faseNome: faseById.get(faseId)?.nome ?? 'Fase',
        ordem: faseById.get(faseId)?.ordem ?? 0,
        motivos: rowsFromMap(motivos),
      }))
      .sort((a, b) => a.ordem - b.ordem),
    porResponsavel: [...porRespMap.values()]
      .map((g) => ({
        responsavelId: g.id,
        responsavelNome: g.label,
        motivos: rowsFromMap(g.motivos),
      }))
      .sort((a, b) => {
        const ta = a.motivos.reduce((s, m) => s + m.total, 0);
        const tb = b.motivos.reduce((s, m) => s + m.total, 0);
        return tb - ta;
      }),
    porFranquia: [...porFranqMap.values()]
      .map((g) => ({
        redeFranqueadoId: g.redeFranqueadoId,
        label: g.label,
        motivos: rowsFromMap(g.motivos),
      }))
      .sort((a, b) => {
        const ta = a.motivos.reduce((s, m) => s + m.total, 0);
        const tb = b.motivos.reduce((s, m) => s + m.total, 0);
        return tb - ta;
      }),
    impactoPerdaAntesConversao,
    semMotivoInformado,
    pctSemMotivo: total === 0 ? null : (semMotivoInformado / total) * 100,
    sugestaoMotivoObrigatorio: semMotivoInformado > 0,
  };
}
