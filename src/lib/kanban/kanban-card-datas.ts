/** Utilitários compartilhados para datas de reunião / follow-up nos cards kanban. */

export function calcularCorDataBadge(dataIso: string): string {
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
