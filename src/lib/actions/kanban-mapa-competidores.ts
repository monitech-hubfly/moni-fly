'use server';

import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import { verifyProcessoCasasAccess } from '@/lib/zap-save-casas';

export type MapaCompetidoresChecklistData =
  | {
      ok: true;
      processoId: string;
      casas: CasaRow[];
      cidadeInicial: string;
      estadoInicial: string;
      ultimaValidacaoCasasManuaisEm: string | null;
    }
  | { ok: false; error: string };

export async function carregarMapaCompetidoresChecklist(
  processoId: string,
): Promise<MapaCompetidoresChecklistData> {
  const pid = String(processoId ?? '').trim();
  if (!pid) return { ok: false, error: 'Processo Step One não vinculado.' };

  const access = await verifyProcessoCasasAccess(pid);
  if (!access.ok) return { ok: false, error: access.error };

  const { data: processo, error: errProc } = await access.supabase
    .from('processo_step_one')
    .select('id, cidade, estado, ultima_validacao_casas_manuais_em')
    .eq('id', pid)
    .maybeSingle();

  if (errProc) return { ok: false, error: errProc.message };
  if (!processo) return { ok: false, error: 'Processo não encontrado.' };

  const { data: casasData, error: errCasas } = await access.supabase
    .from('listings_casas')
    .select(
      'id, cidade, foto_url, status, condominio, localizacao_condominio, quartos, banheiros, vagas, piscina, marcenaria, preco, area_casa_m2, preco_m2, estado, compatibilidade_moni, data_publicacao, data_despublicado, link, manual',
    )
    .eq('processo_id', pid)
    .order('created_at', { ascending: false });

  if (errCasas) return { ok: false, error: errCasas.message };

  const p = processo as {
    id: string;
    cidade: string | null;
    estado: string | null;
    ultima_validacao_casas_manuais_em: string | null;
  };

  return {
    ok: true,
    processoId: p.id,
    casas: (casasData ?? []) as CasaRow[],
    cidadeInicial: p.cidade ?? '',
    estadoInicial: p.estado ?? '',
    ultimaValidacaoCasasManuaisEm: p.ultima_validacao_casas_manuais_em ?? null,
  };
}
