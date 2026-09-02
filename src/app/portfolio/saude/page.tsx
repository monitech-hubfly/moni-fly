import Link from 'next/link';
import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import { montarBlocosPortfolioSaude } from '@/lib/kanban/portfolio-saude-blocos';
import type {
  PortfolioSaudeFranqueadoBase,
  PortfolioSaudeRow,
} from '@/lib/kanban/portfolio-saude-types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { PortfolioSaudeClient } from './PortfolioSaudeClient';

export const dynamic = 'force-dynamic';

function mapRow(raw: Record<string, unknown>): PortfolioSaudeRow {
  return {
    card_id: String(raw.card_id ?? ''),
    titulo: String(raw.titulo ?? ''),
    rede_franqueado_id: raw.rede_franqueado_id != null ? String(raw.rede_franqueado_id) : null,
    franqueado_nome: raw.franqueado_nome != null ? String(raw.franqueado_nome) : null,
    n_franquia: raw.n_franquia != null ? String(raw.n_franquia) : null,
    fase_slug: raw.fase_slug != null ? String(raw.fase_slug) : null,
    fase_nome: raw.fase_nome != null ? String(raw.fase_nome) : null,
    fase_ordem: Number(raw.fase_ordem ?? 0),
    acoplamento_concluido: Boolean(raw.acoplamento_concluido),
    credito_terreno_ok: Boolean(raw.credito_terreno_ok),
    contabilidade_ok: Boolean(raw.contabilidade_ok),
    juridico_ok: Boolean(raw.juridico_ok),
    capital_ok: Boolean(raw.capital_ok),
    credito_obra_ok: Boolean(raw.credito_obra_ok),
    capital_aplicavel: Boolean(raw.capital_aplicavel),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    data_step3_opcao: raw.data_step3_opcao != null ? String(raw.data_step3_opcao) : null,
    data_step5_comite: raw.data_step5_comite != null ? String(raw.data_step5_comite) : null,
    data_step7_contrato: raw.data_step7_contrato != null ? String(raw.data_step7_contrato) : null,
  };
}

function mapFranqueado(raw: Record<string, unknown>): PortfolioSaudeFranqueadoBase {
  return {
    rede_franqueado_id: String(raw.id ?? ''),
    franqueado_nome: raw.nome_completo != null ? String(raw.nome_completo) : null,
    n_franquia: raw.n_franquia != null ? String(raw.n_franquia) : null,
    ordem: Number(raw.ordem ?? 0),
  };
}

export default async function PortfolioSaudePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);

  if (!isRedeStaffRole(role)) redirect('/portfolio');

  let blocos = montarBlocosPortfolioSaude([], []);
  let erro: string | null = null;

  try {
    const admin = createAdminClient();
    const [frRes, cardRes] = await Promise.all([
      admin.from('rede_franqueados').select('id, n_franquia, nome_completo, ordem').order('ordem'),
      admin.from('v_portfolio_saude').select('*').order('fase_ordem', { ascending: false }),
    ]);

    if (frRes.error) {
      erro = frRes.error.message;
    } else if (cardRes.error) {
      erro = cardRes.error.message;
    } else {
      const franqueados = (frRes.data ?? [])
        .map((r) => mapFranqueado(r as Record<string, unknown>))
        .filter((f) => f.rede_franqueado_id);
      const cards = (cardRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>));
      blocos = montarBlocosPortfolioSaude(franqueados, cards);
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : 'Serviço indisponível (service role).';
  }

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-6">
          <Link href="/portfolio" className="text-sm font-medium text-moni-primary hover:underline">
            ← Funil Portfolio
          </Link>
          <span className="text-stone-300">/</span>
          <h1 className="text-sm font-semibold text-stone-800">Painel de saúde — Portfolio</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <p className="mb-6 text-sm text-stone-600">
          Status das esteiras paralelas por unidade de franquia. Cada bloco agrupa os empreendimentos ativos do
          franqueado no Funil Portfólio; unidades sem card em andamento aparecem em branco.
        </p>

        {erro ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Não foi possível carregar o painel: {erro}. Confirme que a migration{' '}
            <code className="rounded bg-red-100 px-1">211_v_portfolio_saude</code> foi aplicada em PROD.
          </p>
        ) : (
          <PortfolioSaudeClient blocos={blocos} />
        )}
      </main>
    </div>
  );
}
