export type Permissao =
  | 'criar_cards'
  | 'mover_fase'
  | 'arquivar_cards'
  | 'finalizar_cards'
  | 'criar_chamados'
  | 'ver_sirene'
  | 'ver_dashboard'
  | 'configurar_sla'
  | 'convidar_usuarios'
  | 'editar_instrucoes'
  | 'vincular_cards';

export type PermissoesPode = { pode: (p: Permissao) => boolean };

/** Chave `role` na tabela `permissoes_perfil` (alinha legados ao modelo atual). */
export function roleParaMatrizPermissoes(role: string | null | undefined): string {
  const r = String(role ?? '')
    .trim()
    .toLowerCase();
  if (r === 'consultor') return 'team';
  if (r === 'supervisor') return 'admin';
  if (
    r === 'admin' ||
    r === 'team' ||
    r === 'frank' ||
    r === 'parceiro' ||
    r === 'fornecedor' ||
    r === 'cliente'
  ) {
    return r;
  }
  return 'cliente';
}

export function cargoParaMatrizPermissoes(cargo: string | null | undefined): 'adm' | 'analista' | 'estagiario' {
  const c = String(cargo ?? '')
    .trim()
    .toLowerCase();
  if (c === 'adm' || c === 'analista' || c === 'estagiario') return c;
  return 'analista';
}

export function permissoesLinhasParaMap(
  rows: { permissao: string; valor: boolean | null }[] | null | undefined,
): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const row of rows ?? []) {
    m.set(String(row.permissao), Boolean(row.valor));
  }
  return m;
}

export function mapPermissoesParaPode(map: Map<string, boolean>): PermissoesPode {
  return {
    pode: (p: Permissao) => map.get(p) ?? false,
  };
}

export function permissoesLinhasParaPode(
  rows: { permissao: string; valor: boolean | null }[] | null | undefined,
): PermissoesPode {
  return mapPermissoesParaPode(permissoesLinhasParaMap(rows));
}

export function permissoesTodasNegadas(): PermissoesPode {
  return { pode: () => false };
}
