import { guardLoginRequired } from '@/lib/auth-guard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CardDetailClient } from './CardDetailClient';

export default async function CardDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role as string) ?? 'frank';
  const isAdmin = role === 'admin' || role === 'consultor';

  // Busca o card — sem join para profiles (FK aponta para auth.users, não public.profiles)
  const { data: cardRaw, error } = await supabase
    .from('kanban_cards')
    .select(
      `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id,
      kanban_id,
      rede_franqueado_id,
      kanban_fases!kanban_cards_fase_id_fkey (
        id,
        nome,
        sla_dias
      )
    `,
    )
    .eq('id', params.id)
    .single();

  if (error || !cardRaw) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">Card não encontrado</h1>
          <Link
            href="/funil-stepone"
            className="mt-4 inline-block text-sm text-moni-primary hover:underline"
          >
            ← Voltar ao Kanban
          </Link>
        </div>
      </div>
    );
  }

  // Verifica permissão: admin vê tudo, franqueado só vê os próprios
  if (!isAdmin && cardRaw.franqueado_id !== user.id) {
    redirect('/funil-stepone');
  }

  // Busca o perfil do responsável separadamente (auth.users → profiles via id)
  const { data: franqueadoProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', cardRaw.franqueado_id)
    .single();

  // Normaliza a fase (PostgREST pode retornar array)
  const card = {
    ...cardRaw,
    kanban_fases: Array.isArray(cardRaw.kanban_fases)
      ? cardRaw.kanban_fases[0] || null
      : cardRaw.kanban_fases,
    profiles: franqueadoProfile ?? null,
  };

  // Busca as fases do kanban para o seletor
  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias')
    .eq('kanban_id', card.kanban_id)
    .eq('ativo', true)
    .order('ordem');

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-6">
          <Link href="/funil-stepone" className="text-sm text-moni-primary hover:underline">
            ← Voltar ao Kanban
          </Link>
          <span className="text-stone-400">/</span>
          <h1 className="text-lg font-semibold text-stone-800">Detalhes do Card</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <CardDetailClient card={card} fases={fases || []} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
