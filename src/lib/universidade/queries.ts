import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CasaComModulos,
  CasaComProgresso,
  CasaComProgressoStatus,
  ConteudoChecklist,
  ConteudoLeitura,
  ConteudoQuiz,
  ConteudoTemplate,
  ConteudoVideo,
  UniBibliotecaItem,
  UniCasa,
  UniCertificado,
  UniModulo,
  UniModuloTipo,
  UniProgresso,
} from './types';

function parseConteudo<T>(raw: unknown): T | null {
  if (raw == null || typeof raw !== 'object') return null;
  return raw as T;
}

export function parseModuloRow(row: {
  id: string;
  casa_id: string;
  tipo: string;
  titulo: string;
  conteudo: unknown;
  ordem: number;
  obrigatorio: boolean | null;
  criado_em: string | null;
}): UniModulo {
  const base = {
    id: String(row.id),
    casa_id: String(row.casa_id),
    titulo: String(row.titulo),
    ordem: Number(row.ordem),
    obrigatorio: row.obrigatorio,
    criado_em: row.criado_em,
  };
  const t = String(row.tipo) as UniModuloTipo;
  switch (t) {
    case 'video':
      return { ...base, tipo: 'video', conteudo: parseConteudo<ConteudoVideo>(row.conteudo) };
    case 'checklist':
      return { ...base, tipo: 'checklist', conteudo: parseConteudo<ConteudoChecklist>(row.conteudo) };
    case 'quiz':
      return { ...base, tipo: 'quiz', conteudo: parseConteudo<ConteudoQuiz>(row.conteudo) };
    case 'template':
      return { ...base, tipo: 'template', conteudo: parseConteudo<ConteudoTemplate>(row.conteudo) };
    case 'leitura':
      return { ...base, tipo: 'leitura', conteudo: parseConteudo<ConteudoLeitura>(row.conteudo) };
    default:
      return { ...base, tipo: 'leitura', conteudo: null };
  }
}

export async function getCasas(supabase: SupabaseClient): Promise<UniCasa[]> {
  const { data, error } = await supabase
    .from('uni_casas')
    .select('id, slug, numero, titulo, descricao, cor_tema, ativa, criado_em')
    .eq('ativa', true)
    .order('numero', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    numero: Number(r.numero),
    titulo: String(r.titulo),
    descricao: r.descricao != null ? String(r.descricao) : null,
    cor_tema: r.cor_tema != null ? String(r.cor_tema) : null,
    ativa: r.ativa as boolean | null,
    criado_em: r.criado_em != null ? String(r.criado_em) : null,
  }));
}

export async function getCasaBySlug(supabase: SupabaseClient, slug: string): Promise<CasaComModulos | null> {
  const { data: casa, error: e1 } = await supabase
    .from('uni_casas')
    .select('id, slug, numero, titulo, descricao, cor_tema, ativa, criado_em')
    .eq('slug', slug)
    .maybeSingle();
  if (e1) throw e1;
  if (!casa) return null;

  const { data: mods, error: e2 } = await supabase
    .from('uni_modulos')
    .select('id, casa_id, tipo, titulo, conteudo, ordem, obrigatorio, criado_em')
    .eq('casa_id', casa.id)
    .order('ordem', { ascending: true });
  if (e2) throw e2;

  const uni: UniCasa = {
    id: String(casa.id),
    slug: String(casa.slug),
    numero: Number(casa.numero),
    titulo: String(casa.titulo),
    descricao: casa.descricao != null ? String(casa.descricao) : null,
    cor_tema: casa.cor_tema != null ? String(casa.cor_tema) : null,
    ativa: casa.ativa as boolean | null,
    criado_em: casa.criado_em != null ? String(casa.criado_em) : null,
  };

  return {
    ...uni,
    modulos: (mods ?? []).map((m) =>
      parseModuloRow({
        id: String(m.id),
        casa_id: String(m.casa_id),
        tipo: String(m.tipo),
        titulo: String(m.titulo),
        conteudo: m.conteudo,
        ordem: Number(m.ordem),
        obrigatorio: m.obrigatorio as boolean | null,
        criado_em: m.criado_em != null ? String(m.criado_em) : null,
      }),
    ),
  };
}

export async function getProgressoUsuario(supabase: SupabaseClient, userId: string): Promise<UniProgresso[]> {
  const { data, error } = await supabase
    .from('uni_progresso')
    .select('id, user_id, modulo_id, casa_id, status, dados, nota, concluido_em, criado_em')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    modulo_id: String(r.modulo_id),
    casa_id: r.casa_id != null ? String(r.casa_id) : null,
    status: r.status as UniProgresso['status'],
    dados: (r.dados as Record<string, unknown> | null) ?? null,
    nota: r.nota != null ? Number(r.nota) : null,
    concluido_em: r.concluido_em != null ? String(r.concluido_em) : null,
    criado_em: r.criado_em != null ? String(r.criado_em) : null,
  }));
}

