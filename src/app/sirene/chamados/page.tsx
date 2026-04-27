import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
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
  const filtroTipoChamado =
    params.tipo === 'padrao' || params.tipo === 'hdm' ? (params.tipo as 'padrao' | 'hdm') : undefined;

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
    .order('criado_em', { ascending: false });

  let painelErro: string | null = null;
  let interacoesListaProps: {
    interacoes: InteracaoSireneRow[];
    times: { id: string; nome: string }[];
    responsaveis: { id: string; nome: string }[];
    currentUserId: string | null;
    comentariosCountByCardId: Record<string, number>;
    filtroTipoChamado?: 'padrao' | 'hdm';
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
        sirene_chamado_id: number | null;
      }
    >();
    if (ids.length > 0) {
      const chunk = 200;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const { data: kaRows } = await admin
          .from('kanban_atividades')
          .select(
            'id, trava, origem, responsaveis_ids, times_ids, responsavel_nome_texto, sirene_chamado_id',
          )
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
          const sid = (r as { sirene_chamado_id?: number | null }).sirene_chamado_id;
          kaById.set(id, {
            trava: Boolean((r as { trava?: boolean }).trava),
            origem: String((r as { origem?: string }).origem ?? 'nativo'),
            responsaveis_ids: arr,
            times_ids: tids,
            responsavel_nome_texto,
            sirene_chamado_id: sid != null && Number.isFinite(Number(sid)) ? Number(sid) : null,
          });
        }
      }
    }

    const sireneIds = [
      ...new Set(
        [...kaById.values()]
          .map((k) => k.sirene_chamado_id)
          .filter((x): x is number => x != null && Number.isFinite(x)),
      ),
    ];
    const sireneById = new Map<
      number,
      {
        frank_id: string | null;
        frank_nome: string | null;
        numero: number;
        tipo: string;
        time_abertura: string | null;
        abertura_responsavel_nome: string | null;
        hdm_responsavel: string | null;
      }
    >();
    if (sireneIds.length > 0) {
      const { data: scRows } = await admin
        .from('sirene_chamados')
        .select(
          'id, frank_id, frank_nome, numero, tipo, time_abertura, abertura_responsavel_nome, hdm_responsavel',
        )
        .in('id', sireneIds);
      for (const s of scRows ?? []) {
        const id = Number((s as { id: number }).id);
        if (!Number.isFinite(id)) continue;
        sireneById.set(id, {
          frank_id: (s as { frank_id?: string | null }).frank_id ?? null,
          frank_nome: (s as { frank_nome?: string | null }).frank_nome ?? null,
          numero: Number((s as { numero?: number }).numero ?? id),
          tipo: String((s as { tipo?: string }).tipo ?? 'padrao'),
          time_abertura: (s as { time_abertura?: string | null }).time_abertura ?? null,
          abertura_responsavel_nome:
            (s as { abertura_responsavel_nome?: string | null }).abertura_responsavel_nome ?? null,
          hdm_responsavel: (s as { hdm_responsavel?: string | null }).hdm_responsavel ?? null,
        });
      }
    }

    const cardIdsNativo = [
      ...new Set(
        rows
          .map((r) => {
            const id = String(r.id);
            const ka = kaById.get(id);
            const cid = r.card_id != null ? String(r.card_id) : null;
            if (!cid || ka?.origem !== 'nativo') return null;
            return cid;
          })
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const frankIdByCard = new Map<string, string | null>();
    if (cardIdsNativo.length > 0) {
      const ch = 200;
      for (let i = 0; i < cardIdsNativo.length; i += ch) {
        const sl = cardIdsNativo.slice(i, i + ch);
        const { data: cards } = await admin.from('kanban_cards').select('id, franqueado_id').in('id', sl);
        for (const c of cards ?? []) {
          frankIdByCard.set(
            String((c as { id: string }).id),
            (c as { franqueado_id?: string | null }).franqueado_id ?? null,
          );
        }
      }
    }

    let interacoes: InteracaoSireneRow[] = rows
      .filter((r) => String(r.atividade_status ?? '').toLowerCase() !== 'cancelada')
      .map((r) => {
        const id = String(r.id);
        const ka = kaById.get(id);
        const cardIdStr = r.card_id != null ? String(r.card_id) : null;
        const sid = ka?.sirene_chamado_id ?? null;
        const scMeta = sid != null ? sireneById.get(sid) : undefined;
        const frankFromCard =
          ka?.origem === 'nativo' && cardIdStr ? frankIdByCard.get(cardIdStr) ?? null : null;
        const frank_id =
          ka?.origem === 'sirene' && scMeta ? scMeta.frank_id : frankFromCard;

        return {
          id,
          card_id: cardIdStr,
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
            if (v == null || typeof v !== 'string') {
              if (ka?.origem === 'sirene' && scMeta?.frank_nome) return scMeta.frank_nome.trim() || null;
              return null;
            }
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
          sirene_chamado_id: sid,
          sirene_numero: scMeta?.numero ?? null,
          sirene_chamado_tipo: ka?.origem === 'sirene' && scMeta ? scMeta.tipo : null,
          sirene_time_abertura: ka?.origem === 'sirene' && scMeta ? scMeta.time_abertura : null,
          sirene_abertura_responsavel_nome:
            ka?.origem === 'sirene' && scMeta ? scMeta.abertura_responsavel_nome : null,
          sirene_hdm_responsavel: ka?.origem === 'sirene' && scMeta ? scMeta.hdm_responsavel : null,
          frank_id,
        };
      });

    if (filtroTipoChamado) {
      interacoes = interacoes.filter((row) => {
        if (row.origem !== 'sirene' || row.sirene_chamado_id == null) return true;
        const t = row.sirene_chamado_tipo ?? 'padrao';
        return filtroTipoChamado === 'hdm' ? t === 'hdm' : t === 'padrao';
      });
    }

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
      filtroTipoChamado,
    };
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Chamados</h1>
      <p className="mt-1 text-stone-400">Chamados Sirene e atividades nos cards — lista unificada.</p>

      <section className="mt-6">
        {painelErro ? (
          <p className="text-red-300">Erro ao carregar o painel: {painelErro}</p>
        ) : interacoesListaProps ? (
          <InteracoesLista
            interacoes={interacoesListaProps.interacoes}
            times={interacoesListaProps.times}
            responsaveis={interacoesListaProps.responsaveis}
            currentUserId={interacoesListaProps.currentUserId}
            comentariosCountByCardId={interacoesListaProps.comentariosCountByCardId}
            filtroTipoChamado={interacoesListaProps.filtroTipoChamado}
          />
        ) : null}
      </section>
    </main>
  );
}
