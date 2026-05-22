import type { PastelariaEstimativaUnidade, PastelariaHorasRow } from '@/lib/pastelaria/types';

export type PastelariaDiaHorasKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex';

export const PASTELARIA_DIAS_HORAS: { key: PastelariaDiaHorasKey; label: string }[] = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
];

export function toHoras(valor: number, unidade: PastelariaEstimativaUnidade): number {
  return unidade === 'min' ? Number((valor / 60).toFixed(2)) : valor;
}

export function parseHorasUnidade(raw: unknown): PastelariaEstimativaUnidade {
  return raw === 'min' ? 'min' : 'h';
}

export function diaUnidadeFromRow(
  row: PastelariaHorasRow | null | undefined,
  dia: PastelariaDiaHorasKey,
): PastelariaEstimativaUnidade {
  if (!row) return 'h';
  const col = `${dia}_unidade` as keyof PastelariaHorasRow;
  const perDay = row[col];
  if (perDay === 'min' || perDay === 'h') return perDay;
  if (row.unidade === 'min') return 'min';
  return 'h';
}

export function totalHorasConvertidas(row: PastelariaHorasRow | null | undefined): number {
  if (!row) return 0;
  return PASTELARIA_DIAS_HORAS.reduce((sum, { key }) => {
    const valor = Number(row[key] ?? 0);
    return sum + toHoras(valor, diaUnidadeFromRow(row, key));
  }, 0);
}

export function horasConvertidasNoDia(
  row: PastelariaHorasRow | null | undefined,
  dia: PastelariaDiaHorasKey,
): number {
  if (!row) return 0;
  return toHoras(Number(row[dia] ?? 0), diaUnidadeFromRow(row, dia));
}

export function formatTotalHorasLabel(total: number): string {
  const n = Number(total.toFixed(2));
  return `${n}h`;
}

/** Resumo de um dia para o rodapé do modal (ex.: "seg 2h", "ter 30min"). */
export function formatDiaHorasResumo(
  diaKey: PastelariaDiaHorasKey,
  valor: number,
  unidade: PastelariaEstimativaUnidade,
): string | null {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return unidade === 'min' ? `${diaKey} ${valor}min` : `${diaKey} ${valor}h`;
}

export function totalHorasFromDias(
  dias: Record<PastelariaDiaHorasKey, { valor: string; unidade: PastelariaEstimativaUnidade }>,
): number {
  return PASTELARIA_DIAS_HORAS.reduce((sum, { key }) => {
    const cell = dias[key];
    const v = Number(cell?.valor || 0);
    return sum + toHoras(v, cell?.unidade ?? 'h');
  }, 0);
}
