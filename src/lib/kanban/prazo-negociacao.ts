/** Estados da negociação de prazo limite em atividades / chamados. */
export type PrazoNegociacaoStatus =
  | 'pendente_aceite_responsavel'
  | 'pendente_aceite_abridor'
  | 'aceito'
  | 'recusado';

export type PrazoNegociacaoCampos = {
  prazo_proposto?: string | null;
  prazo_status?: PrazoNegociacaoStatus | string | null;
  prazo_abridor_id?: string | null;
  prazo_proposto_por?: string | null;
  prazo_aceito_em?: string | null;
  prazo_negociacao_expira_em?: string | null;
  data_fim?: string | null;
  data_vencimento?: string | null;
};

const JANELA_MS = 24 * 60 * 60 * 1000;

export function expiraEm24hDesde(agora = new Date()): string {
  return new Date(agora.getTime() + JANELA_MS).toISOString();
}

export function negociacaoExpirada(expiraEm: string | null | undefined, agora = new Date()): boolean {
  const raw = String(expiraEm ?? '').trim();
  if (!raw) return false;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return false;
  return agora.getTime() > t;
}

export function normalizarPrazoStatus(
  raw: string | null | undefined,
): PrazoNegociacaoStatus | null {
  const s = String(raw ?? '').trim() as PrazoNegociacaoStatus;
  if (
    s === 'pendente_aceite_responsavel' ||
    s === 'pendente_aceite_abridor' ||
    s === 'aceito' ||
    s === 'recusado'
  ) {
    return s;
  }
  return null;
}

/** Prazo oficial para SLA / contagem — só após aceite (`data_fim` ou `data_vencimento`). */
export function prazoIsoEfetivoSla(row: PrazoNegociacaoCampos): string | null {
  const status = normalizarPrazoStatus(row.prazo_status);
  if (status && status !== 'aceito') {
    return null;
  }
  const fim = String(row.data_fim ?? row.data_vencimento ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fim)) return fim;
  if (status === 'aceito') {
    const prop = String(row.prazo_proposto ?? '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(prop)) return prop;
  }
  return null;
}

/** Data exibida na UI (proposta pendente ou efetiva). */
export function prazoIsoExibicao(row: PrazoNegociacaoCampos): string | null {
  const efetivo = prazoIsoEfetivoSla(row);
  if (efetivo) return efetivo;
  const prop = String(row.prazo_proposto ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(prop) ? prop : null;
}

export function rotuloPrazoStatusPt(status: PrazoNegociacaoStatus | null): string {
  switch (status) {
    case 'pendente_aceite_responsavel':
      return 'Aguardando aceite do responsável';
    case 'pendente_aceite_abridor':
      return 'Aguardando aceite de quem abriu';
    case 'recusado':
      return 'Prazo recusado — proponha outro';
    case 'aceito':
      return 'Prazo aceito';
    default:
      return '';
  }
}

export function payloadInicialNegociacaoPrazo(
  prazoIso: string,
  abridorId: string,
): {
  prazo_proposto: string;
  prazo_status: PrazoNegociacaoStatus;
  prazo_abridor_id: string;
  prazo_proposto_por: string;
  prazo_aceito_em: null;
  prazo_negociacao_expira_em: string;
  data_fim: null;
} {
  return {
    prazo_proposto: prazoIso,
    prazo_status: 'pendente_aceite_responsavel',
    prazo_abridor_id: abridorId,
    prazo_proposto_por: abridorId,
    prazo_aceito_em: null,
    prazo_negociacao_expira_em: expiraEm24hDesde(),
    data_fim: null,
  };
}

export function payloadInicialNegociacaoChamado(prazoIso: string, abridorId: string) {
  return {
    ...payloadInicialNegociacaoPrazo(prazoIso, abridorId),
    data_vencimento: null,
  };
}

export function payloadAceitarPrazoTopico(prazoIso: string, agora = new Date()) {
  return {
    prazo_status: 'aceito' as const,
    prazo_proposto: prazoIso,
    prazo_aceito_em: agora.toISOString(),
    data_fim: prazoIso,
  };
}

export function payloadAceitarPrazoChamado(prazoIso: string, agora = new Date()) {
  return {
    ...payloadAceitarPrazoTopico(prazoIso, agora),
    data_vencimento: prazoIso,
  };
}
