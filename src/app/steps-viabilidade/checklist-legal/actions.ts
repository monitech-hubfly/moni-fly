'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Guardamos o padrão de obrigatoriedades para reativar depois.
const ENFORCE_CHECKLIST_LEGAL_REQUIRED = false;

export type ChecklistLegalFileMeta = { storage_path: string; nome_original: string | null };

export type ChecklistLegalArquivos = Partial<{
  manual_condominio_pdf: ChecklistLegalFileMeta[];
  codigo_obras_pdf: ChecklistLegalFileMeta[];
  outros_documentos_pdf: ChecklistLegalFileMeta[];
  aprovacao_matricula_pdf: ChecklistLegalFileMeta[];
  aprovacao_planialtimetrico_pdf: ChecklistLegalFileMeta[];
  aprovacao_spt_pdf: ChecklistLegalFileMeta[];
  terreno_abrigos_medidores_pdf: ChecklistLegalFileMeta[];
}>;

export type ChecklistLegalRespostas = {
  q1_aprov_tel_setor?: string;
  q2_aprov_tel_subprefeitura?: string;
  q3_aprov_pre_fabricadas?: string;
  q6_aprov_taxas?: string;
  q7_aprov_laud_sondagem?: string;
  q9_aprov_doc_solicitados_selecionados?: string[];
  q9_aprov_doc_solicitados_outro_text?: string;
  q10_aprov_prazo_condominio?: string;
  q11_aprov_prazo_prefeitura?: string;

  q12_terreno_recuo_frontal?: string;
  q13_terreno_recuo_lateral?: string;
  q14_terreno_recuo_fundos?: string;
  q15_terreno_taxa_ocupacao?: string;
  q16_terreno_coeficiente_aproveitamento?: string;
  q17_terreno_permeabilidade_minima?: string;
  q18_terreno_regra_area_permeavel?: string;
  q19_terreno_area_construida_minima?: string;
  q20_terreno_cobertura_recuos?: string;
  q21_terreno_piscinas_recuos?: string;
  q22_terreno_ediculas_permitidas?: string;
  q24_terreno_ediculas_especificacoes?: string;

  q25_gabarito_altura_maxima?: string;
  q26_gabarito_pavimentos?: string;
  q27_gabarito_subsolos?: string;
  q28_gabarito_excecoes?: string;

  q29_divisas_altura_muros?: string;
  q30_divisas_restricao_area_comum?: string;
  q31_divisas_muro_arrimo_opcional?: string;
  q32_divisas_areas_gourmet?: string;

  q33_passeios_alteracoes?: string;
  q34_passeios_paginacao?: string;
  q35_passeios_plantio_arvores?: string;

  q36_inst_medidores_posicionamento?: string;
  q37_inst_pocos_fossas?: string;
  q38_inst_esgoto_orientado?: string;
  q39_inst_faixa_servitude?: string;

  q40_outras_observacoes?: string;

  // Permitimos extensões futuras sem quebrar compatibilidade
  [key: string]: unknown;
};

export type ChecklistLegalRecord = {
  processo_id: string;
  nome_condominio: string;
  respostas_json: ChecklistLegalRespostas;
  arquivos_json: ChecklistLegalArquivos;
  completo: boolean;
  updated_at: string;
};

function strTrim(v: unknown): string {
  return String(v ?? '').trim();
}

function arrayLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function computeChecklistLegalCompleto(respostas_json: ChecklistLegalRespostas, arquivos_json: ChecklistLegalArquivos): boolean {
  const manualOk = arrayLen(arquivos_json.manual_condominio_pdf) > 0;
  const codigoOk = arrayLen(arquivos_json.codigo_obras_pdf) > 0;

  const textOk = (key: string) => Boolean(strTrim(respostas_json[key] ?? ''));

  // Aprovações (1-11) - texto obrigatório
  const aprovOk =
    textOk('q1_aprov_tel_setor') &&
    textOk('q2_aprov_tel_subprefeitura') &&
    textOk('q3_aprov_pre_fabricadas') &&
    textOk('q6_aprov_taxas') &&
    textOk('q7_aprov_laud_sondagem') &&
    textOk('q10_aprov_prazo_condominio') &&
    textOk('q11_aprov_prazo_prefeitura');

  // Checkbox 9
  const selected = (respostas_json.q9_aprov_doc_solicitados_selecionados as unknown) as string[] | undefined;
  const otherText = respostas_json.q9_aprov_doc_solicitados_outro_text as unknown;
  const q9Ok = Array.isArray(selected) && selected.length > 0 && (!selected.includes('Outro') || Boolean(strTrim(otherText)));

  // Terreno (12-24)
  const terrenoOk =
    textOk('q12_terreno_recuo_frontal') &&
    textOk('q13_terreno_recuo_lateral') &&
    textOk('q14_terreno_recuo_fundos') &&
    textOk('q15_terreno_taxa_ocupacao') &&
    textOk('q16_terreno_coeficiente_aproveitamento') &&
    textOk('q17_terreno_permeabilidade_minima') &&
    textOk('q18_terreno_regra_area_permeavel') &&
    textOk('q19_terreno_area_construida_minima') &&
    textOk('q20_terreno_cobertura_recuos') &&
    textOk('q21_terreno_piscinas_recuos') &&
    textOk('q22_terreno_ediculas_permitidas');

  // Gabarito (25-28)
  const gabaritoOk =
    textOk('q25_gabarito_altura_maxima') &&
    textOk('q26_gabarito_pavimentos') &&
    textOk('q27_gabarito_subsolos') &&
    textOk('q28_gabarito_excecoes');

  // Divisas (29-32)
  const divisasOk =
    textOk('q29_divisas_altura_muros') &&
    textOk('q30_divisas_restricao_area_comum') &&
    // q31 é opcional
    textOk('q32_divisas_areas_gourmet');

  // Passeios (33-35)
  const passeiosOk = textOk('q33_passeios_alteracoes') && textOk('q34_passeios_paginacao') && textOk('q35_passeios_plantio_arvores');

  // Instalações (36-39)
  const instalOk =
    textOk('q36_inst_medidores_posicionamento') &&
    textOk('q37_inst_pocos_fossas') &&
    textOk('q38_inst_esgoto_orientado') &&
    textOk('q39_inst_faixa_servitude');

  // Documentos base required
  return manualOk && codigoOk && aprovOk && q9Ok && terrenoOk && gabaritoOk && divisasOk && passeiosOk && instalOk;
}

async function resolveAutorNome(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  const nome = (data as { full_name?: string | null } | null)?.full_name?.trim();
  return nome || 'Usuário';
}

