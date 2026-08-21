import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

/** Sem sessão: redireciona para login. */
export function guardLoginRequired(user: User | null): asserts user is User {
  if (!user) redirect('/login');
}
