import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const body = (await req.json()) as { post_id?: string };
  const post_id = body?.post_id;
  if (!post_id) return NextResponse.json({ error: 'post_id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('community_likes').insert({ post_id, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const body = (await req.json()) as { post_id?: string };
  const post_id = body?.post_id;
  if (!post_id) return NextResponse.json({ error: 'post_id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('community_likes').delete().eq('post_id', post_id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

