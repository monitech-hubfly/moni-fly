/** Valores de `profiles.role` escolhíveis no convite admin. */
export type InviteGrupoRole = 'admin' | 'team' | 'frank' | 'parceiro' | 'fornecedor' | 'cliente';

export type InviteCargo = 'adm' | 'analista' | 'estagiario';

/** Nomes exatos em `kanbans.nome` (alinhado ao seed / migrations). */
export const FUNIS_KANBAN_NOMES = [
  'Funil Step One',
  'Funil Moní INC',
  'Funil Portfólio',
  'Funil Operações',
  'Funil Acoplamento',
  'Funil Contabilidade',
  'Funil Crédito',
] as const;

export type FunilKanbanNome = (typeof FUNIS_KANBAN_NOMES)[number];

export const GRUPO_CONVITE_OPCOES: { value: InviteGrupoRole; label: string }[] = [
  { value: 'admin', label: 'Admin Empresa' },
  { value: 'team', label: 'Time' },
  { value: 'frank', label: 'Franqueado' },
  { value: 'parceiro', label: 'Parceiro' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'cliente', label: 'Cliente' },
];

export const CARGO_OPCOES: { value: InviteCargo; label: string }[] = [
  { value: 'adm', label: 'Adm' },
  { value: 'analista', label: 'Analista' },
  { value: 'estagiario', label: 'Estagiário' },
];

export function labelGrupoPorRole(role: string | null | undefined): string {
  const r = String(role ?? '').trim().toLowerCase();
  const hit = GRUPO_CONVITE_OPCOES.find((o) => o.value === r);
  if (hit) return hit.label;
  if (r === 'pending') return 'Pendente';
  if (r === 'blocked') return 'Bloqueado';
  if (r === 'consultor' || r === 'supervisor') return 'Time / legado';
  return r || '—';
}

export function labelCargo(cargo: string | null | undefined): string {
  const c = String(cargo ?? '').trim().toLowerCase();
  const hit = CARGO_OPCOES.find((o) => o.value === c);
  return hit ? hit.label : cargo?.trim() ? cargo : '—';
}

export function exibirFunisNoConvite(grupo: InviteGrupoRole, cargo: InviteCargo): boolean {
  return grupo === 'team' && cargo === 'estagiario';
}
