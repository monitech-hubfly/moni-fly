'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export async function garantirPastelariaCardParaChamado(
  sireneChamadoId: number,
  tituloFallback: string,
): Promise<{ ok: true; cardId: string } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();

    // Verifica se já existe card vinculado
    const { data: existing } = await admin
      .from('pastelaria_cards')
      .select('id')
      .eq('sirene_chamado_id', sireneChamadoId)
      .maybeSingle();

    if (existing) {
      return { ok: true, cardId: String((existing as { id: string }).id) };
    }

    // Cria novo card vinculado ao chamado Sirene
    const { data: novo, error } = await admin
      .from('pastelaria_cards')
      .insert({
        nome: tituloFallback.slice(0, 255),
        coluna: 'doing',
        sirene_chamado_id: sireneChamadoId,
        semana_origem: `S${String(Math.ceil(((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + new Date(new Date().getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`,
        source: 'sirene',
      })
      .select('id')
      .single();

    if (error || !novo) {
      return { ok: false, error: error?.message ?? 'Erro ao criar card' };
    }

    return { ok: true, cardId: String((novo as { id: string }).id) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function salvarHorasChamadoSirene(
  cardId: string,
  semana: string,
  horas: {
    seg: number; ter: number; qua: number; qui: number; sex: number;
    seg_unidade: string; ter_unidade: string; qua_unidade: string; qui_unidade: string; sex_unidade: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from('pastelaria_horas')
      .upsert(
        {
          card_id: cardId,
          semana,
          seg: horas.seg,
          ter: horas.ter,
          qua: horas.qua,
          qui: horas.qui,
          sex: horas.sex,
          seg_unidade: horas.seg_unidade,
          ter_unidade: horas.ter_unidade,
          qua_unidade: horas.qua_unidade,
          qui_unidade: horas.qui_unidade,
          sex_unidade: horas.sex_unidade,
          unidade: 'h',
        },
        { onConflict: 'card_id,semana' },
      );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
