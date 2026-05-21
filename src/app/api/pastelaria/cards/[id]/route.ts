import { NextResponse } from 'next/server';
import { fetchAreaNome, registrarLogPastelaria } from '@/lib/pastelaria/audit';
import { getPastelariaAuthUser, isAuthResponse } from '@/lib/pastelaria/auth';
import { registrarPastelariaLog } from '@/lib/pastelaria/log';
import {
  mapPastelariaCardWithArea,
  PASTELARIA_CARD_SELECT,
  type PastelariaCardDbRow,
} from '@/lib/pastelaria/select';
import type {
  PastelariaCardRow,
  PastelariaColuna,
  PastelariaHorasRow,
  UpdatePastelariaCardBody,
} from '@/lib/pastelaria/types';

const PATCH_FIELDS = [
  'nome',
  'estimativa_valor',
  'estimativa_unidade',
  'area_id',
  'coluna',
  'completed_week',
  'responsavel_id',
  'responsavel_nome',
] as const;

type PatchField = (typeof PATCH_FIELDS)[number];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getPastelariaAuthUser();
    if (isAuthResponse(auth)) return auth;
    const { supabase } = auth;
    const { id } = await params;

    const { data, error } = await supabase
      .from('pastelaria_cards')
      .select(`${PASTELARIA_CARD_SELECT}, pastelaria_horas(*)`)
      .eq('id', id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });

    const row = data as PastelariaCardRow & {
      areas?: { nome: string | null };
      pastelaria_horas?: PastelariaHorasRow[];
    };
    const { pastelaria_horas, ...cardRow } = row;

    return NextResponse.json({
      card: mapPastelariaCardWithArea(cardRow as PastelariaCardDbRow),
      horas: pastelaria_horas ?? [],
    });
  } catch (e) {
    console.error('[pastelaria/cards/[id]] GET', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getPastelariaAuthUser();
    if (isAuthResponse(auth)) return auth;
    const { supabase, user } = auth;
    const { id } = await params;

    const body = (await req.json()) as UpdatePastelariaCardBody;

    const { data: existing, error: fetchError } = await supabase
      .from('pastelaria_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });

    const prev = existing as PastelariaCardRow;
    const patch: Partial<Record<PatchField, string | number | null>> = {};

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) return NextResponse.json({ error: 'nome não pode ser vazio.' }, { status: 400 });
      patch.nome = nome;
    }
    if (body.estimativa_valor !== undefined) patch.estimativa_valor = body.estimativa_valor;
    if (body.estimativa_unidade !== undefined) patch.estimativa_unidade = body.estimativa_unidade;
    if (body.area_id !== undefined) patch.area_id = body.area_id;
    if (body.coluna !== undefined) patch.coluna = body.coluna;
    if (body.completed_week !== undefined) patch.completed_week = body.completed_week;

    if (body.responsavel_id !== undefined || body.responsavel_nome !== undefined) {
      const responsavelId =
        body.responsavel_id === null || body.responsavel_id === ''
          ? null
          : String(body.responsavel_id).trim() || null;

      if (responsavelId) {
        const { data: pessoa, error: pessoaError } = await supabase
          .from('area_pessoas')
          .select('nome')
          .eq('id', responsavelId)
          .maybeSingle();
        if (pessoaError) return NextResponse.json({ error: pessoaError.message }, { status: 500 });
        patch.responsavel_id = responsavelId;
        patch.responsavel_nome =
          (pessoa as { nome?: string } | null)?.nome?.trim() ??
          body.responsavel_nome?.trim() ??
          null;
      } else {
        patch.responsavel_id = null;
        patch.responsavel_nome = body.responsavel_nome?.trim() || null;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pastelaria_cards')
      .update(patch)
      .eq('id', id)
      .select(PASTELARIA_CARD_SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const colunaAlterada =
      patch.coluna !== undefined && patch.coluna !== prev.coluna;
    const outrosAlterados = PATCH_FIELDS.some((field) => {
      if (field === 'coluna') return false;
      if (!(field in patch)) return false;
      return patch[field] !== prev[field];
    });

    if (colunaAlterada) {
      const logColuna = await registrarPastelariaLog(supabase, {
        card_id: id,
        user_id: user.id,
        acao: 'coluna_alterada',
        detalhes: {
          de: prev.coluna,
          para: patch.coluna as PastelariaColuna,
        },
      });
      if (!logColuna.ok) console.error('[pastelaria/cards/[id]] PATCH log coluna', logColuna.error);
    }

    if (outrosAlterados) {
      const logEdit = await registrarPastelariaLog(supabase, {
        card_id: id,
        user_id: user.id,
        acao: 'editado',
      });
      if (!logEdit.ok) console.error('[pastelaria/cards/[id]] PATCH log editado', logEdit.error);
    }

    const updated = data as PastelariaCardRow;
    const areaNome = await fetchAreaNome(supabase, updated.area_id ?? prev.area_id);
    const nomeCard = String(updated.nome ?? prev.nome);

    if (colunaAlterada) {
      void registrarLogPastelaria({
        supabase,
        user,
        area: areaNome,
        entidade: 'pastelaria_card',
        entidade_id: id,
        operacao: 'UPDATE',
        campo: 'coluna',
        valor_anterior: { coluna: prev.coluna },
        valor_novo: { coluna: patch.coluna },
        descricao: `Moveu pastel "${nomeCard}" de ${prev.coluna} para ${patch.coluna}`,
      });
    }

    const responsavelAlterado =
      patch.responsavel_id !== undefined || patch.responsavel_nome !== undefined;
    if (responsavelAlterado) {
      void registrarLogPastelaria({
        supabase,
        user,
        area: areaNome,
        entidade: 'pastelaria_card',
        entidade_id: id,
        operacao: 'UPDATE',
        campo: 'responsavel',
        valor_anterior: { responsavel_nome: prev.responsavel_nome ?? null },
        valor_novo: { responsavel_nome: updated.responsavel_nome ?? null },
        descricao: `Alterou responsável do pastel "${nomeCard}" de ${prev.responsavel_nome ?? '—'} para ${updated.responsavel_nome ?? '—'}`,
      });
    }

    const editFields = [
      'nome',
      'estimativa_valor',
      'estimativa_unidade',
      'area_id',
      'completed_week',
    ] as const;
    const valorAnteriorEdit: Record<string, unknown> = {};
    const valorNovoEdit: Record<string, unknown> = {};
    for (const field of editFields) {
      if (!(field in patch)) continue;
      valorAnteriorEdit[field] = prev[field];
      valorNovoEdit[field] = patch[field];
    }
    if (Object.keys(valorNovoEdit).length > 0) {
      void registrarLogPastelaria({
        supabase,
        user,
        area: areaNome,
        entidade: 'pastelaria_card',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: valorAnteriorEdit,
        valor_novo: valorNovoEdit,
        descricao: `Editou pastel "${nomeCard}"`,
      });
    }

    const card = mapPastelariaCardWithArea(data as PastelariaCardDbRow);
    return NextResponse.json({ card });
  } catch (e) {
    console.error('[pastelaria/cards/[id]] PATCH', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getPastelariaAuthUser();
    if (isAuthResponse(auth)) return auth;
    const { supabase, user } = auth;
    const { id } = await params;

    const { data: existing, error: fetchError } = await supabase
      .from('pastelaria_cards')
      .select('id, nome, area_id, coluna, responsavel_nome')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Card não encontrado.' }, { status: 404 });

    const prevDelete = existing as {
      id: string;
      nome: string;
      area_id: string | null;
      coluna: string;
      responsavel_nome: string | null;
    };

    const log = await registrarPastelariaLog(supabase, {
      card_id: id,
      user_id: user.id,
      acao: 'excluido',
    });
    if (!log.ok) return NextResponse.json({ error: log.error }, { status: 500 });

    const { error } = await supabase.from('pastelaria_cards').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void registrarLogPastelaria({
      supabase,
      user,
      area: await fetchAreaNome(supabase, prevDelete.area_id),
      entidade: 'pastelaria_card',
      entidade_id: id,
      operacao: 'DELETE',
      valor_anterior: {
        nome: prevDelete.nome,
        area_id: prevDelete.area_id,
        coluna: prevDelete.coluna,
        responsavel_nome: prevDelete.responsavel_nome,
      },
      descricao: `Excluiu pastel "${prevDelete.nome}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[pastelaria/cards/[id]] DELETE', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
