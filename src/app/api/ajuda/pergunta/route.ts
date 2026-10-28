import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { quemSouValido } from '@/lib/faq/remetente-perfil';

function nomeCampo(raw: unknown): string | null {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > 80) return null;
  return s;
}

function emailCampo(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.length < 5 || s.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pergunta?: string;
      nome?: string;
      sobrenome?: string;
      email?: string;
      quemSou?: string;
      quemSouOutro?: string;
    };
    const nome = nomeCampo(body.nome);
    const sobrenome = nomeCampo(body.sobrenome);
    const email = emailCampo(body.email);
    const quemSou = String(body.quemSou ?? '').trim();
    const quemSouOutro = String(body.quemSouOutro ?? '').trim().replace(/\s+/g, ' ');
    if (!nome || !sobrenome) {
      return NextResponse.json({ error: 'Informe nome e sobrenome.' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }
    if (!quemSouValido(quemSou)) {
      return NextResponse.json({ error: 'Informe quem você é.' }, { status: 400 });
    }
    if (quemSou === 'Outro' && (quemSouOutro.length < 2 || quemSouOutro.length > 80)) {
      return NextResponse.json({ error: 'Descreva quem você é.' }, { status: 400 });
    }
    const pergunta = String(body.pergunta ?? '').trim();
    if (pergunta.length < 8) {
      return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 });
    }
    if (pergunta.length > 2000) {
      return NextResponse.json({ error: 'A pergunta passou do limite.' }, { status: 400 });
    }

    let createdBy: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
        createdBy = profile?.id ? String(profile.id) : null;
      }
    } catch {
      createdBy = null;
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
      remetente_nome: nome,
      remetente_sobrenome: sobrenome,
      remetente_email: email,
      remetente_perfil: quemSou,
      remetente_perfil_outro: quemSou === 'Outro' ? quemSouOutro : null,
      created_by: createdBy,
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
