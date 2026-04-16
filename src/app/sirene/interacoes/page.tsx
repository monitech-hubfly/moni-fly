import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { InteracoesLista } from './InteracoesLista';

export const dynamic = 'force-dynamic';

type ViewRow = Record<string, unknown>;

export default async function SireneInteracoesPage() {
  const admin = createAdminClient();

  const { data: viewRows, error: viewErr } = await admin
    .from('v_atividades_unificadas')
    .select(
      [
        'id',
        'card_id',
        'card_titulo',
        'fase_nome',
        'kanban_nome',
        'kanban_id',
        'responsavel_id',
        'responsavel_nome',
        'tipo',
        'titulo',
        'descricao',
        'atividade_status',
        'data_vencimento',
        'time_nome',
        'times_nomes',
        'franqueado_nome',
        'criado_em',
        'sla_status',
      ].join(', '),
    )
    .not('card_id', 'is', null)
    .order('criado_em', { ascending: false });

  if (viewErr) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-red-300">
        <p>Erro ao carregar chamados: {viewErr.message}</p>
      </main>
    );
  }

  const rows = (viewRows ?? []) as unknown as ViewRow[];
  const ids = rows.map((r) => String(r.id)).filter(Boolean);

  let kaById = new Map<string, { trava: boolean; origem: string; responsaveis_ids: string[] }>();
  if (ids.length > 0) {
    const chunk = 200;
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk);
      const { data: kaRows } = await admin
        .from('kanban_atividades')
        .select('id, trava, origem, responsaveis_ids')
        .in('id', slice);
      for (const r of kaRows ?? []) {
        const id = String((r as { id: string }).id);
        const raw = (r as { responsaveis_ids?: unknown }).responsaveis_ids;
        const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
        kaById.set(id, {
          trava: Boolean((r as { trava?: boolean }).trava),
          origem: String((r as { origem?: string }).origem ?? 'nativo'),
          responsaveis_ids: arr,
        });
      }
    }
  }

  const interacoes = rows
    .filter((r) => String(r.atividade_status ?? '').toLowerCase() !== 'cancelada')
    .map((r) => {
      const id = String(r.id);
      const ka = kaById.get(id);
      return {
        id,
        card_id: r.card_id != null ? String(r.card_id) : null,
        card_titulo: (r.card_titulo as string | null) ?? null,
        fase_nome: String(r.fase_nome ?? ''),
        kanban_nome: String(r.kanban_nome ?? ''),
        kanban_id: r.kanban_id != null ? String(r.kanban_id) : null,
        responsavel_id: r.responsavel_id != null ? String(r.responsavel_id) : null,
        responsavel_nome: (r.responsavel_nome as string | null) ?? null,
        tipo: String(r.tipo ?? 'atividade'),
        titulo: String(r.titulo ?? '').trim() || '(sem título)',
        descricao: (r.descricao as string | null) ?? null,
        atividade_status: String(r.atividade_status ?? ''),
        data_vencimento: r.data_vencimento != null ? String(r.data_vencimento).slice(0, 10) : null,
        time_nome: (r.time_nome as string | null) ?? null,
        times_nomes: r.times_nomes,
        franqueado_nome: (() => {
          const v = r.franqueado_nome;
          if (v == null || typeof v !== 'string') return null;
          const t = v.trim();
          return t || null;
        })(),
        criado_em: String(r.criado_em ?? ''),
        sla_status: (r.sla_status as string | null) ?? null,
        trava: ka?.trava ?? false,
        origem: ka?.origem ?? 'nativo',
        responsaveis_ids: ka?.responsaveis_ids ?? [],
      };
    });

  const { data: timesRows } = await admin.from('kanban_times').select('id, nome').order('nome');
  const times = (timesRows ?? []).map((t) => ({
    id: String((t as { id: string }).id),
    nome: String((t as { nome: string }).nome),
  }));

  const respIdSet = new Set<string>();
  for (const it of interacoes) {
    if (it.responsavel_id) respIdSet.add(it.responsavel_id);
    for (const uid of it.responsaveis_ids) respIdSet.add(uid);
  }
  const respIds = [...respIdSet];
  let responsaveis: { id: string; nome: string }[] = [];
  if (respIds.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', respIds);
    responsaveis = (profs ?? []).map((p) => ({
      id: String((p as { id: string }).id),
      nome: String((p as { full_name?: string | null; email?: string | null }).full_name?.trim() ||
        (p as { email?: string | null }).email ||
        String((p as { id: string }).id).slice(0, 8)),
    }));
    responsaveis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  const currentUserId = user?.id ?? null;

  return (
    <InteracoesLista
      interacoes={interacoes}
      times={times}
      responsaveis={responsaveis}
      currentUserId={currentUserId}
    />
  );
}
