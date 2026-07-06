import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Suspense } from 'react';
import { HDM_RESPONSAVEIS_TODOS_EMAILS } from '@/lib/times-responsaveis';
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
    responsaveis: { id: string; nome: string; email?: string | null }[];
    currentUserId: string | null;
    sessionEhAdmin: boolean;
    comentariosCountByCardId: Record<string, number>;
    filtroTipoChamado?: 'padrao' | 'hdm';
  } | null = null;

  if (viewErr) {
    painelErro = viewErr.message;
  } else {
    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    const currentUserId = user?.id ?? null;
    let sessionEhAdmin = false;
    if (user) {
      const { data: prof } = await supabaseUser
        .from('profiles')
        .select('role, cargo')
        .eq('id', user.id)
        .maybeSingle();
      const role = String((prof as { role?: string } | null)?.role ?? '').toLowerCase();
      const cargo = String((prof as { cargo?: string } | null)?.cargo ?? '').toLowerCase();
      sessionEhAdmin = role === 'admin' || cargo === 'adm';
    }

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
        categoria: 'chamado' | 'melhoria';
        time_abertura_nome: string | null;
        numero: number | null;
        criado_por: string | null;
      }
    >();
    if (ids.length > 0) {
      const chunk = 200;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const { data: kaRows } = await admin
          .from('kanban_atividades')
          .select(
            'id, trava, origem, responsaveis_ids, times_ids, responsavel_nome_texto, sirene_chamado_id, categoria, time_abertura_nome, numero, criado_por',
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
            categoria: (r as { categoria?: string }).categoria === 'melhoria' ? 'melhoria' : 'chamado',
            time_abertura_nome: (r as { time_abertura_nome?: string | null }).time_abertura_nome ?? null,
            numero: (() => {
              const n = Number((r as { numero?: number | null }).numero);
              return Number.isFinite(n) ? n : null;
            })(),
            criado_por: (() => {
              const cp = (r as { criado_por?: string | null }).criado_por;
              return cp != null && String(cp).trim() !== '' ? String(cp) : null;
            })(),
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
        arquivado: boolean;
        te_trata: boolean | null;
        prioridade: string | null;
        processo_id: string | null;
        processo_titulo: string | null;
        processo_kanban_nome: string | null;
      }
    >();
    if (sireneIds.length > 0) {
      const { data: scRows } = await admin
        .from('sirene_chamados')
        .select(
          'id, frank_id, frank_nome, numero, tipo, time_abertura, abertura_responsavel_nome, hdm_responsavel, arquivado, te_trata, prioridade, processo_id, processo_titulo, processo_kanban_nome',
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
          arquivado: Boolean((s as { arquivado?: boolean | null }).arquivado),
          te_trata: (s as { te_trata?: boolean | null }).te_trata ?? null,
          prioridade: (s as { prioridade?: string | null }).prioridade ?? null,
          processo_id: (s as { processo_id?: string | null }).processo_id ?? null,
          processo_titulo: (s as { processo_titulo?: string | null }).processo_titulo ?? null,
          processo_kanban_nome: (s as { processo_kanban_nome?: string | null }).processo_kanban_nome ?? null,
        });
      }
    }

    // Busca responsaveis_ids dos tópicos de chamados Sirene para o filtro "Ver minhas"
    const topicosResponsaveisByChamadoId = new Map<number, string[]>();
    const meusTopicosConcluidosByChamadoId = new Map<number, boolean>();
    if (sireneIds.length > 0 || kaById.size > 0) {
      // tópicos linkados por chamado_id (criados via Sirene direta normal)
      const byChamadoQuery = sireneIds.length > 0
        ? await admin
            .from('sirene_topicos')
            .select('chamado_id, interacao_id, responsavel_id, responsaveis_ids, status')
            .in('chamado_id', sireneIds)
            .eq('arquivado', false)
        : { data: [] };

      // tópicos linkados por interacao_id (criados via Sirene sem chamado_id preenchido)
      const kaIds = [...kaById.keys()];
      const byInteracaoQuery = kaIds.length > 0
        ? await admin
            .from('sirene_topicos')
            .select('chamado_id, interacao_id, responsavel_id, responsaveis_ids, status')
            .in('interacao_id', kaIds)
            .eq('arquivado', false)
        : { data: [] };

      // helper para resolver chamado_id a partir de interacao_id
      const chamadoIdByKaId = new Map<string, number>();
      for (const [kaId, ka] of kaById.entries()) {
        if (ka.sirene_chamado_id != null) chamadoIdByKaId.set(kaId, ka.sirene_chamado_id);
      }

      const allTopicos = [...(byChamadoQuery.data ?? []), ...(byInteracaoQuery.data ?? [])];
      for (const t of allTopicos) {
        const tRaw = t as { chamado_id?: number | null; interacao_id?: string | null; responsavel_id?: string | null; responsaveis_ids?: unknown; status?: string | null };
        // resolve o chamado_id: direto ou via interacao_id → ka → sirene_chamado_id
        let cid = tRaw.chamado_id != null && Number.isFinite(Number(tRaw.chamado_id))
          ? Number(tRaw.chamado_id)
          : null;
        if (cid == null && tRaw.interacao_id) {
          cid = chamadoIdByKaId.get(tRaw.interacao_id) ?? null;
        }
        if (cid == null) continue;
        const existing = topicosResponsaveisByChamadoId.get(cid) ?? [];
        const rawRi = tRaw.responsaveis_ids;
        const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
        const rid = tRaw.responsavel_id;
        const merged = [...new Set([...existing, ...ri, ...(rid ? [rid] : [])])];
        topicosResponsaveisByChamadoId.set(cid, merged);
      }

      // Passo 2 — computa se TODOS os tópicos do usuário logado estão concluídos por chamado
      if (currentUserId) {
        for (const t of allTopicos) {
          const tRaw = t as { chamado_id?: number | null; interacao_id?: string | null; responsavel_id?: string | null; responsaveis_ids?: unknown; status?: string | null };
          let cid = tRaw.chamado_id != null && Number.isFinite(Number(tRaw.chamado_id))
            ? Number(tRaw.chamado_id)
            : null;
          if (cid == null && tRaw.interacao_id) {
            cid = chamadoIdByKaId.get(tRaw.interacao_id) ?? null;
          }
          if (cid == null) continue;
          const rawRi = tRaw.responsaveis_ids;
          const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
          const rid = tRaw.responsavel_id ?? null;
          const ehMeu = ri.includes(currentUserId) || rid === currentUserId;
          if (!ehMeu) continue;
          const status = String(tRaw.status ?? '').toLowerCase();
          const concluido = status === 'concluido' || status === 'aprovado';
          const prev = meusTopicosConcluidosByChamadoId.get(cid);
          // Inicia com o valor do primeiro tópico do usuário; AND para os seguintes
          meusTopicosConcluidosByChamadoId.set(cid, prev === undefined ? concluido : prev && concluido);
        }
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
          responsaveis_ids: (() => {
            const base = ka?.responsaveis_ids ?? [];
            const sid = ka?.sirene_chamado_id ?? null;
            if (ka?.origem === 'sirene' && sid != null) {
              const fromTopicos = topicosResponsaveisByChamadoId.get(sid) ?? [];
              return [...new Set([...base, ...fromTopicos])];
            }
            return base;
          })(),
          times_ids: ka?.times_ids ?? [],
          responsavel_nome_texto: ka?.responsavel_nome_texto ?? null,
          sirene_chamado_id: sid,
          numero: ka?.numero ?? scMeta?.numero ?? null,
          sirene_numero: ka?.numero ?? scMeta?.numero ?? null,
          sirene_chamado_tipo: ka?.origem === 'sirene' && scMeta ? scMeta.tipo : null,
          sirene_time_abertura:
            ka?.time_abertura_nome?.trim() ||
            (ka?.origem === 'sirene' && scMeta ? scMeta.time_abertura : null),
          categoria: ka?.categoria ?? 'chamado',
          time_abertura_nome: ka?.time_abertura_nome ?? null,
          sirene_abertura_responsavel_nome:
            ka?.origem === 'sirene' && scMeta ? scMeta.abertura_responsavel_nome : null,
          sirene_hdm_responsavel: ka?.origem === 'sirene' && scMeta ? scMeta.hdm_responsavel : null,
          sirene_prioridade: ka?.origem === 'sirene' && scMeta ? scMeta.prioridade : null,
          frank_id,
          te_trata: ka?.origem === 'sirene' && scMeta ? scMeta.te_trata : null,
          sirene_arquivado: ka?.origem === 'sirene' && scMeta ? scMeta.arquivado : false,
          criado_por: ka?.criado_por ?? null,
          meus_topicos_todos_concluidos: (() => {
            const sid = ka?.sirene_chamado_id ?? null;
            if (ka?.origem !== 'sirene' || sid == null) return undefined;
            return meusTopicosConcluidosByChamadoId.get(sid);
          })(),
          processo_id: ka?.origem === 'sirene' && scMeta ? scMeta.processo_id : null,
          processo_titulo: ka?.origem === 'sirene' && scMeta ? scMeta.processo_titulo : null,
          processo_kanban_nome: ka?.origem === 'sirene' && scMeta ? scMeta.processo_kanban_nome : null,
        };
      });

    if (filtroTipoChamado) {
      interacoes = interacoes.filter((row) => {
        if (row.origem !== 'sirene' || row.sirene_chamado_id == null) return true;
        const t = row.sirene_chamado_tipo ?? 'padrao';
        return filtroTipoChamado === 'hdm' ? t === 'hdm' : t === 'padrao';
      });
    }

    // Busca cards em aberto da Pastelaria e injeta na lista
    const { data: pastelariaCards } = await admin
      .from('pastelaria_cards')
      .select('id, nome, coluna, responsavel_id, responsavel_nome, created_at, area_id, sirene_chamado_id')
      .in('coluna', ['mapped', 'doing'])
      .order('created_at', { ascending: false });

    for (const pc of pastelariaCards ?? []) {
      const p = pc as {
        id: string;
        nome: string | null;
        coluna: string;
        responsavel_id: string | null;
        responsavel_nome: string | null;
        created_at: string | null;
        area_id: string | null;
        sirene_chamado_id: number | null;
      };
      const statusMap: Record<string, string> = {
        mapped: 'pendente',
        doing: 'em_andamento',
      };
      interacoes.push({
        id: `pastelaria-${String(p.id)}`,
        card_id: null,
        card_titulo: null,
        fase_nome: '',
        kanban_nome: 'Pastelaria',
        kanban_id: null,
        responsavel_id: p.responsavel_id ?? null,
        responsavel_nome: p.responsavel_nome ?? null,
        tipo: 'atividade',
        titulo: String(p.nome ?? '').trim() || '(sem título)',
        descricao: null,
        atividade_status: statusMap[p.coluna] ?? 'pendente',
        data_vencimento: null,
        time_nome: null,
        times_nomes: [],
        franqueado_nome: null,
        criado_em: String(p.created_at ?? ''),
        sla_status: null,
        trava: false,
        origem: 'pastelaria',
        responsaveis_ids: p.responsavel_id ? [p.responsavel_id] : [],
        times_ids: [],
        responsavel_nome_texto: p.responsavel_nome ?? null,
        sirene_chamado_id: p.sirene_chamado_id ?? null,
        numero: null,
        sirene_numero: null,
        sirene_chamado_tipo: null,
        sirene_time_abertura: null,
        categoria: 'chamado',
        time_abertura_nome: null,
        sirene_abertura_responsavel_nome: null,
        sirene_hdm_responsavel: null,
        sirene_prioridade: null,
        frank_id: null,
        te_trata: null,
        sirene_arquivado: false,
        criado_por: null,
      });
    }

    const cardIdsUniq = [...new Set(interacoes.map((i) => i.card_id).filter(Boolean))] as string[];
    const comentariosCountByCardId: Record<string, number> = {};
    if (cardIdsUniq.length > 0) {
      const chunk = 300;
      for (let i = 0; i < cardIdsUniq.length; i += chunk) {
        const slice = cardIdsUniq.slice(i, i + chunk);
        const { data: ccRows } = await admin.from('kanban_card_comentarios').select('card_id').in('card_id', slice).is('sirene_chamado_id', null);
        for (const r of ccRows ?? []) {
          const cid = String((r as { card_id: string }).card_id);
          comentariosCountByCardId[cid] = (comentariosCountByCardId[cid] ?? 0) + 1;
        }
      }
    }

    // Contagem de comentários por sirene_chamado_id (chamados com ou sem card_id)
    const sireneIdsParaContar = [...new Set(
      interacoes
        .filter((i) => i.sirene_chamado_id != null)
        .map((i) => i.sirene_chamado_id as number)
    )];
    if (sireneIdsParaContar.length > 0) {
      const { data: scComentRows } = await admin
        .from('kanban_card_comentarios')
        .select('sirene_chamado_id')
        .in('sirene_chamado_id', sireneIdsParaContar);
      for (const r of scComentRows ?? []) {
        const scid = (r as { sirene_chamado_id: number }).sirene_chamado_id;
        const key = `sirene-${scid}`;
        comentariosCountByCardId[key] = (comentariosCountByCardId[key] ?? 0) + 1;
      }
    }

    const { data: timesRows } = await admin.from('kanban_times').select('id, nome').order('nome');
    const times = (timesRows ?? []).map((t) => ({
      id: String((t as { id: string }).id),
      nome: String((t as { nome: string }).nome),
    }));

    const emailsHdm = [...HDM_RESPONSAVEIS_TODOS_EMAILS];
    const [profsHdmRes, profsAllRes] = await Promise.all([
      admin.from('profiles').select('id, full_name, email').in('email', emailsHdm),
      admin
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true, nullsFirst: false })
        .limit(500),
    ]);
    const byIdProf = new Map<string, { id: string; nome: string; email: string | null }>();
    const ingestProfRow = (rows: { id: string; full_name?: string | null; email?: string | null }[] | null) => {
      for (const p of rows ?? []) {
        const id = String(p.id);
        const em = String(p.email ?? '')
          .trim()
          .toLowerCase();
        const fn = String(p.full_name ?? '').trim();
        byIdProf.set(id, {
          id,
          nome: fn || em || id.slice(0, 8),
          email: em || null,
        });
      }
    };
    ingestProfRow((profsHdmRes.data ?? []) as { id: string; full_name?: string | null; email?: string | null }[]);
    ingestProfRow((profsAllRes.data ?? []) as { id: string; full_name?: string | null; email?: string | null }[]);
    const responsaveis = [...byIdProf.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    interacoesListaProps = {
      interacoes,
      times,
      responsaveis,
      currentUserId,
      sessionEhAdmin,
      comentariosCountByCardId,
      filtroTipoChamado,
    };
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
      <h1 className="text-2xl font-bold text-[color:var(--moni-text-primary)]">Chamados</h1>
      <p className="mt-1 text-[color:var(--moni-text-tertiary)]">
        Chamados Sirene e atividades nos cards — lista unificada.
      </p>

      <section className="mt-6">
        {painelErro ? (
          <p className="text-red-700">Erro ao carregar o painel: {painelErro}</p>
        ) : interacoesListaProps ? (
          <Suspense fallback={<p className="text-sm text-[color:var(--moni-text-tertiary)]">Carregando chamados…</p>}>
            <InteracoesLista
              interacoes={interacoesListaProps.interacoes}
              times={interacoesListaProps.times}
              responsaveis={interacoesListaProps.responsaveis}
              currentUserId={interacoesListaProps.currentUserId}
              sessionEhAdmin={interacoesListaProps.sessionEhAdmin}
              comentariosCountByCardId={interacoesListaProps.comentariosCountByCardId}
              filtroTipoChamado={interacoesListaProps.filtroTipoChamado}
            />
          </Suspense>
        ) : null}
      </section>
    </main>
  );
}
