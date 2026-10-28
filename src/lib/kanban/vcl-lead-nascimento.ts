import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { KANBAN_IDS, FASE_SLUGS } from '@/lib/constants/kanban-ids';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type NascerCardVclInput = {
  sessionToken: string;
  cardOrigemId: string;
  slug: string;
  corretorId: string;
  nomeCliente: string;
  telefone: string;
  loteCodigo: string | null;
  loteValor: number | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(valor: string): string {
  const id = String(valor ?? '').trim();
  return UUID_RE.test(id) ? id : '';
}

async function empreendimentoDoCardOuSlug(
  admin: SupabaseAdmin,
  cardOrigemId: string,
  slug: string,
): Promise<{ id: string; nome: string; condominio_id: string | null } | null> {
  const { data: direto } = await admin
    .from('imob_empreendimentos')
    .select('id, nome, condominio_id')
    .eq('card_id', cardOrigemId)
    .limit(1);
  const linhaDireta = (direto ?? [])[0] as
    | { id: string; nome: string | null; condominio_id: string | null }
    | undefined;
  if (linhaDireta?.id) {
    return {
      id: String(linhaDireta.id),
      nome: String(linhaDireta.nome ?? '').trim(),
      condominio_id: linhaDireta.condominio_id ? String(linhaDireta.condominio_id) : null,
    };
  }

  const slugNorm = slug.trim().toLowerCase().replace(/[%_]/g, '');
  if (slugNorm) {
    const { data: porSlug } = await admin
      .from('imob_empreendimentos')
      .select('id, nome, condominio_id')
      .ilike('slug', slugNorm)
      .limit(1);
    const achado = (porSlug ?? [])[0] as
      | { id: string; nome: string | null; condominio_id: string | null }
      | undefined;
    if (achado?.id) {
      return {
        id: String(achado.id),
        nome: String(achado.nome ?? '').trim(),
        condominio_id: achado.condominio_id ? String(achado.condominio_id) : null,
      };
    }
  }

  const { data: origem } = await admin
    .from('kanban_cards')
    .select('projeto_id, processo_step_one_id, origem_card_id')
    .eq('id', cardOrigemId)
    .maybeSingle();
  const row = origem as {
    projeto_id?: string | null;
    processo_step_one_id?: string | null;
    origem_card_id?: string | null;
  } | null;
  const ids = new Set<string>([cardOrigemId]);
  const origemId = String(row?.origem_card_id ?? '').trim();
  if (origemId) ids.add(origemId);
  const consultas = [];
  if (row?.projeto_id) {
    consultas.push(admin.from('kanban_cards').select('id').eq('projeto_id', row.projeto_id).limit(40));
  }
  if (row?.processo_step_one_id) {
    consultas.push(
      admin.from('kanban_cards').select('id').eq('processo_step_one_id', row.processo_step_one_id).limit(40),
    );
  }
  const irmaos = await Promise.all(consultas);
  for (const res of irmaos) {
    for (const item of res.data ?? []) {
      const id = String((item as { id?: string }).id ?? '').trim();
      if (id) ids.add(id);
    }
  }
  const { data: emps } = await admin
    .from('imob_empreendimentos')
    .select('id, nome, condominio_id, card_id')
    .in('card_id', [...ids]);
  const lista = (emps ?? []) as {
    id: string;
    nome: string | null;
    condominio_id: string | null;
    card_id: string | null;
  }[];
  const unicos = new Map(lista.map((e) => [e.id, e]));
  const escolhido =
    [...unicos.values()].find((e) => e.card_id === cardOrigemId) ??
    (unicos.size === 1 ? [...unicos.values()][0] : null);
  if (!escolhido) return null;
  return {
    id: String(escolhido.id),
    nome: String(escolhido.nome ?? '').trim(),
    condominio_id: escolhido.condominio_id ? String(escolhido.condominio_id) : null,
  };
}

/**
 * Caminho antigo (service role) do lead VCL. O visitante da jornada não passa mais por aqui:
 * o card nasce em `jornada_registrar_lead` (migration 640). Mantido para não quebrar chamadas internas.
 */
export async function nascerCardVclDoCliente(input: NascerCardVclInput): Promise<void> {
  const sessionToken = String(input.sessionToken ?? '').trim();
  const cardOrigemId = uuid(input.cardOrigemId);
  const corretorId = uuid(input.corretorId);
  if (!sessionToken || !cardOrigemId || !corretorId) return;

  const admin = createAdminClient();

  const { data: sessao, error: sessaoErr } = await admin
    .from('jornada_cliente_sessao')
    .select('id, vcl_card_id')
    .eq('session_token', sessionToken)
    .eq('card_id', cardOrigemId)
    .maybeSingle();
  if (sessaoErr || !sessao) return;
  if ((sessao as { vcl_card_id?: string | null }).vcl_card_id) return;

  const empreendimento = await empreendimentoDoCardOuSlug(admin, cardOrigemId, input.slug);
  if (!empreendimento) return;

  const { data: vinculo } = await admin
    .from('imob_corretor_empreendimentos')
    .select('corretor_id')
    .eq('corretor_id', corretorId)
    .eq('empreendimento_id', empreendimento.id)
    .maybeSingle();
  if (!vinculo) return;

  const { data: fase } = await admin
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.VCL_NAO_VENDIDOS)
    .eq('slug', FASE_SLUGS.VCL_LEADS)
    .eq('ativo', true)
    .maybeSingle();
  const faseId = String((fase as { id?: string } | null)?.id ?? '').trim();
  if (!faseId) return;

  let nomeCondominio = '';
  if (empreendimento.condominio_id) {
    const { data: cond } = await admin
      .from('condominios')
      .select('nome')
      .eq('id', empreendimento.condominio_id)
      .maybeSingle();
    nomeCondominio = String((cond as { nome?: string | null } | null)?.nome ?? '').trim();
  }

  const nomeCliente = String(input.nomeCliente ?? '').trim();
  const complemento = nomeCondominio || empreendimento.nome;
  const titulo = nomeCliente && complemento ? `${nomeCliente} — ${complemento}` : nomeCliente || complemento || 'Lead';
  const lote = String(input.loteCodigo ?? '').trim();
  const valorTerreno =
    input.loteValor != null && Number.isFinite(input.loteValor) ? String(input.loteValor) : null;

  const { data: criado, error: insErr } = await admin
    .from('kanban_cards')
    .insert({
      titulo,
      kanban_id: KANBAN_IDS.VCL_NAO_VENDIDOS,
      fase_id: faseId,
      status: 'ativo',
      nome_condominio: nomeCondominio || null,
      lote: lote || null,
      vc_dono_terreno: nomeCliente || null,
      vc_telefone: String(input.telefone ?? '').trim() || null,
      vc_lote: lote || null,
      vc_valor_terreno: valorTerreno,
      vc_observacao: empreendimento.nome
        ? `Lead da jornada. Empreendimento: ${empreendimento.nome}.`
        : 'Lead da jornada.',
      imob_empreendimento_id: empreendimento.id,
      rede_corretor_id: corretorId,
    })
    .select('id')
    .single();
  if (insErr || !criado) return;

  const cardId = (criado as { id: string }).id;
  const { error: vinculoSessaoErr } = await admin
    .from('jornada_cliente_sessao')
    .update({ vcl_card_id: cardId })
    .eq('session_token', sessionToken)
    .eq('card_id', cardOrigemId)
    .is('vcl_card_id', null);
  if (vinculoSessaoErr) {
    await admin.from('kanban_cards').delete().eq('id', cardId);
    return;
  }

  revalidatePath('/venda-casas-loteadores');
}
