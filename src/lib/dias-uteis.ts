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

/** Formata data local como `YYYY-MM-DD` (sem deslocamento UTC). */
export function formatLocalYmd(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Verifica se uma data é dia útil (não é sábado, domingo ou feriado)
 */
export function isDiaUtil(data: Date): boolean {
  const diaSemana = data.getDay(); // 0=domingo, 6=sábado
  if (diaSemana === 0 || diaSemana === 6) return false;
  return !FERIADOS_NACIONAIS.has(formatLocalYmd(data));
}

export type SlaTipo = 'uteis' | 'corridos';

export function normalizarSlaTipo(value: string | null | undefined): SlaTipo {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'corridos' || v === 'dias_corridos' || v === 'dia_corridos') return 'corridos';
  return 'uteis';
}

export function rotuloUnidadeSla(tipo: SlaTipo | string | null | undefined): 'd.u.' | 'd.c.' {
  return normalizarSlaTipo(tipo) === 'corridos' ? 'd.c.' : 'd.u.';
}

export type RotuloSlaAtividadeVariante = 'atrasado' | 'atencao' | 'ok' | 'nenhum';

export type RotuloSlaAtividade = {
  variante: RotuloSlaAtividadeVariante;
  texto: string;
  diasRestantes?: number;
  diasAtraso?: number;
};

function statusAtividadeConcluido(statusConcluido?: string | boolean): boolean {
  if (typeof statusConcluido === 'boolean') return statusConcluido;
  const st = String(statusConcluido ?? '').trim().toLowerCase();
  return (
    st === 'concluido' ||
    st === 'concluida' ||
    st === 'aprovado' ||
    st === 'cancelada' ||
    st === 'cancelado'
  );
}

/**
 * Rótulo de SLA em dias úteis para atividades/sub-interações.
 * - atrasado: vencimento &lt; hoje
 * - atencao: vence hoje ou em 1 d.u.
 * - ok: 2+ d.u. restantes (sem tag; texto interno)
 */
export function rotuloSlaAtividadeDiasUteis(
  prazoIso: string | null | undefined,
  statusConcluido?: string | boolean,
): RotuloSlaAtividade {
  if (statusAtividadeConcluido(statusConcluido)) {
    return { variante: 'nenhum', texto: '—' };
  }
  const due = parseIsoDateOnlyLocal(prazoIso ?? null);
  if (!due) return { variante: 'nenhum', texto: '—' };

  const hoje = startOfLocalDay(new Date());
  const dueD = startOfLocalDay(due);

  if (dueD < hoje) {
    const depoisDoPrazo = new Date(dueD);
    depoisDoPrazo.setDate(depoisDoPrazo.getDate() + 1);
    const diasAtraso = calcularDiasUteis(startOfLocalDay(depoisDoPrazo), hoje);
    return {
      variante: 'atrasado',
      texto: diasAtraso > 0 ? `Atrasado ${diasAtraso} d.u.` : 'Atrasado',
      diasAtraso,
    };
  }

  if (dueD.getTime() === hoje.getTime()) {
    return { variante: 'atencao', texto: 'Vence hoje', diasRestantes: 0 };
  }

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const diasRestantes = calcularDiasUteis(startOfLocalDay(amanha), dueD);

  if (diasRestantes === 1) {
    return { variante: 'atencao', texto: 'Vence em 1 d.u.', diasRestantes: 1 };
  }

  return {
    variante: 'ok',
    texto: `${diasRestantes} d.u. restantes`,
    diasRestantes,
  };
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

/** Dias corridos entre duas datas (início e fim inclusive no cálculo de atraso). */
export function calcularDiasCorridos(dataInicio: Date, dataFim: Date): number {
  const inicio = startOfLocalDay(dataInicio);
  const fim = startOfLocalDay(dataFim);
  if (fim < inicio) return 0;
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
}

/** Soma N dias corridos a uma data. */
export function adicionarDiasCorridos(dataBase: Date, diasCorridos: number): Date {
  const resultado = new Date(dataBase);
  resultado.setDate(resultado.getDate() + diasCorridos);
  return startOfLocalDay(resultado);
}

export type StatusSlaCalculado = {
  status: 'ok' | 'atencao' | 'atrasado';
  label: string;
  classe: string;
  diasAtraso?: number;
  diasRestantes?: number;
  slaTipo: SlaTipo;
};

/**
 * Calcula o status do SLA baseado em dias corridos.
 */
export function calcularStatusSLACorridos(
  createdAt: Date,
  slaDiasCorridos: number,
): StatusSlaCalculado {
  const hoje = startOfLocalDay(new Date());
  const criacao = startOfLocalDay(createdAt);
  const dataVencimento = adicionarDiasCorridos(criacao, slaDiasCorridos);

  if (dataVencimento < hoje) {
    const diasAtraso = calcularDiasCorridos(dataVencimento, hoje);
    return {
      status: 'atrasado',
      label: `Atrasado ${diasAtraso} d.c.`,
      classe: 'moni-tag-atrasado',
      diasAtraso,
      slaTipo: 'corridos',
    };
  }

  if (dataVencimento.getTime() === hoje.getTime()) {
    return {
      status: 'atencao',
      label: 'Vence hoje',
      classe: 'moni-tag-atencao',
      diasRestantes: 0,
      slaTipo: 'corridos',
    };
  }

  const diasRestantes = calcularDiasCorridos(hoje, dataVencimento);
  if (diasRestantes === 1) {
    return {
      status: 'atencao',
      label: 'Vence em 1 d.c.',
      classe: 'moni-tag-atencao',
      diasRestantes: 1,
      slaTipo: 'corridos',
    };
  }

  return {
    status: 'ok',
    label: `${diasRestantes} d.c. restantes`,
    classe: '',
    diasRestantes,
    slaTipo: 'corridos',
  };
}

/** Despacha para dias úteis ou corridos conforme `sla_tipo` da fase. */
export function calcularStatusSLAPorTipo(
  createdAt: Date,
  slaDias: number,
  slaTipo?: SlaTipo | string | null,
): StatusSlaCalculado {
  if (normalizarSlaTipo(slaTipo) === 'corridos') {
    return calcularStatusSLACorridos(createdAt, slaDias);
  }
  const sla = calcularStatusSLA(createdAt, slaDias);
  return { ...sla, slaTipo: 'uteis' as const };
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
  diasAtraso?: number;
  diasRestantes?: number;
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
      diasAtraso,
    };
  }

  // Vence hoje
  if (dataVencimento.getTime() === hoje.getTime()) {
    return {
      status: 'atencao',
      label: 'Vence hoje',
      classe: 'moni-tag-atencao',
      diasRestantes: 0,
    };
  }

  // Vence em 1 dia útil (amanhã ou próximo dia útil)
  if (diasUteisRestantes === 1) {
    return {
      status: 'atencao',
      label: 'Vence em 1 d.u.',
      classe: 'moni-tag-atencao',
      diasRestantes: 1,
    };
  }

  // Tudo certo (2+ dias úteis restantes)
  return {
    status: 'ok',
    label: `${diasUteisRestantes} d.u. restantes`,
    classe: '',
    diasRestantes: diasUteisRestantes,
  };
}
