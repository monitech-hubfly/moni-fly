/**
 * Mapeamento inicial de e-mails para role/departamento no auto-cadastro.
 * Usuários listados entram como team/admin; demais ficam `pending` até aprovação.
 */
export const TEAM_SEED_BY_EMAIL: Record<string, { role: 'admin' | 'team'; departamento: string }> = {
  'negao@moni.casa': { role: 'team', departamento: 'Marketing' },
  'paula.cruz@moni.casa': { role: 'team', departamento: 'Novos Franks' },
  'helenna.luz@moni.casa': { role: 'team', departamento: 'Portfólio' },
  'elisabete.nucci@moni.casa': { role: 'team', departamento: 'Acoplamento' },
  'nathalia.ferezin@moni.casa': { role: 'team', departamento: 'Waysers' },
  'rafael.mata@moni.casa': { role: 'team', departamento: 'Waysers' },
  'daniel.viotto@moni.casa': { role: 'team', departamento: 'Frank Moní' },
  'kim@moni.casa': { role: 'team', departamento: 'Crédito' },
  'neil@moni.casa': { role: 'admin', departamento: 'Crédito' },
  'vinicius.fr@moni.casa': { role: 'team', departamento: 'Produto' },
  'fabio.siano@moni.casa': { role: 'team', departamento: 'Produto' },
  'karoline.galdino@moni.casa': { role: 'team', departamento: 'Homologações' },
  'helena.oliveira@moni.casa': { role: 'team', departamento: 'Homologações' },
  'jessica.silva@moni.casa': { role: 'team', departamento: 'Homologações' },
  'leticia.duarte@moni.casa': { role: 'team', departamento: 'Homologações' },
  'bruna.scarpeli@moni.casa': { role: 'team', departamento: 'Modelo Virtual / Executivo' },
  'larissa.lima@moni.casa': { role: 'team', departamento: 'Modelo Virtual / Executivo' },
  'vitor.penha@moni.casa': { role: 'team', departamento: 'Modelo Virtual / Executivo' },
  'fernanda.lobao@moni.casa': { role: 'admin', departamento: 'Caneta Verde' },
  'ingrid.hora@moni.casa': { role: 'admin', departamento: 'Caneta Verde' },
  'danilo.n@moni.casa': { role: 'admin', departamento: 'Caneta Verde' },
  'murillo@moni.casa': { role: 'admin', departamento: 'CEO' },
  'isa.seabra@moni.casa': { role: 'admin', departamento: 'Contabilidade' },
  'felipe.batista@moni.casa': { role: 'team', departamento: 'Financeiro' },
  'diogo.chagas@moni.casa': { role: 'team', departamento: 'Moní Capital' },
};
