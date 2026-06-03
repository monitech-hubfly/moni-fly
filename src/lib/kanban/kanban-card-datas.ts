/** Utilitários compartilhados para datas de reunião / follow-up nos cards kanban. */

/** Aceita apenas `YYYY-MM-DD` com ano de 4 dígitos (evita salvar datas parciais do input). */
export function dataIsoInputValida(valor: string | null | undefined): boolean {
  const s = String(valor ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (ano < 1900 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

export function calcularCorDataBadge(dataIso: string): string {
  if (!dataIsoInputValida(dataIso)) return 'text-stone-600 bg-stone-50 border-stone-200';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataIso}T00:00:00`);
  const diffDias = Math.floor((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return 'text-red-700 bg-red-50 border-red-200';
  if (diffDias <= 1) return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-stone-600 bg-stone-50 border-stone-200';
}

export function calcularCorDataTexto(dataIso: string): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataIso}T00:00:00`);
  const diffDias = Math.floor((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return 'text-red-600';
  if (diffDias <= 1) return 'text-yellow-600';
  return 'text-stone-500';
}

export function labelRelativoData(dataIso: string): string {
  if (!dataIsoInputValida(dataIso)) return '—';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataIso}T00:00:00`);
  const diffDias = Math.floor((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return `Atrasado ${Math.abs(diffDias)}d`;
  if (diffDias === 0) return 'Hoje';
  if (diffDias === 1) return 'Amanhã';
  return `Em ${diffDias}d`;
}

export function formatDataPtBr(dataIso: string): string {
  const d = new Date(`${dataIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dataIso;
  return d.toLocaleDateString('pt-BR');
}
