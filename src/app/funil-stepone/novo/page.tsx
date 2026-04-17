import { guardLoginRequired } from '@/lib/auth-guard';
import { getPermissoes } from '@/lib/permissoes-server';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NovoCardForm } from './NovoCardForm';

export default async function NovoCardPage() {
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

  const perms = await getPermissoes(user.id);
  if (!perms.pode('criar_cards')) {
    redirect('/funil-stepone');
  }

  // Busca o kanban "Funil Step One"
  const { data: kanban } = await supabase
    .from('kanbans')
    .select('id, nome')
    .eq('nome', 'Funil Step One')
    .eq('ativo', true)
    .single();

  if (!kanban) {
    redirect('/funil-stepone');
  }

  // Busca as fases deste kanban
  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem')
    .eq('kanban_id', kanban.id)
    .eq('ativo', true)
    .order('ordem');

  // Busca franqueados da rede para auto-preenchimento do título
  // Admin/consultor vê todos; frank vê todos mas vai usar o próprio
  const { data: franqueados } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo, area_atuacao')
    .order('n_franquia', { ascending: true });

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white" style={{ borderBottom: '0.5px solid var(--moni-border-default)' }}>
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4 sm:px-6">
          <Link href="/funil-stepone" className="text-sm text-moni-primary hover:underline">
            ← Voltar ao Kanban
          </Link>
          <span className="text-stone-400">/</span>
          <h1 className="text-lg font-semibold text-stone-800">Novo Card</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div
          className="bg-white p-4 sm:p-6"
          style={{
            borderRadius: 'var(--moni-radius-lg)',
            border: '0.5px solid var(--moni-border-default)',
            boxShadow: 'var(--moni-shadow-card)',
          }}
        >
          <h2 className="mb-6 text-xl font-bold text-stone-800">Criar novo card no Funil Step One</h2>
          <NovoCardForm
            kanbanId={kanban.id}
            fases={fases || []}
            franqueados={franqueados || []}
            isAdmin={isAdmin}
          />
        </div>
      </main>
    </div>
  );
}
