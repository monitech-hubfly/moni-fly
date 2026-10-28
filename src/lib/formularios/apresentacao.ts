import type { FormularioCampo, FormularioCampoGrupoDef, FormularioResposta, FormularioSecao } from '@/types/formularios';

export type ItemGrupoApresentado = {
  label: string;
  valor: string;
  largo: boolean;
};

export type BlocoGrupoApresentado = {
  titulo: string | null;
  itens: ItemGrupoApresentado[];
};

export type LinhaGrupoApresentada = {
  titulo: string;
  blocos: BlocoGrupoApresentado[];
};

const ROTULOS_GRUPO: Record<string, string> = {
  nome: 'Nome do condomínio',
  faixa_preco: 'Faixa de preço de venda das casas',
  giro_vendas: 'Giro de vendas nessa faixa',
  metragem_construida: 'Metragem construída aproximada',
  num_suites: 'Número de suítes',
  possui_piscina: 'Possui piscina?',
  vagas_cobertas: 'Número de vagas cobertas',
  preco_medio_venda: 'Preço médio de venda das casas nessa faixa',
  composicao_media: 'Composição média das casas nessa faixa',
};

function ehTemaGrupo(def: FormularioCampoGrupoDef): boolean {
  return def.tipo === 'titulo' || def.key === 'composicao_media';
}

function ehFaixaGrupo(def: FormularioCampoGrupoDef): boolean {
  return def.tipo === 'faixa_moeda' || def.key === 'faixa_preco';
}

function rotuloGrupo(def: FormularioCampoGrupoDef): string {
  const label = def.label?.trim();
  if (label) return label;
  return ROTULOS_GRUPO[def.key] ?? def.key.replace(/_/g, ' ');
}

function textoDoItemGrupo(def: FormularioCampoGrupoDef, registro: Record<string, unknown>): string {
  if (ehTemaGrupo(def)) return '';
  if (ehFaixaGrupo(def)) {
    const de = String(registro[`${def.key}_de`] ?? registro[def.key] ?? '').trim();
    const ate = String(registro[`${def.key}_ate`] ?? '').trim();
    if (de && ate && de !== ate) return `De ${de} à ${ate}`;
    return de || ate;
  }
  let texto = String(registro[def.key] ?? '').trim();
  if (!texto) return '';
  if ((def.tipo === 'm2' || def.key === 'metragem_construida') && !/m²|m2/i.test(texto)) texto = `${texto} m²`;
  return texto;
}

function defsDoGrupo(campo: FormularioCampo, registro: Record<string, unknown>): FormularioCampoGrupoDef[] {
  const defs = campo.config?.campos ?? [];
  if (defs.length > 0) return defs;
  const ordem = ['nome', 'faixa_preco', 'giro_vendas', 'composicao_media', 'metragem_construida', 'num_suites', 'possui_piscina', 'vagas_cobertas', 'preco_medio_venda'];
  const chaves = new Set(Object.keys(registro).filter((key) => !key.endsWith('_de') && !key.endsWith('_ate')));
  const lista = ordem.filter((key) => chaves.has(key) || key === 'composicao_media');
  for (const key of chaves) {
    if (!lista.includes(key)) lista.push(key);
  }
  return lista.map((key) => ({
    key,
    label: ROTULOS_GRUPO[key] ?? key.replace(/_/g, ' '),
    tipo: key === 'composicao_media' ? 'titulo' : key === 'faixa_preco' ? 'faixa_moeda' : 'texto',
  }));
}

