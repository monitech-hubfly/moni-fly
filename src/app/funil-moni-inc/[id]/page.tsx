import { guardLoginRequired } from '@/lib/auth-guard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CardDetailClient } from './CardDetailClient';

export default async function FunilMoniIncCardDetailPage({ params }: { params: { id: string } }) {
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
  const isAdmin = role === 'admin' || role === 'consultor' || role === 'supervisor' || role === 'team';

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
            href="/funil-moni-inc"
            className="mt-4 inline-block text-sm text-moni-primary hover:underline"
          >
            ← Voltar ao Kanban
          </Link>
        </div>
      </div>
    );
  }

  const { data: kanbanRow } = await supabase
    .from('kanbans')
    .select('nome')
    .eq('id', (cardRaw as { kanban_id: string }).kanban_id)
    .maybeSingle();
  if (kanbanRow?.nome !== 'Funil Moní INC') {
    redirect('/funil-moni-inc');
  }

  if (!isAdmin && cardRaw.franqueado_id !== user.id) {
    redirect('/funil-moni-inc');
  }

  const { data: franqueadoProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', cardRaw.franqueado_id)
    .single();

  const card = {
    ...cardRaw,
    kanban_fases: Array.isArray(cardRaw.kanban_fases)
      ? cardRaw.kanban_fases[0] || null
      : cardRaw.kanban_fases,
    profiles: franqueadoProfile ?? null,
  };

  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias')
    .eq('kanban_id', card.kanban_id)
    .eq('ativo', true)
    .order('ordem');

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/funil-moni-inc" className="mb-4 inline-block text-sm text-moni-primary hover:underline">
          ← Voltar ao Kanban
        </Link>
        <CardDetailClient card={card} fases={fases || []} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
