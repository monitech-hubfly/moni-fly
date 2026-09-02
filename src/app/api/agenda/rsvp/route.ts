/**
 * GET /api/agenda/rsvp?token=xxx&r=sim|nao
 * Endpoint público — não requer autenticação.
 * Registra a resposta e redireciona para página de confirmação.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicAppUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token  = searchParams.get('token')?.trim() ?? '';
  const r      = searchParams.get('r') ?? ''; // 'sim' | 'nao'
  const appUrl = getPublicAppUrl();

  if (!token || !['sim', 'nao'].includes(r)) {
    return NextResponse.redirect(`${appUrl}/rsvp?status=invalido`);
  }

  const admin = createAdminClient();

  const { data: rsvp } = await admin
    .from('gantt_rsvp_externos')
    .select('id, status')
    .eq('token', token)
    .maybeSingle();

  if (!rsvp) {
    return NextResponse.redirect(`${appUrl}/rsvp?status=invalido`);
  }

  const novoStatus = r === 'sim' ? 'aceito' : 'recusado';

  await admin
    .from('gantt_rsvp_externos')
    .update({ status: novoStatus, respondido_em: new Date().toISOString() })
    .eq('id', (rsvp as { id: string }).id);

  return NextResponse.redirect(`${appUrl}/rsvp?status=${novoStatus}`);
}