/** Regra sequencial casa N-1 → N (para integrações legadas). O tabuleiro e a jornada não bloqueiam por isto. */
export async function verificarDesbloqueioDb(
  supabase: SupabaseClient,
  userId: string,
  casaNumero: number,
): Promise<boolean> {
  if (casaNumero <= 0) return true;

  const { data: casaAnt, error: e1 } = await supabase
    .from('uni_casas')
    .select('id')
    .eq('numero', casaNumero - 1)
    .eq('ativa', true)
    .maybeSingle();
  if (e1) throw e1;
  if (!casaAnt) return true;

  const { data: mods, error: e2 } = await supabase
    .from('uni_modulos')
    .select('id')
    .eq('casa_id', casaAnt.id)
    .eq('obrigatorio', true);
  if (e2) throw e2;
  const obrIds = (mods ?? []).map((m) => String(m.id));
  if (obrIds.length === 0) return true;

  const { data: prog, error: e3 } = await supabase
    .from('uni_progresso')
    .select('modulo_id, status')
    .eq('user_id', userId)
    .in('modulo_id', obrIds)
    .eq('status', 'concluido');
  if (e3) throw e3;
  const done = new Set((prog ?? []).map((p) => String(p.modulo_id)));
  return obrIds.every((id) => done.has(id));
}

function casaStatus(
  bloqueada: boolean,
  totalObr: number,
  concl: number,
  obrEmProgresso: number,
): CasaComProgressoStatus {
  if (bloqueada) return 'bloqueada';
  const pct = totalObr > 0 ? Math.round((concl / totalObr) * 100) : 0;
  if (pct >= 100) return 'concluida';
  if (pct > 0 || obrEmProgresso > 0) return 'em_progresso';
  return 'disponivel';
}

export async function getCasasComProgresso(
  supabase: SupabaseClient,
  userId: string,
): Promise<CasaComProgresso[]> {
  const casas = await getCasas(supabase);
  const progresso = await getProgressoUsuario(supabase, userId);
  const porModulo = new Map(progresso.map((p) => [p.modulo_id, p]));

  const out: CasaComProgresso[] = [];

  for (const c of casas) {
    const { data: mods } = await supabase
      .from('uni_modulos')
      .select('id, obrigatorio')
      .eq('casa_id', c.id)
      .order('ordem', { ascending: true });

    const obr = (mods ?? []).filter((m) => m.obrigatorio !== false);
    const totalObr = obr.length;
    let concl = 0;
    let obrEmProgresso = 0;
    for (const m of obr) {
      const p = porModulo.get(String(m.id));
      if (p?.status === 'concluido') concl++;
      else if (p?.status === 'em_progresso') obrEmProgresso++;
    }
    const percentual = totalObr > 0 ? Math.round((concl / totalObr) * 100) : 0;

    // Tabuleiro: todas as casas navegáveis; progresso só reflete conclusões (e status "em andamento" com atividade).
    const status = casaStatus(false, totalObr, concl, obrEmProgresso);

    out.push({
      ...c,
      percentual,
      modulos_concluidos: concl,
      total_obrigatorios: totalObr,
      status,
    });
  }

  return out;
}

export async function getCertificados(supabase: SupabaseClient, userId: string): Promise<UniCertificado[]> {
  const { data, error } = await supabase
    .from('uni_certificados')
    .select('id, user_id, nivel, titulo, emitido_em')
    .eq('user_id', userId)
    .order('nivel', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    nivel: Number(r.nivel),
    titulo: String(r.titulo),
    emitido_em: r.emitido_em != null ? String(r.emitido_em) : null,
  }));
}

export async function getBiblioteca(
  supabase: SupabaseClient,
  categoria?: string,
): Promise<UniBibliotecaItem[]> {
  let q = supabase
    .from('uni_biblioteca')
    .select('id, categoria, titulo, descricao, tipo, url, tags, visivel_para, criado_em')
    .order('categoria', { ascending: true })
    .order('titulo', { ascending: true });
  if (categoria?.trim()) {
    q = q.eq('categoria', categoria.trim());
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    categoria: String(r.categoria),
    titulo: String(r.titulo),
    descricao: r.descricao != null ? String(r.descricao) : null,
    tipo: (r.tipo as UniBibliotecaItem['tipo']) ?? null,
    url: r.url != null ? String(r.url) : null,
    tags: (r.tags as string[] | null) ?? null,
    visivel_para: (r.visivel_para as string[] | null) ?? null,
    criado_em: r.criado_em != null ? String(r.criado_em) : null,
  }));
}

/** Progresso geral: média dos percentuais de todas as casas (peso igual por casa; só sobe com módulos concluídos). */
export function calcularProgressoGeral(casas: CasaComProgresso[]): number {
  const ativas = casas.filter((c) => c.status !== 'bloqueada');
  if (ativas.length === 0) return 0;
  const sum = ativas.reduce((a, c) => a + c.percentual, 0);
  return Math.round(sum / ativas.length);
}

export function nivelMaximoCertificado(certificados: UniCertificado[]): number {
  if (!certificados.length) return 0;
  return Math.max(...certificados.map((c) => c.nivel));
}
