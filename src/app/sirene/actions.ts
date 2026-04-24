'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAppFullyPublic } from '@/lib/public-rede-novos';
import { revalidatePath } from 'next/cache';
import type { Chamado, HdmTime } from '@/types/sirene';
import { canActAsBombeiro, type SireneUserContext } from '@/lib/sirene';
import {
  TIMES_MONI,
  validarParTimeResponsavelMoni,
  validarTimeMoniOpcional,
} from '@/lib/times-responsaveis';
import { rankChamadoPainelUnificado } from '@/lib/sirene-painel-chamados-rank';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';

export type SireneActionResult = { ok: true } | { ok: false; error: string };

const HDM_TIMES: HdmTime[] = ['Homologações', 'Produto', 'Modelo Virtual'];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDataVencimentoChamado(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/** Dados do layout Sirene: nome do usuário e se é Bombeiro (para mostrar aba Monitor). */
export async function getSireneLayoutContext(): Promise<
  | { ok: true; userName: string; isBombeiro: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (isAppFullyPublic()) {
      return { ok: true, userName: 'Visitante', isBombeiro: false };
    }
    return { ok: false, error: 'Faça login.' };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const userName = (profile?.full_name as string)?.trim() || user.email?.split('@')[0] || 'Usuário';
  const { data: papelRow } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .maybeSingle();
  const isBombeiro = papelRow?.papel === 'bombeiro';
  return { ok: true, userName, isBombeiro };
}

/** Dados para o modal de novo chamado: se é frank e lista de franqueados (times vêm do catálogo fixo no cliente). */
export async function getDadosNovoChamado(): Promise<
  | { ok: true; isFrank: boolean; franqueados: { id: string; n_franquia: string | null; nome_completo: string | null }[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role as string) ?? 'franqueado';
  const isFrank = role === 'franqueado' || role === 'frank';

  let franqueados: { id: string; n_franquia: string | null; nome_completo: string | null }[] = [];
  if (!isFrank) {
    const { data: rows } = await supabase
      .from('rede_franqueados')
      .select('id, n_franquia, nome_completo')
      .order('nome_completo', { ascending: true, nullsFirst: false });
    franqueados = (rows ?? []).map((r) => ({
      id: r.id,
      n_franquia: r.n_franquia ?? null,
      nome_completo: r.nome_completo ?? null,
    }));
  }

  return { ok: true, isFrank, franqueados };
}

/** Lista de times para vincular a tópicos (mesma lista do modal de abertura). */
export async function getTimesParaTopicos(): Promise<
  | { ok: true; times: string[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  return { ok: true, times: [...TIMES_MONI] };
}

/** Tópicos do chamado (para listar e exibir ações Concluir / Aprovar / Reprovar). */
export async function getTopicosChamado(
  chamadoId: number,
): Promise<
  | {
      ok: true;
      topicos: Array<{
        id: number;
        ordem: number;
        descricao: string;
        time_responsavel: string;
        tipo: SubInteracaoTipoDb;
        times_ids: string[];
        responsaveis_ids: string[];
        data_inicio: string | null;
        data_fim: string | null;
        trava: boolean;
        status: string;
        resolucao_time: string | null;
        motivo_reprovacao: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data, error } = await supabase
    .from('sirene_topicos')
    .select(
      'id, ordem, descricao, time_responsavel, tipo, times_ids, responsaveis_ids, data_inicio, data_fim, status, trava, resolucao_time, motivo_reprovacao',
    )
    .eq('chamado_id', chamadoId)
    .order('ordem', { ascending: true });

  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  const topicos = rows.map((r) => {
    const rawTi = (r as { times_ids?: unknown }).times_ids;
    const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
    const rawRi = (r as { responsaveis_ids?: unknown }).responsaveis_ids;
    const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
    const tipoRaw = String((r as { tipo?: string }).tipo ?? 'atividade');
    const tipo: SubInteracaoTipoDb =
      tipoRaw === 'duvida' || tipoRaw === 'chamado' ? (tipoRaw as SubInteracaoTipoDb) : 'atividade';
    return {
      id: r.id,
      ordem: r.ordem,
      descricao: r.descricao,
      time_responsavel: r.time_responsavel,
      tipo,
      times_ids: ti,
      responsaveis_ids: ri,
      data_inicio: r.data_inicio ?? null,
      data_fim: r.data_fim ?? null,
      trava: (r as { trava?: boolean }).trava ?? false,
      status: r.status,
      resolucao_time: r.resolucao_time ?? null,
      motivo_reprovacao: r.motivo_reprovacao ?? null,
    };
  });
  return { ok: true, topicos };
}

export type TopicoInput = {
  descricao: string;
  time_responsavel: string;
  data_inicio?: string;
  data_fim?: string;
  trava?: boolean;
};

/** Salvar resolução em tópicos: cria/atualiza tópicos, marca início do atendimento e status em andamento. */
export async function salvarResolucaoComTopicos(
  chamadoId: number,
  topicos: TopicoInput[],
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para salvar tópicos.' };

  const validos = topicos.filter((t) => (t.descricao?.trim() ?? '') !== '' && (t.time_responsavel?.trim() ?? '') !== '');
  if (validos.length === 0) return { ok: false, error: 'Adicione ao menos um tópico com descrição e time.' };

  const { error: delErr } = await supabase.from('sirene_topicos').delete().eq('chamado_id', chamadoId);
  if (delErr) return { ok: false, error: delErr.message };

  for (let i = 0; i < validos.length; i++) {
    const t = validos[i];
    const dataInicio = t.data_inicio?.trim() || null;
    const dataFim = t.data_fim?.trim() || null;
    const { error: insErr } = await supabase.from('sirene_topicos').insert({
      chamado_id: chamadoId,
      ordem: i + 1,
      descricao: t.descricao.trim(),
      time_responsavel: t.time_responsavel.trim(),
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      trava: t.trava ?? false,
      status: 'nao_iniciado',
      tipo: 'atividade',
    });
    if (insErr) return { ok: false, error: insErr.message };
  }

  const updates: { data_inicio_atendimento?: string; status: string; updated_at: string } = {
    status: 'em_andamento',
    updated_at: new Date().toISOString(),
  };
  if (!chamado.data_inicio_atendimento) {
    updates.data_inicio_atendimento = new Date().toISOString();
  }

  const { error: updErr } = await supabase
    .from('sirene_chamados')
    .update(updates)
    .eq('id', chamadoId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

async function getSireneUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ userId: string; userName: string; ctx: SireneUserContext; role: string | null } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [papelRes, profileRes] = await Promise.all([
    supabase.from('sirene_papeis').select('papel').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name, time, role').eq('id', user.id).single(),
  ]);

  const papel = (papelRes.data?.papel as 'bombeiro' | 'caneta_verde') ?? null;
  const time = (profileRes.data?.time as string) ?? null;
  const role = (profileRes.data?.role as string) ?? null;

  return {
    userId: user.id,
    userName: (profileRes.data?.full_name as string)?.trim() || user.email || 'Usuário',
    ctx: { papel, time },
    role,
  };
}

/** Retorna IDs de usuários a notificar: bombeiros ou time HDM. */
async function getUserIdsToNotify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipo: 'bombeiro' | 'hdm',
  hdmTime?: HdmTime,
): Promise<string[]> {
  if (tipo === 'bombeiro') {
    const { data } = await supabase.from('sirene_papeis').select('user_id').eq('papel', 'bombeiro');
    return (data ?? []).map((r) => r.user_id);
  }
  if (tipo === 'hdm' && hdmTime) {
    const { data } = await supabase.from('profiles').select('id').eq('time', hdmTime);
    return (data ?? []).map((r) => r.id);
  }
  return [];
}

/** Corpo estruturado opcional (ex.: mencao_comentario). `texto` permanece preenchido para compatibilidade. */
type AvisoNotificacaoEstruturado = {
  titulo: string;
  mensagem: string;
  referencia_id: number;
};

/** Insere uma notificação para um usuário. */
async function inserirNotificacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chamadoId: number | null,
  tipo: string,
  texto: string,
  topicoId?: number | null,
  aviso?: AvisoNotificacaoEstruturado,
): Promise<void> {
  const corpo = aviso?.mensagem ?? texto;
  await supabase.from('sirene_notificacoes').insert({
    user_id: userId,
    chamado_id: chamadoId,
    tipo,
    texto: corpo,
    ...(topicoId != null && { topico_id: topicoId }),
    ...(aviso && {
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      referencia_id: aviso.referencia_id,
    }),
  });
}

/** IDs do time responsável por um tópico (responsavel_id ou profiles com time = time_responsavel). */
async function getUserIdsTimeTopico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timeResponsavel: string,
  responsavelId: string | null,
): Promise<string[]> {
  if (responsavelId) return [responsavelId];
  const { data } = await supabase.from('profiles').select('id').eq('time', timeResponsavel);
  return (data ?? []).map((r) => r.id);
}

