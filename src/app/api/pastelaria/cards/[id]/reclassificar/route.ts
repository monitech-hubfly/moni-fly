import { NextResponse } from 'next/server';

import { fetchAreaNome, registrarLogPastelaria } from '@/lib/pastelaria/audit';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';

import type { ReclassificarPastelariaCardBody } from '@/lib/pastelaria/types';



export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {

    const auth = await getPastelariaAuthUser();

    if (isAuthResponse(auth)) return auth;

    const { supabase, user } = auth;

    const { id } = await params;



    const body = (await req.json()) as ReclassificarPastelariaCardBody;

    const action = body?.action;

    const justificativa = body?.justificativa?.trim() ?? '';

    const destino = body?.destino?.trim() || null;



    if (action !== 'redirect' && action !== 'return') {

      return NextResponse.json({ error: 'action deve ser redirect ou return.' }, { status: 400 });

    }

    if (!justificativa) {

      return NextResponse.json({ error: 'justificativa é obrigatória.' }, { status: 400 });

    }



    const { data: existing, error: fetchError } = await supabase

      .from('pastelaria_cards')

      .select('id, nome, area_id, reclassificado')

      .eq('id', id)

      .maybeSingle();



    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    if (!existing) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });

    if ((existing as { reclassificado?: boolean }).reclassificado) {

      return NextResponse.json({ error: 'Card já foi reclassificado.' }, { status: 409 });

    }



    const { data: reclassRow, error: reclassError } = await supabase

      .from('pastelaria_reclassificacoes')

      .insert({

        card_id: id,

        action,

        destino,

        justificativa,

        reclassificado_por: user.id,

      })

      .select('id')

      .single();



    if (reclassError) return NextResponse.json({ error: reclassError.message }, { status: 500 });



    const { error: updateError } = await supabase

      .from('pastelaria_cards')

      .update({

        coluna: 'inbox',

        reclassificado: true,

        reclassificado_em: new Date().toISOString(),

        reclassificado_destino: destino,

        reclassificado_justificativa: justificativa,

      })

      .eq('id', id);



    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });



    const log = await registrarPastelariaLog(supabase, {

      card_id: id,

      user_id: user.id,

      acao: 'reclassificado',

      detalhes: {

        action,

        destino,

        justificativa,

        card_nome: (existing as { nome?: string }).nome ?? null,

        reclassificacao_id: reclassRow?.id ?? null,

      },

    });

    if (!log.ok) return NextResponse.json({ error: log.error }, { status: 500 });

    const nomeCard = (existing as { nome?: string }).nome ?? 'Pastel';
    const descricaoReclass =
      action === 'redirect'
        ? `Redirecionou pastel "${nomeCard}" para ${destino ?? '—'}`
        : `Devolveu pastel "${nomeCard}" ao solicitante`;

    void registrarLogPastelaria({
      supabase,
      user,
      area: await fetchAreaNome(supabase, (existing as { area_id?: string | null }).area_id),
      entidade: 'pastelaria_reclassificacao',
      entidade_id: reclassRow?.id ?? id,
      operacao: 'UPDATE',
      valor_novo: { action, destino, justificativa },
      descricao: descricaoReclass,
    });

    return NextResponse.json({ ok: true, action, destino });

  } catch (e) {

    console.error('[pastelaria/cards/[id]/reclassificar] POST', e);

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });

  }

}

