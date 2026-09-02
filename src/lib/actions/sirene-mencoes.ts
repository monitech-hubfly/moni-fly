'use server';

import { revalidatePath } from 'next/cache';
import {
  extrairIdsMencoes,
  extrairNomesMencionados,
  htmlComentarioParaTextoPlano,
  type PerfilMencao,
} from '@/lib/kanban/mencao-comentario';
import { createClient } from '@/lib/supabase/server';

async function dbParaMencoes(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  } catch {
    return supabase;
  }
}

async function buscarPerfisPorNomesMencionados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nomes: string[],
): Promise<PerfilMencao[]> {
  if (nomes.length === 0) return [];

  const db = await dbParaMencoes(supabase);
  const perfis = new Map<string, PerfilMencao>();
  for (const nome of nomes) {
    // Usa as primeiras 2 palavras com wildcard — evita falha quando o regex capturou palavras extras
    const prefixoBusca = nome.split(/\s+/).slice(0, 2).join(' ');
    const { data: exatos } = await db
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `${prefixoBusca}%`)
      .limit(10);
    for (const row of exatos ?? []) {
      const id = String(row.id);
      const n = String((row as { full_name?: string | null }).full_name ?? '').trim();
      if (n) perfis.set(id, { id, nome: n });
    }
  }

  return [...perfis.values()];
}

function textoPlanoDeEntrada(conteudo: string): string {
  const raw = String(conteudo ?? '').trim();
  if (!raw) return '';
  if (raw.includes('<')) return htmlComentarioParaTextoPlano(raw);
  return raw;
}

export async function resolverMencoesSirene(
  conteudo: string,
): Promise<{ plain: string; mencoesIds: string[] }> {
  const supabase = await createClient();
  const plain = textoPlanoDeEntrada(conteudo);
  if (!plain) return { plain: '', mencoesIds: [] };

  const nomesMencionados = extrairNomesMencionados(plain);
  const perfis = await buscarPerfisPorNomesMencionados(supabase, nomesMencionados);
  const mencoesIds = extrairIdsMencoes(plain, perfis);
  return { plain, mencoesIds };
}

/** Persiste alertas no sino (`alertas`, tipo `mencao_sirene`). */
export async function notificarMencoesSirene(input: {
  mencoesIds: string[];
  plain: string;
  referenciaPath: string;
  contextoTitulo: string;
  autorId: string;
  /** IDs adicionais a notificar (aberto_por, responsaveis_ids, etc.) — sem @menção no texto. */
  extraDestinatarios?: string[];
  sireneChamadoId?: number | null;
}): Promise<void> {
  const supabase = await createClient();
  if (input.sireneChamadoId != null) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: ch } = await admin
      .from('sirene_chamados')
      .select('status, arquivado')
      .eq('id', input.sireneChamadoId)
      .maybeSingle();
    if (ch) {
      const s = String((ch as { status?: string | null }).status ?? '').toLowerCase();
      const fechado = (ch as { arquivado?: boolean }).arquivado === true || s === 'concluido' || s === 'concluído';
      if (fechado) return;
    }
  }
  const { data: profAutor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', input.autorId)
    .maybeSingle();
  const autorNome =
    String((profAutor as { full_name?: string | null } | null)?.full_name ?? '').trim() ||
    'Alguém';

  const titulo = String(input.contextoTitulo ?? '').trim() || 'Chamado Sirene';
  const preview =
    input.plain.length > 120 ? `${input.plain.slice(0, 120)}…` : input.plain;
  const referenciaPath = String(input.referenciaPath ?? '').trim() || '/sirene/chamados';

  // Deduplicação: @mencionados têm alerta específico; extras (sem @) recebem alerta genérico
  const mencionadosSemAutor = input.mencoesIds.filter(uid => uid !== input.autorId);
  const mencionadosSet = new Set(mencionadosSemAutor);
  const extrasSemAutor = (input.extraDestinatarios ?? []).filter(
    uid => uid && uid !== input.autorId && !mencionadosSet.has(uid),
  );

  const adminDb = await dbParaMencoes(supabase);

  // Alertas por @menção
  for (const uid of mencionadosSemAutor) {
    await adminDb.from('alertas').insert({
      user_id: uid,
      tipo: 'mencao_sirene',
      mensagem: `${autorNome} mencionou você em "${titulo}" (Sirene): "${preview}"`,
      referencia_path: referenciaPath,
    });
  }

  // Alertas para demais envolvidos (sem @menção)
  for (const uid of extrasSemAutor) {
    await adminDb.from('alertas').insert({
      user_id: uid,
      tipo: 'kanban_atividade_atualizada',
      mensagem: `${autorNome} adicionou atividade em "${titulo}" (Sirene): "${preview}"`,
      referencia_path: referenciaPath,
    });
  }

  if (mencionadosSemAutor.length > 0) {
    const { enviarEmailsMencaoUsuarios } = await import('@/lib/mencoes/enviar-email-mencao');
    void enviarEmailsMencaoUsuarios({
      userIds: mencionadosSemAutor,
      autorId: input.autorId,
      cardTitulo: titulo,
      autorNome,
      comentarioPreview: preview,
      linkPath: referenciaPath,
    }).catch((err) => console.error('[sirene-mencoes] email menção', err));
  }

  revalidatePath('/alertas');
}
