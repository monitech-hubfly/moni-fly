import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { getCasas, getProgressoUsuario } from '@/lib/universidade/queries';

export const dynamic = 'force-dynamic';

export default async function AdminUniversidadeFranqueadoPage({ params }: { params: { userId: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((prof as { role?: string } | null)?.role);
  if (role !== 'admin' && role !== 'team') redirect('/');

  const targetId = params.userId;
  const { data: target } = await supabase.from('profiles').select('id, full_name, email').eq('id', targetId).maybeSingle();
  if (!target) notFound();

  const [casas, progresso] = await Promise.all([getCasas(supabase), getProgressoUsuario(supabase, targetId)]);
  const porMod = new Map(progresso.map((p) => [p.modulo_id, p]));

  const casaIds = casas.map((c) => c.id);
  const modsByCasa = new Map<string, Array<{ id: string; titulo: string; ordem: number }>>();
  if (casaIds.length > 0) {
    const { data: modRows } = await supabase
      .from('uni_modulos')
      .select('id, casa_id, titulo, ordem')
      .in('casa_id', casaIds);
    for (const row of modRows ?? []) {
      const cid = String((row as { casa_id: string }).casa_id);
      const id = String((row as { id: string }).id);
      const titulo = String((row as { titulo: string }).titulo);
      const ordem = Number((row as { ordem: number }).ordem);
      if (!modsByCasa.has(cid)) modsByCasa.set(cid, []);
      modsByCasa.get(cid)!.push({ id, titulo, ordem });
    }
    for (const arr of modsByCasa.values()) {
      arr.sort((a, b) => a.ordem - b.ordem);
    }
  }

  const blocos = casas.map((casa) => {
    const mods = modsByCasa.get(casa.id) ?? [];
    return (
      <section key={casa.id} className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900">
          Casa {casa.numero}: {casa.titulo}
        </h2>
        {mods.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">Nenhum módulo cadastrado.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-stone-600">
            {mods.map((m) => {
              const pr = porMod.get(m.id);
              return (
                <li key={m.id} className="flex justify-between gap-2 border-b border-stone-100 py-1">
                  <span>{m.titulo}</span>
                  <span className="shrink-0 text-stone-500">{pr?.status ?? 'pendente'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/admin/universidade" className="text-sm text-moni-primary hover:underline">
        ← Gestão Universidade
      </Link>
      <h1 className="text-xl font-semibold text-stone-900">
        Progresso — {(target as { full_name?: string | null }).full_name ?? (target as { email?: string | null }).email}
      </h1>
      <div className="space-y-6">{blocos}</div>
    </div>
  );
}
