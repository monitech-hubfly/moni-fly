export type CampoIdentidade = {
  id: string;
  nome: string;
  tipo: string;
  ordem: number;
};

export type CamposIdentidadeIds = {
  nomeId: string | null;
  cidadeId: string | null;
  estadoId: string | null;
};

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function foraDaIdentidade(nome: string): boolean {
  const n = semAcento(nome);
  return (
    n.includes('por que') ||
    n.includes('comprovante') ||
    n.includes('habitante') ||
    n.includes('estado civil')
  );
}

function ehNomeCompleto(nome: string): boolean {
  const n = semAcento(nome).trim();
  if (n === 'nome completo' || n.startsWith('nome completo')) return true;
  if (!n.startsWith('nome')) return false;
  return !n.includes('franquia') && !n.includes('empresa') && !n.includes('fantasia');
}

function prioridadeLocal(nome: string): number {
  const n = semAcento(nome);
  if (/reside|atual/.test(n)) return 0;
  if (/pretende atuar|praca/.test(n)) return 1;
  return 2;
}

export function numeroFranquiaDoTitulo(titulo: string | null | undefined): string | null {
  const texto = String(titulo ?? '').trim();
  const fk = texto.match(/\bFK\s*\d+/i);
  if (fk) return fk[0].replace(/\s+/g, '');
  const inicio = texto.match(/^(\d{2,5})\b/);
  return inicio?.[1] ?? null;
}

function escolherLocal(campos: CampoIdentidade[], tipo: string, palavra: string): CampoIdentidade | null {
  const lista = campos.filter((campo) => campo.tipo === tipo || semAcento(campo.nome).includes(palavra));
  lista.sort((a, b) => prioridadeLocal(a.nome) - prioridadeLocal(b.nome) || a.ordem - b.ordem);
  return lista[0] ?? null;
}

export function camposIdentidadeResposta(campos: CampoIdentidade[]): CamposIdentidadeIds {
  const uteis = campos.filter((campo) => !foraDaIdentidade(campo.nome));
  const nome = [...uteis].filter((campo) => ehNomeCompleto(campo.nome)).sort((a, b) => a.ordem - b.ordem)[0];
  return {
    nomeId: nome?.id ?? null,
    cidadeId: escolherLocal(uteis, 'select_cidade', 'cidade')?.id ?? null,
    estadoId: escolherLocal(uteis, 'select_estado', 'estado')?.id ?? null,
  };
}

export function rotuloNumeroFranquia(valor: string | null | undefined): string | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  if (/^fk/i.test(texto)) return `FK${texto.replace(/^fk/i, '')}`;
  if (/^\d+$/.test(texto)) return `FK${texto.padStart(4, '0')}`;
  return texto;
}

export function chaveUltimoPreenchimento(row: {
  id: string;
  card_id: string | null;
  rede_franqueado_id: string | null;
}): string {
  if (row.card_id) return `card:${row.card_id}`;
  if (row.rede_franqueado_id) return `rede:${row.rede_franqueado_id}`;
  return `resp:${row.id}`;
}
