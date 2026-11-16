import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lerTokenPublico } from '@/lib/formularios/token-publico';
import { buscarCardsPortfolio, carregarCardPortfolio } from '@/lib/formularios/cards-portfolio-busca';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get('token') ?? '').trim();
    const q = String(url.searchParams.get('q') ?? '');
    const id = String(url.searchParams.get('id') ?? '').trim();
    const lido = await lerTokenPublico(token);
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: lido.status });

    const admin = createAdminClient();
    const { data: secoes } = await admin.from('formulario_secoes').select('id').eq('formulario_id', lido.token.formulario_id);
    const secaoIds = (secoes ?? []).map((secao) => String((secao as { id: string }).id));
    if (secaoIds.length === 0) {
      return NextResponse.json({ error: 'Este formulário não vincula card do Portfólio.' }, { status: 403 });
    }
    const { data: campo } = await admin
      .from('formulario_campos')
      .select('id, tipo, config')
      .in('secao_id', secaoIds)
      .or('tipo.eq.card_portfolio,config->>widget.eq.card_portfolio')
      .limit(1);
    if (!campo?.length) {
      return NextResponse.json({ error: 'Este formulário não vincula card do Portfólio.' }, { status: 403 });
    }

    if (id) {
      const card = await carregarCardPortfolio(admin, id);
      return NextResponse.json({ ok: true, cards: card ? [card] : [] });
    }

    const cards = await buscarCardsPortfolio(admin, q);
    return NextResponse.json({ ok: true, cards });
  } catch {
    return NextResponse.json({ error: 'Não foi possível buscar os cards.' }, { status: 500 });
  }
}
