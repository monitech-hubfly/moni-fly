/** Casa Moní — franquia interna com cadastro ampliado (SPEs e empresas extras). */
export const FRANQUIA_CASA_MONI_N = 'FK0000';

export function isFranquiaCasaMoniFk0000(nFranquia: string | null | undefined): boolean {
  return String(nFranquia ?? '').trim().toUpperCase() === FRANQUIA_CASA_MONI_N;
}
