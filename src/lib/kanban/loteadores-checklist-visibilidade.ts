/**
 * Visibilidade de itens de checklist do Funil Loteadores.
 * Spec v2: campos listados em `visiveis` sempre aparecem.
 * Campos antigos sem `oculto_ui` (têm dados gravados) são preservados —
 * a ocultação de leftovers vazios é feita no banco (`config_json.oculto_ui`).
 */

export function isLoteadoresChecklistCampoVisivel(
  item: { campo_slug?: string | null },
  visiveis: readonly string[],
): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (!slug) return false;
  void visiveis;
  return true;
}

export function grupoChecklistItem(item: {
  config_json?: Record<string, unknown> | null;
}): string {
  return String(item.config_json?.grupo ?? '').trim();
}
