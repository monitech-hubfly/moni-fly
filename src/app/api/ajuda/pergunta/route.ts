import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { pergunta?: string };
    const pergunta = String(body.pergunta ?? '').trim();
    if (pergunta.length < 8) {
      return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 });
    }
    if (pergunta.length > 2000) {
      return NextResponse.json({ error: 'A pergunta passou do limite.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const slug = `pergunta-publica-${randomBytes(6).toString('hex')}`;
    const { error } = await admin.from('faq_articles').insert({
      question: pergunta,
      slug,
      short_answer: null,
      answer: '',
      category_id: null,
      status: 'draft',
      display_order: 0,
      is_featured: false,
      keywords: [],
      synonyms: [],
      visibility: ['frank', 'team', 'admin'],
      responsible_area: null,
    });
    if (error) {
      console.error('Erro ao receber pergunta da Central de Ajuda:', error.message);
      return NextResponse.json({ error: 'Não foi possível enviar agora.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível enviar agora.' }, { status: 500 });
  }
}
