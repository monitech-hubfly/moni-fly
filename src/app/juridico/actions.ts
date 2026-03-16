"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getStatusLabel } from "./constants";
import { sendJuridicoStatusEmail } from "@/lib/email";

export type JuridicoActionResult = { ok: true } | { ok: false; error: string };

async function getMyRole(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").single();
  return (data?.role as string) ?? "frank";
}

/** Frank: cria novo ticket de dúvida jurídica. */
export async function createJuridicoTicket(data: {
  nome_frank: string;
  titulo: string;
  descricao: string;
  nome_condominio?: string;
  lote?: string;
}): Promise<JuridicoActionResult & { ticketId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const nomeFrank = data.nome_frank?.trim();
  const titulo = data.titulo?.trim();
  const descricao = data.descricao?.trim();
  if (!nomeFrank) return { ok: false, error: "Informe seu nome." };
  if (!titulo) return { ok: false, error: "Informe o título." };
  if (!descricao) return { ok: false, error: "Informe a descrição da dúvida." };

  const { data: ticket, error } = await supabase
    .from("juridico_tickets")
    .insert({
      user_id: user.id,
      nome_frank: nomeFrank,
      titulo,
      descricao,
      nome_condominio: data.nome_condominio?.trim() || null,
      lote: data.lote?.trim() || null,
      email_frank: user.email ?? null,
      status: "nova_duvida",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/juridico");
  revalidatePath("/juridico/kanban");
  return { ok: true, ticketId: ticket.id };
}

/** Frank: lista próprios tickets. Moní: lista todos (via kanban). */
export async function listJuridicoTickets(): Promise<
  { ok: true; tickets: Array<{ id: string; titulo: string; descricao: string; status: string; created_at: string; resposta_publica: string | null; nome_frank: string | null; nome_condominio: string | null; lote: string | null }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: tickets, error } = await supabase
    .from("juridico_tickets")
    .select("id, titulo, descricao, status, created_at, resposta_publica, nome_frank, nome_condominio, lote")
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, tickets: tickets ?? [] };
}

/** Busca um ticket (Frank só o próprio; Moní qualquer). */
export async function getJuridicoTicket(ticketId: string): Promise<
  | { ok: true; ticket: { id: string; user_id: string; titulo: string; descricao: string; status: string; resposta_publica: string | null; resposta_publica_em: string | null; created_at: string; updated_at: string; nome_frank: string | null; nome_condominio: string | null; lote: string | null } }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: ticket, error } = await supabase
    .from("juridico_tickets")
    .select("id, user_id, titulo, descricao, status, resposta_publica, resposta_publica_em, created_at, updated_at, nome_frank, nome_condominio, lote")
    .eq("id", ticketId)
    .single();

  if (error || !ticket) return { ok: false, error: error?.message ?? "Ticket não encontrado." };
  return { ok: true, ticket };
}

/** Moní: altera status do ticket e dispara alerta para o Frank. */
export async function updateJuridicoTicketStatus(
  ticketId: string,
  newStatus: string
): Promise<JuridicoActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const role = await getMyRole(supabase);
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };
  const allowed = ["nova_duvida", "em_analise", "paralisado", "finalizado"];
  if (!allowed.includes(newStatus)) return { ok: false, error: "Status inválido." };

  const { data: ticket } = await supabase
    .from("juridico_tickets")
    .select("user_id, status, titulo, email_frank")
    .eq("id", ticketId)
    .single();
  if (!ticket) return { ok: false, error: "Ticket não encontrado." };

  const { error: updateError } = await supabase
    .from("juridico_tickets")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (updateError) return { ok: false, error: updateError.message };

  const statusLabel = getStatusLabel(newStatus);
  const mensagem = `Sua dúvida jurídica está em: ${statusLabel}.`;
  await supabase.from("alertas").insert({
    user_id: ticket.user_id,
    tipo: "Dúvida jurídica",
    mensagem,
    lido: false,
  });

  if (ticket.email_frank) {
    await sendJuridicoStatusEmail(
      ticket.email_frank,
      ticket.titulo ?? "Dúvida jurídica",
      mensagem,
      statusLabel
    );
  }

  revalidatePath("/juridico");
  revalidatePath("/juridico/kanban");
  revalidatePath("/juridico/[id]", "page");
  return { ok: true };
}

