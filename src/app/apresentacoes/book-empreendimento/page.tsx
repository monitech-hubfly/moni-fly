import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';
import { filtrarLinhasEmBrancoCondominios, toCondominioRow } from '@/lib/condominios';
import { isKanbanIdInterno } from '@/lib/kanban/filtrar-kanbans-internos';
import { BookDoEmpreendimentoGerador } from '@/components/livro-empreendimento/BookDoEmpreendimentoGerador';
import type { FunilLivroOpcao } from '@/app/apresentacoes/book-empreendimento/dados-negocio-actions';

export const dynamic = 'force-dynamic';

export default async function BookDoEmpreendimentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  const { data: condominios } = await supabase
    .from('condominios')
    .select('*')
    .order('nome', { ascending: true });

  const opcoes = filtrarLinhasEmBrancoCondominios(
    (condominios ?? []).map((row) => toCondominioRow(row as Record<string, unknown>)),
  );

  const { data: kanbans } = await supabase.from('kanbans').select('id, nome').order('nome', { ascending: true });
  const funis: FunilLivroOpcao[] = (kanbans ?? [])
    .map((row) => ({
      id: String((row as { id?: string }).id ?? ''),
      nome: String((row as { nome?: string | null }).nome ?? '').trim(),
    }))
    .filter((funil) => funil.id && funil.nome && !isKanbanIdInterno(funil.id));

  return <BookDoEmpreendimentoGerador condominios={opcoes} funis={funis} />;
}
