type GateResult = { ok: true } | { ok: false; error: string };

/**
 * A flag `juridico_retroalimentar` não governa mais as 8 fases ativas.
 * A retroalimentação passará a sair dos Pontos Jurídicos, em etapa posterior.
 * Esta função permanece para não quebrar imports e nunca bloqueia o avanço.
 */
export async function verificarGateJuridicoRetroalimentar(
  _cardId: string,
  _novaFaseId: string,
): Promise<GateResult> {
  return { ok: true };
}

/**
 * O fork para fases 09/10 não faz parte do quadro atual.
 * Não move o card.
 */
export async function executarForkJuridicoDemandaConcluida(_cardId: string): Promise<void> {
  return;
}
