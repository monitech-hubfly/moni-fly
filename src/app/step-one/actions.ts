"use server";

import { createClient } from "@/lib/supabase/server";

export type CreateProcessoResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createProcesso(cidade: string, estado: string): Promise<CreateProcessoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Faça login para iniciar um processo." };
  }

  const { data: processo, error: errProcesso } = await supabase
    .from("processo_step_one")
    .insert({
      user_id: user.id,
      cidade: cidade.trim(),
      estado: estado.trim() || null,
      status: "em_andamento",
      etapa_atual: 1,
    })
    .select("id")
    .single();

  if (errProcesso) {
    return { ok: false, error: errProcesso.message };
  }
  if (!processo?.id) {
    return { ok: false, error: "Processo não foi criado." };
  }

  const etapas = Array.from({ length: 11 }, (_, i) => ({
    user_id: user.id,
    processo_id: processo.id,
    etapa_id: i + 1,
    status: "nao_iniciada" as const,
    tentativas: 0,
  }));

  const { error: errEtapas } = await supabase.from("etapa_progresso").insert(etapas);

  if (errEtapas) {
    return { ok: false, error: errEtapas.message };
  }

  return { ok: true, id: processo.id };
}
