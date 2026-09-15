import { normalizeAccessRole } from '@/lib/authz';

/**
 * Mapeamento inicial de e-mails para role/departamento/cargo no auto-cadastro.
 * Usuários listados entram como team/admin já aprovados; demais ficam `pending` até aprovação.
 */
export type TeamSeedEntry = {
  role: 'admin' | 'team';
  departamento: string;
  /** Só `team`: adm (gestão do time) ou analista. Se omitido, o signup assume `analista`. */
  cargo?: 'adm' | 'analista';
};

export const TEAM_SEED_BY_EMAIL: Record<string, TeamSeedEntry> = {
  // role: 'admin' — adms empresa (inclui quem já tinha perfil manual em PROD)
  'neil@moni.casa': { role: 'admin', departamento: '' },
  'murillo@moni.casa': { role: 'admin', departamento: '' },
  'danilo.n@moni.casa': { role: 'admin', departamento: 'Caneta Verde' },
  'ingrid.hora@moni.casa': { role: 'admin', departamento: '' },
  'fernanda.lobao@moni.casa': { role: 'admin', departamento: '' },

  // role: 'team', cargo: adm
  'nathalia.ferezin@moni.casa': { role: 'team', departamento: 'Waysers', cargo: 'adm' },
  'rafael.matta@moni.casa': { role: 'team', departamento: 'Waysers', cargo: 'adm' },
  'bruna.scarpeli@moni.casa': { role: 'team', departamento: 'Modelo Virtual', cargo: 'adm' },
  'larissa.lima@moni.casa': { role: 'team', departamento: 'Executivo Local', cargo: 'adm' },
  'alef.lopes@moni.casa': { role: 'team', departamento: 'Modelo Virtual', cargo: 'adm' },
  'elisabete.nucci@moni.casa': { role: 'team', departamento: 'Acoplamento', cargo: 'adm' },
  'helenna.luz@moni.casa': { role: 'team', departamento: 'Moní Inc', cargo: 'adm' },
  'daniel.viotto@moni.casa': { role: 'team', departamento: 'Moní Inc', cargo: 'adm' },
  'karoline.galdino@moni.casa': { role: 'team', departamento: 'Homologações', cargo: 'adm' },
  'vinicius.fr@moni.casa': { role: 'team', departamento: 'Produto', cargo: 'adm' },
  'rafael.abreu@moni.casa': { role: 'team', departamento: 'Marketing', cargo: 'adm' },
  'isa.seabra@moni.casa': { role: 'team', departamento: 'Administrativo', cargo: 'adm' },
  'felipe.batista@moni.casa': { role: 'team', departamento: 'Controladoria', cargo: 'adm' },
  'isabela.correa@moni.casa': { role: 'team', departamento: 'Jurídico', cargo: 'adm' },
  'kim@moni.casa': { role: 'team', departamento: 'Crédito', cargo: 'adm' },
  'paula.cruz@moni.casa': { role: 'team', departamento: 'Novos Franqueados', cargo: 'adm' },

  // role: 'team', cargo: analista
  'helena.oliveira@moni.casa': { role: 'team', departamento: 'Homologações', cargo: 'analista' },
  'jessica.silva@moni.casa': { role: 'team', departamento: 'Homologações', cargo: 'analista' },
  'leticia.duarte@moni.casa': { role: 'team', departamento: 'Homologações', cargo: 'analista' },
  'mateus.palma@moni.casa': { role: 'team', departamento: 'Produto', cargo: 'analista' },
  'fabio.siano@moni.casa': { role: 'team', departamento: 'Produto', cargo: 'analista' },
};

export function seedEntryForEmail(email: string | null | undefined): TeamSeedEntry | undefined {
  const e = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!e) return undefined;
  return TEAM_SEED_BY_EMAIL[e];
}

/** Corrige perfil DEV criado como frank/pending (trigger padrão) quando o e-mail é da equipe. */
export function seededRoleNeedsRepair(
  currentRole: string | null | undefined,
  seedRole: 'admin' | 'team',
): boolean {
  const access = normalizeAccessRole(currentRole);
  if (access === 'blocked') return false;
  const raw = String(currentRole ?? '').trim();
  if (!raw) return true;
  if (seedRole === 'admin') return access !== 'admin';
  return access === 'pending' || access === 'frank';
}
