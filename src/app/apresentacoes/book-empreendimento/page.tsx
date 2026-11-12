import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';
import { BookDoEmpreendimentoGerador } from '@/components/livro-empreendimento/BookDoEmpreendimentoGerador';

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
    .select('id, nome, cidade, estado')
    .order('nome', { ascending: true });

  const opcoes = (condominios ?? [])
    .map((row) => ({
      id: String(row.id ?? ''),
      nome: String(row.nome ?? '').trim(),
      cidade: row.cidade ? String(row.cidade) : null,
      estado: row.estado ? String(row.estado) : null,
    }))
    .filter((row) => row.id && row.nome);

  return <BookDoEmpreendimentoGerador condominios={opcoes} />;
}
