import { createBrowserClient } from '@supabase/ssr';
import { processLock } from '@supabase/supabase-js';

// Singleton: todas as chamadas retornam a mesma instância.
// Múltiplas instâncias compartilham o mesmo PROCESS_LOCKS global do auth-js,
// causando timeout de fila quando a página cria 7+ clientes simultâneos
// (ex: Pre Bone Day). Um único cliente elimina a contenção.
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (_client) return _client;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // O navigatorLock padrao (Web Locks API) rouba a trava com { steal: true } apos timeout,
      // e as requisicoes que estavam esperando falham com
      // "Lock broken by another request with the 'steal' option" (Carometro, Backlog, Agenda).
      // processLock serializa a renovacao de sessao em memoria, sem roubo de trava.
      lock: processLock,
    },
  });
  return _client;
}
