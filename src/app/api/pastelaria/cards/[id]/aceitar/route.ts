import { NextResponse } from 'next/server';

import { fetchAreaNome, registrarLogPastelaria } from '@/lib/pastelaria/audit';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';

import {

  mapPastelariaCardWithArea,

  PASTELARIA_CARD_SELECT,

  type PastelariaCardDbRow,

} from '@/lib/pastelaria/select';

import { resolveResponsavelNomeFromArea } from '@/lib/pastelaria/user-profile';



export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {

    const auth = await getPastelariaAuthUser();

    if (isAuthResponse(auth)) return auth;

    const { supabase, user } = auth;

    const { id } = await params;



    const { data: existing, error: fetchError } = await supabase

      .from('pastelaria_cards')

      .select('id, nome, coluna, area_id')

      .eq('id', id)

      .maybeSingle();



    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    if (!existing) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });



    if ((existing as { coluna: string }).coluna !== 'inbox') {

      return NextResponse.json(

        { error: 'Somente cards na coluna inbox podem ser aceitos.' },

        { status: 400 },

      );

    }



    const areaId = (existing as { area_id?: string | null }).area_id ?? null;

    const responsavel = await resolveResponsavelNomeFromArea(supabase, areaId, user);



    const { data, error } = await supabase

      .from('pastelaria_cards')

      .update({

        coluna: 'mapped',

        responsavel_id: responsavel.responsavel_id,

        responsavel_nome: responsavel.responsavel_nome,

      })

      .eq('id', id)

      .select(PASTELARIA_CARD_SELECT)

      .single();



    if (error) return NextResponse.json({ error: error.message }, { status: 500 });



    const log = await registrarPastelariaLog(supabase, {

      card_id: id,

      user_id: user.id,

      acao: 'aceito',

      detalhes: { responsavel_nome: responsavel.responsavel_nome },

    });

    if (!log.ok) console.error('[pastelaria/cards/[id]/aceitar] log', log.error);

    const nomeCard = (existing as { nome?: string }).nome ?? 'Pastel';
    void registrarLogPastelaria({
      supabase,
      user,
      area: await fetchAreaNome(supabase, areaId),
      entidade: 'pastelaria_card',
      entidade_id: id,
      operacao: 'UPDATE',
      campo: 'coluna',
      valor_anterior: { coluna: 'inbox' },
      valor_novo: { coluna: 'mapped', responsavel_nome: responsavel.responsavel_nome },
      descricao: `Aceitou pastel "${nomeCard}" — responsável: ${responsavel.responsavel_nome ?? '—'}`,
    });

    const card = mapPastelariaCardWithArea(data as PastelariaCardDbRow);

    return NextResponse.json({ card });

  } catch (e) {

    console.error('[pastelaria/cards/[id]/aceitar] POST', e);

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });

  }

}

