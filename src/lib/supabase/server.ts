import { cache } from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User, UserResponse } from '@supabase/supabase-js';
import { readFreshSessionUser } from '@/lib/supabase/session-from-cookies';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function createRawServerClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Ignore in Server Components
        }
      },
    },
  });
}

/** Uma ida ao Auth por request, só quando o cookie de sessão está perto de expirar. */
const getUserFromAuth = cache(async (cookieKey: string) => {
  void cookieKey;
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createRawServerClient(cookieStore, supabaseUrl, supabaseAnonKey);
  return supabase.auth.getUser();
});

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createRawServerClient(cookieStore, supabaseUrl, supabaseAnonKey);
  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);

  supabase.auth.getUser = async (jwt?: string): Promise<UserResponse> => {
    if (typeof jwt === 'string' && jwt.length > 0) return originalGetUser(jwt);

    const all = cookieStore.getAll();
    const fresh = readFreshSessionUser(all, supabaseUrl);
    if (fresh) {
      return { data: { user: fresh as User }, error: null };
    }

    const hasSession = all.some((cookie) => cookie.name.includes('-auth-token'));
    if (!hasSession) return { data: { user: null }, error: null } as unknown as UserResponse;

    const cookieKey = all
      .filter((cookie) => cookie.name.includes('-auth-token'))
      .map((cookie) => cookie.name)
      .join('|');
    return getUserFromAuth(cookieKey);
  };

  return supabase;
}
