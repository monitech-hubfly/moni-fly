'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type FormularioQualificacaoRow = {
  id: string;
  rede_franqueado_id: string;
  n_franquia: string;
  nome_franqueado_confirmado: string | null;
  periodo_mes: number | null;
  periodo_ano: number | null;
  tem_ponto_comercial: boolean | null;
  endereco_ponto_comercial: string | null;
  numero_colaboradores: number | null;
  contratos_realizados_trimestre: number | null;
  meta_contratos_trimestre: number | null;
  principais_desafios: string | null;
  apoio_necessario: string | null;
  observacoes_adicionais: string | null;
  preenchido_por_user_id: string | null;
  criado_em: string;
  // ENI columns
  cidade_atuacao: string | null;
  estado_atuacao: string | null;
  capital_gate: string | null;
  capital_faixa: string | null;
  capital_timing: string | null;
  capital_valor_declarado: string | null;
  conhecimento_mercado: string | null;
  conhecimento_imob: string | null;
  conhecimento_moni: string | null;
  tempo_horas: string | null;
  tempo_resposta: string | null;
  tempo_agenda: string | null;
  workshops: string | null;
  motivacao: string | null;
  score_capital_pct: number | null;
  score_conhecimento_pct: number | null;
  score_tempo_pct: number | null;
  resultado_tipo: string | null;
  texto_gerado: string | null;
};

export type FormularioEniInput = {
  rede_franqueado_id: string;
  n_franquia: string;
  nome_franqueado_confirmado: string;
  cidade_atuacao: string;
  estado_atuacao: string;
  // capital_gate: derived from capital_faixa for backward compat
  capital_gate: string;
  capital_faixa: string | null;
  capital_timing: string | null;
  capital_valor_declarado: string | null;
  conhecimento_mercado: string | null;
  conhecimento_imob: string | null;
  conhecimento_moni: string | null;
  tempo_horas: string | null;
  tempo_resposta: string | null;
  tempo_agenda: string | null;
  workshops: string | null;
  motivacao: string | null;
  score_capital_pct: number;
  score_conhecimento_pct: number;
  score_tempo_pct: number;
  resultado_tipo: string;
  diag_d: number;
  diag_k: number;
  diag_c: number;
  texto_gerado: string | null;
};

export async function salvarFormularioEni(
  input: FormularioEniInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessão expirada. Faça login novamente.' };

  const { data: inserted, error: insertErr } = await supabase
    .from('formularios_qualificacao')
    .insert({
      ...input,
      preenchido_por_user_id: user.id,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[formulario-qualificacao] insert error', insertErr);
    return { ok: false, error: 'Erro ao salvar formulário. Tente novamente.' };
  }

  // Update diag scores on rede_franqueados
  const { error: updateErr } = await supabase
    .from('rede_franqueados')
    .update({ diag_d: input.diag_d, diag_k: input.diag_k, diag_c: input.diag_c })
    .eq('id', input.rede_franqueado_id);

  if (updateErr) {
    console.error('[formulario-qualificacao] update rede_franqueados error', updateErr);
    // Non-fatal: form was saved, just log the error
  }

  revalidatePath(`/rede-franqueados/${input.rede_franqueado_id}/formulario-qualificacao`);
  return { ok: true, id: inserted.id };
}

export async function buscarHistoricoFormularios(
  rede_franqueado_id: string,
): Promise<{ data: FormularioQualificacaoRow[] | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Sessão expirada.' };

  const { data, error } = await supabase
    .from('formularios_qualificacao')
    .select('*')
    .eq('rede_franqueado_id', rede_franqueado_id)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[formulario-qualificacao] select error', error);
    return { data: null, error: 'Erro ao carregar histórico.' };
  }

  return { data: data as FormularioQualificacaoRow[] };
}

// Legacy function kept for backward compatibility
export type FormularioQualificacaoInput = FormularioEniInput;
export const salvarFormularioQualificacao = salvarFormularioEni;
