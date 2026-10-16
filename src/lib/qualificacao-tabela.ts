import type { FormularioQualificacaoRow } from '@/lib/actions/formulario-qualificacao';
import {
  filtrarLinhasEmBrancoRedeFranqueados,
  formatNFranquiaRedeExibicao,
  ordenarRedePorNFranquia,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';

export type QualificacaoTabelaLinha = {
  redeId: string;
  nFranquia: string;
  nome: string;
  resposta: FormularioQualificacaoRow | null;
};

/** Uma linha por franqueado, com a resposta mais recente quando existir. */
export function montarLinhasQualificacao(
  rows: RedeFranqueadoRowDb[],
  respostas: FormularioQualificacaoRow[],
): QualificacaoTabelaLinha[] {
  const porRede = new Map(respostas.map((r) => [r.rede_franqueado_id, r]));
  const base = ordenarRedePorNFranquia(filtrarLinhasEmBrancoRedeFranqueados(rows));
  return base.map((r) => ({
    redeId: r.id,
    nFranquia: formatNFranquiaRedeExibicao(r.n_franquia, r.ordem),
    nome: String(r.nome_completo ?? '').trim(),
    resposta: porRede.get(r.id) ?? null,
  }));
}
