import { compareRedePorNFranquia } from '@/lib/rede-franqueados';
import type {
  PortfolioSaudeBlocoFranqueado,
  PortfolioSaudeFranqueadoBase,
  PortfolioSaudeRow,
} from '@/lib/kanban/portfolio-saude-types';

const SEM_FRANQUEADO_ID = '__sem_franqueado__';

export function montarBlocosPortfolioSaude(
  franqueados: PortfolioSaudeFranqueadoBase[],
  cards: PortfolioSaudeRow[],
): PortfolioSaudeBlocoFranqueado[] {
  const porRede = new Map<string, PortfolioSaudeRow[]>();
  const semRede: PortfolioSaudeRow[] = [];

  for (const card of cards) {
    const rid = String(card.rede_franqueado_id ?? '').trim();
    if (!rid) {
      semRede.push(card);
      continue;
    }
    const list = porRede.get(rid) ?? [];
    list.push(card);
    porRede.set(rid, list);
  }

  const sortCards = (list: PortfolioSaudeRow[]) =>
    [...list].sort((a, b) => (b.fase_ordem ?? 0) - (a.fase_ordem ?? 0));

  const blocos: PortfolioSaudeBlocoFranqueado[] = [...franqueados]
    .sort((a, b) =>
      compareRedePorNFranquia(
        { n_franquia: a.n_franquia, ordem: a.ordem, id: a.rede_franqueado_id },
        { n_franquia: b.n_franquia, ordem: b.ordem, id: b.rede_franqueado_id },
      ),
    )
    .map((f) => ({
      ...f,
      cards: sortCards(porRede.get(f.rede_franqueado_id) ?? []),
    }));

  if (semRede.length > 0) {
    blocos.push({
      rede_franqueado_id: SEM_FRANQUEADO_ID,
      franqueado_nome: 'Sem franqueado vinculado',
      n_franquia: null,
      ordem: 999999,
      cards: sortCards(semRede),
    });
  }

  return blocos;
}

export function franqueadoLabelBloco(bloco: PortfolioSaudeBlocoFranqueado): string {
  const fk = String(bloco.n_franquia ?? '').trim();
  const nome = String(bloco.franqueado_nome ?? '').trim();
  if (fk && nome) return `${fk} — ${nome}`;
  return fk || nome || '—';
}

export function franqueadoSearchTextBloco(bloco: PortfolioSaudeBlocoFranqueado): string {
  return [bloco.n_franquia, bloco.franqueado_nome, bloco.rede_franqueado_id]
    .map((x) => String(x ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

export function totalCardsAtivos(blocos: PortfolioSaudeBlocoFranqueado[]): number {
  return blocos.reduce((n, b) => n + b.cards.length, 0);
}
