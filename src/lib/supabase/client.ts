import { createBrowserClient } from '@supabase/ssr';
import { processLock } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // O navigatorLock padrao (Web Locks API) rouba a trava com { steal: true } apos timeout,
      // e as requisicoes que estavam esperando falham com
      // "Lock broken by another request with the 'steal' option" (Carometro, Backlog, Agenda).
      // processLock serializa a renovacao de sessao em memoria, sem roubo de trava.
      lock: processLock,
    },
  });
}
