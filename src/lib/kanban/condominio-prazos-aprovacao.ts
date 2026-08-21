import { normalizarSlaTipo, type SlaTipo } from '@/lib/dias-uteis';
import type { CondominioRow } from '@/lib/condominios';

export type CondominioPrazosAprovacaoSla = {
  aprovacao_condominio?: { dias: number; tipo: SlaTipo };
  aprovacao_prefeitura?: { dias: number; tipo: SlaTipo };
};

export type CondominioPrazosAprovacaoDraft = {
  prazo_aprovacao_condominio_dias: string;
  prazo_aprovacao_condominio_sla_tipo: SlaTipo;
  prazo_aprovacao_prefeitura_dias: string;
  prazo_aprovacao_prefeitura_sla_tipo: SlaTipo;
};

export function emptyCondominioPrazosAprovacaoDraft(): CondominioPrazosAprovacaoDraft {
  return {
    prazo_aprovacao_condominio_dias: '',
    prazo_aprovacao_condominio_sla_tipo: 'corridos',
    prazo_aprovacao_prefeitura_dias: '',
    prazo_aprovacao_prefeitura_sla_tipo: 'corridos',
  };
}

export function prazosAprovacaoDraftFromRow(
  row: Pick<
    CondominioRow,
    | 'prazo_aprovacao_condominio_dias'
    | 'prazo_aprovacao_condominio_sla_tipo'
    | 'prazo_aprovacao_prefeitura_dias'
    | 'prazo_aprovacao_prefeitura_sla_tipo'
  > | null | undefined,
): CondominioPrazosAprovacaoDraft {
  if (!row) return emptyCondominioPrazosAprovacaoDraft();
  return {
    prazo_aprovacao_condominio_dias:
      row.prazo_aprovacao_condominio_dias != null && row.prazo_aprovacao_condominio_dias > 0
        ? String(row.prazo_aprovacao_condominio_dias)
        : '',
    prazo_aprovacao_condominio_sla_tipo: normalizarSlaTipo(row.prazo_aprovacao_condominio_sla_tipo),
    prazo_aprovacao_prefeitura_dias:
      row.prazo_aprovacao_prefeitura_dias != null && row.prazo_aprovacao_prefeitura_dias > 0
        ? String(row.prazo_aprovacao_prefeitura_dias)
        : '',
    prazo_aprovacao_prefeitura_sla_tipo: normalizarSlaTipo(row.prazo_aprovacao_prefeitura_sla_tipo),
  };
}

export function parsePrazoAprovacaoDias(raw: string): number | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const n = parseInt(t.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function prazosAprovacaoPatchFromDraft(d: CondominioPrazosAprovacaoDraft): {
  prazo_aprovacao_condominio_dias: number | null;
  prazo_aprovacao_condominio_sla_tipo: SlaTipo | null;
  prazo_aprovacao_prefeitura_dias: number | null;
  prazo_aprovacao_prefeitura_sla_tipo: SlaTipo | null;
} {
  const condDias = parsePrazoAprovacaoDias(d.prazo_aprovacao_condominio_dias);
  const prefDias = parsePrazoAprovacaoDias(d.prazo_aprovacao_prefeitura_dias);
  return {
    prazo_aprovacao_condominio_dias: condDias,
    prazo_aprovacao_condominio_sla_tipo: condDias != null ? normalizarSlaTipo(d.prazo_aprovacao_condominio_sla_tipo) : null,
    prazo_aprovacao_prefeitura_dias: prefDias,
    prazo_aprovacao_prefeitura_sla_tipo: prefDias != null ? normalizarSlaTipo(d.prazo_aprovacao_prefeitura_sla_tipo) : null,
  };
}

export function condominioPrazosSlaFromRow(
  row: Pick<
    CondominioRow,
    | 'prazo_aprovacao_condominio_dias'
    | 'prazo_aprovacao_condominio_sla_tipo'
    | 'prazo_aprovacao_prefeitura_dias'
    | 'prazo_aprovacao_prefeitura_sla_tipo'
  > | null | undefined,
): CondominioPrazosAprovacaoSla | null {
  if (!row) return null;
  const out: CondominioPrazosAprovacaoSla = {};
  if (row.prazo_aprovacao_condominio_dias != null && row.prazo_aprovacao_condominio_dias > 0) {
    out.aprovacao_condominio = {
      dias: row.prazo_aprovacao_condominio_dias,
      tipo: normalizarSlaTipo(row.prazo_aprovacao_condominio_sla_tipo),
    };
  }
  if (row.prazo_aprovacao_prefeitura_dias != null && row.prazo_aprovacao_prefeitura_dias > 0) {
    out.aprovacao_prefeitura = {
      dias: row.prazo_aprovacao_prefeitura_dias,
      tipo: normalizarSlaTipo(row.prazo_aprovacao_prefeitura_sla_tipo),
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function fmtPrazoAprovacaoLabel(
  dias: number | null | undefined,
  tipo: string | null | undefined,
): string {
  if (dias == null || dias <= 0) return '—';
  const u = normalizarSlaTipo(tipo) === 'uteis' ? 'd.u.' : 'd.c.';
  return `${dias} ${u}`;
}
