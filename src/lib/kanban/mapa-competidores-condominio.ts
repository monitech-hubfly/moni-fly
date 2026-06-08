import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import { condominiosMapaCompativeis } from '@/lib/zap-condominio-busca';

export function normalizarNomeCondominioMapa(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function casaMapaPertenceCondominio(casa: CasaRow, nomeCondominio: string): boolean {
  const alvo = normalizarNomeCondominioMapa(nomeCondominio);
  if (!alvo) return false;
  const cnd = normalizarNomeCondominioMapa(casa.condominio ?? '');
  if (!cnd) return false;
  if (cnd === alvo || cnd.includes(alvo) || alvo.includes(cnd)) return true;
  return condominiosMapaCompativeis(nomeCondominio, casa.condominio ?? '');
}

export function filtrarCasasMapaPorCondominio(casas: CasaRow[], nomeCondominio: string): CasaRow[] {
  const alvo = normalizarNomeCondominioMapa(nomeCondominio);
  if (!alvo) return [];
  return casas.filter((c) => casaMapaPertenceCondominio(c, nomeCondominio));
}

/** Pelo menos uma listagem vinculada ao condomínio da sessão. */
export function linhaMapaCompetidoresCompleta(
  linha: LinhaProspectCondominio,
  casas: CasaRow[],
): boolean {
  const nome = linha.condominio?.trim();
  if (!nome) return false;
  return filtrarCasasMapaPorCondominio(casas, nome).length > 0;
}
