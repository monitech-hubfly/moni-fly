export const LISTINGS_CASAS_MUTATED_EVENT = 'moni-listings-casas-mutated';

export function notifyListingsCasasMutated(cardId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LISTINGS_CASAS_MUTATED_EVENT, { detail: { cardId: cardId?.trim() || null } }),
  );
}