/** Moní: define resposta pública (ex.: ao mover para finalizado) e opcionalmente altera status. */
export async function setJuridicoRespostaPublica(
  ticketId: string,
  resposta: string,
  setStatusFinalizado?: boolean
): Promise<JuridicoActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const role = await getMyRole(supabase);
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };

  const payload: { resposta_publica: string; resposta_publica_em: string; updated_at: string; status?: string } = {
    resposta_publica: resposta,
    resposta_publica_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (setStatusFinalizado) payload.status = "finalizado";

  const { data: ticket } = await supabase
    .from("juridico_tickets")
    .select("user_id, titulo, email_frank")
    .eq("id", ticketId)
    .single();
  if (!ticket) return { ok: false, error: "Ticket não encontrado." };

  const { error } = await supabase.from("juridico_tickets").update(payload).eq("id", ticketId);
  if (error) return { ok: false, error: error.message };

  const mensagem = "Sua dúvida jurídica foi respondida. Acesse o canal de dúvidas (Jurídico) para ver a resposta e anexos.";
  await supabase.from("alertas").insert({
    user_id: ticket.user_id,
    tipo: "Dúvida jurídica",
    mensagem,
    lido: false,
  });

  if (ticket.email_frank) {
    await sendJuridicoStatusEmail(
      ticket.email_frank,
      ticket.titulo ?? "Dúvida jurídica",
      mensagem,
      "Finalizado"
    );
  }

  revalidatePath("/juridico");
  revalidatePath("/juridico/kanban");
  revalidatePath("/juridico/[id]", "page");
  return { ok: true };
}

/** Moní: adiciona comentário interno (Frank não vê). */
export async function addJuridicoComentarioInterno(
  ticketId: string,
  texto: string
): Promise<JuridicoActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const role = await getMyRole(supabase);
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };
  if (!texto?.trim()) return { ok: false, error: "Informe o comentário." };

  const { error } = await supabase.from("juridico_ticket_comentarios").insert({
    ticket_id: ticketId,
    autor_id: user.id,
    texto: texto.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/juridico/kanban");
  revalidatePath("/juridico/[id]", "page");
  return { ok: true };
}

/** Lista comentários internos (apenas Moní). */
export async function listJuridicoComentariosInternos(ticketId: string): Promise<
  { ok: true; comentarios: Array<{ id: string; texto: string; created_at: string }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const role = await getMyRole(supabase);
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };

  const { data: rows, error } = await supabase
    .from("juridico_ticket_comentarios")
    .select("id, texto, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, comentarios: rows ?? [] };
}

/** Registra anexo após upload (Frank ou Moní). file_path = path dentro do bucket (ex: ticket_id/frank/uuid_nome.pdf). */
export async function registerJuridicoAnexo(
  ticketId: string,
  filePath: string,
  fileName: string,
  fileSize: number | null,
  lado: "frank" | "moni"
): Promise<JuridicoActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const role = await getMyRole(supabase);
  if (lado === "moni" && role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };
  if (lado === "frank") {
    const { data: t } = await supabase.from("juridico_tickets").select("id").eq("id", ticketId).eq("user_id", user.id).single();
    if (!t) return { ok: false, error: "Ticket não encontrado." };
  }

  const { error } = await supabase.from("juridico_ticket_anexos").insert({
    ticket_id: ticketId,
    user_id: user.id,
    lado,
    file_name: fileName,
    file_url: filePath,
    file_size: fileSize,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/juridico");
  revalidatePath("/juridico/kanban");
  revalidatePath("/juridico/[id]", "page");
  return { ok: true };
}

/** Lista anexos do ticket (Frank vê todos do ticket; Moní também). */
export async function listJuridicoAnexos(ticketId: string): Promise<
  { ok: true; anexos: Array<{ id: string; file_name: string; file_url: string; lado: string; created_at: string }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: anexos, error } = await supabase
    .from("juridico_ticket_anexos")
    .select("id, file_name, file_url, lado, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, anexos: anexos ?? [] };
}

/** Gera URL assinada para download (bucket privado). file_url no banco = path dentro do bucket. */
export async function getJuridicoAnexoDownloadUrl(anexoId: string): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: anexo, error: e1 } = await supabase
    .from("juridico_ticket_anexos")
    .select("file_url")
    .eq("id", anexoId)
    .single();
  if (e1 || !anexo) return { ok: false, error: "Anexo não encontrado." };

  const path = anexo.file_url.startsWith("http") ? anexo.file_url.replace(/^.*\/juridico-anexos\//, "") : anexo.file_url;
  const { data: signed } = await supabase.storage.from("juridico-anexos").createSignedUrl(path, 60);
  if (!signed?.signedUrl) return { ok: false, error: "Não foi possível gerar link de download." };
  return { ok: true, url: signed.signedUrl };
}

/** Lista documentos templates (contratos Moní) para o Frank. */
export async function listJuridicoDocumentos(): Promise<
  { ok: true; documentos: Array<{ id: string; titulo: string; descricao: string | null; categoria: string | null; file_url: string; ordem: number }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: docs, error } = await supabase
    .from("juridico_documentos")
    .select("id, titulo, descricao, categoria, file_url, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, documentos: docs ?? [] };
}