export async function getChecklistLegalForCard(
  processoId: string,
): Promise<
  | { ok: true; record: ChecklistLegalRecord | null; hasOwnRecord: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: processo, error: procErr } = await supabase
    .from('processo_step_one')
    .select('id, nome_condominio')
    .eq('id', processoId)
    .maybeSingle();

  if (procErr || !processo) return { ok: false, error: procErr?.message ?? 'Processo não encontrado.' };

  const nome_condominio = String((processo as any).nome_condominio ?? '').trim();
  if (!nome_condominio) {
    return { ok: true, record: null, hasOwnRecord: false };
  }

  const { data: own } = await supabase
    .from('processo_card_checklist_legal')
    .select('id, processo_id, nome_condominio, respostas_json, arquivos_json, completo, updated_at')
    .eq('processo_id', processoId)
    .maybeSingle();

  if (own) {
    return {
      ok: true,
      hasOwnRecord: true,
      record: {
        processo_id: String((own as any).processo_id),
        nome_condominio: String((own as any).nome_condominio),
        respostas_json: (own as any).respostas_json ?? {},
        arquivos_json: (own as any).arquivos_json ?? {},
        completo: Boolean((own as any).completo),
        updated_at: String((own as any).updated_at ?? new Date().toISOString()),
      },
    };
  }

  const { data: reusedComplete } = await supabase
    .from('processo_card_checklist_legal')
    .select('processo_id, nome_condominio, respostas_json, arquivos_json, completo, updated_at')
    .eq('nome_condominio', nome_condominio)
    .eq('completo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const reused = reusedComplete
    ? reusedComplete
    : (
        await supabase
          .from('processo_card_checklist_legal')
          .select('processo_id, nome_condominio, respostas_json, arquivos_json, completo, updated_at')
          .eq('nome_condominio', nome_condominio)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;

  if (!reused) return { ok: true, record: null, hasOwnRecord: false };

  return {
    ok: true,
    hasOwnRecord: false,
    record: {
      processo_id: String((reused as any).processo_id),
      nome_condominio: String((reused as any).nome_condominio),
      respostas_json: (reused as any).respostas_json ?? {},
      arquivos_json: (reused as any).arquivos_json ?? {},
      completo: Boolean((reused as any).completo),
      updated_at: String((reused as any).updated_at ?? new Date().toISOString()),
    },
  };
}

export async function saveChecklistLegalDraft(
  processoId: string,
  respostas_json: ChecklistLegalRespostas,
  arquivos_json: ChecklistLegalArquivos,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: processo } = await supabase.from('processo_step_one').select('nome_condominio').eq('id', processoId).maybeSingle();
  const nome_condominio = String((processo as any)?.nome_condominio ?? '').trim();
  if (!nome_condominio) return { ok: false, error: 'Nome do condomínio não encontrado.' };

  const completo = ENFORCE_CHECKLIST_LEGAL_REQUIRED
    ? computeChecklistLegalCompleto(respostas_json, arquivos_json)
    : false;

  const { error } = await supabase.from('processo_card_checklist_legal').upsert(
    {
      processo_id: processoId,
      nome_condominio,
      respostas_json,
      arquivos_json,
      completo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'processo_id' },
  );

  if (error) return { ok: false, error: error.message };

  try {
    const autorNome = await resolveAutorNome(supabase, user.id);
    await supabase.from('processo_card_eventos').insert({
      processo_id: processoId,
      autor_id: user.id,
      autor_nome: autorNome,
      etapa_painel: 'step_4',
      tipo: 'checklist_legal_save',
      descricao: 'Checklist Legal salva',
      detalhes: { completo },
    });
  } catch {
    // não bloquear fluxo
  }

  revalidatePath('/painel-novos-negocios');
  return { ok: true };
}

export async function concluirChecklistLegal(
  processoId: string,
  respostas_json: ChecklistLegalRespostas,
  arquivos_json: ChecklistLegalArquivos,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const completo = computeChecklistLegalCompleto(respostas_json, arquivos_json);
  if (ENFORCE_CHECKLIST_LEGAL_REQUIRED && !completo) {
    return { ok: false, error: 'Checklist Legal não está 100% preenchido.' };
  }
  const r = await saveChecklistLegalDraft(processoId, respostas_json, arquivos_json);
  if (!r.ok) return r;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  try {
    const autorNome = await resolveAutorNome(supabase, user.id);
    await supabase.from('processo_card_checklist_legal').update({ completo: true, updated_at: new Date().toISOString() }).eq('processo_id', processoId);
    await supabase.from('processo_card_eventos').insert({
      processo_id: processoId,
      autor_id: user.id,
      autor_nome: autorNome,
      etapa_painel: 'step_4',
      tipo: 'checklist_legal_complete',
      descricao: 'Checklist Legal concluído',
      detalhes: {},
    });
  } catch {
    // não bloquear
  }

  revalidatePath('/painel-novos-negocios');
  return { ok: true };
}

