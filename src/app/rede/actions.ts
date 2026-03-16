"use server";

import { createClient } from "@/lib/supabase/server";

export type RedeTipo = "condominio" | "corretor" | "imobiliaria";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addRedeContato(data: {
  tipo: RedeTipo;
  nome: string;
  contato?: string;
  processo_id?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const nomeTrim = data.nome?.trim();
  if (!nomeTrim) return { ok: false, error: "Informe o nome." };
  const { error } = await supabase.from("rede_contatos").insert({
    user_id: user.id,
    tipo: data.tipo,
    nome: nomeTrim,
    contato: data.contato?.trim() || null,
    processo_id: data.processo_id || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteRedeContato(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };
  const { error } = await supabase.from("rede_contatos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