/** Todos os usuários do time (para notificações de atraso: sinalizar o time inteiro). */
async function getUserIdsTimeTopicoTodos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timeResponsavel: string,
  responsavelId: string | null,
): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id').eq('time', timeResponsavel);
  const ids = new Set<string>((data ?? []).map((r) => r.id));
  if (responsavelId) ids.add(responsavelId);
  return [...ids];
}

/** Dias úteis entre data (YYYY-MM-DD) e hoje (inclusive). */
function diasUteisAtraso(dataFimStr: string): number {
  const dataFim = new Date(dataFimStr + 'T12:00:00Z');
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  if (dataFim >= hoje) return 0;
  let count = 0;
  const d = new Date(dataFim);
  d.setHours(0, 0, 0, 0);
  const end = new Date(hoje);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Tópicos atrasados (não concluídos, data_fim no passado) com dias úteis de atraso. Ordenados pelos mais atrasados (TOP 10 primeiro). */
async function getTopicosAtrasados(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  Array<{
    id: number;
    chamado_id: number;
    numero: number;
    descricao: string;
    time_responsavel: string;
    responsavel_id: string | null;
    data_fim: string;
    dias_atraso: number;
  }>
> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: topicos, error } = await supabase
    .from('sirene_topicos')
    .select('id, chamado_id, descricao, time_responsavel, responsavel_id, data_fim')
    .in('status', ['nao_iniciado', 'em_andamento'])
    .not('data_fim', 'is', null)
    .lt('data_fim', hoje);

  if (error || !topicos?.length) return [];

  const chamadoIds = [...new Set(topicos.map((t) => t.chamado_id))];
  const { data: chamados } = await supabase
    .from('sirene_chamados')
    .select('id, numero')
    .in('id', chamadoIds);
  const numeroByChamado = new Map(
    (chamados ?? []).map((c) => [c.id, (c as { numero?: number }).numero ?? c.id]),
  );

  return topicos
    .map((t) => {
      const dataFim = (t.data_fim as string) ?? '';
      const dias_atraso = diasUteisAtraso(dataFim);
      return {
        id: t.id,
        chamado_id: t.chamado_id,
        numero: numeroByChamado.get(t.chamado_id) ?? t.chamado_id,
        descricao: t.descricao ?? '',
        time_responsavel: t.time_responsavel ?? '',
        responsavel_id: t.responsavel_id ?? null,
        data_fim: dataFim,
        dias_atraso,
      };
    })
    .sort((a, b) => a.data_fim.localeCompare(b.data_fim)); // mais antigo = mais atrasado primeiro
}

