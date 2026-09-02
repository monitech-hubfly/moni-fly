export type FundingTipo = 'Investidor' | 'Broker';

export type FundingCardDraft = {
  /** Nome ou empresa — gravado em `kanban_cards.titulo`. */
  funding_nome: string;
  funding_tipo: FundingTipo | '';
  funding_localizacao: string;
  funding_descritivo: string;
  proxima_atividade: string;
  prazo_atividade: string;
};

export function fundingDraftVazio(): FundingCardDraft {
  return {
    funding_nome: '',
    funding_tipo: '',
    funding_localizacao: '',
    funding_descritivo: '',
    proxima_atividade: '',
    prazo_atividade: '',
  };
}

export function fundingDraftFromRow(row: {
  titulo?: string | null;
  funding_tipo?: string | null;
  funding_localizacao?: string | null;
  funding_descritivo?: string | null;
  proxima_atividade?: string | null;
  prazo_atividade?: string | null;
} | null | undefined): FundingCardDraft {
  const tipoRaw = String(row?.funding_tipo ?? '').trim();
  const funding_tipo: FundingCardDraft['funding_tipo'] =
    tipoRaw === 'Investidor' || tipoRaw === 'Broker' ? tipoRaw : '';
  const prazoRaw = row?.prazo_atividade;
  const prazo_atividade =
    prazoRaw != null && String(prazoRaw).trim() !== '' ? String(prazoRaw).slice(0, 10) : '';
  return {
    funding_nome: String(row?.titulo ?? ''),
    funding_tipo,
    funding_localizacao: String(row?.funding_localizacao ?? ''),
    funding_descritivo: String(row?.funding_descritivo ?? ''),
    proxima_atividade: String(row?.proxima_atividade ?? ''),
    prazo_atividade,
  };
}

export function fundingTipoBadgeClass(tipo: string | null | undefined): string | null {
  const t = String(tipo ?? '').trim();
  if (t === 'Investidor') return 'moni-funding-tipo-badge moni-funding-tipo-badge--investidor';
  if (t === 'Broker') return 'moni-funding-tipo-badge moni-funding-tipo-badge--broker';
  return null;
}
