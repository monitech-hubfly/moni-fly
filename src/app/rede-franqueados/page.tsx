import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

import {
  canAccessCondominiosTab,
  canAccessRedeFranqueadosCadastrosCompletos,
  isRedeStaffRole,
} from '@/lib/authz';

import { fetchFranqueadoEmpresasRows } from '@/lib/franqueado-empresas';
import { fetchFranqueadoSpeRows } from '@/lib/franqueado-spe';
import { fetchMoniCapitalCadastrosRows } from '@/lib/moni-capital-cadastros';

import { fetchRedeFranqueadosRows } from '@/lib/rede-franqueados';

import { fetchRedeLoteadoresRows } from '@/lib/rede-loteadores';

import { fetchCondominiosRows } from '@/lib/condominios';

import { normalizarStatusEmProcessoRede } from './actions';

import { RedeFranqueadosPageTabs } from './RedeFranqueadosPageTabs';



export const dynamic = 'force-dynamic';



export default async function RedeFranqueadosPage() {

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) redirect('/login');



  const { data: profile } = await supabase
    .from('profiles')
    .select('role, departamento, time, email')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as string) ?? 'frank';
  const departamento = (profile as { departamento?: string | null } | null)?.departamento ?? null;
  const time = (profile as { time?: string | null } | null)?.time ?? null;
  const email = (profile as { email?: string | null } | null)?.email ?? user.email ?? null;

  const canManage = isRedeStaffRole(role);

  const maskSensitiveColumns = !canAccessRedeFranqueadosCadastrosCompletos(
    role,
    departamento,
    time,
    email,
  );

  const showStaffTabs = isRedeStaffRole(role);

  const showCondominiosTab = canAccessCondominiosTab(role);

  const canManageCondominios = showStaffTabs;



  if (canManage) {

    await normalizarStatusEmProcessoRede();

  }



  const [rows, loteadoresRows, empresasResult, spesResult, moniCapitalResult, condominiosRows] = await Promise.all([
    fetchRedeFranqueadosRows(supabase),
    showStaffTabs ? fetchRedeLoteadoresRows(supabase) : Promise.resolve(null),
    showStaffTabs ? fetchFranqueadoEmpresasRows(supabase) : Promise.resolve(null),
    showStaffTabs ? fetchFranqueadoSpeRows(supabase) : Promise.resolve(null),
    showStaffTabs ? fetchMoniCapitalCadastrosRows(supabase) : Promise.resolve(null),
    showCondominiosTab ? fetchCondominiosRows(supabase) : Promise.resolve(null),
  ]);

  const empresasLoadError = showStaffTabs && empresasResult === null;
  const spesLoadError = showStaffTabs && spesResult === null;
  const moniCapitalLoadError = showStaffTabs && moniCapitalResult === null;



  return (

    <div className="min-h-screen bg-[var(--moni-surface-50)]">

      <main className="mx-auto max-w-[1600px] px-6 py-8">

        <header

          className="flex flex-col gap-4 pb-6"

          style={{ borderBottom: '0.5px solid var(--moni-border-default, #e8e2da)' }}

        >

          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary, #0c2633)' }}>

            Rede de Franqueados

          </h1>

        </header>



        {rows ? (

          <RedeFranqueadosPageTabs

            rows={rows}

            loteadoresRows={loteadoresRows}

            showStaffTabs={showStaffTabs}

            empresasRows={empresasResult}

            spesRows={spesResult ?? []}

            empresasLoadError={empresasLoadError}

            spesLoadError={spesLoadError}

            moniCapitalRows={moniCapitalResult}
            moniCapitalLoadError={moniCapitalLoadError}

            condominiosRows={condominiosRows}

            showCondominiosTab={showCondominiosTab}

            canManageCondominios={canManageCondominios}

            canManageFranqueados={canManage}

            maskSensitiveColumns={maskSensitiveColumns}

            showDashboard={rows.length > 0}
          />

        ) : (

          <p className="mt-10 text-sm text-red-600">Erro ao carregar a tabela.</p>

        )}

      </main>

    </div>

  );

}
