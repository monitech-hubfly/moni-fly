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
  const diffDias = diffDiasCalendario(dataIso);
  if (diffDias == null) return 'text-stone-600 bg-stone-50 border-stone-200';
  if (diffDias < 0) return 'text-red-700 bg-red-50 border-red-200';
  if (diffDias <= 1) return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-stone-600 bg-stone-50 border-stone-200';
}

export function calcularCorDataTexto(dataIso: string): string {
  const diffDias = diffDiasCalendario(dataIso);
  if (diffDias == null) return 'text-stone-500';
  if (diffDias < 0) return 'text-red-600';
  if (diffDias <= 1) return 'text-yellow-600';
  return 'text-stone-500';
}

export function labelRelativoData(dataIso: string): string {
  const diffDias = diffDiasCalendario(dataIso);
  if (diffDias == null) return '—';
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

export type IndicadorDataKanbanTipo = 'reuniao' | 'followup';

export type IndicadorDataKanban = {
  tipo: IndicadorDataKanbanTipo;
  variante: 'atrasado' | 'atencao' | 'ok';
  /** Dias em atraso (calendário) ou dias até a data. */
  numero: number;
  rotuloCurto: string;
  title: string;
};

function partesDataIso(dataIso: string): { y: number; m: number; d: number } | null {
  const s = String(dataIso ?? '').trim().slice(0, 10);
  if (!dataIsoInputValida(s)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function partesDataLocal(): { y: number; m: number; d: number } {
  const hoje = new Date();
  return { y: hoje.getFullYear(), m: hoje.getMonth() + 1, d: hoje.getDate() };
}

/** Diferença em dias de calendário (data alvo − hoje local), sem deslocamento de fuso. */
function diffDiasCalendario(dataIso: string): number | null {
  const target = partesDataIso(dataIso);
  if (!target) return null;
  const today = partesDataLocal();
  const targetMs = Date.UTC(target.y, target.m - 1, target.d);
  const todayMs = Date.UTC(today.y, today.m - 1, today.d);
  return Math.round((targetMs - todayMs) / 86400000);
}

const TITULO_DATA: Record<IndicadorDataKanbanTipo, string> = {
  reuniao: 'Reunião',
  followup: 'Follow-up',
};

/** Indicador compacto para data de reunião ou follow-up no card. */
export function indicadorDataKanban(
  tipo: IndicadorDataKanbanTipo,
  dataIso: string,
): IndicadorDataKanban | null {
  const diff = diffDiasCalendario(dataIso);
  if (diff == null) return null;
  const titulo = TITULO_DATA[tipo];
  const dataFmt = formatDataPtBr(dataIso);

  if (diff < 0) {
    const n = Math.abs(diff);
    // Reunião agendada: passou o dia, mas não é prazo de SLA — destaque atenção, não vermelho.
    if (tipo === 'reuniao') {
      return {
        tipo,
        variante: 'atencao',
        numero: n,
        rotuloCurto: dataFmt,
        title: `${titulo}: ${dataFmt} — preencha a ata`,
      };
    }
    return {
      tipo,
      variante: 'atrasado',
      numero: n,
      rotuloCurto: dataFmt,
      title: `${titulo}: ${n} dia(s) em atraso (${dataFmt})`,
    };
  }
  if (diff === 0) {
    return {
      tipo,
      variante: 'atencao',
      numero: 0,
      rotuloCurto: 'Hoje',
      title: `${titulo}: hoje (${dataFmt})`,
    };
  }
  if (diff === 1) {
    return {
      tipo,
      variante: 'atencao',
      numero: 1,
      rotuloCurto: 'Amanhã',
      title: `${titulo}: amanhã (${dataFmt})`,
    };
  }
  return {
    tipo,
    variante: 'ok',
    numero: diff,
    rotuloCurto: dataFmt,
    title: `${titulo}: ${dataFmt}`,
  };
}