export function linhasDoGrupo(
  campo: FormularioCampo,
  valor: string | string[] | null | undefined,
): LinhaGrupoApresentada[] | null {
  if (valor === null || valor === undefined || valor === '') return [];
  let rows: unknown;
  try {
    rows = JSON.parse(String(valor));
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;

  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') return [];
    const registro = row as Record<string, unknown>;
    const defs = defsDoGrupo(campo, registro);
    const nome = String(registro.nome ?? '').trim();
    const blocos: BlocoGrupoApresentado[] = [];
    let atual: BlocoGrupoApresentado = { titulo: null, itens: [] };

    for (const def of defs) {
      if (def.key === 'nome') continue;
      if (ehTemaGrupo(def)) {
        if (atual.titulo || atual.itens.length > 0) blocos.push(atual);
        atual = { titulo: rotuloGrupo(def), itens: [] };
        continue;
      }
      const texto = textoDoItemGrupo(def, registro);
      if (!texto) continue;
      atual.itens.push({
        label: rotuloGrupo(def),
        valor: texto,
        largo: rotuloGrupo(def).length > 42,
      });
    }
    if (atual.titulo || atual.itens.length > 0) blocos.push(atual);
    const visiveis = blocos.filter((bloco) => bloco.itens.length > 0);
    if (!nome && visiveis.length === 0) return [];
    return [{ titulo: nome || `Condomínio ${index + 1}`, blocos: visiveis }];
  });
}

export function labelDoStatus(status: string): string {
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    iniciado: 'Iniciado',
    em_preenchimento: 'Em preenchimento',
    enviado: 'Enviado',
    arquivado: 'Arquivado',
  };
  return map[status] ?? status;
}

export function corDoStatus(status: string): string {
  const map: Record<string, string> = {
    iniciado: 'var(--moni-text-tertiary)',
    rascunho: 'var(--moni-text-tertiary)',
    em_preenchimento: 'var(--moni-gold-400)',
    enviado: 'var(--moni-green-600)',
    arquivado: 'var(--moni-text-tertiary)',
  };
  return map[status] ?? 'var(--moni-text-tertiary)';
}

export function formatarValorCampo(campo: FormularioCampo, valor: string | string[] | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';

  if (campo.tipo === 'moeda') {
    const num = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(num)) return String(valor);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (campo.tipo === 'checkbox' && Array.isArray(valor)) {
    return valor.join(', ');
  }

  if (campo.tipo === 'grupo_repetivel') {
    const linhas = linhasDoGrupo(campo, valor);
    if (!linhas) return String(valor);
    if (linhas.length === 0) return '—';
    return linhas
      .map((linha) => {
        const partes = linha.blocos.flatMap((bloco) => [
          bloco.titulo ?? '',
          ...bloco.itens.map((item) => `${item.label}: ${item.valor}`),
        ]);
        return [linha.titulo, ...partes].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  if (campo.tipo === 'data') {
    const [y, m, d] = String(valor).split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return String(valor);
  }

  return Array.isArray(valor) ? valor.join(', ') : String(valor);
}

export function secoesVisiveis(
  secoes: FormularioSecao[],
  respostaDados: FormularioResposta['dados'],
): FormularioSecao[] {
  return secoes.filter((secao) => {
    if (!secao.condicional_campo_id) return true;
    const resp = respostaDados[secao.condicional_campo_id];
    if (!resp) return false;
    const valorAtual = Array.isArray(resp.valor) ? resp.valor.join(',') : (resp.valor ?? '');
    return valorAtual === secao.condicional_valor;
  });
}

export function camposVisiveis(
  campos: FormularioCampo[],
  respostaDados: FormularioResposta['dados'],
): FormularioCampo[] {
  return campos.filter((campo) => {
    if (!campo.condicional_campo_id) return true;
    const resp = respostaDados[campo.condicional_campo_id];
    if (!resp) return false;
    const valorAtual = Array.isArray(resp.valor) ? resp.valor.join(',') : (resp.valor ?? '');
    return valorAtual === campo.condicional_valor;
  });
}

export function normalizarCondicional(valor: string | null | undefined): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function mascaraTelefone(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length < 3) return `(${digitos}`;
  if (digitos.length < 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function mascaraMoeda(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '');
  if (!digitos) return '';
  const numero = Number(digitos) / 100;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function moedaParaNumero(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return null;
  return Number(digitos) / 100;
}

export function nomeArquivoSeguro(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120);
  return base.length > 0 ? base : 'arquivo';
}

export function opcoesParaLista(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return String(row.valor ?? row.value ?? row.rotulo ?? row.label ?? '').trim();
      }
      return '';
    })
    .filter((item) => item.length > 0);
}
