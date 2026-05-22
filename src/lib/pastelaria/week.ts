import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { isoWeekToMondayUtc } from '@/utils/isoWeekDate';
import { labelSemanaIsoAtual, parseSemanaMetaTexto } from '@/utils/metaCiclo';

/** Semana ISO atual no formato exibido no app (ex.: S18). */
export function semanaAtualLabel(): string {
  return labelSemanaIsoAtual();
}

export function semanaLabelFromNum(num: number): string {
  return `S${num}`;
}

/** Normaliza rótulos de semana para S{n} (ex.: "18", "s18" → "S18"). */
export function normalizeSemanaLabel(raw: string | null | undefined): string {
  const n = parseSemanaMetaTexto(String(raw ?? ''));
  if (n != null) return semanaLabelFromNum(n);
  const s = String(raw ?? '').trim();
  return s || semanaAtualLabel();
}

/** Semanas de `semana_origem` até a semana atual (inclusive), para o modal de horas. */
export function semanasEntreOrigemEAtual(semanaOrigem: string): string[] {
  const start = parseSemanaMetaTexto(semanaOrigem) ?? parseSemanaMetaTexto(semanaAtualLabel());
  const end = isoWeek(new Date());
  const lo = Math.min(start ?? end, end);
  const hi = Math.max(start ?? end, end);
  const labels: string[] = [];
  for (let n = lo; n <= hi; n++) {
    labels.push(semanaLabelFromNum(n));
  }
  if (labels.length === 0) labels.push(semanaAtualLabel());
  return labels;
}

/** Semanas do modal de horas: origem do card até 2 semanas à frente da atual. */
export function semanasParaModalHoras(semanaOrigem: string): string[] {
  const start = parseSemanaMetaTexto(semanaOrigem) ?? parseSemanaMetaTexto(semanaAtualLabel());
  const atual = isoWeek(new Date());
  const end = atual + 2;
  const lo = Math.min(start ?? atual, end);
  const hi = Math.max(start ?? atual, end);
  const labels: string[] = [];
  for (let n = lo; n <= hi; n++) {
    labels.push(semanaLabelFromNum(n));
  }
  if (labels.length === 0) labels.push(semanaAtualLabel());
  return labels;
}

/** Segunda-feira da semana ISO indicada (ano ISO civil atual). */
export function getInicioSemana(semanaLabel: string, ano?: number): Date {
  const semNum = parseSemanaMetaTexto(semanaLabel) ?? isoWeek(new Date());
  const isoYear = ano ?? isoWeekYear(new Date());
  const mondayUtc = isoWeekToMondayUtc(isoYear, semNum);
  return new Date(mondayUtc.getUTCFullYear(), mondayUtc.getUTCMonth(), mondayUtc.getUTCDate());
}

/** Segunda a sexta da semana ISO (5 dias úteis). */
export function getDiasDaSemana(semanaLabel: string, ano?: number): Date[] {
  const inicio = getInicioSemana(semanaLabel, ano);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}
