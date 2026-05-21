import { addWeeks, endOfISOWeek, format, startOfISOWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { expandGanttSemanasParaGradeIso, isoWeek, isoWeekYear, normalizarSemanasSelecionadasGantt } from '@/utils/periodos';
import { dataReferenciaSemanaIso } from '@/utils/semanaIsoUi';

export type StatusCelula = 'ok' | 'nok' | 'pendente' | 'sem_dados' | 'futuro';

export type RegistroStatusPreenchimento = {
  id?: string;
  area_id: string;
  usuario_id: string;
  semana_iso: number;
  ano: number;
  registrado_em: string;
  status: 'ok' | 'nok';
};

export type SemanaColuna = {
  semanaIso: number;
  ano: number;
  offset: number;
};

const WEEK_OPTS = { weekStartsOn: 1 as const };

export function semanaIsoComOffset(offset: number, refDate = new Date()): SemanaColuna {
  const semana = isoWeek(refDate);
  const ano = isoWeekYear(refDate);
  const ref = dataReferenciaSemanaIso(ano, semana);
  const monday = ref ? startOfISOWeek(ref, WEEK_OPTS) : new Date();
  const target = addWeeks(monday, offset);
  return {
    semanaIso: isoWeek(target),
    ano: isoWeekYear(target),
    offset,
  };
}

export function colunasSemanasBoard(): SemanaColuna[] {
  return [-4, -3, -2, -1, 0, 1, 2].map((o) => semanaIsoComOffset(o));
}

export function getSextaDaSemanaISO(semana: number, ano: number): Date {
  const jan4 = new Date(ano, 0, 4);
  const inicioAno = new Date(jan4);
  inicioAno.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const segunda = new Date(inicioAno);
  segunda.setDate(inicioAno.getDate() + (semana - 1) * 7);
  const sexta = new Date(segunda);
  sexta.setDate(segunda.getDate() + 4);
  sexta.setHours(23, 59, 59, 999);
  return sexta;
}

export function prazoPassouSemana(semanaIso: number, ano: number, hoje = new Date()): boolean {
  return hoje > getSextaDaSemanaISO(semanaIso, ano);
}

/** Registro feito até o fim da sexta-feira (23:59:59) da semana ISO. */
export function registroDentroDoPrazoSemana(
  registradoEm: string | Date,
  semanaIso: number,
  ano: number,
): boolean {
  const d = registradoEm instanceof Date ? registradoEm : new Date(registradoEm);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= getSextaDaSemanaISO(semanaIso, ano).getTime();
}

export function labelIntervaloSemana(semanaIso: number, ano: number): string {
  const ref = dataReferenciaSemanaIso(ano, semanaIso);
  if (!ref) return `S${semanaIso}`;
  const start = startOfISOWeek(ref, WEEK_OPTS);
  const end = endOfISOWeek(ref, WEEK_OPTS);
  const fri = new Date(start);
  fri.setDate(start.getDate() + 4);
  const ini = format(start, 'MMM d', { locale: ptBR }).replace('.', '');
  const fim = format(fri, 'd', { locale: ptBR });
  return `${ini}–${fim}`;
}

export function labelPrazoSexta(semanaIso: number, ano: number): string {
  const ref = dataReferenciaSemanaIso(ano, semanaIso);
  if (!ref) return `sex —`;
  const start = startOfISOWeek(ref, WEEK_OPTS);
  const fri = new Date(start);
  fri.setDate(start.getDate() + 4);
  return `sex ${format(fri, 'dd/MM', { locale: ptBR })}`;
}

export function compararSemanaAno(a: { semanaIso: number; ano: number }, b: { semanaIso: number; ano: number }): number {
  if (a.ano !== b.ano) return a.ano - b.ano;
  return a.semanaIso - b.semanaIso;
}

export function semanaEhFutura(semanaIso: number, ano: number, refDate = new Date()): boolean {
  const atual = { semanaIso: isoWeek(refDate), ano: isoWeekYear(refDate) };
  return compararSemanaAno({ semanaIso, ano }, atual) > 0;
}

export function semanaEhAtual(semanaIso: number, ano: number, refDate = new Date()): boolean {
  return semanaIso === isoWeek(refDate) && ano === isoWeekYear(refDate);
}

export function ganttRowNaSemanaIso(
  g: {
    semanas_selecionadas?: unknown;
    semana_inicio?: number | null;
    semana_fim?: number | null;
  },
  semanaIsoNum: number,
): boolean {
  const sn = Number(semanaIsoNum);
  if (!Number.isFinite(sn)) return false;
  const ss = normalizarSemanasSelecionadasGantt(g?.semanas_selecionadas);
  if (ss.some((w) => Number(w) === sn)) return true;
  const wk = expandGanttSemanasParaGradeIso(g, [sn]);
  if (wk.some((w) => Number(w) === sn)) return true;
  const si = g.semana_inicio != null ? Number(g.semana_inicio) : NaN;
  const sf = g.semana_fim != null ? Number(g.semana_fim) : NaN;
  return Number.isFinite(si) && Number.isFinite(sf) && si <= sn && sn <= sf;
}

export function calcularStatusCelula(opts: {
  semanaIso: number;
  ano: number;
  registros: RegistroStatusPreenchimento[];
  areaId: string;
  usuarioId: string;
  temDadosGantt: boolean;
  temDadosIndicadores: boolean;
  hoje?: Date;
}): StatusCelula {
  const { semanaIso, ano, registros, areaId, usuarioId, temDadosGantt, temDadosIndicadores } = opts;
  const hoje = opts.hoje ?? new Date();
  const semanaAtual = isoWeek(hoje);
  const anoAtual = isoWeekYear(hoje);

  if (semanaEhFutura(semanaIso, ano, hoje)) return 'futuro';

  const temRegistro = registros.some(
    (r) =>
      r.area_id === areaId &&
      r.usuario_id === usuarioId &&
      r.semana_iso === semanaIso &&
      r.ano === ano &&
      r.status === 'ok',
  );

  if (temRegistro) return 'ok';

  if (semanaIso === semanaAtual && ano === anoAtual) return 'pendente';

  const prazoPassou = prazoPassouSemana(semanaIso, ano, hoje);
  if (prazoPassou) {
    const temDados = temDadosGantt && temDadosIndicadores;
    if (!temDados) return 'sem_dados';
    return 'nok';
  }

  return 'pendente';
}

export const CORES_CELULA: Record<
  Exclude<StatusCelula, 'futuro'>,
  { dot: string; bg: string; label: string }
> = {
  ok: { dot: '#639922', bg: '#EAF3DE', label: 'OK' },
  nok: { dot: '#E24B4A', bg: '#FCEBEB', label: 'Não OK' },
  pendente: { dot: '#EF9F27', bg: '#FAEEDA', label: 'Pendente' },
  sem_dados: { dot: '#D3D1C7', bg: '#fff', label: 'Sem dados' },
};

export function iniciaisNome(nome: string | null | undefined): string {
  const parts = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

export function parseResponsaveisGantt(str: string | null | undefined): string[] {
  const t = String(str ?? '').trim();
  if (!t || t === '—') return [];
  return t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
