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

  try {
    const { data: condominios, error: erroCondominios } = await supabase
      .from('condominios')
      .select('*')
      .order('nome', { ascending: true });
    if (erroCondominios) throw new Error(erroCondominios.message);

    const linhas = [];
    for (const row of condominios ?? []) {
      try {
        linhas.push(toCondominioRow(row as Record<string, unknown>));
      } catch (falha) {
        console.error('[book-empreendimento] condomínio ignorado', falha);
      }
    }
    const opcoes = filtrarLinhasEmBrancoCondominios(linhas);

    const { data: kanbans, error: erroKanbans } = await supabase
      .from('kanbans')
      .select('id, nome')
      .order('nome', { ascending: true });
    if (erroKanbans) throw new Error(erroKanbans.message);

    const funis: FunilLivroOpcao[] = (kanbans ?? [])
      .map((row) => ({
        id: String((row as { id?: string }).id ?? ''),
        nome: String((row as { nome?: string | null }).nome ?? '').trim(),
      }))
      .filter((funil) => funil.id && funil.nome && !isKanbanIdInterno(funil.id));

    return <BookDoEmpreendimentoGerador condominios={opcoes} funis={funis} />;
  } catch (falha) {
    const digest = typeof falha === 'object' && falha && 'digest' in falha ? String((falha as { digest?: unknown }).digest) : '';
    if (digest.startsWith('NEXT_')) throw falha;
    console.error('[book-empreendimento]', falha);
    const mensagem = falha instanceof Error ? falha.message : 'Não foi possível carregar o book.';
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-xl text-[var(--moni-text-primary)]" style={{ fontFamily: 'var(--moni-font-display)' }}>
          Book do Empreendimento
        </h1>
        <p className="mt-3 text-sm text-[var(--moni-text-secondary)]" style={{ fontFamily: 'var(--moni-font-sans)' }}>
          Não foi possível carregar as informações. {mensagem}
        </p>
      </div>
    );
  }
}
