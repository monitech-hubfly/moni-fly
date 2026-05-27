import { normalizeNFranquiaCsv } from '@/lib/import-rede-csv';

export type RedeLinhaParaDuplicata = {
  id: string;
  n_franquia: string | null;
  nome_completo: string | null;
  processo_id: string | null;
  created_at: string | null;
  preenchidos: number;
};

export type GrupoDuplicataRede = {
  chave: string;
  rotulo: string;
  linhas: RedeLinhaParaDuplicata[];
  manterId: string;
  removerIds: string[];
};

function chaveAgrupamento(n_franquia: string | null, nome_completo: string | null): string | null {
  const fk = normalizeNFranquiaCsv(n_franquia);
  if (fk) return `fk:${fk.toLowerCase()}`;
  const nome = (nome_completo ?? '').trim().toLowerCase();
  if (nome.length >= 3) return `nome:${nome}`;
  return null;
}

function pontuacaoManter(l: RedeLinhaParaDuplicata): number {
  let p = l.preenchidos;
  if (l.processo_id) p += 1000;
  if (l.n_franquia?.trim()) p += 50;
  return p;
}

/** Mantém a linha mais “completa”; em empate, a mais antiga (created_at). */
export function escolherIdParaManter(linhas: RedeLinhaParaDuplicata[]): string {
  const sorted = [...linhas].sort((a, b) => {
    const d = pontuacaoManter(b) - pontuacaoManter(a);
    if (d !== 0) return d;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  return sorted[0]!.id;
}

export function agruparDuplicatasRede(linhas: RedeLinhaParaDuplicata[]): GrupoDuplicataRede[] {
  const map = new Map<string, RedeLinhaParaDuplicata[]>();
  for (const l of linhas) {
    const chave = chaveAgrupamento(l.n_franquia, l.nome_completo);
    if (!chave) continue;
    const arr = map.get(chave) ?? [];
    arr.push(l);
    map.set(chave, arr);
  }

  const grupos: GrupoDuplicataRede[] = [];
  for (const [chave, items] of map) {
    if (items.length < 2) continue;
    const manterId = escolherIdParaManter(items);
    const rotulo =
      normalizeNFranquiaCsv(items[0]?.n_franquia) ??
      ((items[0]?.nome_completo ?? '').trim() || chave);
    grupos.push({
      chave,
      rotulo,
      linhas: items,
      manterId,
      removerIds: items.filter((i) => i.id !== manterId).map((i) => i.id),
    });
  }

  grupos.sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return grupos;
}
