import { guardLoginRequired } from '@/lib/auth-guard';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { ConvidarPendentesButton } from './ConvidarPendentesButton';
import { EnviarConviteForm } from './EnviarConviteForm';
import { UsuarioGrupoEcargoCells } from './UsuarioGrupoEcargoCells';

type ProfileRow = {
  id: string;
  full_name: string | null;
  nome_completo: string | null;
  email: string | null;
  departamento: string | null;
  role: string | null;
  cargo: string | null;
  created_at: string | null;
  aprovado_em: string | null;
  invite_token: string | null;
  invite_email_sent_at: string | null;
  invite_accepted_at: string | null;
};

export default async function AdminUsuariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((me as { role?: string } | null)?.role) !== 'admin') {
    redirect('/rede-franqueados');
  }

  const { data: rows } = await supabase
    .from('profiles')
    .select(
      'id, full_name, nome_completo, email, departamento, role, cargo, created_at, aprovado_em, invite_token, invite_email_sent_at, invite_accepted_at',
    )
    .order('created_at', { ascending: false });

  const list = (rows ?? []) as ProfileRow[];

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/admin" className="text-stone-600 hover:text-stone-900 hover:underline">
            Admin
          </Link>
          <Link href="/admin/sla" className="text-stone-600 hover:text-stone-900 hover:underline">
            SLA das fases
          </Link>
        </div>
        <h1 className="text-xl font-bold text-moni-dark">Gerenciar Usuários</h1>
        <p className="mt-1 text-sm text-stone-600">Aprovação, grupo, cargo e convites.</p>
        <div className="mt-4 space-y-4">
          <EnviarConviteForm />
          <ConvidarPendentesButton />
        </div>
        <div className="mt-4 overflow-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-600">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Departamento</th>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Cargo</th>
                <th
                  className="px-3 py-2"
                  title="Convite pendente (token), envio por Resend, ou utilizador que já aceitou o convite e definiu senha."
                >
                  Convite ativo
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-3 py-2">{r.nome_completo ?? r.full_name ?? '—'}</td>
                  <td className="px-3 py-2">{r.email ?? '—'}</td>
                  <td className="px-3 py-2">{r.departamento ?? '—'}</td>
                  <UsuarioGrupoEcargoCells profileId={r.id} role={r.role ?? 'team'} cargo={r.cargo} />
                  <td className="px-3 py-2 text-stone-600">
                    {r.invite_token ? (
                      r.invite_email_sent_at ? (
                        <span className="text-emerald-800" title={String(r.invite_email_sent_at)}>
                          Sim — e-mail enviado (Resend)
                        </span>
                      ) : (
                        <span
                          className="text-amber-900"
                          title="Há link de convite, mas o envio não foi registado. Configure RESEND_API_KEY e RESEND_FROM na Vercel e reenvie o convite."
                        >
                          Link ativo — e-mail não enviado
                        </span>
                      )
                    ) : r.invite_accepted_at ? (
                      <span className="text-sky-900" title={`Convite aceito em ${String(r.invite_accepted_at)}`}>
                        Usuário Logado
                      </span>
                    ) : (
                      <span className="text-stone-400">Não</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
