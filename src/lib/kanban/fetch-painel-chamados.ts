import type { SupabaseClient } from '@supabase/supabase-js';
import type { PainelChamadoUnificadoDTO } from '@/lib/kanban/painel-performance-types';

const KA_SELECT =
  'id,card_id,titulo,numero,status,trava,tipo,responsavel_id,responsaveis_ids,created_at,data_vencimento,sirene_chamado_id,arquivado';

const SC_SELECT =
  'id,card_id,incendio,numero,status,trava,te_trata,data_vencimento,created_at';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isAbertoStatus(status: string): boolean {
  const st = status.trim().toLowerCase();
  return (
    st !== 'concluida' &&
    st !== 'concluido' &&
    st !== 'aprovado' &&
    st !== 'cancelada' &&
    st !== 'cancelado'
  );
}

function isConcluidoStatus(status: string): boolean {
  const st = status.trim().toLowerCase();
  return st === 'concluida' || st === 'concluido' || st === 'aprovado';
}

function isVencido(dataVencimento: string | null | undefined, aberto: boolean): boolean {
  if (!aberto || !dataVencimento) return false;
  const d = new Date(`${dataVencimento}T23:59:59`);
  return Number.isFinite(d.getTime()) && d.getTime() < Date.now();
}

function mapKaRow(row: Record<string, unknown>): {
  id: string;
  cardId: string;
  sireneChamadoId: number | null;
  titulo: string;
  numero: number | null;
  status: string;
  trava: boolean;
  responsavelId: string | null;
  createdAt: string;
  dataVencimento: string | null;
} {
  const sidRaw = row.sirene_chamado_id;
  const sid =
    sidRaw != null && Number.isFinite(Number(sidRaw)) ? Number(sidRaw) : null;
  const rawNum = Number(row.numero);
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    sireneChamadoId: sid,
    titulo: String(row.titulo ?? '').trim() || 'Chamado',
    numero: Number.isFinite(rawNum) ? rawNum : null,
    status: String(row.status ?? '').trim() || 'nao_iniciado',
    trava: row.trava === true,
    responsavelId: row.responsavel_id != null ? String(row.responsavel_id) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    dataVencimento: row.data_vencimento != null ? String(row.data_vencimento) : null,
  };
}

type ScRow = {
  id: number;
  card_id: string;
  incendio: string | null;
  numero: number | null;
  status: string | null;
  trava: boolean | null;
  te_trata: boolean | null;
  data_vencimento: string | null;
  created_at: string;
};

function mapScRow(row: ScRow): Omit<PainelChamadoUnificadoDTO, 'emPastelaria' | 'responsavelNome'> {
  const status = String(row.status ?? '').trim() || 'nao_iniciado';
  const aberto = isAbertoStatus(status);
  const rawNum = Number(row.numero);
  return {
    dedupeKey: `sc-${row.id}`,
    cardId: String(row.card_id),
    kanbanAtividadeId: null,
    sireneChamadoId: row.id,
    titulo: String(row.incendio ?? '').trim() || 'Chamado Sirene',
    numero: Number.isFinite(rawNum) ? rawNum : row.id,
    status,
    trava: Boolean(row.trava || row.te_trata),
    vencido: isVencido(row.data_vencimento, aberto),
    aberto,
    concluido: isConcluidoStatus(status),
    responsavelId: null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    data_vencimento: row.data_vencimento,
    origem: 'sirene_card',
  };
}

/**
 * Carrega chamados deduplicados por card do funil:
 * `kanban_atividades` + `sirene_chamados` (card_id) + indicador Pastelaria via vínculo.
 */
export async function fetchPainelChamados(
  supabase: SupabaseClient,
  cardIds: string[],
  origem: 'nativo' | 'legado',
): Promise<PainelChamadoUnificadoDTO[]> {
  if (cardIds.length === 0) return [];

  const kaRows: ReturnType<typeof mapKaRow>[] = [];
  for (const part of chunk(cardIds, 100)) {
    const { data } = await supabase
      .from('kanban_atividades')
      .select(KA_SELECT)
      .in('card_id', part)
      .eq('origem', origem)
      .eq('arquivado', false);
    for (const r of data ?? []) {
      kaRows.push(mapKaRow(r as Record<string, unknown>));
    }
  }

  const sireneIdsFromKa = new Set(
    kaRows.map((r) => r.sireneChamadoId).filter((x): x is number => x != null),
  );

  const scById = new Map<number, ScRow>();
  for (const part of chunk(cardIds, 100)) {
    const { data } = await supabase.from('sirene_chamados').select(SC_SELECT).in('card_id', part);
    for (const r of data ?? []) {
      const row = r as ScRow;
      if (Number.isFinite(Number(row.id))) scById.set(Number(row.id), row);
    }
  }

  const pastelBySireneId = new Set<number>();
  const allSireneIds = [...new Set([...sireneIdsFromKa, ...scById.keys()])];
  for (const part of chunk(allSireneIds, 120)) {
    if (part.length === 0) continue;
    const { data } = await supabase
      .from('sirene_pastelaria_vinculos')
      .select('sirene_chamado_id')
      .in('sirene_chamado_id', part);
    for (const v of data ?? []) {
      const sid = Number((v as { sirene_chamado_id?: number }).sirene_chamado_id);
      if (Number.isFinite(sid)) pastelBySireneId.add(sid);
    }
  }

  const out = new Map<string, PainelChamadoUnificadoDTO>();

  for (const ka of kaRows) {
    const sc = ka.sireneChamadoId != null ? scById.get(ka.sireneChamadoId) : undefined;
    const status = sc?.status?.trim() || ka.status;
    const aberto = isAbertoStatus(status);
    const dataVenc = sc?.data_vencimento ?? ka.dataVencimento;
    const dedupeKey =
      ka.sireneChamadoId != null ? `sc-${ka.sireneChamadoId}` : `ka-${ka.id}`;

    out.set(dedupeKey, {
      dedupeKey,
      cardId: ka.cardId,
      kanbanAtividadeId: ka.id,
      sireneChamadoId: ka.sireneChamadoId,
      titulo: ka.titulo || String(sc?.incendio ?? '').trim() || 'Chamado',
      numero: ka.numero ?? (sc?.numero != null ? Number(sc.numero) : null),
      status,
      trava: Boolean(ka.trava || sc?.trava || sc?.te_trata),
      vencido: isVencido(dataVenc, aberto),
      aberto,
      concluido: isConcluidoStatus(status),
      emPastelaria: ka.sireneChamadoId != null && pastelBySireneId.has(ka.sireneChamadoId),
      responsavelId: ka.responsavelId,
      responsavelNome: null,
      created_at: ka.createdAt,
      data_vencimento: dataVenc,
      origem: 'kanban_atividade',
    });
  }

  for (const [sid, sc] of scById) {
    const key = `sc-${sid}`;
    if (out.has(key)) continue;
    if (!cardIds.includes(String(sc.card_id))) continue;
    const mapped = mapScRow(sc);
    out.set(key, {
      ...mapped,
      emPastelaria: pastelBySireneId.has(sid),
      responsavelNome: null,
    });
  }

  return [...out.values()];
}
