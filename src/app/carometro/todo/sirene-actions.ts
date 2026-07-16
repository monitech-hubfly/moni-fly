'use server';

import { Client } from 'pg';

function pgDateToIso(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).slice(0, 10);
  return s || null;
}

export type TopicoAdminRow = {
  id: number;
  chamadoId: number;
  numero: number;
  descricao: string;
  status: string;
  dataFim: string | null;
  chamadoDataVencimento: string | null;
  responsaveisIds: string[];
  responsavelId: string | null;
  responsavelNome: string | null;
  trava: boolean;
  frankId: string | null;
  frankNome: string | null;
  teTrata: boolean | null;
};

export type ProfileAdminRow = { id: string; nome: string | null; time: string | null };

export type GetTodoSireneResult =
  | { ok: true; topicos: TopicoAdminRow[]; profiles: ProfileAdminRow[]; msgCounts: Record<number, number> }
  | { ok: false; error: string };

function buildDbConfig() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) throw new Error('SUPABASE_DB_PASSWORD não definida em .env.local');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*$/, '');
  return {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  };
}

export async function getTodoSireneTopicos(): Promise<GetTodoSireneResult> {
  const client = new Client(buildDbConfig());
  try {
    await client.connect();

    const { rows: raw } = await client.query(`
      SELECT
        st.id, st.descricao, st.status, st.data_fim,
        st.responsaveis_ids, st.responsavel_id, st.responsavel_nome,
        st.trava                AS topico_trava,
        sc.id                   AS sc_id,
        sc.numero,
        sc.frank_id, sc.frank_nome,
        sc.trava                AS sc_trava,
        sc.te_trata,
        sc.data_vencimento
      FROM public.sirene_topicos st
      JOIN public.sirene_chamados sc ON sc.id = COALESCE(
        st.chamado_id,
        (SELECT ka.sirene_chamado_id
         FROM public.kanban_atividades ka
         WHERE ka.id = st.interacao_id
           AND ka.sirene_chamado_id IS NOT NULL
         LIMIT 1)
      )
      WHERE st.status NOT IN ('concluido', 'aprovado')
        AND st.responsavel_id IS NOT NULL
    `);

    // Coletar responsavel IDs únicos
    const allIds = new Set<string>();
    for (const r of raw) {
      const ids: string[] = r.responsaveis_ids ?? [];
      if (ids.length) ids.forEach(id => allIds.add(id));
      else if (r.responsavel_id) allIds.add(r.responsavel_id);
    }

    // Profiles
    let profiles: ProfileAdminRow[] = [];
    if (allIds.size) {
      const { rows: profs } = await client.query(
        `SELECT id, full_name, time FROM public.profiles WHERE id = ANY($1)`,
        [[...allIds]],
      );
      profiles = profs.map(p => ({ id: String(p.id), nome: p.full_name ?? null, time: p.time ?? null }));
    }
    console.log('[getTodoSireneTopicos] allIds coletados:', allIds.size,
      '| IDs:', [...allIds].slice(0, 5),
      '| profiles retornados:', profiles.length);

    console.log('[raw primeiros 3]', raw.slice(0, 3).map(r => ({
      responsavel_id: r.responsavel_id,
      responsaveis_ids: r.responsaveis_ids,
      frank_nome: r.frank_nome,
      sc_trava: r.sc_trava,
      data_vencimento: r.data_vencimento,
    })));

    // Contagem de mensagens por chamado
    const chamadoIds = [...new Set(raw.map(r => r.sc_id as number))];
    const msgCounts: Record<number, number> = {};
    if (chamadoIds.length) {
      const { rows: msgs } = await client.query(
        `SELECT chamado_id FROM public.sirene_mensagens WHERE chamado_id = ANY($1)`,
        [chamadoIds],
      );
      for (const m of msgs) {
        msgCounts[m.chamado_id as number] = (msgCounts[m.chamado_id as number] ?? 0) + 1;
      }
    }

    const topicos: TopicoAdminRow[] = raw.map(r => ({
      id: r.id as number,
      chamadoId: r.sc_id as number,
      numero: (r.numero as number | null) ?? (r.sc_id as number),
      descricao: (r.descricao as string) ?? '',
      status: (r.status as string) ?? '',
      dataFim: pgDateToIso(r.data_fim),
      chamadoDataVencimento: pgDateToIso(r.data_vencimento),
      responsaveisIds: (r.responsaveis_ids as string[] | null) ?? [],
      responsavelId: (r.responsavel_id as string | null) ?? null,
      responsavelNome: (r.responsavel_nome as string | null) ?? null,
      trava: Boolean(r.sc_trava),
      frankId: (r.frank_id as string | null) ?? null,
      frankNome: (r.frank_nome as string | null) ?? null,
      teTrata: (r.te_trata as boolean | null) ?? null,
    }));

    console.log('[getTodoSireneTopicos] raw:', raw.length, 'topicos:', topicos.length);
    return { ok: true, topicos, profiles, msgCounts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro interno.' };
  } finally {
    await client.end().catch(() => {});
  }
}
