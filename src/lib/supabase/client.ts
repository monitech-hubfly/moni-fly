import { createBrowserClient } from '@supabase/ssr';

// Singleton: todas as chamadas retornam a mesma instância.
// Com apenas UM cliente no browser, o navigatorLock padrão (Web Locks API)
// nunca tem contenção — não há outro cliente para "roubar" a trava.
// O processLock foi removido: ele é projetado para servidores (Node.js) e
// pode causar falhas silenciosas na primeira autenticação no browser.
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (_client) return _client;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return _client;
}
