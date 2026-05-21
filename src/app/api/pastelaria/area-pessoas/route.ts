import { NextResponse } from 'next/server';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';

export async function GET(req: Request) {
  try {
    const auth = await getPastelariaAuthUser();
    if (isAuthResponse(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(req.url);
    const areaId = searchParams.get('area_id')?.trim();

    if (!areaId) {
      return NextResponse.json({ error: 'area_id é obrigatório.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('area_pessoas')
      .select('id, nome')
      .eq('area_id', areaId)
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ pessoas: data ?? [] });
  } catch (e) {
    console.error('[pastelaria/area-pessoas] GET', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
