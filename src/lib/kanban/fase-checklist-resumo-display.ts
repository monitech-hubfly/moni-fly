import type { FaseChecklistItem } from '@/lib/actions/candidato-actions';
import {
  isMultiPracaStoreJson,
  labelPracaCidade,
  type PracaCidade,
} from '@/lib/kanban/dados-cidade-praca-multi';
import { parseLinhasProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';

export type ResumoChecklistSubLinha = {
  prefixo: string;
  valor: string;
};

export type ResumoChecklistLinha = {
  label: string;
  valorExibicao: string;
  preenchido: boolean;
  subLinhas?: ResumoChecklistSubLinha[];
};

function trunc(s: string, max = 100): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function nomeArquivo(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

function resumoMultiPraca(
  raw: string,
  areas: PracaCidade[],
  formatValor: (v: string) => string,
): { valorExibicao: string; preenchido: boolean; subLinhas: ResumoChecklistSubLinha[] } {
  let store: Record<string, string> = {};
  try {
    store = JSON.parse(raw) as Record<string, string>;
  } catch {
    return { valorExibicao: trunc(raw), preenchido: Boolean(raw.trim()), subLinhas: [] };
  }
  const subLinhas = areas.map((a) => {
    const chave = `${a.uf}::${a.cidade}`;
    const val = String(store[chave] ?? '').trim();
    return { prefixo: labelPracaCidade(a), valor: val ? formatValor(val) : '—' };
  });
  const preenchido = subLinhas.some((s) => s.valor !== '—');
  const qtd = subLinhas.filter((s) => s.valor !== '—').length;
  return {
    valorExibicao: preenchido ? `${qtd} praça(s)` : '—',
    preenchido,
    subLinhas,
  };
}

export function resumoChecklistItem(
  item: FaseChecklistItem,
  valor: string | null | undefined,
  arquivoPath: string | null | undefined,
  opts?: { multiPraca?: boolean; areas?: PracaCidade[] },
): ResumoChecklistLinha {
  const v = String(valor ?? '').trim();
  const arquivo = String(arquivoPath ?? '').trim();
  const areas = opts?.areas ?? [];

  if (item.tipo === 'checkbox') {
    const valorExibicao = v === 'true' ? 'Sim' : v === 'false' ? 'Não' : '—';
    return { label: item.label, valorExibicao, preenchido: v === 'true' };
  }

  if (item.tipo === 'anexo' || item.tipo === 'anexo_template') {
    const path = arquivo || v;
    if (isMultiPracaStoreJson(path) && areas.length > 0) {
      const mp = resumoMultiPraca(path, areas, (p) => nomeArquivo(p));
      return { label: item.label, ...mp };
    }
    const nome = path ? nomeArquivo(path) : '';
    return { label: item.label, valorExibicao: nome || '—', preenchido: Boolean(path) };
  }

  if (item.tipo === 'data' && v) {
    const d = new Date(v);
    const valorExibicao = Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR');
    return { label: item.label, valorExibicao, preenchido: true };
  }

  if (item.tipo === 'hora' && v) {
    return { label: item.label, valorExibicao: v, preenchido: true };
  }

  if (item.tipo === 'tabela' || item.label.trim().includes('Tabela')) {
    if (isMultiPracaStoreJson(v) && areas.length > 0) {
      const mp = resumoMultiPraca(v, areas, (raw) => {
        try {
          const rows = parseLinhasProspectCondominio(raw);
          return rows.length ? `${rows.length} registro(s)` : '—';
        } catch {
          return raw ? trunc(raw, 40) : '—';
        }
      });
      return { label: item.label, ...mp };
    }
    try {
      const rows = parseLinhasProspectCondominio(v);
      return {
        label: item.label,
        valorExibicao: rows.length ? `${rows.length} registro(s)` : '—',
        preenchido: rows.length > 0,
      };
    } catch {
      /* valor livre */
    }
  }

  if (
    item.tipo === 'dados_cidade_ibge' ||
    item.tipo === 'mapa_praca' ||
    item.tipo === 'listagem_casas_zap' ||
    item.tipo === 'pesquisa_condominio' ||
    item.tipo === 'lotes_condominio' ||
    item.tipo === 'condominio'
  ) {
    return {
      label: item.label,
      valorExibicao: v || arquivo ? 'Preenchido' : 'Pendente',
      preenchido: Boolean(v || arquivo),
    };
  }

  if (opts?.multiPraca && isMultiPracaStoreJson(v) && areas.length > 0) {
    const mp = resumoMultiPraca(v, areas, (val) => trunc(val, 60));
    return { label: item.label, ...mp };
  }

  const texto = v || (arquivo ? nomeArquivo(arquivo) : '');
  return {
    label: item.label,
    valorExibicao: texto ? trunc(texto) : '—',
    preenchido: Boolean(texto),
  };
}