/** Verifica se já enviamos notificação (user, topico, tipo) nas últimas 24h. */
async function notificacaoAtrasoJaEnviada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  topicoId: number,
  tipo: string,
): Promise<boolean> {
  const desde = new Date();
  desde.setHours(desde.getHours() - 24);
  const { data } = await supabase
    .from('sirene_notificacoes')
    .select('id')
    .eq('user_id', userId)
    .eq('topico_id', topicoId)
    .eq('tipo', tipo)
    .gte('created_at', desde.toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Sinaliza aos times: tarefas > 2 dias úteis atrasadas e TOP 10 mais atrasadas. Evita duplicata nas últimas 24h. */
export async function enviarNotificacoesAtrasoTopicos(): Promise<SireneActionResult> {
  const supabase = await createClient();
  const lista = await getTopicosAtrasados(supabase);
  if (lista.length === 0) return { ok: true };

  const top10Ids = new Set(lista.slice(0, 10).map((t) => t.id));

  for (const t of lista) {
    const userIds = await getUserIdsTimeTopicoTodos(
      supabase,
      t.time_responsavel,
      t.responsavel_id,
    );
    if (userIds.length === 0) continue;

    const textoBase = `Chamado #${t.numero}: ${t.descricao.slice(0, 60)}${t.descricao.length > 60 ? '…' : ''}`;

    if (t.dias_atraso > 2) {
      const tipo = 'atraso_2d';
      const texto = `Tarefa com mais de 2 dias úteis de atraso — ${textoBase}`;
      for (const uid of userIds) {
        const ja = await notificacaoAtrasoJaEnviada(supabase, uid, t.id, tipo);
        if (!ja) {
          await inserirNotificacao(supabase, uid, t.chamado_id, tipo, texto, t.id);
        }
      }
    }

    if (top10Ids.has(t.id)) {
      const tipo = 'atraso_top10';
      const texto = `Tarefa entre as TOP 10 mais atrasadas — ${textoBase}`;
      for (const uid of userIds) {
        const ja = await notificacaoAtrasoJaEnviada(supabase, uid, t.id, tipo);
        if (!ja) {
          await inserirNotificacao(supabase, uid, t.chamado_id, tipo, texto, t.id);
        }
      }
    }
  }

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath('/sirene/kanban');
  return { ok: true };
}

/** Criar chamado. Se tipo === 'hdm', notifica o time HDM em vez do Bombeiro. */
export async function criarChamado(
  formData: FormData,
): Promise<SireneActionResult & { chamadoId?: number }> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const incendio = (formData.get('incendio') as string)?.trim();
  const timeAbertura = (formData.get('time_abertura') as string)?.trim() || null;
  const aberturaResponsavelNome =
    (formData.get('abertura_responsavel_nome') as string)?.trim() || null;
  const frankId = (formData.get('frank_id') as string)?.trim() || null;
  const frankNome = (formData.get('frank_nome') as string)?.trim() || null;
  const cardIdRaw = (formData.get('card_id') as string)?.trim() || null;
  const cardKanbanNome = (formData.get('card_kanban_nome') as string)?.trim() || null;
  const cardTitulo = (formData.get('card_titulo') as string)?.trim() || null;
  const dataVencimento = parseDataVencimentoChamado(formData.get('data_vencimento') as string | null);
  const teTrataRaw = formData.get('te_trata');
  const teTrata =
    teTrataRaw === 'sim' ? true : teTrataRaw === 'nao' ? false : null;
  const tipo = ((formData.get('tipo') as string) || 'padrao') as 'padrao' | 'hdm';
  const hdmResponsavel =
    tipo === 'hdm' ? (formData.get('hdm_responsavel') as HdmTime) || null : null;

  if (!incendio) return { ok: false, error: 'Informe o incêndio (resumo).' };
  if (tipo === 'hdm' && hdmResponsavel && !HDM_TIMES.includes(hdmResponsavel))
    return { ok: false, error: 'Time HDM inválido.' };

  const vTimeAb = validarTimeMoniOpcional(timeAbertura);
  if (!vTimeAb.ok) return { ok: false, error: vTimeAb.error };
  const vRespAb = validarParTimeResponsavelMoni(timeAbertura, aberturaResponsavelNome);
  if (!vRespAb.ok) return { ok: false, error: vRespAb.error };

  const roleNorm = (me.role ?? '').toLowerCase();
  const visivelFrank = roleNorm === 'frank' || roleNorm === 'franqueado';

  const cardId = cardIdRaw && UUID_RE.test(cardIdRaw) ? cardIdRaw : null;

  const { data: chamado, error } = await supabase
    .from('sirene_chamados')
    .insert({
      aberto_por: me.userId,
      aberto_por_nome: me.userName,
      incendio,
      time_abertura: timeAbertura,
      abertura_responsavel_nome: aberturaResponsavelNome,
      frank_id: frankId,
      frank_nome: frankNome,
      te_trata: teTrata,
      tipo,
      hdm_responsavel: hdmResponsavel,
      visivel_frank: visivelFrank,
      ...(cardId
        ? {
            card_id: cardId,
            card_kanban_nome: cardKanbanNome || null,
            card_titulo: cardTitulo || null,
          }
        : {}),
      ...(dataVencimento ? { data_vencimento: dataVencimento } : {}),
    })
    .select('id, numero, created_at')
    .single();

  if (error) return { ok: false, error: error.message };

  const chamadoRow = chamado as { id: number; numero?: number; created_at?: string };
  const admin = createAdminClient();
  const timeNome = timeAbertura?.trim() || null;
  let timesIdsKa: string[] = [];
  let timeCol: string | null = null;
  if (timeNome) {
    const { data: trow } = await admin.from('kanban_times').select('id').eq('nome', timeNome).maybeSingle();
    if (trow && (trow as { id?: string }).id) {
      timesIdsKa = [String((trow as { id: string }).id)];
      timeCol = timeNome;
    }
  }
  const tipoKa = tipo === 'hdm' ? 'chamado_hdm' : 'chamado_padrao';
  const createdAtSc = chamadoRow.created_at ?? new Date().toISOString();
  const { error: kaErr } = await admin.from('kanban_atividades').insert({
    card_id: cardId,
    titulo: incendio,
    descricao: null,
    tipo: tipoKa,
    status: 'pendente',
    trava: false,
    origem: 'sirene',
    criado_por: me.userId,
    created_at: createdAtSc,
    updated_at: new Date().toISOString(),
    data_vencimento: dataVencimento,
    times_ids: timesIdsKa,
    time: timeCol,
    responsavel_nome_texto: aberturaResponsavelNome,
    sirene_chamado_id: chamadoRow.id,
  });
  if (kaErr) {
    await admin.from('sirene_chamados').delete().eq('id', chamadoRow.id);
    return { ok: false, error: kaErr.message };
  }

  const numero = chamadoRow.numero ?? chamadoRow.id;
  const userIds =
    tipo === 'hdm' && hdmResponsavel
      ? await getUserIdsToNotify(supabase, 'hdm', hdmResponsavel)
      : await getUserIdsToNotify(supabase, 'bombeiro');
  const notifTipo =
    tipo === 'hdm' && hdmResponsavel ? 'chamado_hdm_recebido' : 'novo_chamado';
  const texto =
    tipo === 'hdm' && hdmResponsavel
      ? `Chamado #${numero} direcionado ao time ${hdmResponsavel}`
      : `Novo chamado #${numero}: ${incendio}`;

  for (const uid of userIds) {
    await supabase.from('sirene_notificacoes').insert({
      user_id: uid,
      chamado_id: chamadoRow.id,
      tipo: notifTipo,
      texto,
    });
  }

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  return { ok: true, chamadoId: chamado.id };
}

export type SireneVinculoCardBuscaItem = {
  card_id: string;
  titulo: string;
  kanban_nome: string;
  origem: 'nativo' | 'legado';
};

/** Autocomplete: cards nativos + legado (view) por título — para vínculo opcional no novo chamado. */
export async function buscarCardsParaNovoChamadoSirene(
  busca: string,
): Promise<{ ok: true; items: SireneVinculoCardBuscaItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const q = busca.trim();
  if (q.length < 2) return { ok: true, items: [] };

  const admin = createAdminClient();
  const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  const out: SireneVinculoCardBuscaItem[] = [];
  const seen = new Set<string>();

  const { data: nativeCards, error: nErr } = await admin
    .from('kanban_cards')
    .select('id, titulo, kanban_id')
    .ilike('titulo', pattern)
    .limit(18);
  if (nErr) return { ok: false, error: nErr.message };

  const kidSet = new Set<string>();
  for (const r of nativeCards ?? []) {
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    if (kid) kidSet.add(kid);
  }
  let kbNomeById = new Map<string, string>();
  if (kidSet.size > 0) {
    const { data: kbs } = await admin.from('kanbans').select('id, nome').in('id', [...kidSet]);
    kbNomeById = new Map(
      (kbs ?? []).map((k) => [String((k as { id: string }).id), String((k as { nome?: string }).nome ?? '')]),
    );
  }
  for (const r of nativeCards ?? []) {
    const id = String((r as { id: string }).id);
    const key = `n:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    out.push({
      card_id: id,
      titulo: String((r as { titulo?: string | null }).titulo ?? 'Sem título'),
      kanban_nome: kbNomeById.get(kid) || '—',
      origem: 'nativo',
    });
  }

  const { data: legRows, error: lErr } = await admin
    .from('v_processo_como_kanban_cards')
    .select('id, titulo, kanban_id')
    .ilike('titulo', pattern)
    .limit(12);
  if (lErr) return { ok: false, error: lErr.message };

  const kidSet2 = new Set<string>();
  for (const r of legRows ?? []) {
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    if (kid) kidSet2.add(kid);
  }
  let kbNome2 = new Map<string, string>();
  if (kidSet2.size > 0) {
    const { data: kbs2 } = await admin.from('kanbans').select('id, nome').in('id', [...kidSet2]);
    kbNome2 = new Map(
      (kbs2 ?? []).map((k) => [String((k as { id: string }).id), String((k as { nome?: string }).nome ?? '')]),
    );
  }
  for (const r of legRows ?? []) {
    const id = String((r as { id: string }).id);
    const key = `l:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    out.push({
      card_id: id,
      titulo: String((r as { titulo?: string | null }).titulo ?? 'Sem título'),
      kanban_nome: kbNome2.get(kid) || 'Funil Step One',
      origem: 'legado',
    });
  }

  return { ok: true, items: out.slice(0, 24) };
}

/** Redirecionar chamado para HDM. Apenas Bombeiro. */
export async function redirecionarParaHDM(
  chamadoId: number,
  hdmResponsavel: HdmTime,
  observacao?: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado, error: fetchErr } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();

  if (fetchErr || !chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const ctx: SireneUserContext = me.ctx;
  const chamadoTyped = chamado as unknown as Chamado;
  if (!canActAsBombeiro(ctx, chamadoTyped))
    return { ok: false, error: 'Apenas o Bombeiro pode redirecionar para HDM.' };

  if (chamado.tipo === 'hdm') return { ok: false, error: 'Chamado já está em HDM.' };

  if (!HDM_TIMES.includes(hdmResponsavel)) return { ok: false, error: 'Time HDM inválido.' };

  const { error: updateErr } = await supabase
    .from('sirene_chamados')
    .update({
      tipo: 'hdm',
      hdm_responsavel: hdmResponsavel,
      hdm_redirecionado_por: me.userId,
      hdm_redirecionado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (updateErr) return { ok: false, error: updateErr.message };

  if (observacao?.trim()) {
    await supabase.from('sirene_mensagens').insert({
      chamado_id: chamadoId,
      autor_id: me.userId,
      autor_nome: me.userName,
      autor_time: me.ctx.time ?? undefined,
      texto: `[Redirecionamento HDM — ${hdmResponsavel}] ${observacao.trim()}`,
    });
  }

  const userIds = await getUserIdsToNotify(supabase, 'hdm', hdmResponsavel);
  const numero = chamado.numero ?? chamadoId;
  const texto = `Chamado #${numero} redirecionado para ${hdmResponsavel}.`;
  for (const uid of userIds) {
    await supabase.from('sirene_notificacoes').insert({
      user_id: uid,
      chamado_id: chamadoId,
      tipo: 'chamado_hdm_recebido',
      texto,
    });
  }

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Definir prioridade. Quem pode: Bombeiro ou time HDM responsável (canActAsBombeiro). */
export async function definirPrioridade(
  chamadoId: number,
  prioridade: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para alterar prioridade.' };

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      prioridade: prioridade?.trim() || 'Média',
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/**
 * Permite editar tema (título) e incêndio (resumo) de um sirene_chamado.
 * Só o criador (aberto_por) ou Bombeiro (papel em sirene_papeis) pode editar.
 */
export async function editarChamado(
  chamadoId: number,
  incendio: string,
  tema: string | null,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('sirene_chamados')
    .select('id, aberto_por')
    .eq('id', chamadoId)
    .single();
  if (!row) return { ok: false, error: 'Chamado não encontrado.' };

  const isCriador = row.aberto_por != null && row.aberto_por === me.userId;
  const isBombeiro = me.ctx.papel === 'bombeiro';
  if (!isCriador && !isBombeiro) {
    return { ok: false, error: 'Apenas o criador do chamado ou o Bombeiro pode editar o resumo e o tema.' };
  }

  const incendioTrim = incendio?.trim() ?? '';
  if (!incendioTrim) return { ok: false, error: 'O resumo (incêndio) é obrigatório.' };
  const temaTrim = tema?.trim() || null;

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      incendio: incendioTrim,
      tema: temaTrim,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };

  const admin = createAdminClient();
  await admin
    .from('kanban_atividades')
    .update({ titulo: incendioTrim, updated_at: new Date().toISOString() })
    .eq('sirene_chamado_id', chamadoId);

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

export type AtualizarChamadoPainelInput = {
  incendio: string;
  time_abertura: string | null;
  abertura_responsavel_nome: string | null;
  data_vencimento: string | null;
  trava: boolean;
  tipo: 'padrao' | 'hdm';
  hdm_responsavel: HdmTime | null;
};

/** Edição inline na lista unificada: atualiza sirene_chamados e espelho em kanban_atividades. */
export async function atualizarChamadoPainelUnificado(
  chamadoId: number,
  dados: AtualizarChamadoPainelInput,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamadoFull } = await supabase.from('sirene_chamados').select('*').eq('id', chamadoId).single();
  if (!chamadoFull) return { ok: false, error: 'Chamado não encontrado.' };

  const isCriador =
    (chamadoFull as { aberto_por?: string | null }).aberto_por != null &&
    (chamadoFull as { aberto_por: string }).aberto_por === me.userId;
  const isBombeiro = me.ctx.papel === 'bombeiro';
  const podeBombeiroOuHdm = canActAsBombeiro(me.ctx, chamadoFull as unknown as Chamado);
  if (!isCriador && !isBombeiro && !podeBombeiroOuHdm) {
    return { ok: false, error: 'Sem permissão para editar este chamado.' };
  }

  const incendioTrim = dados.incendio?.trim() ?? '';
  if (!incendioTrim) return { ok: false, error: 'O resumo (incêndio) é obrigatório.' };

  const tipo = dados.tipo === 'hdm' ? 'hdm' : 'padrao';
  const hdmRaw = tipo === 'hdm' ? dados.hdm_responsavel : null;
  if (tipo === 'hdm' && hdmRaw && !HDM_TIMES.includes(hdmRaw)) return { ok: false, error: 'Time HDM inválido.' };

  const timeAb = (dados.time_abertura ?? '').trim() || null;
  const respAb = (dados.abertura_responsavel_nome ?? '').trim() || null;
  const vTime = validarTimeMoniOpcional(timeAb);
  if (!vTime.ok) return { ok: false, error: vTime.error };
  const vPar = validarParTimeResponsavelMoni(timeAb, respAb);
  if (!vPar.ok) return { ok: false, error: vPar.error };

  const dataVen = parseDataVencimentoChamado(dados.data_vencimento);

  const { error: scErr } = await supabase
    .from('sirene_chamados')
    .update({
      incendio: incendioTrim,
      time_abertura: timeAb,
      abertura_responsavel_nome: respAb,
      data_vencimento: dataVen,
      trava: Boolean(dados.trava),
      tipo,
      hdm_responsavel: tipo === 'hdm' ? hdmRaw : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);
  if (scErr) return { ok: false, error: scErr.message };

  const admin = createAdminClient();
  let timesIdsKa: string[] = [];
  let timeCol: string | null = null;
  if (timeAb) {
    const { data: trow } = await admin.from('kanban_times').select('id').eq('nome', timeAb).maybeSingle();
    if (trow && (trow as { id?: string }).id) {
      timesIdsKa = [String((trow as { id: string }).id)];
      timeCol = timeAb;
    }
  }
  const tipoKa = tipo === 'hdm' ? 'chamado_hdm' : 'chamado_padrao';
  const { error: kaErr } = await admin
    .from('kanban_atividades')
    .update({
      titulo: incendioTrim,
      tipo: tipoKa,
      data_vencimento: dataVen,
      trava: Boolean(dados.trava),
      times_ids: timesIdsKa,
      time: timeCol,
      responsavel_nome_texto: respAb,
      updated_at: new Date().toISOString(),
    })
    .eq('sirene_chamado_id', chamadoId);
  if (kaErr) return { ok: false, error: kaErr.message };

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

export type AdicionarTopicoChamadoPainelInput = {
  descricao: string;
  tipo: SubInteracaoTipoDb;
  times_ids: string[];
  responsaveis_ids: string[];
  data_fim: string | null;
  trava: boolean;
};

function uniqUuidStrings(ids: string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    const u = String(x ?? '').trim();
    if (!u || !UUID_RE.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export async function adicionarTopicoChamadoPainel(
  chamadoId: number,
  payload: AdicionarTopicoChamadoPainelInput,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const desc = payload.descricao?.trim() ?? '';
  if (!desc) return { ok: false, error: 'Informe a descrição do sub-chamado.' };

  const tipo =
    payload.tipo === 'duvida' || payload.tipo === 'chamado' ? payload.tipo : 'atividade';

  const timesIds = uniqUuidStrings(payload.times_ids);
  if (timesIds.length === 0) {
    return { ok: false, error: 'Selecione ao menos um time.' };
  }

  const respIds = uniqUuidStrings(payload.responsaveis_ids);
  const dataFim = parseDataVencimentoChamado(payload.data_fim);

  const { data: nomeRow } = await supabase.from('kanban_times').select('nome').eq('id', timesIds[0]!).maybeSingle();
  const timeLabel = String((nomeRow as { nome?: string } | null)?.nome ?? '').trim() || '—';

  const { data: chamadoFull } = await supabase.from('sirene_chamados').select('*').eq('id', chamadoId).single();
  if (!chamadoFull) return { ok: false, error: 'Chamado não encontrado.' };

  const isCriador =
    (chamadoFull as { aberto_por?: string | null }).aberto_por != null &&
    (chamadoFull as { aberto_por: string }).aberto_por === me.userId;
  const podeBombeiro = canActAsBombeiro(me.ctx, chamadoFull as unknown as Chamado);
  if (!isCriador && !podeBombeiro) {
    return { ok: false, error: 'Sem permissão para adicionar tópico.' };
  }

  const { data: maxRow } = await supabase
    .from('sirene_topicos')
    .select('ordem')
    .eq('chamado_id', chamadoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const proxOrdem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;

  const { error: insErr } = await supabase.from('sirene_topicos').insert({
    chamado_id: chamadoId,
    ordem: proxOrdem,
    descricao: desc,
    time_responsavel: timeLabel,
    times_ids: timesIds,
    responsavel_id: respIds.length > 0 ? respIds[0]! : null,
    responsaveis_ids: respIds,
    status: 'nao_iniciado',
    trava: Boolean(payload.trava),
    data_fim: dataFim,
    tipo,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/sirene/chamados');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Salvar resolução pontual do chamado. canActAsBombeiro. */
export async function salvarResolucaoPontual(
  chamadoId: number,
  resolucao: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para editar resolução pontual.' };

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      resolucao_pontual: resolucao?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Concluir tópico: preenche resolução do time e marca status concluído. Pode: Bombeiro ou o time responsável. */
export async function concluirTopico(
  topicoId: number,
  resolucaoTime: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: topico, error: errT } = await supabase
    .from('sirene_topicos')
    .select('id, chamado_id, time_responsavel, status')
    .eq('id', topicoId)
    .single();
  if (errT || !topico) return { ok: false, error: 'Tópico não encontrado.' };
  if (topico.status === 'aprovado') return { ok: false, error: 'Tópico já foi aprovado.' };

  const podeConcluir =
    me.ctx.papel === 'bombeiro' || me.ctx.time === topico.time_responsavel;
  if (!podeConcluir)
    return { ok: false, error: 'Apenas o Bombeiro ou o time responsável pode concluir este tópico.' };

  const resolucaoTrim = resolucaoTime?.trim() ?? '';
  if (!resolucaoTrim) return { ok: false, error: 'Informe a resolução antes de concluir.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      resolucao_time: resolucaoTrim,
      status: 'concluido',
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicoId);

  if (error) return { ok: false, error: error.message };
  const { data: chamadoRef } = await supabase
    .from('sirene_chamados')
    .select('numero')
    .eq('id', topico.chamado_id)
    .single();
  const numero = (chamadoRef as { numero?: number } | null)?.numero ?? topico.chamado_id;
  const bombeiros = await getUserIdsToNotify(supabase, 'bombeiro');
  for (const uid of bombeiros) {
    await inserirNotificacao(
      supabase,
      uid,
      topico.chamado_id,
      'topico_concluido',
      `Tópico do chamado #${numero} foi concluído pelo time.`,
    );
  }
  revalidatePath('/sirene');
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Aprovar tópico. canActAsBombeiro. */
export async function aprovarTopico(topicoId: number): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: topico } = await supabase
    .from('sirene_topicos')
    .select('chamado_id, time_responsavel, responsavel_id')
    .eq('id', topicoId)
    .single();
  if (!topico) return { ok: false, error: 'Tópico não encontrado.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', topico.chamado_id)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para aprovar tópico.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      status: 'aprovado',
      aprovado_bombeiro: true,
      motivo_reprovacao: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicoId);

  if (error) return { ok: false, error: error.message };
  const numero = (chamado as { numero?: number })?.numero ?? topico.chamado_id;
  const userIdsTime = await getUserIdsTimeTopico(
    supabase,
    topico.time_responsavel ?? '',
    topico.responsavel_id ?? null,
  );
  for (const uid of userIdsTime) {
    await inserirNotificacao(
      supabase,
      uid,
      topico.chamado_id,
      'topico_aprovado',
      `Tópico do chamado #${numero} foi aprovado pelo Bombeiro.`,
    );
  }
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Reprovar tópico. canActAsBombeiro. */
export async function reprovarTopico(
  topicoId: number,
  motivo: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: topico } = await supabase
    .from('sirene_topicos')
    .select('chamado_id, time_responsavel, responsavel_id')
    .eq('id', topicoId)
    .single();
  if (!topico) return { ok: false, error: 'Tópico não encontrado.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', topico.chamado_id)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para reprovar tópico.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      status: 'em_andamento',
      aprovado_bombeiro: false,
      motivo_reprovacao: motivo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicoId);

  if (error) return { ok: false, error: error.message };
  const numero = (chamado as { numero?: number })?.numero ?? topico.chamado_id;
  const userIdsTime = await getUserIdsTimeTopico(
    supabase,
    topico.time_responsavel ?? '',
    topico.responsavel_id ?? null,
  );
  for (const uid of userIdsTime) {
    await inserirNotificacao(
      supabase,
      uid,
      topico.chamado_id,
      'topico_reprovado',
      `Tópico do chamado #${numero} foi reprovado pelo Bombeiro.`,
    );
  }
  if ((chamado as { aberto_por?: string }).aberto_por) {
    await inserirNotificacao(
      supabase,
      (chamado as { aberto_por: string }).aberto_por,
      topico.chamado_id,
      'topico_reprovado',
      `Tópico do chamado #${numero} foi reprovado.`,
    );
  }
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Fechar chamado (parecer, tema, mapeamento). Só Bombeiro; só quando todos os tópicos estão aprovados. Coloca status em aguardando_aprovacao_criador. */
export async function fecharChamado(
  chamadoId: number,
  parecer: string,
  tema: string,
  mapeamento: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();

  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const ctx = me.ctx;
  const chamadoTyped = chamado as unknown as Chamado;
  if (!canActAsBombeiro(ctx, chamadoTyped))
    return { ok: false, error: 'Apenas Bombeiro pode preencher tema e mapeamento de perícia.' };

  const { data: topicos } = await supabase
    .from('sirene_topicos')
    .select('id, status')
    .eq('chamado_id', chamadoId);
  const lista = topicos ?? [];
  if (lista.length === 0)
    return { ok: false, error: 'Não há tópicos. Crie e salve os tópicos antes de concluir o chamado.' };
  const todosAprovados = lista.every((t) => t.status === 'aprovado');
  if (!todosAprovados)
    return { ok: false, error: 'Todos os tópicos precisam estar aprovados para enviar o fechamento ao criador.' };

  const parecerTrim = parecer?.trim();
  const temaTrim = tema?.trim();
  const mapeamentoTrim = mapeamento?.trim();
  if (!parecerTrim || !temaTrim || !mapeamentoTrim)
    return { ok: false, error: 'Parecer, tema e mapeamento de perícia são obrigatórios.' };

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      parecer_final: parecerTrim,
      tema: temaTrim,
      mapeamento_pericia: mapeamentoTrim,
      status: 'aguardando_aprovacao_criador',
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };

  const numero = (chamado as { numero?: number })?.numero ?? chamadoId;
  if ((chamado as { aberto_por?: string }).aberto_por) {
    await inserirNotificacao(
      supabase,
      (chamado as { aberto_por: string }).aberto_por,
      chamadoId,
      'fechamento_enviado',
      `Bombeiro enviou o fechamento do chamado #${numero}. Avalie se a resolução foi suficiente.`,
    );
  }
  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Criador aprova (suficiente) ou reprova (insuficiente) o fechamento. Só quem abriu o chamado. */
export async function concluirChamadoCriador(
  chamadoId: number,
  suficiente: boolean,
  motivoInsuficiente?: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id, aberto_por, status')
    .eq('id', chamadoId)
    .single();

  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  if (chamado.aberto_por !== me.userId)
    return { ok: false, error: 'Apenas quem abriu o chamado pode aprovar ou reprovar o fechamento.' };

  const { data: topicosRows } = await supabase
    .from('sirene_topicos')
    .select('status')
    .eq('chamado_id', chamadoId);
  const topicos = topicosRows ?? [];
  const todosTopicosConcluidos =
    topicos.length > 0 && topicos.every((t) => t.status === 'concluido');

  const podeAvaliar =
    chamado.status === 'aguardando_aprovacao_criador' ||
    (chamado.status === 'em_andamento' && todosTopicosConcluidos);
  if (!podeAvaliar)
    return {
      ok: false,
      error:
        chamado.status === 'em_andamento'
          ? 'Só é possível avaliar quando todos os tópicos estiverem concluídos ou após o fechamento do Bombeiro.'
          : 'Chamado não está aguardando aprovação do criador.',
    };

  if (suficiente) {
    const { error } = await supabase
      .from('sirene_chamados')
      .update({
        resolucao_suficiente: true,
        motivo_insuficiente: null,
        status: 'concluido',
        data_conclusao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chamadoId);
    if (error) return { ok: false, error: error.message };
  } else {
    const motivo = motivoInsuficiente?.trim();
    if (!motivo) return { ok: false, error: 'Informe o motivo da insuficiência para reabrir.' };
    const { error } = await supabase
      .from('sirene_chamados')
      .update({
        resolucao_suficiente: false,
        motivo_insuficiente: motivo,
        status: 'em_andamento',
        parecer_final: null,
        tema: null,
        mapeamento_pericia: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chamadoId);
    if (error) return { ok: false, error: error.message };
    const bombeiros = await getUserIdsToNotify(supabase, 'bombeiro');
    const numero = (chamado as { numero?: number })?.numero ?? chamadoId;
    for (const uid of bombeiros) {
      await inserirNotificacao(
        supabase,
        uid,
        chamadoId,
        'criador_reabriu',
        `Criador marcou o fechamento do chamado #${numero} como insuficiente. Chamado reaberto.`,
      );
    }
  }

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

export type AnexoOrigem = 'criador' | 'topico' | 'fechamento_bombeiro';

/** Listar anexos do chamado (todos os participantes veem todos; RLS garante acesso). */
export async function listAnexosChamado(chamadoId: number): Promise<
  | {
      ok: true;
      anexos: Array<{
        id: number;
        chamado_id: number;
        topico_id: number | null;
        uploader_nome: string | null;
        nome_original: string | null;
        origem: string | null;
        created_at: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const { data: rows, error } = await supabase
    .from('sirene_anexos')
    .select('id, chamado_id, topico_id, uploader_nome, nome_original, origem, created_at')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, anexos: rows ?? [] };
}

/** Upload de anexo: criador (abertura), time (tópico) ou Bombeiro (fechamento). */
export async function uploadAnexoChamado(
  chamadoId: number,
  origem: AnexoOrigem,
  formData: FormData,
  topicoId?: number,
): Promise<SireneActionResult & { anexoId?: number }> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Selecione um arquivo.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  const chamadoTyped = chamado as unknown as Chamado;

  if (origem === 'criador') {
    if (chamado.aberto_por !== me.userId)
      return { ok: false, error: 'Apenas quem abriu o chamado pode anexar como criador.' };
  } else if (origem === 'fechamento_bombeiro') {
    if (!canActAsBombeiro(me.ctx, chamadoTyped))
      return { ok: false, error: 'Apenas Bombeiro pode anexar no fechamento.' };
  } else if (origem === 'topico') {
    if (topicoId == null) return { ok: false, error: 'Informe o tópico para anexo do time.' };
    const { data: topico } = await supabase
      .from('sirene_topicos')
      .select('time_responsavel')
      .eq('id', topicoId)
      .eq('chamado_id', chamadoId)
      .single();
    if (!topico) return { ok: false, error: 'Tópico não encontrado.' };
    if (!canActAsBombeiro(me.ctx, chamadoTyped) && topico.time_responsavel !== me.ctx.time)
      return { ok: false, error: 'Apenas o time do tópico ou Bombeiro pode anexar neste tópico.' };
  }

  const ext = file.name.replace(/^.*\./, '') || 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
  const path =
    origem === 'topico' && topicoId != null
      ? `chamado_${chamadoId}/topico_${topicoId}_${uid}_${safeName}`
      : `chamado_${chamadoId}/${origem}_${uid}_${safeName}`;

  const { error: uploadErr } = await supabase.storage.from('sirene-attachments').upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: inserted, error: insertErr } = await supabase
    .from('sirene_anexos')
    .insert({
      chamado_id: chamadoId,
      topico_id: origem === 'topico' ? topicoId ?? null : null,
      uploader_id: me.userId,
      uploader_nome: me.userName,
      storage_path: path,
      nome_original: file.name,
      tipo: file.type || null,
      origem,
    })
    .select('id')
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true, anexoId: inserted?.id };
}

/** URL assinada para download de anexo (bucket privado). */
export async function getAnexoChamadoDownloadUrl(
  anexoId: number,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: anexo, error } = await supabase
    .from('sirene_anexos')
    .select('chamado_id, storage_path')
    .eq('id', anexoId)
    .single();
  if (error || !anexo) return { ok: false, error: 'Anexo não encontrado.' };

  const { data: signed, error: signErr } = await supabase.storage
    .from('sirene-attachments')
    .createSignedUrl(anexo.storage_path, 60);
  if (signErr || !signed?.signedUrl) return { ok: false, error: signErr?.message ?? 'Erro ao gerar link.' };
  return { ok: true, url: signed.signedUrl };
}

function statusSireneParaRankLista(status: string): string {
  const x = String(status ?? '').trim().toLowerCase();
  if (x === 'concluido') return 'concluida';
  if (x === 'em_andamento' || x === 'aguardando_aprovacao_criador') return 'em_andamento';
  return 'pendente';
}

/** Listar chamados (filtro opcional por tipo: todos | padrao | hdm). */
export async function listChamados(filtroTipo?: 'todos' | 'padrao' | 'hdm'): Promise<
  | {
      ok: true;
      chamados: Array<{
        id: number;
        numero: number;
        incendio: string;
        status: string;
        prioridade: string;
        tipo: string;
        hdm_responsavel: string | null;
        time_abertura: string | null;
        abertura_responsavel_nome: string | null;
        trava: boolean;
        created_at: string;
        frank_id: string | null;
        data_vencimento: string | null;
        /** Primeiro tópico do chamado (`ordem` ASC): nome do responsável, se houver. */
        primeiro_topico_responsavel_nome: string | null;
        /** Primeiro tópico: time responsável. */
        primeiro_topico_time_responsavel: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  let q = supabase.from('sirene_chamados').select(
    'id, numero, incendio, status, prioridade, tipo, hdm_responsavel, time_abertura, abertura_responsavel_nome, trava, created_at, frank_id, data_vencimento',
  );

  if (filtroTipo === 'padrao') q = q.eq('tipo', 'padrao');
  else if (filtroTipo === 'hdm') q = q.eq('tipo', 'hdm');

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];

  const firstTopicoByChamado = new Map<number, { responsavel_nome: string | null; time_responsavel: string | null }>();
  if (rows.length > 0) {
    const chamadoIds = rows.map((c) => c.id);
    const { data: topicosRows, error: tErr } = await supabase
      .from('sirene_topicos')
      .select('chamado_id, ordem, responsavel_nome, time_responsavel')
      .in('chamado_id', chamadoIds)
      .order('chamado_id', { ascending: true })
      .order('ordem', { ascending: true });
    if (tErr) return { ok: false, error: tErr.message };
    for (const t of topicosRows ?? []) {
      const cid = Number((t as { chamado_id: number }).chamado_id);
      if (!Number.isFinite(cid) || firstTopicoByChamado.has(cid)) continue;
      const rn = (t as { responsavel_nome?: string | null }).responsavel_nome;
      const tr = (t as { time_responsavel?: string | null }).time_responsavel;
      firstTopicoByChamado.set(cid, {
        responsavel_nome: rn != null && String(rn).trim() !== '' ? String(rn).trim() : null,
        time_responsavel: tr != null && String(tr).trim() !== '' ? String(tr).trim() : null,
      });
    }
  }

  const chamados = rows.map((c) => {
    const first = firstTopicoByChamado.get(Number(c.id));
    const row = c as Record<string, unknown>;
    return {
      ...c,
      frank_id: (row.frank_id as string | null | undefined) ?? null,
      data_vencimento:
        row.data_vencimento != null && String(row.data_vencimento).trim() !== ''
          ? String(row.data_vencimento).slice(0, 10)
          : null,
      primeiro_topico_responsavel_nome: first?.responsavel_nome ?? null,
      primeiro_topico_time_responsavel: first?.time_responsavel ?? null,
    };
  });

  chamados.sort((a, b) => {
    const ra = rankChamadoPainelUnificado({
      frank_id: a.frank_id,
      franqueado_nome: null,
      trava: a.trava,
      data_vencimento: a.data_vencimento,
      atividade_status: statusSireneParaRankLista(a.status),
    });
    const rb = rankChamadoPainelUnificado({
      frank_id: b.frank_id,
      franqueado_nome: null,
      trava: b.trava,
      data_vencimento: b.data_vencimento,
      atividade_status: statusSireneParaRankLista(b.status),
    });
    if (ra.group !== rb.group) return ra.group - rb.group;
    if (ra.dueMs !== rb.dueMs) return ra.dueMs - rb.dueMs;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });

  return { ok: true, chamados };
}

export type MonitorTopico = {
  topicoId: number;
  chamadoId: number;
  numero: number;
  incendio: string;
  frank_nome: string | null;
  trava: boolean;
  descricao: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
};

/** Monitor dos times: Bombeiro vê todos os tópicos agrupados por time (não aprovados). filtroTipo: todos | padrao | hdm */
export async function getMonitorTopicosPorTime(
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
): Promise<
  | { ok: true; isBombeiro: true; porTime: Record<string, MonitorTopico[]> }
  | { ok: true; isBombeiro: false }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: papelRow } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .maybeSingle();
  const isBombeiro = papelRow?.papel === 'bombeiro';
  if (!isBombeiro) return { ok: true, isBombeiro: false };

  const { data: topicos, error: errT } = await supabase
    .from('sirene_topicos')
    .select('id, chamado_id, descricao, time_responsavel, status, data_inicio, data_fim, trava')
    .in('status', ['nao_iniciado', 'em_andamento', 'concluido'])
    .order('ordem', { ascending: true });

  if (errT) return { ok: false, error: errT.message };
  let list = topicos ?? [];
  if (list.length === 0) return { ok: true, isBombeiro: true, porTime: {} };

  const chamadoIds = [...new Set(list.map((t) => t.chamado_id))];
  let q = supabase
    .from('sirene_chamados')
    .select('id, numero, incendio, frank_nome, trava, tipo')
    .in('id', chamadoIds);
  if (filtroTipo === 'padrao') q = q.eq('tipo', 'padrao');
  else if (filtroTipo === 'hdm') q = q.eq('tipo', 'hdm');
  const { data: chamados, error: errC } = await q;
  if (errC) return { ok: false, error: errC.message };
  const chamadosById = new Map(
    (chamados ?? []).map((c) => [
      c.id,
      { numero: c.numero, incendio: c.incendio, frank_nome: c.frank_nome ?? null, trava: c.trava ?? false },
    ]),
  );

  if (filtroTipo === 'padrao' || filtroTipo === 'hdm') {
    const idsFiltrados = new Set((chamados ?? []).map((c) => c.id));
    list = list.filter((t) => idsFiltrados.has(t.chamado_id));
  }

  const porTime: Record<string, MonitorTopico[]> = {};
  for (const t of list) {
    const c = chamadosById.get(t.chamado_id);
    if (!c) continue;
    const time = t.time_responsavel?.trim() || 'Sem time';
    if (!porTime[time]) porTime[time] = [];
    porTime[time].push({
      topicoId: t.id,
      chamadoId: t.chamado_id,
      numero: c.numero,
      incendio: c.incendio,
      frank_nome: c.frank_nome,
      trava: (t as { trava?: boolean }).trava ?? c.trava,
      descricao: t.descricao,
      status: t.status,
      data_inicio: t.data_inicio ?? null,
      data_fim: t.data_fim ?? null,
    });
  }
  return { ok: true, isBombeiro: true, porTime };
}

/** Dados para o dashboard: KPIs, chamados por status, travados, satisfação, minhas tarefas. */
export async function getDashboardData(
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
): Promise<
  | {
      ok: true;
      emAberto: number;
      emAndamento: number;
      concluidos: number;
      tempoMedioPrimeiroAtendimento: string;
      porStatus: { status: string; count: number; pct: number }[];
      satisfacaoPct: number;
      chamadosComTrava: number;
      recentesComTrava: Array<{
        id: number;
        numero: number;
        time_abertura: string | null;
        incendio: string;
      }>;
      minhasTarefas: Array<{
        chamadoId: number;
        numero: number;
        incendio: string;
        titulo: string;
        status: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  let me = await getSireneUserContext(supabase);
  let queryClient: typeof supabase = supabase;
  if (!me && isAppFullyPublic()) {
    try {
      queryClient = createAdminClient() as typeof supabase;
      me = {
        userId: '00000000-0000-0000-0000-000000000000',
        userName: 'Visitante',
        ctx: { papel: null, time: null },
        role: null,
      };
    } catch {
      /* sem service role */
    }
  }
  if (!me) return { ok: false, error: 'Faça login.' };

  let query = queryClient
    .from('sirene_chamados')
    .select(
      'id, numero, status, trava, te_trata, data_abertura, data_inicio_atendimento, resolucao_suficiente, incendio, time_abertura, tipo, updated_at',
    );
  if (filtroTipo === 'padrao') query = query.eq('tipo', 'padrao');
  else if (filtroTipo === 'hdm') query = query.eq('tipo', 'hdm');

  const { data: chamados } = await query;

  const list = chamados ?? [];
  const total = list.length;
  const emAberto = list.filter((c) => c.status === 'nao_iniciado').length;
  const emAndamento = list.filter((c) => c.status === 'em_andamento').length;
  const concluidos = list.filter((c) => c.status === 'concluido').length;

  const comPrimeiroAtendimento = list.filter(
    (c) => c.data_inicio_atendimento != null && c.data_abertura != null,
  );
  let tempoMedioPrimeiroAtendimento = '—';
  if (comPrimeiroAtendimento.length > 0) {
    const avgMs =
      comPrimeiroAtendimento.reduce((acc, c) => {
        const a = new Date(c.data_abertura!).getTime();
        const b = new Date(c.data_inicio_atendimento!).getTime();
        return acc + (b - a);
      }, 0) / comPrimeiroAtendimento.length;
    const dias = avgMs / (1000 * 60 * 60 * 24);
    tempoMedioPrimeiroAtendimento = `${dias.toFixed(1).replace('.', ',')}d`;
  }

  const comResolucao = list.filter((c) => c.resolucao_suficiente != null);
  const resolvidosPrimeira = comResolucao.filter((c) => c.resolucao_suficiente === true).length;
  const satisfacaoPct =
    comResolucao.length > 0 ? Math.round((resolvidosPrimeira / comResolucao.length) * 100) : 0;

  // Chamados com trava: campo trava da abertura OU flag "te_trata" marcada na abertura do chamado
  const comTrava = list.filter((c) => c.trava === true || (c as { te_trata?: boolean | null }).te_trata === true);
  const recentesComTrava = comTrava
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      numero: c.numero,
      time_abertura: c.time_abertura,
      incendio: c.incendio,
    }));

  const porStatus = [
    { status: 'nao_iniciado', count: emAberto, pct: total > 0 ? (emAberto / total) * 100 : 0 },
    {
      status: 'em_andamento',
      count: emAndamento,
      pct: total > 0 ? (emAndamento / total) * 100 : 0,
    },
    { status: 'concluido', count: concluidos, pct: total > 0 ? (concluidos / total) * 100 : 0 },
  ];

  const minhasTarefas: Array<{
    chamadoId: number;
    numero: number;
    incendio: string;
    titulo: string;
    status: string;
  }> = [];

  const { data: topicos } = await queryClient
    .from('sirene_topicos')
    .select('id, chamado_id, descricao, status, time_responsavel')
    .eq('responsavel_id', me.userId);

  const chamadoIds = [...new Set((topicos ?? []).map((t) => t.chamado_id))];
  const chamadosById = new Map<number, { numero: number; incendio: string | null }>();
  if (chamadoIds.length > 0) {
    const { data: chamadosList } = await queryClient
      .from('sirene_chamados')
      .select('id, numero, incendio')
      .in('id', chamadoIds);
    for (const c of chamadosList ?? []) {
      chamadosById.set(c.id, { numero: c.numero, incendio: c.incendio });
    }
  }

  for (const t of topicos ?? []) {
    if (t.status === 'aprovado') continue;
    const c = chamadosById.get(t.chamado_id);
    if (c)
      minhasTarefas.push({
        chamadoId: t.chamado_id,
        numero: c.numero,
        incendio: c.incendio ?? '',
        titulo: `Tópico: ${t.descricao?.slice(0, 40) ?? ''}${(t.descricao?.length ?? 0) > 40 ? '…' : ''}`,
        status: t.status === 'concluido' ? 'Aguardando' : 'Em andamento',
      });
  }

  if (me.ctx.papel === 'bombeiro') {
    const { data: chamadosEmAndamento } = await queryClient
      .from('sirene_chamados')
      .select('id, numero, incendio')
      .eq('status', 'em_andamento');
    const { data: todosTopicos } = await queryClient
      .from('sirene_topicos')
      .select('chamado_id, status, aprovado_bombeiro');
    const porChamado = new Map<number, { concluidos: number; aprovados: number }>();
    for (const t of todosTopicos ?? []) {
      const cur = porChamado.get(t.chamado_id) ?? { concluidos: 0, aprovados: 0 };
      if (t.status === 'concluido' || t.status === 'aprovado') cur.concluidos++;
      if (t.status === 'aprovado' || t.aprovado_bombeiro === true) cur.aprovados++;
      porChamado.set(t.chamado_id, cur);
    }
    for (const c of chamadosEmAndamento ?? []) {
      const stats = porChamado.get(c.id);
      if (!stats) continue;
      const temConcluidoNaoAprovado = stats.concluidos > stats.aprovados;
      const todosAprovados = stats.concluidos > 0 && stats.concluidos === stats.aprovados;
      if (temConcluidoNaoAprovado)
        minhasTarefas.push({
          chamadoId: c.id,
          numero: c.numero,
          incendio: c.incendio ?? '',
          titulo: 'Revisar resolução pontual',
          status: 'Em andamento',
        });
      else if (todosAprovados)
        minhasTarefas.push({
          chamadoId: c.id,
          numero: c.numero,
          incendio: c.incendio ?? '',
          titulo: 'Parecer final pendente após todos os times concluírem',
          status: 'Em andamento',
        });
    }
  }

  return {
    ok: true,
    emAberto,
    emAndamento,
    concluidos,
    tempoMedioPrimeiroAtendimento,
    porStatus,
    satisfacaoPct,
    chamadosComTrava: comTrava.length,
    recentesComTrava,
    minhasTarefas: minhasTarefas.slice(0, 10),
  };
}

/** Buscar um chamado por id (para detalhe). */
export async function getChamado(
  chamadoId: number,
): Promise<
  | {
      ok: true;
      chamado: Chamado & { numero: number };
      userContext: SireneUserContext | null;
      currentUserId: string;
      isFrank: boolean;
      /** `profiles.role` bruto (ex.: admin, team, franqueado). */
      rawProfileRole: string | null;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado, error } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();

  if (error || !chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const c = chamado as unknown as Chamado & { numero: number };
  const isFrank = me.role === 'frank' || me.role === 'franqueado';
  return {
    ok: true,
    chamado: c,
    userContext: me.ctx,
    currentUserId: me.userId,
    isFrank,
    rawProfileRole: me.role,
  };
}

/** Chamados com tema e mapeamento preenchidos e ainda sem perícia vinculada (para Caneta Verde). */
export async function listChamadosParaVincularPericia(): Promise<
  | {
      ok: true;
      chamados: Array<{
        id: number;
        numero: number;
        incendio: string;
        tema: string | null;
        mapeamento_pericia: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  if (me.ctx.papel !== 'bombeiro' && me.ctx.papel !== 'caneta_verde')
    return { ok: false, error: 'Apenas Bombeiro ou Caneta Verde podem vincular perícia.' };

  const { data: chamados } = await supabase
    .from('sirene_chamados')
    .select('id, numero, incendio, tema, mapeamento_pericia')
    .not('tema', 'is', null)
    .not('mapeamento_pericia', 'is', null);
  const list = chamados ?? [];
  const { data: vinculados } = await supabase
    .from('sirene_pericia_chamados')
    .select('chamado_id');
  const idsVinculados = new Set((vinculados ?? []).map((v) => v.chamado_id));
  const pendentes = list.filter((c) => !idsVinculados.has(c.id));
  return { ok: true, chamados: pendentes };
}

/** Lista perícias do planejamento (autocomplete / filtro). */
export async function listPericias(busca?: string): Promise<
  | {
      ok: true;
      pericias: Array<{
        id: number;
        nome_pericia: string;
        time_responsavel: string | null;
        responsavel_id: string | null;
        responsavel_nome: string | null;
        data_inicio: string | null;
        status: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  let q = supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_id, responsavel_nome, data_inicio, status')
    .order('nome_pericia', { ascending: true });
  if (busca?.trim()) {
    q = q.ilike('nome_pericia', `%${busca.trim()}%`);
  }
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, pericias: data ?? [] };
}

/** Vincula chamado a uma perícia (Caneta Verde). Dados da perícia vêm do planejamento. */
export async function vincularChamadoPericia(
  chamadoId: number,
  periciaId: number,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  if (me.ctx.papel !== 'bombeiro' && me.ctx.papel !== 'caneta_verde')
    return { ok: false, error: 'Apenas Bombeiro ou Caneta Verde podem vincular perícia.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id, tema, mapeamento_pericia')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !chamado.tema || !chamado.mapeamento_pericia)
    return { ok: false, error: 'Chamado não encontrado ou sem tema/mapeamento preenchidos.' };

  const { data: pericia } = await supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_id, responsavel_nome, data_inicio, status')
    .eq('id', periciaId)
    .single();
  if (!pericia) return { ok: false, error: 'Perícia não encontrada.' };

  const { error: insErr } = await supabase.from('sirene_pericia_chamados').insert({
    pericia_id: periciaId,
    chamado_id: chamadoId,
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath('/sirene/pericias');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Perícia vinculada ao chamado (para exibir no detalhe). */
export async function getPericiaDoChamado(chamadoId: number): Promise<
  | {
      ok: true;
      pericia: {
        id: number;
        nome_pericia: string;
        time_responsavel: string | null;
        responsavel_nome: string | null;
        data_inicio: string | null;
        status: string;
      } | null;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: vinc } = await supabase
    .from('sirene_pericia_chamados')
    .select('pericia_id')
    .eq('chamado_id', chamadoId)
    .limit(1)
    .maybeSingle();
  if (!vinc) return { ok: true, pericia: null };
  const { data: pericia } = await supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_nome, data_inicio, status')
    .eq('id', vinc.pericia_id)
    .single();
  return { ok: true, pericia: pericia ?? null };
}

/** Lista perícias com chamados vinculados (planejamento). Filtros opcionais. */
export async function listPericiasComChamados(filtros?: {
  nome?: string;
  time?: string;
  status?: string;
}): Promise<
  | {
      ok: true;
      pericias: Array<{
        id: number;
        nome_pericia: string;
        time_responsavel: string | null;
        responsavel_nome: string | null;
        data_inicio: string | null;
        status: string;
        chamados: Array<{ id: number; numero: number; incendio: string }>;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  let q = supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_nome, data_inicio, status')
    .order('nome_pericia', { ascending: true });
  if (filtros?.nome?.trim()) q = q.ilike('nome_pericia', `%${filtros.nome.trim()}%`);
  if (filtros?.time?.trim()) q = q.eq('time_responsavel', filtros.time.trim());
  if (filtros?.status?.trim()) q = q.eq('status', filtros.status.trim());
  const { data: pericias, error } = await q;
  if (error) return { ok: false, error: error.message };
  const list = pericias ?? [];
  const { data: vinc } = await supabase.from('sirene_pericia_chamados').select('pericia_id, chamado_id');
  const porPericia = new Map<number, number[]>();
  for (const v of vinc ?? []) {
    if (!porPericia.has(v.pericia_id)) porPericia.set(v.pericia_id, []);
    porPericia.get(v.pericia_id)!.push(v.chamado_id);
  }
  const chamadoIds = [...new Set((vinc ?? []).map((v) => v.chamado_id))];
  const { data: chamadosList } =
    chamadoIds.length > 0
      ? await supabase.from('sirene_chamados').select('id, numero, incendio').in('id', chamadoIds)
      : { data: [] };
  const chamadosMap = new Map(
    (chamadosList ?? []).map((c) => [c.id, { id: c.id, numero: c.numero, incendio: c.incendio }]),
  );
  const result = list.map((p) => ({
    ...p,
    chamados: (porPericia.get(p.id) ?? []).map((cid) => chamadosMap.get(cid)!).filter(Boolean),
  }));
  return { ok: true, pericias: result };
}

/** Mensagens do chamado (comentários). */
export async function listMensagensChamado(chamadoId: number): Promise<
  | {
      ok: true;
      mensagens: Array<{
        id: number;
        autor_nome: string | null;
        autor_time: string | null;
        texto: string;
        created_at: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  const { data: c } = await supabase.from('sirene_chamados').select('id').eq('id', chamadoId).single();
  if (!c) return { ok: false, error: 'Chamado não encontrado.' };
  const { data, error } = await supabase
    .from('sirene_mensagens')
    .select('id, autor_nome, autor_time, texto, created_at')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, mensagens: data ?? [] };
}

/** Participantes do chamado (para autocomplete @pessoa): criador, bombeiros, times dos tópicos. */
export async function getParticipantesChamado(chamadoId: number): Promise<
  | { ok: true; participantes: Array<{ id: string; nome: string }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('aberto_por')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  const ids = new Set<string>();
  if ((chamado as { aberto_por?: string }).aberto_por) ids.add((chamado as { aberto_por: string }).aberto_por);
  const { data: bombeiros } = await supabase.from('sirene_papeis').select('user_id').eq('papel', 'bombeiro');
  for (const b of bombeiros ?? []) ids.add(b.user_id);
  const { data: topicos } = await supabase
    .from('sirene_topicos')
    .select('responsavel_id, time_responsavel')
    .eq('chamado_id', chamadoId);
  const times = new Set<string>();
  for (const t of topicos ?? []) {
    if (t.responsavel_id) ids.add(t.responsavel_id);
    if ((t as { time_responsavel?: string }).time_responsavel)
      times.add((t as { time_responsavel: string }).time_responsavel);
  }
  if (times.size > 0) {
    const { data: byTime } = await supabase.from('profiles').select('id').in('time', [...times]);
    for (const p of byTime ?? []) ids.add(p.id);
  }
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [...ids]);
  const participantes = (profiles ?? []).map((p) => ({
    id: p.id,
    nome: (p.full_name as string)?.trim() || 'Sem nome',
  }));
  return { ok: true, participantes };
}

/** Enviar comentário no chamado. Parse @nome e cria notificações tipo mencao_comentario. */
export async function enviarMensagemChamado(
  chamadoId: number,
  texto: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id, numero, incendio, tema')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  const textoTrim = texto?.trim();
  if (!textoTrim) return { ok: false, error: 'Digite um comentário.' };

  const participantesResult = await getParticipantesChamado(chamadoId);
  if (!participantesResult.ok) return participantesResult;
  const participantes = participantesResult.participantes;
  const mencoesIds: string[] = [];
  const regex = /@(\p{L}[\p{L}\s]*)/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(textoTrim)) !== null) {
    const nomeBusca = match[1].trim().toLowerCase();
    const found = participantes.find(
      (p) => p.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(p.nome.toLowerCase()),
    );
    if (found && !mencoesIds.includes(found.id)) mencoesIds.push(found.id);
  }

  const { data: msgData, error: msgErr } = await supabase
    .from('sirene_mensagens')
    .insert({
      chamado_id: chamadoId,
      autor_id: me.userId,
      autor_nome: me.userName,
      autor_time: me.ctx.time ?? undefined,
      texto: textoTrim,
      mencoes: mencoesIds.length > 0 ? mencoesIds : null,
    })
    .select('id')
    .single();
  if (msgErr) return { ok: false, error: msgErr.message };
  const numero = (chamado as { numero?: number })?.numero ?? chamadoId;
  const temaCh = ((chamado as { tema?: string | null }).tema ?? '').trim();
  const incendioCh = ((chamado as { incendio?: string | null }).incendio ?? '').trim();
  const tituloChamadoNotif = temaCh || incendioCh || `Chamado #${numero}`;
  const tituloChamadoEsc = tituloChamadoNotif.replace(/"/g, "'");
  const tituloAvisoMencao = '@você foi mencionado em um chamado';
  const mensagemMencao = `${me.userName} te mencionou no chamado "${tituloChamadoEsc}"`;
  const mencoesParaOutros = mencoesIds.filter((uid) => uid !== me.userId);
  if (mencoesParaOutros.length > 0 && msgData?.id) {
    await supabase.from('chamado_mencoes').insert(
      mencoesParaOutros.map((uid) => ({
        comentario_id: msgData.id,
        mencionado_id: uid,
        chamado_id: chamadoId,
      })),
    );
  }
  for (const uid of mencoesParaOutros) {
    await inserirNotificacao(supabase, uid, chamadoId, 'mencao_comentario', mensagemMencao, null, {
      titulo: tituloAvisoMencao,
      mensagem: mensagemMencao,
      referencia_id: chamadoId,
    });
  }
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Busca usuários internos para autocomplete de @menção. Exclui roles frank/franqueado. */
export async function buscarUsuariosInternos(
  query: string,
): Promise<{ id: string; nome: string; avatar_url: string | null }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const q = query.trim();
  if (!q) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('role', 'in', '("frank","franqueado")')
    .ilike('full_name', `%${q}%`)
    .order('full_name', { ascending: true })
    .limit(10);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nome: ((p.full_name as string) ?? '').trim() || 'Sem nome',
    avatar_url: null,
  }));
}

/** Insere uma linha em chamado_mencoes por mencionado. Ignora duplicatas silenciosamente. */
export async function inserirMencoes(
  comentarioId: number,
  chamadoId: number,
  idsMencionados: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (idsMencionados.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from('chamado_mencoes').insert(
    idsMencionados.map((uid) => ({
      comentario_id: comentarioId,
      mencionado_id: uid,
      chamado_id: chamadoId,
    })),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Resumo de notificações para o sino no header (não lidas + últimas). */
export async function getNotificacoesResumo(): Promise<{
  totalNaoLidas: number;
  ultimas: Array<{
    id: number;
    chamado_id: number | null;
    tipo: string;
    texto: string | null;
    titulo: string | null;
    mensagem: string | null;
    referencia_id: number | null;
    lida: boolean;
    created_at: string;
  }>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { totalNaoLidas: 0, ultimas: [] };

  const { data: list } = await supabase
    .from('sirene_notificacoes')
    .select('id, chamado_id, tipo, texto, titulo, mensagem, referencia_id, lida, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const ultimas = (list ?? []) as Array<{
    id: number;
    chamado_id: number | null;
    tipo: string;
    texto: string | null;
    titulo: string | null;
    mensagem: string | null;
    referencia_id: number | null;
    lida: boolean;
    created_at: string;
  }>;
  const totalNaoLidas = ultimas.filter((n) => !n.lida).length;
  return { totalNaoLidas, ultimas };
}

/** Marcar notificação como lida (ao clicar no sino). */
export async function marcarNotificacaoLida(notificacaoId: number): Promise<SireneActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { error } = await supabase
    .from('sirene_notificacoes')
    .update({ lida: true })
    .eq('id', notificacaoId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath('/sirene/kanban');
  revalidatePath('/sirene/pericias');
  return { ok: true };
}
