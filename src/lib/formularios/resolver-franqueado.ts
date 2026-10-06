import { canonicalNFranquiaRede } from '@/lib/rede-franqueados';
import type { SupabaseClient } from '@supabase/supabase-js';

function candidatosNumero(bruto: string): string[] {
  const texto = bruto.trim();
  const lista = new Set<string>();
  if (texto) lista.add(texto);
  const canon = canonicalNFranquiaRede(texto);
  if (canon) lista.add(canon);
  return [...lista];
}

async function buscarPorColuna(
  admin: SupabaseClient,
  coluna: 'unidade' | 'n_franquia',
  valores: string[],
): Promise<string | null> {
  for (const valor of valores) {
    const { data, error } = await admin.from('rede_franqueados').select('id').eq(coluna, valor).limit(1);
    if (error) {
      if (coluna === 'unidade') return null;
      return null;
    }
    const id = (data?.[0] as { id?: string } | undefined)?.id;
    if (id) return String(id);
  }
  return null;
}

/** Modo avulso: resolve a franquia pelo número informado (coluna unidade, depois n_franquia). */
export async function resolverRedeFranqueadoPorNumero(
  admin: SupabaseClient,
  numeroFranquia: string,
): Promise<string | null> {
  const valores = candidatosNumero(numeroFranquia);
  if (valores.length === 0) return null;
  const porUnidade = await buscarPorColuna(admin, 'unidade', valores);
  if (porUnidade) return porUnidade;
  return buscarPorColuna(admin, 'n_franquia', valores);
}
