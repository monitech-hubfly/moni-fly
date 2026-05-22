import { NextResponse } from 'next/server';

import { fetchAreaNome, registrarLogPastelaria } from '@/lib/pastelaria/audit';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { parseHorasUnidade } from '@/lib/pastelaria/converter';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';

import type { PastelariaHorasRow, UpsertPastelariaHorasBody } from '@/lib/pastelaria/types';

import { normalizeSemanaLabel } from '@/lib/pastelaria/week';



export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {

    const auth = await getPastelariaAuthUser();

    if (isAuthResponse(auth)) return auth;

    const { supabase } = auth;

    const { id: cardId } = await params;



    const { data: card, error: cardError } = await supabase

      .from('pastelaria_cards')

      .select('id')

      .eq('id', cardId)

      .maybeSingle();



    if (cardError) return NextResponse.json({ error: cardError.message }, { status: 500 });

    if (!card) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });



    const { data, error } = await supabase

      .from('pastelaria_horas')

      .select('*')

      .eq('card_id', cardId)

      .order('semana', { ascending: true });



    if (error) return NextResponse.json({ error: error.message }, { status: 500 });



    return NextResponse.json({ horas: (data ?? []) as PastelariaHorasRow[] });

  } catch (e) {

    console.error('[pastelaria/cards/[id]/horas] GET', e);

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });

  }

}



export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {

    const auth = await getPastelariaAuthUser();

    if (isAuthResponse(auth)) return auth;

    const { supabase, user } = auth;

    const { id: cardId } = await params;



    const body = (await req.json()) as UpsertPastelariaHorasBody;

    const semana = normalizeSemanaLabel(body?.semana?.trim());



    if (!semana) {

      return NextResponse.json({ error: 'semana é obrigatória.' }, { status: 400 });

    }



    const { data: existingHoras } = await supabase

      .from('pastelaria_horas')

      .select('id')

      .eq('card_id', cardId)

      .eq('semana', semana)

      .maybeSingle();



    const { data: card, error: cardError } = await supabase

      .from('pastelaria_cards')

      .select('id, nome, area_id')

      .eq('id', cardId)

      .maybeSingle();



    if (cardError) return NextResponse.json({ error: cardError.message }, { status: 500 });

    if (!card) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });



    const horasPayload = {

      seg: body.seg ?? 0,

      ter: body.ter ?? 0,

      qua: body.qua ?? 0,

      qui: body.qui ?? 0,

      sex: body.sex ?? 0,

      seg_unidade: parseHorasUnidade(body.seg_unidade),

      ter_unidade: parseHorasUnidade(body.ter_unidade),

      qua_unidade: parseHorasUnidade(body.qua_unidade),

      qui_unidade: parseHorasUnidade(body.qui_unidade),

      sex_unidade: parseHorasUnidade(body.sex_unidade),

    };



    const { data, error } = await supabase

      .from('pastelaria_horas')

      .upsert(

        {

          card_id: cardId,

          semana,

          ...horasPayload,

        },

        { onConflict: 'card_id,semana' },

      )

      .select('*')

      .single();



    if (error) return NextResponse.json({ error: error.message }, { status: 500 });



    const log = await registrarPastelariaLog(supabase, {

      card_id: cardId,

      user_id: user.id,

      acao: 'horas_registradas',

      detalhes: { semana, horas: horasPayload },

    });

    if (!log.ok) console.error('[pastelaria/cards/[id]/horas] log', log.error);

    const cardMeta = card as { nome?: string; area_id?: string | null };
    const valorNovoHoras = { semana, ...horasPayload };
    void registrarLogPastelaria({
      supabase,
      user,
      area: await fetchAreaNome(supabase, cardMeta.area_id),
      entidade: 'pastelaria_horas',
      entidade_id: cardId,
      operacao: existingHoras ? 'UPDATE' : 'INSERT',
      valor_novo: valorNovoHoras,
      descricao: `Registrou horas do pastel "${cardMeta.nome ?? 'Pastel'}" — semana ${semana}`,
    });

    return NextResponse.json({ horas: data as PastelariaHorasRow });

  } catch (e) {

    console.error('[pastelaria/cards/[id]/horas] POST', e);

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });

  }

}


