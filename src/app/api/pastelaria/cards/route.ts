import { NextResponse } from 'next/server';

import { fetchAreaNome, registrarLogPastelaria } from '@/lib/pastelaria/audit';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';

import {
  fetchPastelariaCardsRankMeta,
  sortPastelariaCardsByPrioridade,
} from '@/lib/pastelaria/pastelaria-card-rank';
import { mapPastelariaCardWithArea, PASTELARIA_CARD_SELECT, type PastelariaCardDbRow } from '@/lib/pastelaria/select';

import type { CreatePastelariaCardBody } from '@/lib/pastelaria/types';



async function resolveResponsavelFields(

  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,

  body: CreatePastelariaCardBody,

): Promise<{ responsavel_id: string | null; responsavel_nome: string | null }> {

  const responsavelId = body.responsavel_id?.trim() || null;

  const nomeLivre = body.responsavel_nome?.trim() || null;



  if (responsavelId) {

    const { data: pessoa } = await supabase

      .from('area_pessoas')

      .select('nome')

      .eq('id', responsavelId)

      .maybeSingle();

    return {

      responsavel_id: responsavelId,

      responsavel_nome: (pessoa as { nome?: string } | null)?.nome?.trim() ?? nomeLivre,

    };

  }



  return { responsavel_id: null, responsavel_nome: nomeLivre };

}



export async function GET(req: Request) {

  try {

    const auth = await getPastelariaAuthUser();

    if (isAuthResponse(auth)) return auth;

    const { supabase } = auth;



    const { searchParams } = new URL(req.url);

    const areaId = searchParams.get('area_id')?.trim() || null;



    let query = supabase

      .from('pastelaria_cards')

      .select(PASTELARIA_CARD_SELECT)

      .or('reclassificado.is.null,reclassificado.eq.false')

      .order('created_at', { ascending: false });



    if (areaId) {

      query = query.eq('area_id', areaId);

    }



    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });



    const cards = (data ?? []).map((row) => mapPastelariaCardWithArea(row as PastelariaCardDbRow));

    const rankMeta = await fetchPastelariaCardsRankMeta(supabase, cards);
    const sorted = sortPastelariaCardsByPrioridade(cards, rankMeta);

    return NextResponse.json({ cards: sorted });

  } catch (e) {

    console.error('[pastelaria/cards] GET', e);

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });

  }

}



export async function POST(req: Request) {

  try {

    const auth = await getPastelariaAuthUser();

    if (isAuthResponse(auth)) return auth;

    const { supabase, user } = auth;



    const body = (await req.json()) as CreatePastelariaCardBody;

    if (body.source !== 'sirene' && body.source !== 'kanban') {
      return NextResponse.json(
        { error: 'Criação manual desativada. Chamados chegam via Sirene.' },
        { status: 403 },
      );
    }

    const nome = body?.nome?.trim();

    const semanaOrigem = body?.semana_origem?.trim();



    if (!nome) {

      return NextResponse.json({ error: 'nome é obrigatório.' }, { status: 400 });

    }

    if (!semanaOrigem) {

      return NextResponse.json({ error: 'semana_origem é obrigatória.' }, { status: 400 });

    }



    const responsavel = await resolveResponsavelFields(supabase, body);



    const { data, error } = await supabase

      .from('pastelaria_cards')

      .insert({

        nome,

        area_id: body.area_id ?? null,

        estimativa_valor: body.estimativa_valor ?? 1,

        estimativa_unidade: body.estimativa_unidade ?? 'h',

        semana_origem: semanaOrigem,

        source: body.source ?? null,

        opened_by: body.opened_by ?? null,

        coluna: 'mapped',

        created_by: user.id,

        responsavel_id: responsavel.responsavel_id,

        responsavel_nome: responsavel.responsavel_nome,

      })

      .select(PASTELARIA_CARD_SELECT)

      .single();



    if (error) return NextResponse.json({ error: error.message }, { status: 500 });



    const card = mapPastelariaCardWithArea(data as PastelariaCardDbRow);



    const log = await registrarPastelariaLog(supabase, {

      card_id: card.id,

      user_id: user.id,

      acao: 'criado',

    });

    if (!log.ok) {

      console.error('[pastelaria/cards] POST log', log.error);

    }

    void registrarLogPastelaria({
      supabase,
      user,
      area: await fetchAreaNome(supabase, card.area_id),
      entidade: 'pastelaria_card',
      entidade_id: card.id,
      operacao: 'INSERT',
      valor_novo: {
        nome: card.nome,
        area_id: card.area_id,
        estimativa_valor: card.estimativa_valor,
        estimativa_unidade: card.estimativa_unidade,
        semana_origem: card.semana_origem,
        responsavel_nome: card.responsavel_nome,
      },
      descricao: `Criou pastel "${card.nome}"`,
    });

    return NextResponse.json({ card }, { status: 201 });

  } catch (e) {

    console.error('[pastelaria/cards] POST', e);

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });

  }

}

