'use server';

import { createClient } from '@/lib/supabase/server';
import { createDocument, type AutentiqueSignerInput } from '@/lib/autentique';

const BUCKET = 'processo-docs';

async function resolveHistoricoBaseId(supabase: Awaited<ReturnType<typeof createClient>>, processoId: string) {
  const { data } = await supabase.from('processo_step_one').select('historico_base_id').eq('id', processoId).maybeSingle();
  return (data as { historico_base_id?: string | null } | null)?.historico_base_id ?? processoId;
}

export async function approveDocumentInstance(
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
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
  const role = profile?.role ?? 'frank';
  if (role !== 'consultor' && role !== 'admin') return { ok: false, error: 'Sem permissão.' };

  const { data: instanceBefore } = await supabase
    .from('document_instances')
    .select('processo_id, step')
    .eq('id', instanceId)
    .single();

  const { error } = await supabase
    .from('document_instances')
    .update({
      status: 'aprovado',
      analisado_por: user.id,
      analisado_em: new Date().toISOString(),
      motivo_reprovacao: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId);

  if (error) return { ok: false, error: error.message };

  // Log no card
  try {
    const autorNome = user.email?.split('@')?.[0]?.trim() || 'Usuário';
    if (instanceBefore?.processo_id) {
      const baseId = await resolveHistoricoBaseId(supabase, instanceBefore.processo_id);
      const isStep3 = instanceBefore.step === 3;
      const isStep7 = instanceBefore.step === 7;

      const tipo = isStep3
        ? 'documento_step3_opcao_aprovado'
        : isStep7
          ? 'documento_step7_contrato_aprovado'
          : 'documento_aprovado';
      const descricao = isStep3
        ? 'Opção aprovada (Step 3)'
        : isStep7
          ? 'Contrato aprovado (Step 7)'
          : 'Documento aprovado';

      await supabase.from('processo_card_eventos').insert({
        processo_id: baseId,
        autor_id: user.id,
        autor_nome: autorNome,
        etapa_painel: isStep7 ? 'step_7' : 'step_3',
        tipo,
        descricao,
        detalhes: { instance_id: instanceId, step: instanceBefore.step ?? null },
      });
    }
  } catch {
    // não bloquear
  }
  return { ok: true };
}

export async function rejectDocumentInstance(
  instanceId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
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
  const role = profile?.role ?? 'frank';
  if (role !== 'consultor' && role !== 'admin') return { ok: false, error: 'Sem permissão.' };

  const { data: instanceBefore } = await supabase
    .from('document_instances')
    .select('processo_id, step')
    .eq('id', instanceId)
    .single();

  const { error } = await supabase
    .from('document_instances')
    .update({
      status: 'reprovado',
      analisado_por: user.id,
      analisado_em: new Date().toISOString(),
      motivo_reprovacao: motivo.trim() || 'Reprovado pelo consultor.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId);

  if (error) return { ok: false, error: error.message };

  try {
    const autorNome = user.email?.split('@')?.[0]?.trim() || 'Usuário';
    if (instanceBefore?.processo_id) {
      const baseId = await resolveHistoricoBaseId(supabase, instanceBefore.processo_id);
      const isStep3 = instanceBefore.step === 3;
      const isStep7 = instanceBefore.step === 7;

      const tipo = isStep3
        ? 'documento_step3_opcao_reprovado'
        : isStep7
          ? 'documento_step7_contrato_reprovado'
          : 'documento_reprovado';

      const descricao = isStep3
        ? 'Opção reprovada (Step 3)'
        : isStep7
          ? 'Contrato reprovado (Step 7)'
          : 'Documento reprovado';

      await supabase.from('processo_card_eventos').insert({
        processo_id: baseId,
        autor_id: user.id,
        autor_nome: autorNome,
        etapa_painel: isStep7 ? 'step_7' : 'step_3',
        tipo,
        descricao,
        detalhes: { instance_id: instanceId, step: instanceBefore.step ?? null, motivo: motivo.trim() },
      });
    }
  } catch {
    // não bloquear
  }
  return { ok: true };
}

export async function enviarParaAutentique(
  instanceId: string,
): Promise<{ ok: boolean; error?: string; signingLink?: string | null }> {
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
  const role = profile?.role ?? 'frank';
  if (role !== 'consultor' && role !== 'admin') return { ok: false, error: 'Sem permissão.' };

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('autentique_api_key, full_name')
    .eq('id', user.id)
    .single();
  const apiKey =
    (myProfile?.autentique_api_key as string | null)?.trim() ||
    process.env.AUTENTIQUE_API_KEY?.trim() ||
    null;
  if (!apiKey)
    return {
      ok: false,
      error:
        'Configure sua chave do Autentique em Perfil (ou defina AUTENTIQUE_API_KEY no servidor). O documento será enviado pela sua conta no Autentique.',
    };

  const { data: instance, error: instError } = await supabase
    .from('document_instances')
    .select('id, processo_id, step, status, arquivo_preenchido_path, template_id')
    .eq('id', instanceId)
    .single();

  if (instError || !instance) return { ok: false, error: 'Instância não encontrada.' };
  if (instance.status !== 'aprovado')
    return { ok: false, error: 'Só é possível enviar para assinatura documentos aprovados.' };
  if (!instance.arquivo_preenchido_path)
    return { ok: false, error: 'Documento sem arquivo anexado.' };

  // Log no card
  try {
    const autorNome = (myProfile?.full_name ?? '').trim() || user.email?.split('@')[0] || 'Usuário';
    const baseId = await resolveHistoricoBaseId(supabase, instance.processo_id);
    const isStep3 = instance.step === 3;
    const isStep7 = instance.step === 7;

    const tipo = isStep3
      ? 'documento_step3_opcao_enviado_autentique'
      : isStep7
        ? 'documento_step7_contrato_enviado_autentique'
        : 'documento_enviado_autentique';

    const descricao = isStep3 ? 'Opção enviada para Autentique' : isStep7 ? 'Contrato enviado para Autentique' : 'Documento enviado para Autentique';

    await supabase.from('processo_card_eventos').insert({
      processo_id: baseId,
      autor_id: user.id,
      autor_nome: autorNome,
      etapa_painel: isStep7 ? 'step_7' : 'step_3',
      tipo,
      descricao,
      detalhes: { instance_id: instanceId, status: instance.status },
    });
  } catch {
    // não bloquear
  }

  let signers: AutentiqueSignerInput[] = [];
  if (instance.template_id) {
    const { data: tpl } = await supabase
      .from('document_templates')
      .select('metadados')
      .eq('id', instance.template_id)
      .single();
    const meta =
      (tpl?.metadados as { signers?: Array<{ email?: string; action?: string }> } | null) ?? {};
    if (Array.isArray(meta.signers) && meta.signers.length > 0) {
      signers = meta.signers.map((s) => ({
        email: s.email,
        action: (s.action as 'SIGN') || 'SIGN',
      }));
    }
  }
  if (signers.length === 0 && process.env.AUTENTIQUE_SIGNERS_EMAILS) {
    const emails = process.env.AUTENTIQUE_SIGNERS_EMAILS.split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    signers = emails.map((email) => ({ email, action: 'SIGN' as const }));
  }
  if (signers.length === 0)
    return {
      ok: false,
      error:
        'Configure os signatários no template (metadados.signers) ou em AUTENTIQUE_SIGNERS_EMAILS.',
    };

  const path = instance.arquivo_preenchido_path.replace(/^\//, '');
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(path);
  if (downloadError || !fileData)
    return { ok: false, error: 'Falha ao baixar o arquivo do documento.' };

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const fileName = path.split('/').pop() ?? 'documento.pdf';
  const docName = `Documento Step ${instance.step} - Processo ${instance.processo_id.slice(0, 8)}`;

  const result = await createDocument(apiKey, buffer, fileName, docName, signers);
  if (!result.ok) return { ok: false, error: result.error };

  const signingLink =
    result.document.signatures?.[0]?.link?.short_link ?? null;

  const { error: updateError } = await supabase
    .from('document_instances')
    .update({
      autentique_document_id: result.document.id,
      status: 'enviado_assinatura',
      assinatura_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, signingLink };
}
