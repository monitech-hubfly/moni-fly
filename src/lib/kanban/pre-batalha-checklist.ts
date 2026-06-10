/** Labels de checklist da fase Pré Batalha (Funil Step One, slug `batalha`). */

export const PRE_BATALHA_CHECKLIST_LABEL_APLICADA =
  'Pré-batalha aplicada (Produto + Localização)';

export const PRE_BATALHA_CHECKLIST_LABEL_RANKING =
  'Ranking inicial — casas candidatas confirmadas';

export type RankingInicialChecklistItem = {
  modelo: string;
  topografia: string;
  notaFinal: number;
};

/** Formato checklist: "1º Gal/plano (Final: 2.3) | 2º Sol/aclive (Final: 1.8)" */
export function formatRankingInicialChecklistPreBatalha(
  ranking: RankingInicialChecklistItem[],
): string {
  return ranking
    .slice(0, 5)
    .map((item, idx) => {
      const palavra = item.modelo.trim().split(/\s+/)[0] || item.modelo.trim();
      const abrev = palavra.length <= 4 ? palavra : palavra.slice(0, 3);
      const topoRaw = item.topografia.trim().toLowerCase();
      const topoSlug = topoRaw === '—' || !topoRaw ? '—' : topoRaw;
      return `${idx + 1}º ${abrev}/${topoSlug} (Final: ${item.notaFinal})`;
    })
    .join(' | ');
}
