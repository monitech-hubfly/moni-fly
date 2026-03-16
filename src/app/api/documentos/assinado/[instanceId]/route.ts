import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'processo-docs';

export async function GET(_req: Request, { params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data: instance, error: instError } = await supabase
    .from('document_instances')
    .select('id, processo_id, step, status, arquivo_assinado_path')
    .eq('id', instanceId)
    .single();

  if (instError || !instance)
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  if (instance.status !== 'assinado' || !instance.arquivo_assinado_path) {
    return NextResponse.json({ error: 'Documento assinado não disponível' }, { status: 404 });
  }

  const { data: processo } = await supabase
    .from('processo_step_one')
    .select('user_id')
    .eq('id', instance.processo_id)
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role ?? 'frank';
  const isOwner = processo?.user_id === user.id;
  let isConsultor = false;
  if (role === 'consultor' && processo?.user_id) {
    const { data: frank } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', processo.user_id)
      .eq('consultor_id', user.id)
      .single();
    isConsultor = !!frank;
  }
  const isAdmin = role === 'admin';

  if (!isOwner && !isConsultor && !isAdmin) {
    return NextResponse.json({ error: 'Sem permissão para este documento' }, { status: 403 });
  }

  const path = instance.arquivo_assinado_path.replace(/^\//, '');
  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Falha ao gerar link de download' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
