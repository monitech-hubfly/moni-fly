"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Chamado, HdmTime } from "@/types/sirene";
import {
  canActAsBombeiro,
  type SireneUserContext,
} from "@/lib/sirene";

export type SireneActionResult = { ok: true } | { ok: false; error: string };

const HDM_TIMES: HdmTime[] = ["Homologações", "Produto", "Modelo Virtual"];

async function getSireneUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string; userName: string; ctx: SireneUserContext } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [papelRes, profileRes] = await Promise.all([
    supabase
      .from("sirene_papeis")
      .select("papel")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, time")
      .eq("id", user.id)
      .single(),
  ]);

  const papel =
    (papelRes.data?.papel as "bombeiro" | "caneta_verde") ?? null;
  const time = (profileRes.data?.time as string) ?? null;

  return {
    userId: user.id,
    userName:
      (profileRes.data?.full_name as string)?.trim() || user.email || "Usuário",
    ctx: { papel, time },
  };
}

/** Retorna IDs de usuários a notificar: bombeiros ou time HDM. */
async function getUserIdsToNotify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipo: "bombeiro" | "hdm",
  hdmTime?: HdmTime
): Promise<string[]> {
  if (tipo === "bombeiro") {
    const { data } = await supabase
      .from("sirene_papeis")
      .select("user_id")
      .eq("papel", "bombeiro");
    return (data ?? []).map((r) => r.user_id);
  }
  if (tipo === "hdm" && hdmTime) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("time", hdmTime);
    return (data ?? []).map((r) => r.id);
  }
  return [];
}

/** Criar chamado. Se tipo === 'hdm', notifica o time HDM em vez do Bombeiro. */
export async function criarChamado(formData: FormData): Promise<
  | (SireneActionResult & { chamadoId?: number })
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const incendio = (formData.get("incendio") as string)?.trim();
  const timeAbertura = (formData.get("time_abertura") as string)?.trim() || null;
  const frankId = (formData.get("frank_id") as string)?.trim() || null;
  const frankNome = (formData.get("frank_nome") as string)?.trim() || null;
  const tipo = ((formData.get("tipo") as string) || "padrao") as "padrao" | "hdm";
  const hdmResponsavel =
    tipo === "hdm"
      ? (formData.get("hdm_responsavel") as HdmTime) || null
      : null;

  if (!incendio) return { ok: false, error: "Informe o incêndio (resumo)." };
  if (tipo === "hdm" && (!hdmResponsavel || !HDM_TIMES.includes(hdmResponsavel)))
    return { ok: false, error: "Selecione o time HDM responsável." };

  const { data: chamado, error } = await supabase
    .from("sirene_chamados")
    .insert({
      aberto_por: me.userId,
      aberto_por_nome: me.userName,
      incendio,
      time_abertura: timeAbertura,
      frank_id: frankId,
      frank_nome: frankNome,
      tipo,
      hdm_responsavel: hdmResponsavel,
    })
    .select("id, numero")
    .single();

  if (error) return { ok: false, error: error.message };

  const userIds =
    tipo === "hdm"
      ? await getUserIdsToNotify(supabase, "hdm", hdmResponsavel!)
      : await getUserIdsToNotify(supabase, "bombeiro");

  const numero = (chamado as { id: number; numero?: number }).numero ?? chamado.id;
  const notifTipo = tipo === "hdm" ? "chamado_hdm_recebido" : "novo_chamado";
  const texto =
    tipo === "hdm"
      ? `Chamado #${numero} direcionado ao time ${hdmResponsavel}`
      : `Novo chamado #${numero}: ${incendio}`;

  for (const uid of userIds) {
    await supabase.from("sirene_notificacoes").insert({
      user_id: uid,
      chamado_id: chamado.id,
      tipo: notifTipo,
      texto,
    });
  }

  revalidatePath("/sirene");
  revalidatePath("/sirene/chamados");
  return { ok: true, chamadoId: chamado.id };
}

