import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const post_id = searchParams.get('post_id');
  if (!post_id) return NextResponse.json({ error: 'post_id obrigatório' }, { status: 400 });

  const { data: rows, error } = await supabase
    .from('community_comments')
    .select('id, user_id, texto, created_at')
    .eq('post_id', post_id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const comments = rows ?? [];

  const userIds = Array.from(
    new Set(
      comments
        .map((c) => (c as { user_id?: string }).user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  let profileById: Record<string, string | null> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    profileById = Object.fromEntries((profiles ?? []).map((p) => [String((p as { id?: string }).id), (p as { full_name?: string | null }).full_name ?? null]));
  }

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: String((c as { id?: string }).id ?? ''),
      user_id: String((c as { user_id?: string }).user_id ?? ''),
      autor_nome: profileById[String((c as { user_id?: string }).user_id ?? '')] ?? null,
      texto: (c as { texto?: string }).texto ?? '',
      created_at: (c as { created_at?: string }).created_at ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const body = (await req.json()) as { post_id?: string; texto?: string };
  const post_id = body?.post_id;
  const texto = body?.texto;
  if (!post_id) return NextResponse.json({ error: 'post_id obrigatório' }, { status: 400 });
  if (!texto || !String(texto).trim()) return NextResponse.json({ error: 'texto obrigatório' }, { status: 400 });

  const { error } = await supabase.from('community_comments').insert({
    post_id,
    user_id: user.id,
    texto: String(texto).trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

