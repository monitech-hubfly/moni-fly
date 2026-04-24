import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { listChamados } from '../actions';
import { ChamadosLista } from '../ChamadosLista';
import { InteracoesLista, type InteracaoSireneRow } from './InteracoesLista';

export const dynamic = 'force-dynamic';

type SearchParams = { tipo?: string };
type ViewRow = Record<string, unknown>;

export default async function SireneChamadosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filtroTipo = params.tipo === 'padrao' || params.tipo === 'hdm' ? params.tipo : undefined;
  const listResult = await listChamados(filtroTipo);
  const chamados = listResult.ok ? listResult.chamados : [];

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

  let painelErro: string | null = null;
  let interacoesListaProps: {
    interacoes: InteracaoSireneRow[];
    times: { id: string; nome: string }[];
    responsaveis: { id: string; nome: string }[];
    currentUserId: string | null;
    comentariosCountByCardId: Record<string, number>;
  } | null = null;

  if (viewErr) {
    painelErro = viewErr.message;
  } else {
    const rows = (viewRows ?? []) as unknown as ViewRow[];
    const ids = rows.map((r) => String(r.id)).filter(Boolean);

    let kaById = new Map<
      string,
      {
        trava: boolean;
        origem: string;
        responsaveis_ids: string[];
        times_ids: string[];
        responsavel_nome_texto: string | null;
      }
    >();
    if (ids.length > 0) {
      const chunk = 200;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const { data: kaRows } = await admin
          .from('kanban_atividades')
          .select('id, trava, origem, responsaveis_ids, times_ids, responsavel_nome_texto')
          .in('id', slice);
        for (const r of kaRows ?? []) {
          const id = String((r as { id: string }).id);
          const raw = (r as { responsaveis_ids?: unknown }).responsaveis_ids;
          const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
          const rawT = (r as { times_ids?: unknown }).times_ids;
          const tids = Array.isArray(rawT) ? rawT.map((x) => String(x)) : [];
          const rnt = (r as { responsavel_nome_texto?: string | null }).responsavel_nome_texto;
          const responsavel_nome_texto =
            rnt != null && String(rnt).trim() !== '' ? String(rnt).trim() : null;
          kaById.set(id, {
            trava: Boolean((r as { trava?: boolean }).trava),
            origem: String((r as { origem?: string }).origem ?? 'nativo'),
            responsaveis_ids: arr,
            times_ids: tids,
            responsavel_nome_texto,
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
          times_ids: ka?.times_ids ?? [],
          responsavel_nome_texto: ka?.responsavel_nome_texto ?? null,
        };
      });

    const cardIdsUniq = [...new Set(interacoes.map((i) => i.card_id).filter(Boolean))] as string[];
    const comentariosCountByCardId: Record<string, number> = {};
    if (cardIdsUniq.length > 0) {
      const chunk = 300;
      for (let i = 0; i < cardIdsUniq.length; i += chunk) {
        const slice = cardIdsUniq.slice(i, i + chunk);
        const { data: ccRows } = await admin.from('kanban_card_comentarios').select('card_id').in('card_id', slice);
        for (const r of ccRows ?? []) {
          const cid = String((r as { card_id: string }).card_id);
          comentariosCountByCardId[cid] = (comentariosCountByCardId[cid] ?? 0) + 1;
        }
      }
    }

    const { data: timesRows } = await admin.from('kanban_times').select('id, nome').order('nome');
    const times = (timesRows ?? []).map((t) => ({
      id: String((t as { id: string }).id),
      nome: String((t as { nome: string }).nome),
    }));

    const { data: profsAll } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true, nullsFirst: false })
      .limit(500);
    const responsaveis = (profsAll ?? []).map((p) => ({
      id: String((p as { id: string }).id),
      nome:
        String((p as { full_name?: string | null; email?: string | null }).full_name?.trim() ||
          (p as { email?: string | null }).email ||
          String((p as { id: string }).id).slice(0, 8)),
    }));

    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    const currentUserId = user?.id ?? null;

    interacoesListaProps = {
      interacoes,
      times,
      responsaveis,
      currentUserId,
      comentariosCountByCardId,
    };
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Chamados</h1>
      <p className="mt-1 text-stone-400">
        Lista de chamados Sirene (tipo e novo chamado) e painel de atividades nos cards.
      </p>
      <section className="mt-6">
        <ChamadosLista chamados={chamados} />
      </section>

      <section className="mt-10 border-t border-stone-700 pt-8">
        {painelErro ? (
          <p className="text-red-300">Erro ao carregar o painel de cards: {painelErro}</p>
        ) : interacoesListaProps ? (
          <InteracoesLista
            interacoes={interacoesListaProps.interacoes}
            times={interacoesListaProps.times}
            responsaveis={interacoesListaProps.responsaveis}
            currentUserId={interacoesListaProps.currentUserId}
            comentariosCountByCardId={interacoesListaProps.comentariosCountByCardId}
          />
        ) : null}
      </section>
    </main>
  );
}
