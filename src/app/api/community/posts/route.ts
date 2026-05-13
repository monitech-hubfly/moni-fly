import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const { data, error } = await supabase
    .from('community_posts')
    .select(
      'id, author_type, tipo, titulo, conteudo, sino_html, franqueado_id, created_at, community_likes(count), community_comments(count)',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = data ?? [];
  const postIds = posts.map((p) => p.id).filter(Boolean) as string[];
  let likedSet = new Set<string>();

  if (postIds.length > 0) {
    const { data: myLikes } = await supabase
      .from('community_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds);

    likedSet = new Set((myLikes ?? []).map((r) => String((r as { post_id?: string }).post_id ?? '')));
  }

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      liked_by_me: likedSet.has(String(p.id)),
    })),
  });
}

