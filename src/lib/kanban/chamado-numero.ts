/** Formata número global do chamado (#0001). */
export function formatChamadoNumero(numero: number | null | undefined): string {
  if (numero == null || !Number.isFinite(Number(numero))) return '';
  return `#${String(numero).padStart(4, '0')}`;
}
