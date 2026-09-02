import { NextResponse } from 'next/server';
import { fetchAreaNome, registrarLogPastelaria } from '@/lib/pastelaria/audit';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';

export async function POST(req: Request) {
  try {
    const auth = await getPastelariaAuthUser();
    if (isAuthResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = (await req.json()) as { area_id?: string; nome?: string };
    const areaId = body?.area_id?.trim();
    const nome = body?.nome?.trim();

    if (!areaId) {
      return NextResponse.json({ error: 'area_id é obrigatório.' }, { status: 400 });
    }
    if (!nome) {
      return NextResponse.json({ error: 'nome é obrigatório.' }, { status: 400 });
    }

    const { data: maxRow } = await supabase
      .from('area_pessoas')
      .select('ordem')
      .eq('area_id', areaId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    const ordem = Number((maxRow as { ordem?: number } | null)?.ordem ?? -1) + 1;

    const { data, error } = await supabase
      .from('area_pessoas')
      .insert({
        area_id: areaId,
        nome,
        ativo: true,
        ordem,
      })
      .select('id, nome, area_id')
      .single();

    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        return NextResponse.json(
          { error: 'Já existe uma pessoa com este nome nesta área.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const log = await registrarPastelariaLog(supabase, {
      card_id: null,
      user_id: user.id,
      acao: 'pessoa_adicionada',
      detalhes: { nome, area_id: areaId },
    });
    if (!log.ok) console.error('[area-pessoas] POST log', log.error);

    const pessoa = data as { id: string; nome: string; area_id: string };
    void registrarLogPastelaria({
      supabase,
      user,
      area: await fetchAreaNome(supabase, areaId),
      entidade: 'area_pessoas',
      entidade_id: pessoa.id,
      operacao: 'INSERT',
      valor_novo: { nome: pessoa.nome, area_id: pessoa.area_id },
      descricao: `Adicionou responsável "${pessoa.nome}" na área`,
    });

    return NextResponse.json({ pessoa: data }, { status: 201 });
  } catch (e) {
    console.error('[area-pessoas] POST', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
