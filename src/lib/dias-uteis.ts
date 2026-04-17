/**
 * Utilitários para cálculo de dias úteis
 * Considera sábados, domingos e feriados nacionais brasileiros
 */

/** Parse `YYYY-MM-DD` como data de calendário local (evita deslocamento UTC de `new Date('YYYY-MM-DD')`). */
export function parseIsoDateOnlyLocal(iso: string | null | undefined): Date | null {
  const s = String(iso ?? '').trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

/** Formata `YYYY-MM-DD` para `dd/mm/aaaa` sem usar timezone de string ISO. */
export function formatIsoDateOnlyPtBr(iso: string | null | undefined): string | null {
  const s = String(iso ?? '').trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Maior data entre várias strings `YYYY-MM-DD` (ordem lexicográfica = ordem cronológica). */
export function maxIsoDateOnly(dates: (string | null | undefined)[]): string | null {
  const cleaned = dates
    .map((x) => String(x ?? '').trim().slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (cleaned.length === 0) return null;
  return cleaned.reduce((a, b) => (a > b ? a : b));
}

/**
 * Normaliza valor vindo de `<input type="date">` ou coluna `date` para `YYYY-MM-DD` puro,
 * sem passar por `Date` (evita perder um dia ao gravar no Postgres em ambientes UTC−X).
 */
export function normalizarDataIsoYmd(input: string | null | undefined): string | null {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  return null;
}

// Feriados nacionais brasileiros 2025-2027
const FERIADOS_NACIONAIS = new Set([
  // 2025
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-06-19',
  '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21',
  '2027-05-01', '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02',
  '2027-11-15', '2027-12-25',
]);

/**
 * Verifica se uma data é dia útil (não é sábado, domingo ou feriado)
 */
export function isDiaUtil(data: Date): boolean {
  const diaSemana = data.getDay(); // 0=domingo, 6=sábado
  if (diaSemana === 0 || diaSemana === 6) return false;

  const dataStr = data.toISOString().split('T')[0];
  return !FERIADOS_NACIONAIS.has(dataStr);
}

/**
 * Calcula quantos dias úteis existem entre duas datas
 * @param dataInicio Data inicial (inclusive)
 * @param dataFim Data final (inclusive)
 * @returns Número de dias úteis
 */
export function calcularDiasUteis(dataInicio: Date, dataFim: Date): number {
  if (dataFim < dataInicio) return 0;

  let diasUteis = 0;
  const atual = new Date(dataInicio);
  const fim = new Date(dataFim);

  // Normaliza para meia-noite para comparação correta
  atual.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  while (atual <= fim) {
    if (isDiaUtil(atual)) {
      diasUteis++;
    }
    atual.setDate(atual.getDate() + 1);
  }

  return diasUteis;
}

/**
 * Adiciona N dias úteis a uma data
 * @param dataBase Data inicial
 * @param diasUteis Quantidade de dias úteis a adicionar
 * @returns Nova data após adicionar os dias úteis
 */
export function adicionarDiasUteis(dataBase: Date, diasUteis: number): Date {
  if (diasUteis <= 0) return dataBase;

  const resultado = new Date(dataBase);
  let diasAdicionados = 0;

  while (diasAdicionados < diasUteis) {
    resultado.setDate(resultado.getDate() + 1);
    if (isDiaUtil(resultado)) {
      diasAdicionados++;
    }
  }

  return resultado;
}

/**
 * Calcula o status do SLA baseado em dias úteis
 * @param createdAt Data de criação do card
 * @param slaDiasUteis SLA em dias úteis
 * @returns Objeto com status, label e classe CSS
 */
export function calcularStatusSLA(
  createdAt: Date,
  slaDiasUteis: number,
): {
  status: 'ok' | 'atencao' | 'atrasado';
  label: string;
  classe: string;
} {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const criacao = new Date(createdAt);
  criacao.setHours(0, 0, 0, 0);

  // Calcula quantos dias úteis se passaram desde a criação
  const diasUteisDecorridos = calcularDiasUteis(criacao, hoje);

  // Calcula a data de vencimento (criação + SLA em dias úteis)
  const dataVencimento = adicionarDiasUteis(criacao, slaDiasUteis);
  dataVencimento.setHours(0, 0, 0, 0);

  // Calcula dias úteis restantes
  const diasUteisRestantes = calcularDiasUteis(hoje, dataVencimento);

  // Atrasado: já passou do prazo
  if (dataVencimento < hoje) {
    const diasAtraso = calcularDiasUteis(dataVencimento, hoje);
    return {
      status: 'atrasado',
      label: `Atrasado ${diasAtraso} d.u.`,
      classe: 'moni-tag-atrasado',
    };
  }

  // Vence hoje
  if (dataVencimento.getTime() === hoje.getTime()) {
    return {
      status: 'atencao',
      label: 'Vence hoje',
      classe: 'moni-tag-atencao',
    };
  }

  // Vence em 1 dia útil (amanhã ou próximo dia útil)
  if (diasUteisRestantes === 1) {
    return {
      status: 'atencao',
      label: 'Vence em 1 d.u.',
      classe: 'moni-tag-atencao',
    };
  }

  // Vence em 2 dias úteis (atenção)
  if (diasUteisRestantes === 2) {
    return {
      status: 'atencao',
      label: 'Vence em 2 d.u.',
      classe: 'moni-tag-atencao',
    };
  }

  // Tudo certo
  return {
    status: 'ok',
    label: `${diasUteisRestantes} d.u. restantes`,
    classe: '',
  };
}
