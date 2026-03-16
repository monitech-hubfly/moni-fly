/**
 * Helpers Sirene — Central de Chamados.
 * canActAsBombeiro: Bombeiro (sirene_papeis) ou time HDM responsável pelo chamado HDM.
 */

import type { Chamado, ChamadoStatus, HdmTime } from "@/types/sirene";

const HDM_TIMES: HdmTime[] = ["Homologações", "Produto", "Modelo Virtual"];

/** Perfil do usuário no contexto Sirene: papel (sirene_papeis) e time (profiles.time). */
export interface SireneUserContext {
  papel: "bombeiro" | "caneta_verde" | null;
  time: string | null;
}

/**
 * Indica se o usuário pode atuar como Bombeiro neste chamado:
 * - É Bombeiro (papel = bombeiro), ou
 * - Chamado é HDM e o time do usuário é o hdm_responsavel (Homologações, Produto, Modelo Virtual).
 */
export function canActAsBombeiro(
  userContext: SireneUserContext,
  chamado: Chamado
): boolean {
  if (userContext.papel === "bombeiro") return true;
  if (
    chamado.tipo === "hdm" &&
    chamado.hdm_responsavel != null &&
    chamado.hdm_responsavel === userContext.time &&
    HDM_TIMES.includes(chamado.hdm_responsavel)
  )
    return true;
  return false;
}

export function formatarStatus(status: ChamadoStatus): string {
  const map: Record<ChamadoStatus, string> = {
    nao_iniciado: "Não iniciado",
    em_andamento: "Em andamento",
    concluido: "Concluído",
  };
  return map[status] ?? status;
}

export function calcularProgressoTopicos(
  total: number,
  aprovados: number
): number {
  if (total === 0) return 0;
  return Math.round((aprovados / total) * 100);
}
