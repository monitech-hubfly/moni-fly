import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'processo-docs';

type WebhookPayload = {
  event?: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        name?: string;
        files?: { signed?: string; original?: string };
      };
    };
  };
};

export async function POST(req: Request) {
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.event?.type;
  const dataObject = payload.event?.data?.object;

  if (eventType !== 'document.finished' || !dataObject?.id) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const autentiqueDocId = dataObject.id;
  const signedUrl = dataObject.files?.signed;

  try {
    const supabase = createAdminClient();
    const { data: instance, error: findError } = await supabase
      .from('document_instances')
      .select('id, processo_id, step, status')
      .eq('autentique_document_id', autentiqueDocId)
      .single();

    if (findError || !instance) {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    if (instance.status === 'assinado') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    let arquivoAssinadoPath: string | null = null;
    if (signedUrl) {
      try {
        const apiKey = process.env.AUTENTIQUE_API_KEY;
        const res = await fetch(signedUrl, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const fileName = `assinado_${Date.now()}.pdf`;
          const storagePath = `processos/${instance.processo_id}/step${instance.step}/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buf, { contentType: 'application/pdf', upsert: false });
          if (!uploadError) arquivoAssinadoPath = storagePath;
        }
      } catch {
        // Continua sem arquivo assinado; status será atualizado
      }
    }

    await supabase
      .from('document_instances')
      .update({
        status: 'assinado',
        assinatura_status: 'completed',
        arquivo_assinado_path: arquivoAssinadoPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id);

    const { data: processo } = await supabase
      .from('processo_step_one')
      .select('user_id, cidade, estado')
      .eq('id', instance.processo_id)
      .single();

    const cidade = processo?.cidade ?? '';
    const estado = processo?.estado ?? '';
    const mensagem = `Documento da etapa ${instance.step} do processo ${cidade}${estado ? ` - ${estado}` : ''} foi assinado no Autentique.`;

    const userIdsToNotify = new Set<string>();

    if (processo?.user_id) {
      const { data: frankProfile } = await supabase
        .from('profiles')
        .select('consultor_id')
        .eq('id', processo.user_id)
        .single();
      if (frankProfile?.consultor_id) userIdsToNotify.add(frankProfile.consultor_id);
    }

    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    admins?.forEach((a) => userIdsToNotify.add(a.id));

    for (const userId of Array.from(userIdsToNotify)) {
      await supabase.from('alertas').insert({
        user_id: userId,
        tipo: 'documento_assinado',
        mensagem,
        lido: false,
      });
    }
  } catch {
    // Não falha o webhook; log em produção
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
