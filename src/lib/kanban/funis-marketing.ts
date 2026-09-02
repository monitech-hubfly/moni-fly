import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

export const KANBAN_NOME_MKT_GRAVACAO = 'Funil Gravação de Vídeos Externos' as const;
export const KANBAN_NOME_MKT_PROGRAMACAO = 'Funil Programação de Conteúdo Semanal' as const;
export const KANBAN_NOME_MKT_INC_TO_FLY = 'Funil Série Inc. to Fly' as const;

export type MarketingFunilSlug =
  | 'gravacao-videos-externos'
  | 'programacao-conteudo-semanal'
  | 'serie-inc-to-fly';

export type MarketingFunilDef = {
  slug: MarketingFunilSlug;
  kanbanId: string;
  kanbanNomeDb: typeof KANBAN_NOME_MKT_GRAVACAO | typeof KANBAN_NOME_MKT_PROGRAMACAO | typeof KANBAN_NOME_MKT_INC_TO_FLY;
  titulo: string;
  tipo: 'pontual' | 'recorrente' | 'temporada';
  entrada: string;
  saida: string;
};

export const MARKETING_FUNIS: readonly MarketingFunilDef[] = [
  {
    slug: 'gravacao-videos-externos',
    kanbanId: KANBAN_IDS.MARKETING_GRAVACAO,
    kanbanNomeDb: KANBAN_NOME_MKT_GRAVACAO,
    titulo: 'Gravação de Vídeos Externos',
    tipo: 'pontual',
    entrada: 'Oportunidade originada pela Agenda / Assessoria do Murillo',
    saida: 'Material segue para time de conteúdo/social media após decupagem',
  },
  {
    slug: 'programacao-conteudo-semanal',
    kanbanId: KANBAN_IDS.MARKETING_PROGRAMACAO,
    kanbanNomeDb: KANBAN_NOME_MKT_PROGRAMACAO,
    titulo: 'Programação de Conteúdo Semanal',
    tipo: 'recorrente',
    entrada: 'Demanda recorrente semanal — Moní Capital, Franks e Murillo',
    saida: 'Após agendamento, o post passa a depender da plataforma de publicação',
  },
  {
    slug: 'serie-inc-to-fly',
    kanbanId: KANBAN_IDS.MARKETING_INC_TO_FLY,
    kanbanNomeDb: KANBAN_NOME_MKT_INC_TO_FLY,
    titulo: 'Série Inc. to Fly',
    tipo: 'temporada',
    entrada: 'Aprovação de destino/temporada (marketing ou franquias)',
    saida: 'Ao final de D4, episódio segue para publicação/aprovação',
  },
] as const;

export const MARKETING_FRENTES = ['Moní Capital', 'Franks', 'Murillo'] as const;
export type MarketingFrente = (typeof MARKETING_FRENTES)[number];

export const MKT_CAMPO_PERFIL_DESTINO = 'mkt_perfil_destino';
export const MKT_PROG_PLANEJAMENTO_SLUG = 'mkt_prog_planejamento';

export function isMarketingFunilSlug(v: string): v is MarketingFunilSlug {
  return MARKETING_FUNIS.some((f) => f.slug === v);
}

export function marketingFunilPorSlug(slug: string): MarketingFunilDef | null {
  return MARKETING_FUNIS.find((f) => f.slug === slug) ?? null;
}

export function isMarketingKanbanId(id: string | null | undefined): boolean {
  const v = String(id ?? '').trim();
  return (
    v === KANBAN_IDS.MARKETING_GRAVACAO ||
    v === KANBAN_IDS.MARKETING_PROGRAMACAO ||
    v === KANBAN_IDS.MARKETING_INC_TO_FLY
  );
}

export function labelSemanaIsoAtual(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const yyyy = date.getUTCFullYear();
  return `Semana ${String(week).padStart(2, '0')}/${yyyy}`;
}
