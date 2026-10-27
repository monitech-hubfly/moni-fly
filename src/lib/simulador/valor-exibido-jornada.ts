import { formatarMoeda } from '@/lib/simulador/calcular-oferta';

export const MENSAGEM_TERRENO_OBRIGATORIO_OFERTA =
  'Informe o valor do terreno para salvar a oferta.';

/** Terreno gravado na oferta. Zero, vazio ou inválido não entra na subtração. */
export function valorTerrenoGravado(valor: number | null | undefined): number | null {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Número de "A partir de" na jornada: valor total à vista menos só o terreno da oferta.
 * ITBI, impostos, taxas e acoplamento permanecem no total.
 * Sem terreno gravado, devolve o total e marca semTerreno.
 */
export function valorExibidoNaJornada(
  valorTotalAvista: number | null | undefined,
  valorTerreno: number | null | undefined,
): { valor: number | null; semTerreno: boolean } {
  const total = Number(valorTotalAvista);
  if (!Number.isFinite(total) || total <= 0) {
    return { valor: null, semTerreno: false };
  }
  const terreno = valorTerrenoGravado(valorTerreno);
  if (terreno == null) {
    return { valor: total, semTerreno: true };
  }
  return { valor: total - terreno, semTerreno: false };
}

export function textoValorExibidoNaJornada(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) {
    return 'Valor exibido na jornada: A partir de —';
  }
  return `Valor exibido na jornada: A partir de ${formatarMoeda(valor)}`;
}
