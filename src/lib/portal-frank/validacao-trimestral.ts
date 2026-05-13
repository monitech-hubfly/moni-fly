/** Janelas trimestrais: após estas datas o Frank deve validar o período indicado (campo `periodo`). */
const ANCORAS = [
  { mes: 1, dia: 30, periodoSuffix: '01' },
  { mes: 4, dia: 30, periodoSuffix: '04' },
  { mes: 7, dia: 30, periodoSuffix: '07' },
  { mes: 11, dia: 30, periodoSuffix: '11' },
] as const;

function fimDoPrazoLocal(ano: number, mes: number, dia: number): Date {
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
}

function periodoKey(ano: number, suffix: string): string {
  return `${ano}-${suffix}`;
}

/**
 * Devolve o período mais antigo ainda em aberto (prazo já passou e sem `validado_em` registado).
 */
export function obterPeriodoValidacaoPendente(
  hoje: Date,
  periodosComValidacao: Set<string>,
): { periodo: string; titulo: string } | null {
  const anos = [hoje.getFullYear(), hoje.getFullYear() - 1, hoje.getFullYear() - 2];
  const candidatos: { periodo: string; prazo: Date; titulo: string }[] = [];

  for (const ano of anos) {
    for (const a of ANCORAS) {
      const prazo = fimDoPrazoLocal(ano, a.mes, a.dia);
      if (hoje.getTime() <= prazo.getTime()) continue;
      const periodo = periodoKey(ano, a.periodoSuffix);
      if (periodosComValidacao.has(periodo)) continue;
      candidatos.push({
        periodo,
        prazo,
        titulo: `Validação ${a.dia.toString().padStart(2, '0')}/${a.mes.toString().padStart(2, '0')}/${ano}`,
      });
    }
  }

  if (candidatos.length === 0) return null;
  candidatos.sort((x, y) => x.prazo.getTime() - y.prazo.getTime());
  const c = candidatos[0]!;
  return { periodo: c.periodo, titulo: c.titulo };
}
