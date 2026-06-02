/** Monta URL de deep link para uma atividade (sub-interação) ou chamado. */
export function montarPathAlertaAtividade(params: {
  cardId?: string | null;
  basePath?: string | null;
  interacaoId: string;
  topicoId?: string | number | null;
}): string {
  const interacaoId = String(params.interacaoId ?? '').trim();
  const topicoId = params.topicoId != null ? String(params.topicoId).trim() : '';
  const cardId = String(params.cardId ?? '').trim();
  const base = (params.basePath ?? '').trim();

  const qs = new URLSearchParams();
  if (cardId) qs.set('card', cardId);
  qs.set('interacao', interacaoId);
  if (topicoId) qs.set('topico', topicoId);

  if (cardId && base) {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${qs.toString()}`;
  }

  if (cardId) {
    return `/?${qs.toString()}`;
  }

  const sireneQs = new URLSearchParams();
  sireneQs.set('interacao', interacaoId);
  if (topicoId) sireneQs.set('topico', topicoId);
  return `/sirene/chamados?${sireneQs.toString()}`;
}
