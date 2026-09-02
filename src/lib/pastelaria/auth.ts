import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function getPastelariaAuthUser(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; user: User } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  }

  return { supabase, user };
}

export function isAuthResponse(
  value: { supabase: Awaited<ReturnType<typeof createClient>>; user: User } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
