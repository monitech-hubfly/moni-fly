import { NextResponse } from 'next/server';
import { computeChecklistLegalCompleto } from '@/lib/checklist-legal/compute-completo';
import { CHECKLIST_LEGAL_FORM_VERSION } from '@/lib/checklist-legal/types';
import type { ChecklistLegalArquivos, ChecklistLegalRespostas } from '@/lib/checklist-legal/types';
import { createAdminClient } from '@/lib/supabase/admin';

async function resolveToken(token: string) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: link, error } = await admin
    .from('checklist_legal_public_tokens')
    .select('card_id, condominio_id, expires_at, revoked_at')
    .eq('token', token)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (error || !link) {
    return { ok: false as const, error: error?.message ?? 'Link inválido ou expirado.' };
  }

  return {
    ok: true as const,
    cardId: String((link as { card_id: string }).card_id),
    condominioId: String((link as { condominio_id?: string | null }).condominio_id ?? '').trim() || null,
    admin,
  };
}

async function loadPayload(admin: ReturnType<typeof createAdminClient>, condominioId: string, cardId: string) {
  const { data: draft } = await admin
    .from('checklist_legal_condominio')
    .select('*')
    .eq('condominio_id', condominioId)
    .eq('status', 'rascunho')
    .eq('card_origem_id', cardId)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draft) return draft;

  const { data: canonical } = await admin
    .from('checklist_legal_condominio')
    .select('*')
    .eq('condominio_id', condominioId)
    .eq('status', 'concluido')
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  return canonical;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = String(params.token ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Token ausente.' }, { status: 400 });

  try {
    const resolved = await resolveToken(token);
    if (!resolved.ok) return NextResponse.json(resolved, { status: 401 });

    let condominioId = resolved.condominioId;
    if (!condominioId) {
      const { data: card } = await resolved.admin
        .from('kanban_cards')
        .select('condominio_id, titulo, quadra, lote, franqueado_id, projeto_id')
        .eq('id', resolved.cardId)
        .maybeSingle();
      condominioId = String((card as { condominio_id?: string | null } | null)?.condominio_id ?? '').trim() || null;
    }

    if (!condominioId) {
      return NextResponse.json(
        { ok: false, error: 'Condomínio não vinculado ao card. Solicite ao time Moní.' },
        { status: 400 },
      );
    }

    const row = await loadPayload(resolved.admin, condominioId, resolved.cardId);
    const { data: cardMeta } = await resolved.admin
      .from('kanban_cards')
      .select('titulo, quadra, lote, franqueado_id, projeto_id')
      .eq('id', resolved.cardId)
      .maybeSingle();

    let franqueadoNome = '';
    const franqId = String((cardMeta as { franqueado_id?: string | null } | null)?.franqueado_id ?? '').trim();
    if (franqId) {
      const { data: franq } = await resolved.admin
        .from('profiles')
        .select('full_name')
        .eq('id', franqId)
        .maybeSingle();
      franqueadoNome = String((franq as { full_name?: string | null } | null)?.full_name ?? '').trim();
    }

    let condominioNome = '';
    const { data: cond } = await resolved.admin
      .from('condominios')
      .select('nome')
      .eq('id', condominioId)
      .maybeSingle();
    condominioNome = String((cond as { nome?: string | null } | null)?.nome ?? '').trim();

    return NextResponse.json({
      ok: true,
      cardId: resolved.cardId,
      condominioId,
      prefill: {
        cadastro_franqueado: franqueadoNome,
        cadastro_condominio: condominioNome,
        cadastro_quadra: String((cardMeta as { quadra?: string | null } | null)?.quadra ?? ''),
        cadastro_lote: String((cardMeta as { lote?: string | null } | null)?.lote ?? ''),
      },
      payload: row
        ? {
            respostas_json: (row as { respostas_json?: ChecklistLegalRespostas }).respostas_json ?? {},
            arquivos_json: (row as { arquivos_json?: ChecklistLegalArquivos }).arquivos_json ?? {},
            status: (row as { status?: string }).status ?? 'rascunho',
            updated_at: (row as { updated_at?: string }).updated_at ?? null,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erro interno.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = String(params.token ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Token ausente.' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    respostas_json?: ChecklistLegalRespostas;
    arquivos_json?: ChecklistLegalArquivos;
    concluir?: boolean;
  } | null;

  try {
    const resolved = await resolveToken(token);
    if (!resolved.ok) return NextResponse.json(resolved, { status: 401 });

    let condominioId = resolved.condominioId;
    if (!condominioId) {
      const { data: card } = await resolved.admin
        .from('kanban_cards')
        .select('condominio_id')
        .eq('id', resolved.cardId)
        .maybeSingle();
      condominioId = String((card as { condominio_id?: string | null } | null)?.condominio_id ?? '').trim() || null;
    }
    if (!condominioId) {
      return NextResponse.json({ ok: false, error: 'Condomínio não vinculado.' }, { status: 400 });
    }

    const respostas = body?.respostas_json ?? {};
    const arquivos = body?.arquivos_json ?? {};
    const concluir = Boolean(body?.concluir);
    if (concluir && !computeChecklistLegalCompleto(respostas, arquivos)) {
      return NextResponse.json({ ok: false, error: 'Checklist incompleto.' }, { status: 400 });
    }

    const admin = resolved.admin;
    const { data: existingDraft } = await admin
      .from('checklist_legal_condominio')
      .select('id, versao')
      .eq('condominio_id', condominioId)
      .eq('status', 'rascunho')
      .eq('card_origem_id', resolved.cardId)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    let checklistId: string;

    if (existingDraft?.id) {
      checklistId = String(existingDraft.id);
      const { error } = await admin
        .from('checklist_legal_condominio')
        .update({
          respostas_json: respostas,
          arquivos_json: arquivos,
          status: concluir ? 'concluido' : 'rascunho',
          updated_at: now,
        })
        .eq('id', checklistId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    } else {
      const { data: maxRow } = await admin
        .from('checklist_legal_condominio')
        .select('versao')
        .eq('condominio_id', condominioId)
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      const versao = Number((maxRow as { versao?: number } | null)?.versao ?? 0) + 1;

      const { data: inserted, error } = await admin
        .from('checklist_legal_condominio')
        .insert({
          condominio_id: condominioId,
          versao,
          status: concluir ? 'concluido' : 'rascunho',
          respostas_json: respostas,
          arquivos_json: arquivos,
          form_version: CHECKLIST_LEGAL_FORM_VERSION,
          card_origem_id: resolved.cardId,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error || !inserted?.id) {
        return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar.' }, { status: 500 });
      }
      checklistId = String(inserted.id);
    }

    await admin.from('checklist_legal_log').insert({
      checklist_id: checklistId,
      condominio_id: condominioId,
      card_id: resolved.cardId,
      acao: concluir ? 'concluido_publico' : 'rascunho_publico',
      actor_label: 'Link público',
      detalhes: { token_prefix: token.slice(0, 8) },
    });

    return NextResponse.json({ ok: true, status: concluir ? 'concluido' : 'rascunho' });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erro interno.' },
      { status: 500 },
    );
  }
}
