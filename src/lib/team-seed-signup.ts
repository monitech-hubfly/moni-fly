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

/** `ingrid.hora@moni.casa` e `fernanda.lobao@moni.casa` não constam aqui: já possuem perfil criado manualmente como admin. */
export const TEAM_SEED_BY_EMAIL: Record<string, TeamSeedEntry> = {
  // role: 'admin' — adms empresa
  'neil@moni.casa': { role: 'admin', departamento: '' },
  'murillo@moni.casa': { role: 'admin', departamento: '' },
  'danilo.n@moni.casa': { role: 'admin', departamento: 'Caneta Verde' },

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
