/**
 * Validações de negócio para chamados/atividades kanban.
 */

export const TIME_BOMBEIRO = 'Bombeiro';

const MS_24H = 24 * 60 * 60 * 1000;

export function nomesTimesIncluemBombeiro(nomesTimes: readonly string[]): boolean {
  return nomesTimes.some((n) => String(n ?? '').trim() === TIME_BOMBEIRO);
}

export function validarPrazoBombeiro(dataFimIso: string | null | undefined): { ok: true } | { ok: false; error: string } {
  const raw = (dataFimIso ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: 'Informe o prazo limite (até 24 horas para o time Bombeiro).' };
  }
  const [y, m, d] = raw.split('-').map(Number);
  const fim = new Date(y, m - 1, d, 23, 59, 59, 999);
  const limite = Date.now() + MS_24H;
  if (fim.getTime() > limite) {
    return { ok: false, error: 'Atividades do time Bombeiro devem ter prazo limite de até 24 horas.' };
  }
  return { ok: true };
}

export function validarCategoriaComTimes(
  categoria: 'chamado' | 'melhoria',
  nomesTimes: readonly string[],
): { ok: true } | { ok: false; error: string } {
  if (categoria === 'melhoria' && nomesTimesIncluemBombeiro(nomesTimes)) {
    return { ok: false, error: 'O time Bombeiro não pode receber melhorias, apenas chamados.' };
  }
  return { ok: true };
}
