import Link from 'next/link';
import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  MapeamentoPastelariaTable,
  type MapeamentoPessoaRow,
  type MapeamentoUsuarioOption,
} from './MapeamentoPastelariaTable';

export const dynamic = 'force-dynamic';

type AreaJoin = { nome: string | null } | { nome: string | null }[] | null;

type AreaPessoaRow = {
  id: string;
  nome: string;
  areas: AreaJoin;
};

type VinculoRow = {
  area_pessoa_id: string;
  user_id: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

function areaNome(areas: AreaJoin): string {
  if (!areas) return '—';
  const row = Array.isArray(areas) ? areas[0] : areas;
  return row?.nome?.trim() || '—';
}

export default async function AdminPastelariaMapeamentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((me as { role?: string } | null)?.role) !== 'admin') {
    redirect('/rede-franqueados');
  }

  const admin = createAdminClient();

  const [{ data: pessoasRaw, error: pessoasErr }, { data: vinculosRaw }, { data: profilesRaw }] =
    await Promise.all([
      supabase
        .from('area_pessoas')
        .select('id, nome, areas(nome)')
        .eq('ativo', true)
        .order('nome'),
      admin.from('area_pessoas_users').select('area_pessoa_id, user_id'),
      admin
        .from('profiles')
        .select('id, email, full_name, role')
        .in('role', ['admin', 'team'])
        .order('full_name'),
    ]);

  if (pessoasErr) {
    return (
      <div className="min-h-screen bg-stone-50">
        <main className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-sm text-red-700" role="alert">
            Erro ao carregar pessoas: {pessoasErr.message}
          </p>
        </main>
      </div>
    );
  }

  const pessoas = (pessoasRaw ?? []) as AreaPessoaRow[];
  const vinculos = (vinculosRaw ?? []) as VinculoRow[];
  const profiles = (profilesRaw ?? []) as ProfileRow[];

  const vinculoByPessoa = new Map(vinculos.map((v) => [v.area_pessoa_id, v.user_id]));
  const pessoaByUser = new Map(vinculos.map((v) => [v.user_id, v.area_pessoa_id]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const rows: MapeamentoPessoaRow[] = pessoas.map((p) => {
    const uid = vinculoByPessoa.get(p.id) ?? null;
    const prof = uid ? profileById.get(uid) : null;
    return {
      areaPessoaId: p.id,
      nome: p.nome,
      areaNome: areaNome(p.areas),
      vinculoUserId: uid,
      vinculoEmail: prof?.email ?? null,
      vinculoFullName: prof?.full_name ?? null,
    };
  });

  const usuarios: MapeamentoUsuarioOption[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role ?? '',
    linkedAreaPessoaId: pessoaByUser.get(p.id) ?? null,
  }));

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/admin" className="text-stone-600 hover:text-stone-900 hover:underline">
            Admin
          </Link>
          <Link
            href="/carometro/pastelaria"
            className="text-stone-600 hover:text-stone-900 hover:underline"
          >
            Pastelaria
          </Link>
        </div>

        <h1 className="text-xl font-bold text-moni-dark">Mapeamento Sirene → Pastelaria</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Vincule cada pessoa do Carômetro (<code className="text-xs">area_pessoas</code>) a um
          usuário do portal (admin ou team). Usado para responsável automático na Pastelaria e
          integração com a Sirene.
        </p>

        <div className="mt-6">
          <MapeamentoPastelariaTable rows={rows} usuarios={usuarios} />
        </div>
      </main>
    </div>
  );
}