/** Redirecionar chamado para HDM. Apenas Bombeiro. */
export async function redirecionarParaHDM(
  chamadoId: number,
  hdmResponsavel: HdmTime,
  observacao?: string
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: chamado, error: fetchErr } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", chamadoId)
    .single();

  if (fetchErr || !chamado)
    return { ok: false, error: "Chamado não encontrado." };

  const ctx: SireneUserContext = me.ctx;
  const chamadoTyped = chamado as unknown as Chamado;
  if (!canActAsBombeiro(ctx, chamadoTyped))
    return { ok: false, error: "Apenas o Bombeiro pode redirecionar para HDM." };

  if (chamado.tipo === "hdm")
    return { ok: false, error: "Chamado já está em HDM." };

  if (!HDM_TIMES.includes(hdmResponsavel))
    return { ok: false, error: "Time HDM inválido." };

  const { error: updateErr } = await supabase
    .from("sirene_chamados")
    .update({
      tipo: "hdm",
      hdm_responsavel: hdmResponsavel,
      hdm_redirecionado_por: me.userId,
      hdm_redirecionado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  if (updateErr) return { ok: false, error: updateErr.message };

  if (observacao?.trim()) {
    await supabase.from("sirene_mensagens").insert({
      chamado_id: chamadoId,
      autor_id: me.userId,
      autor_nome: me.userName,
      autor_time: me.ctx.time ?? undefined,
      texto: `[Redirecionamento HDM — ${hdmResponsavel}] ${observacao.trim()}`,
    });
  }

  const userIds = await getUserIdsToNotify(supabase, "hdm", hdmResponsavel);
  const numero = chamado.numero ?? chamadoId;
  const texto = `Chamado #${numero} redirecionado para ${hdmResponsavel}.`;
  for (const uid of userIds) {
    await supabase.from("sirene_notificacoes").insert({
      user_id: uid,
      chamado_id: chamadoId,
      tipo: "chamado_hdm_recebido",
      texto,
    });
  }

  revalidatePath("/sirene");
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Definir prioridade. Quem pode: Bombeiro ou time HDM responsável (canActAsBombeiro). */
export async function definirPrioridade(
  chamadoId: number,
  prioridade: string
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: chamado } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: "Sem permissão para alterar prioridade." };

  const { error } = await supabase
    .from("sirene_chamados")
    .update({
      prioridade: prioridade?.trim() || "Média",
      updated_at: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/sirene");
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Salvar resolução pontual do chamado. canActAsBombeiro. */
export async function salvarResolucaoPontual(
  chamadoId: number,
  resolucao: string
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: chamado } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: "Sem permissão para editar resolução pontual." };

  const { error } = await supabase
    .from("sirene_chamados")
    .update({
      resolucao_pontual: resolucao?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Aprovar tópico. canActAsBombeiro. */
export async function aprovarTopico(topicoId: number): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: topico } = await supabase
    .from("sirene_topicos")
    .select("chamado_id")
    .eq("id", topicoId)
    .single();
  if (!topico) return { ok: false, error: "Tópico não encontrado." };

  const { data: chamado } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", topico.chamado_id)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: "Sem permissão para aprovar tópico." };

  const { error } = await supabase
    .from("sirene_topicos")
    .update({
      status: "aprovado",
      aprovado_bombeiro: true,
      motivo_reprovacao: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", topicoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Reprovar tópico. canActAsBombeiro. */
export async function reprovarTopico(
  topicoId: number,
  motivo: string
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: topico } = await supabase
    .from("sirene_topicos")
    .select("chamado_id")
    .eq("id", topicoId)
    .single();
  if (!topico) return { ok: false, error: "Tópico não encontrado." };

  const { data: chamado } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", topico.chamado_id)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: "Sem permissão para reprovar tópico." };

  const { error } = await supabase
    .from("sirene_topicos")
    .update({
      status: "em_andamento",
      aprovado_bombeiro: false,
      motivo_reprovacao: motivo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", topicoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Fechar chamado (parecer, tema, mapeamento). Apenas Bombeiro real — tema/mapeamento são exclusivos do Bombeiro. */
export async function fecharChamado(
  chamadoId: number,
  parecer: string,
  tema: string,
  mapeamento: string
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: chamado } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", chamadoId)
    .single();

  if (!chamado) return { ok: false, error: "Chamado não encontrado." }

  const ctx = me.ctx;
  const chamadoTyped = chamado as unknown as Chamado;
  if (!canActAsBombeiro(ctx, chamadoTyped))
    return { ok: false, error: "Apenas Bombeiro pode preencher tema e mapeamento de perícia." };

  const parecerTrim = parecer?.trim();
  const temaTrim = tema?.trim();
  const mapeamentoTrim = mapeamento?.trim();
  if (!parecerTrim || !temaTrim || !mapeamentoTrim)
    return { ok: false, error: "Parecer, tema e mapeamento de perícia são obrigatórios." };

  const { error } = await supabase
    .from("sirene_chamados")
    .update({
      parecer_final: parecerTrim,
      tema: temaTrim,
      mapeamento_pericia: mapeamentoTrim,
      status: "em_andamento",
      updated_at: new Date().toISOString(),
    })
    .eq("id", chamadoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/sirene");
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Listar chamados (filtro opcional por tipo: todos | padrao | hdm). */
export async function listChamados(filtroTipo?: "todos" | "padrao" | "hdm"): Promise<
  | { ok: true; chamados: Array<{ id: number; numero: number; incendio: string; status: string; prioridade: string; tipo: string; hdm_responsavel: string | null; time_abertura: string | null; trava: boolean; created_at: string }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  let q = supabase
    .from("sirene_chamados")
    .select("id, numero, incendio, status, prioridade, tipo, hdm_responsavel, time_abertura, trava, created_at")
    .order("created_at", { ascending: false });

  if (filtroTipo === "padrao") q = q.eq("tipo", "padrao");
  else if (filtroTipo === "hdm") q = q.eq("tipo", "hdm");

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, chamados: data ?? [] };
}

/** Dados para o dashboard: KPIs, chamados por status, travados, satisfação, minhas tarefas. */
export async function getDashboardData(): Promise<
  | {
      ok: true;
      emAberto: number;
      emAndamento: number;
      concluidos: number;
      tempoMedioPrimeiroAtendimento: string;
      porStatus: { status: string; count: number; pct: number }[];
      satisfacaoPct: number;
      chamadosComTrava: number;
      recentesComTrava: Array<{ id: number; numero: number; time_abertura: string | null; incendio: string }>;
      minhasTarefas: Array<{ chamadoId: number; numero: number; incendio: string; titulo: string; status: string }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: chamados } = await supabase
    .from("sirene_chamados")
    .select("id, numero, status, trava, data_abertura, data_inicio_atendimento, resolucao_suficiente, incendio, time_abertura, updated_at");

  const list = chamados ?? [];
  const total = list.length;
  const emAberto = list.filter((c) => c.status === "nao_iniciado").length;
  const emAndamento = list.filter((c) => c.status === "em_andamento").length;
  const concluidos = list.filter((c) => c.status === "concluido").length;

  const comPrimeiroAtendimento = list.filter(
    (c) => c.data_inicio_atendimento != null && c.data_abertura != null
  );
  let tempoMedioPrimeiroAtendimento = "—";
  if (comPrimeiroAtendimento.length > 0) {
    const avgMs =
      comPrimeiroAtendimento.reduce((acc, c) => {
        const a = new Date(c.data_abertura!).getTime();
        const b = new Date(c.data_inicio_atendimento!).getTime();
        return acc + (b - a);
      }, 0) / comPrimeiroAtendimento.length;
    const dias = avgMs / (1000 * 60 * 60 * 24);
    tempoMedioPrimeiroAtendimento = `${dias.toFixed(1).replace(".", ",")}d`;
  }

  const comResolucao = list.filter((c) => c.resolucao_suficiente != null);
  const resolvidosPrimeira = comResolucao.filter((c) => c.resolucao_suficiente === true).length;
  const satisfacaoPct = comResolucao.length > 0 ? Math.round((resolvidosPrimeira / comResolucao.length) * 100) : 0;

  const comTrava = list.filter((c) => c.trava === true);
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
    { status: "nao_iniciado", count: emAberto, pct: total > 0 ? (emAberto / total) * 100 : 0 },
    { status: "em_andamento", count: emAndamento, pct: total > 0 ? (emAndamento / total) * 100 : 0 },
    { status: "concluido", count: concluidos, pct: total > 0 ? (concluidos / total) * 100 : 0 },
  ];

  const minhasTarefas: Array<{ chamadoId: number; numero: number; incendio: string; titulo: string; status: string }> = [];

  const { data: topicos } = await supabase
    .from("sirene_topicos")
    .select("id, chamado_id, descricao, status, time_responsavel")
    .eq("responsavel_id", me.userId);

  for (const t of topicos ?? []) {
    if (t.status === "aprovado") continue;
    const { data: c } = await supabase.from("sirene_chamados").select("numero, incendio").eq("id", t.chamado_id).single();
    if (c)
      minhasTarefas.push({
        chamadoId: t.chamado_id,
        numero: c.numero,
        incendio: c.incendio ?? "",
        titulo: `Tópico: ${t.descricao?.slice(0, 40) ?? ""}${(t.descricao?.length ?? 0) > 40 ? "…" : ""}`,
        status: t.status === "concluido" ? "Aguardando" : "Em andamento",
      });
  }

  if (me.ctx.papel === "bombeiro") {
    const { data: chamadosEmAndamento } = await supabase
      .from("sirene_chamados")
      .select("id, numero, incendio")
      .eq("status", "em_andamento");
    const { data: todosTopicos } = await supabase.from("sirene_topicos").select("chamado_id, status, aprovado_bombeiro");
    const porChamado = new Map<number, { concluidos: number; aprovados: number }>();
    for (const t of todosTopicos ?? []) {
      const cur = porChamado.get(t.chamado_id) ?? { concluidos: 0, aprovados: 0 };
      if (t.status === "concluido" || t.status === "aprovado") cur.concluidos++;
      if (t.status === "aprovado" || t.aprovado_bombeiro === true) cur.aprovados++;
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
          incendio: c.incendio ?? "",
          titulo: "Revisar resolução pontual",
          status: "Em andamento",
        });
      else if (todosAprovados)
        minhasTarefas.push({
          chamadoId: c.id,
          numero: c.numero,
          incendio: c.incendio ?? "",
          titulo: "Parecer final pendente após todos os times concluírem",
          status: "Em andamento",
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
export async function getChamado(chamadoId: number): Promise<
  | { ok: true; chamado: Chamado & { numero: number }; userContext: SireneUserContext | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: "Faça login." };

  const { data: chamado, error } = await supabase
    .from("sirene_chamados")
    .select("*")
    .eq("id", chamadoId)
    .single();

  if (error || !chamado) return { ok: false, error: "Chamado não encontrado." };

  const c = chamado as unknown as Chamado & { numero: number };
  return {
    ok: true,
    chamado: c,
    userContext: me.ctx,
  };
}

/** Resumo de notificações para o sino no header (não lidas + últimas). */
export async function getNotificacoesResumo(): Promise<{
  totalNaoLidas: number;
  ultimas: Array<{ id: number; chamado_id: number | null; tipo: string; texto: string | null; lida: boolean; created_at: string }>;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { totalNaoLidas: 0, ultimas: [] };

  const { data: list } = await supabase
    .from("sirene_notificacoes")
    .select("id, chamado_id, tipo, texto, lida, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const ultimas = list ?? [];
  const totalNaoLidas = ultimas.filter((n) => !n.lida).length;
  return { totalNaoLidas, ultimas };
}

/** Marcar notificação como lida (ao clicar no sino). */
export async function marcarNotificacaoLida(notificacaoId: number): Promise<SireneActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const { error } = await supabase
    .from("sirene_notificacoes")
    .update({ lida: true })
    .eq("id", notificacaoId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sirene");
  revalidatePath("/sirene/chamados");
  revalidatePath("/sirene/kanban");
  revalidatePath("/sirene/pericias");
  return { ok: true };
}
