/** Tema opcional nos formulários de chamado (kanban e Sirene). */
export function resolveTemaChamadoForm(tema: string, temaOutro = ''): string | null {
  const base = tema.trim();
  if (!base) return null;
  if (base === 'Outro') {
    const outro = temaOutro.trim();
    return outro || null;
  }
  return base;
}

export function normalizeTemaChamado(tema?: string | null): string | null {
  const t = (tema ?? '').trim();
  return t || null;
}
