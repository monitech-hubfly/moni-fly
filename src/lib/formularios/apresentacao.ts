import type { FormularioCampo, FormularioResposta, FormularioSecao } from '@/types/formularios';

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
    try {
      const rows = JSON.parse(String(valor)) as unknown;
      if (!Array.isArray(rows) || rows.length === 0) return '—';
      return rows
        .map((row, index) => {
          if (!row || typeof row !== 'object') return '';
          const temas = new Set(
            (campo.config?.campos ?? [])
              .filter((def) => def.tipo === 'titulo' || def.key === 'composicao_media')
              .map((def) => def.key),
          );
          const faixas = (campo.config?.campos ?? [])
            .filter((def) => def.tipo === 'faixa_moeda' || def.key === 'faixa_preco')
            .map((def) => def.key);
          const ignorar = new Set(faixas.flatMap((key) => [key, `${key}_de`, `${key}_ate`]));
          const registro = row as Record<string, unknown>;
          const partes = [
            ...Object.entries(registro)
              .map(([key, item]) => {
                if (temas.has(key) || ignorar.has(key)) return '';
                const texto = String(item ?? '').trim();
                if (!texto) return '';
                const valor = key === 'metragem_construida' && !texto.endsWith('m²') ? `${texto} m²` : texto;
                return `${key}: ${valor}`;
              }),
            ...faixas.map((key) => {
              const de = String(registro[`${key}_de`] ?? registro[key] ?? '').trim();
              const ate = String(registro[`${key}_ate`] ?? '').trim();
              if (de && ate) return `${key}: De ${de} à ${ate}`;
              if (de || ate) return `${key}: ${de || ate}`;
              return '';
            }),
          ].filter(Boolean);
          return partes.length > 0 ? `${index + 1}. ${partes.join(' · ')}` : '';
        })
        .filter(Boolean)
        .join('\n');
    } catch {
      return String(valor);
    }
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
