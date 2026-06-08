import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

import {
  canAccessCondominiosTab,
  canAccessRedeFranqueadosCadastrosCompletos,
  isRedeStaffRole,
} from '@/lib/authz';

import { fetchFranqueadoEmpresasRows } from '@/lib/franqueado-empresas';

import { fetchRedeFranqueadosRows } from '@/lib/rede-franqueados';

import { fetchRedeLoteadoresRows } from '@/lib/rede-loteadores';

import { fetchCondominiosRows } from '@/lib/condominios';

import { contarLinhasSemCard, normalizarStatusEmProcessoRede } from './actions';

import { RedeFranqueadosPageTabs } from './RedeFranqueadosPageTabs';



export const dynamic = 'force-dynamic';



export default async function RedeFranqueadosPage() {

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) redirect('/login');



  const { data: profile } = await supabase.from('profiles').select('role, departamento').eq('id', user.id).single();

  const role = (profile?.role as string) ?? 'frank';
  const departamento = (profile as { departamento?: string | null } | null)?.departamento ?? null;

  const canManage = isRedeStaffRole(role);

  const maskSensitiveColumns = !canAccessRedeFranqueadosCadastrosCompletos(role, departamento);

  const showStaffTabs = isRedeStaffRole(role);

  const showCondominiosTab = canAccessCondominiosTab(role);

  const canManageCondominios = showStaffTabs;



  if (canManage) {

    await normalizarStatusEmProcessoRede();

  }



  const [rows, countResult, loteadoresRows, empresasResult, condominiosRows] = await Promise.all([

    fetchRedeFranqueadosRows(supabase),

    canManage ? contarLinhasSemCard() : Promise.resolve({ ok: true as const, total: 0 }),

    showStaffTabs ? fetchRedeLoteadoresRows(supabase) : Promise.resolve(null),

    showStaffTabs ? fetchFranqueadoEmpresasRows(supabase) : Promise.resolve(null),

    showCondominiosTab ? fetchCondominiosRows(supabase) : Promise.resolve(null),

  ]);

  const linhasSemCard = countResult.ok ? countResult.total : 0;

  const empresasLoadError = showStaffTabs && empresasResult === null;



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

            empresasLoadError={empresasLoadError}

            condominiosRows={condominiosRows}

            showCondominiosTab={showCondominiosTab}

            canManageCondominios={canManageCondominios}

            canManageFranqueados={canManage}

            maskSensitiveColumns={maskSensitiveColumns}

            linhasSemCard={linhasSemCard}

            showDashboard={rows.length > 0}

          />

        ) : (

          <p className="mt-10 text-sm text-red-600">Erro ao carregar a tabela.</p>

        )}

      </main>

    </div>

  );

}
