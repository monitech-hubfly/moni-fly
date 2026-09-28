'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type FormularioQualificacaoRow = {
  id: string;
  rede_franqueado_id: string;
  n_franquia: string;
  nome_franqueado_confirmado: string;
  periodo_mes: number;
  periodo_ano: number;
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
};

export type FormularioQualificacaoInput = {
  rede_franqueado_id: string;
  n_franquia: string;
  nome_franqueado_confirmado: string;
  periodo_mes: number;
  periodo_ano: number;
  tem_ponto_comercial: boolean | null;
  endereco_ponto_comercial: string | null;
  numero_colaboradores: number | null;
  contratos_realizados_trimestre: number | null;
  meta_contratos_trimestre: number | null;
  principais_desafios: string | null;
  apoio_necessario: string | null;
  observacoes_adicionais: string | null;
};

export async function salvarFormularioQualificacao(
  input: FormularioQualificacaoInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessão expirada. Faça login novamente.' };

  // Verificar que o n_franquia bate com a rede_franqueado_id informada
  const { data: rede, error: redeErr } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo')
    .eq('id', input.rede_franqueado_id)
    .single();

  if (redeErr || !rede) {
    return { ok: false, error: 'Franqueado não encontrado.' };
  }

  // Verificar correspondência do número de franquia
  if (String(rede.n_franquia ?? '').trim() !== String(input.n_franquia ?? '').trim()) {
    return { ok: false, error: 'O número de franquia informado não corresponde ao cadastro.' };
  }

  // Verificar correspondência do nome (normaliza para lowercase sem acentos para comparação flexível)
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();

  const nomeInformado = normalize(input.nome_franqueado_confirmado ?? '');
  const nomeCadastrado = normalize(rede.nome_completo ?? '');

  if (nomeInformado.length < 3 || !nomeCadastrado.includes(nomeInformado.split(' ')[0])) {
    return {
      ok: false,
      error:
        'O nome informado não corresponde ao cadastro deste número de franquia. Verifique e tente novamente.',
    };
  }

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
