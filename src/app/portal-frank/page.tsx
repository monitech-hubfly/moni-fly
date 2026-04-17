import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchPeriodosValidadosFrank, fetchPortalFrankCards } from '@/lib/portal-frank/fetch-portal-cards';
import {
  REDE_SELECT_FIELDS,
  redePrefillParaPayload,
  redeSqlRowParaPrefill,
} from '@/lib/portal-frank/rede-cadastro-types';
import type { RedeFrankCadastroPayload } from '@/lib/portal-frank/rede-cadastro-types';
import { obterPeriodoValidacaoPendente } from '@/lib/portal-frank/validacao-trimestral';
import { ensureNotificacaoValidacaoFrank } from './actions';
import { PortalFrankHome } from './PortalFrankHome';

export const dynamic = 'force-dynamic';

function isFrankRole(role: string | null | undefined) {
  const r = String(role ?? '').toLowerCase();
  return r === 'frank' || r === 'franqueado';
}

export default async function PortalFrankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/portal-frank/login');

  const { data: prof } = await supabase
    .from('profiles')
    .select('role, rede_franqueado_id')
    .eq('id', user.id)
    .maybeSingle();
  const profRow = prof as { role?: string | null; rede_franqueado_id?: string | null } | null;
  const role = profRow?.role;
  if (!isFrankRole(role)) {
    redirect('/login?motivo=portal_apenas_franqueado');
  }

  const redeId =
    profRow?.rede_franqueado_id != null && String(profRow.rede_franqueado_id).trim() !== ''
      ? String(profRow.rede_franqueado_id)
      : null;

  const periodosValidados = await fetchPeriodosValidadosFrank(supabase, user.id);
  const pendente = obterPeriodoValidacaoPendente(new Date(), periodosValidados);
  const bloqueioValidacao = pendente && redeId ? pendente : null;

  if (bloqueioValidacao) {
    await ensureNotificacaoValidacaoFrank(bloqueioValidacao.periodo);
  }

  let redeValidacaoInicial: RedeFrankCadastroPayload | null = null;
  if (bloqueioValidacao && redeId) {
    const { data: rrow } = await supabase
      .from('rede_franqueados')
      .select(REDE_SELECT_FIELDS)
      .eq('id', redeId)
      .maybeSingle();
    redeValidacaoInicial = redePrefillParaPayload(
      redeSqlRowParaPrefill((rrow as Record<string, unknown> | null) ?? null),
    );
  }

  const cards = await fetchPortalFrankCards(supabase, user.id);
  return (
    <PortalFrankHome
      initialCards={cards}
      bloqueioValidacao={bloqueioValidacao}
      redeValidacaoInicial={redeValidacaoInicial}
    />
  );
}
