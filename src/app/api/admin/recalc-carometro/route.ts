import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { gerarSnapshotCarometro } from '@/lib/carometro/carometro-status-snapshot';

const ADMIN_EMAIL = 'danilo.n@moni.casa';

/**
 * Rota temporária de auditoria e recalculo de snapshots do Carômetro.
 * DELETAR APÓS USO.
 *
 * Aceita autenticação por CRON_SECRET (query param) OU sessão do usuário admin logado.
 *
 * GET /api/admin/recalc-carometro?secret=CRON_SECRET&acao=audit
 * GET /api/admin/recalc-carometro?acao=audit                      ← admin logado no browser
 * GET /api/admin/recalc-carometro?acao=deletar&datas=2026-11-01,2026-11-02
 * GET /api/admin/recalc-carometro?acao=recalcular&datas=2026-11-03
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Auth 1: CRON_SECRET via query param
  const secret = process.env.CRON_SECRET;
  const secretOk = secret && searchParams.get('secret') === secret;

  // Auth 2: sessão do usuário admin logado (cookie de sessão Supabase)
  let sessionOk = false;
  if (!secretOk) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      sessionOk = user?.email === ADMIN_EMAIL;
    } catch {
      sessionOk = false;
    }
  }

  if (!secretOk && !sessionOk) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const acao  = searchParams.get('acao')  ?? 'audit';
  const datas = (searchParams.get('datas') ?? '').split(',').map(d => d.trim()).filter(Boolean);

  const db = createAdminClient();

  // ── AUDIT: mostra snapshots salvos no mês ──────────────────────────────────
  if (acao === 'audit') {
    const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const { data, error } = await db
      .from('carometro_status_diario')
      .select('profile_id, data, sirene, engajamento, indicadores')
      .gte('data', `${mesAtual}-01`)
      .order('data')
      .order('profile_id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type SnapRow = {
      profile_id: string;
      data: string;
      sirene: Record<string, unknown> | null;
      engajamento: Record<string, unknown> | null;
      indicadores: Record<string, unknown> | null;
    };

    const rows = (data ?? []) as SnapRow[];
    const resumo = rows.map(r => ({
      profile_id:   r.profile_id,
      data:         r.data,
      sirene_score: r.sirene?.score ?? null,
      eng_score:    r.engajamento?.score ?? null,
      ind_media:    r.indicadores?.media ?? null,
    }));

    // Agrupa por data para facilitar leitura
    const porData: Record<string, typeof resumo> = {};
    for (const r of resumo) {
      if (!porData[r.data]) porData[r.data] = [];
      porData[r.data].push(r);
    }

    return NextResponse.json({
      total_registros: rows.length,
      datas_no_mes:    Object.keys(porData).sort(),
      por_data:        porData,
    });
  }

  // ── DELETAR: remove snapshots das datas informadas ────────────────────────
  if (acao === 'deletar') {
    if (datas.length === 0) {
      return NextResponse.json({ error: 'Informe datas=YYYY-MM-DD,...' }, { status: 400 });
    }

    const resultados: { data: string; deletados: number; erro?: string }[] = [];

    for (const data of datas) {
      const { error, count } = await db
        .from('carometro_status_diario')
        .delete({ count: 'exact' })
        .eq('data', data);

      if (error) {
        resultados.push({ data, deletados: 0, erro: error.message });
      } else {
        resultados.push({ data, deletados: count ?? 0 });
      }
    }

    return NextResponse.json({ acao: 'deletar', resultados });
  }

  // ── RECALCULAR: recalcula snapshots das datas informadas ──────────────────
  if (acao === 'recalcular') {
    if (datas.length === 0) {
      return NextResponse.json({ error: 'Informe datas=YYYY-MM-DD,...' }, { status: 400 });
    }

    // Busca todos os usuários ativos
    const { data: pessoas, error: pessoasErr } = await db
      .from('area_pessoas')
      .select('profile_id, area_id, nome')
      .eq('ativo', true)
      .not('profile_id', 'is', null)
      .not('area_id', 'is', null);

    if (pessoasErr) return NextResponse.json({ error: pessoasErr.message }, { status: 500 });

    type PessoaRow = { profile_id: string; area_id: string; nome: string | null };
    const usuarios = (pessoas ?? []) as PessoaRow[];

    const resultados: {
      data: string;
      ok: number;
      erros: number;
      falhas: { profile_id: string; erro: string }[];
    }[] = [];

    for (const dataStr of datas) {
      const dataObj = new Date(`${dataStr}T12:00:00`);
      let ok = 0;
      const falhas: { profile_id: string; erro: string }[] = [];

      // Processa em lotes de 10 (mesmo padrão do cron)
      const LOTE = 10;
      for (let i = 0; i < usuarios.length; i += LOTE) {
        const lote = usuarios.slice(i, i + LOTE);
        await Promise.all(
          lote.map(async u => {
            try {
              await gerarSnapshotCarometro(db, u.profile_id, u.area_id, u.nome, dataObj);
              ok++;
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              falhas.push({ profile_id: u.profile_id, erro: msg });
            }
          }),
        );
      }

      resultados.push({ data: dataStr, ok, erros: falhas.length, falhas });
    }

    return NextResponse.json({ acao: 'recalcular', total_usuarios: usuarios.length, resultados });
  }

  return NextResponse.json({ error: `acao inválida: ${acao}. Use audit, deletar ou recalcular.` }, { status: 400 });
}
