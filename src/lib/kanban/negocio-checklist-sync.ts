import {
  NEGOCIO_PRAZO_DRAFT_VAZIO,
  negocioPrazoDbPatchFromValores,
  negocioPrazoDraftFromValores,
  negocioPrazoValoresFromDraft,
  negocioPrazoValoresFromProcessoRow,
  type NegocioPrazoDraft,
} from '@/lib/kanban/dados-negocio-prazo';
import type { ProcessoNegocioUpdatePayload } from '@/lib/kanban/kanban-card-modal-detalhes';
import { parseNumeroPtBr } from '@/lib/dashboard-novos-negocios/parseMoney';
import {
  parseNegociacaoChecklistValor,
  serializarNegociacaoChecklist,
} from '@/lib/kanban/negociacao-linhas';

export const NEGOCIO_CHECKLIST_PREFIX = 'negocio:';

const CAMPOS_TEXTO = [
  'tipo_aquisicao_terreno',
  'valor_terreno',
  'divida_terreno',
  'vgv_pretendido',
  'produto_modelo_casa',
  'custo_obra',
  'divida_obra',
  'valor_recompra',
  'link_pasta_drive',
  'link_bca',
  'link_gbox',
  'link_gbox_ozempic',
  'link_mapa_competidores',
  'link_acoplamento',
  'link_apresentacao_comite',
  'link_opcao_permuta',
  'extrato_modelo_configurado',
  'data_aprovacao_comite',
  'obs_opcao',
  'data_ass_opcao_terreno',
  'obs_instrumento_garantidor',
  'data_ass_contrato_terreno',
  'book_empreendimento',
  'check_analise_credito',
] as const;

const CAMPOS_NUMERO = [
  'pct_compra_parcial_terreno',
  'pct_vgv_terrenista',
  'm2_terreno',
  'm2_casa',
] as const;

const PRAZOS = ['prazo_opcao', 'prazo_instrumento_garantidor'] as const;

export function chaveNegocioChecklist(campo: string): string {
  return `${NEGOCIO_CHECKLIST_PREFIX}${campo}`;
}

export function campoNegocioFromChave(chave: string): string | null {
  const c = chave.trim();
  if (!c.startsWith(NEGOCIO_CHECKLIST_PREFIX)) return null;
  const campo = c.slice(NEGOCIO_CHECKLIST_PREFIX.length);
  return campo || null;
}

export function prazoDraftFromChecklistValor(raw: string | null | undefined): NegocioPrazoDraft {
  const s = String(raw ?? '').trim();
  if (!s) return { ...NEGOCIO_PRAZO_DRAFT_VAZIO };
  try {
    const p = JSON.parse(s) as Partial<NegocioPrazoDraft>;
    if (p && (p.modo === 'fase' || p.modo === 'data' || p.modo === '')) {
      return {
        modo: p.modo,
        dias: String(p.dias ?? ''),
        slaTipo: p.slaTipo === 'corridos' ? 'corridos' : 'uteis',
        faseId: String(p.faseId ?? ''),
        data: String(p.data ?? '').slice(0, 10),
      };
    }
  } catch {
    /* valor que não é o JSON do prazo */
  }
  return { ...NEGOCIO_PRAZO_DRAFT_VAZIO };
}

/** Valores da lateral do card, indexados pela chave compartilhada do checklist. */
export function negocioEspelhoFromProcesso(
  proc: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!proc) return out;
  for (const campo of CAMPOS_TEXTO) {
    const v = proc[campo];
    out[chaveNegocioChecklist(campo)] = v == null ? '' : String(v);
  }
  for (const campo of CAMPOS_NUMERO) {
    const v = proc[campo];
    out[chaveNegocioChecklist(campo)] = v == null || v === '' ? '' : String(v);
  }
  for (const prefix of PRAZOS) {
    const draft = negocioPrazoDraftFromValores(negocioPrazoValoresFromProcessoRow(proc, prefix));
    out[chaveNegocioChecklist(prefix)] = draft.modo ? JSON.stringify(draft) : '';
  }
  out[chaveNegocioChecklist('negociacao_linhas')] = serializarNegociacaoChecklist(proc.negociacao_linhas);
  return out;
}

function numeroOuNull(raw: string): number | null {
  return parseNumeroPtBr(raw);
}

export function processoPatchFromChecklistNegocio(
  chave: string,
  valor: string | null,
): ProcessoNegocioUpdatePayload | null {
  const campo = campoNegocioFromChave(chave);
  if (!campo) return null;
  const raw = String(valor ?? '').trim();
  if (campo === 'negociacao_linhas') {
    const serial = serializarNegociacaoChecklist(parseNegociacaoChecklistValor(raw));
    return {
      negociacao_linhas: serial
        ? (JSON.parse(serial) as ProcessoNegocioUpdatePayload['negociacao_linhas'])
        : null,
    };
  }
  if (campo === 'prazo_opcao' || campo === 'prazo_instrumento_garantidor') {
    const valores = negocioPrazoValoresFromDraft(prazoDraftFromChecklistValor(raw));
    return negocioPrazoDbPatchFromValores(valores, campo) as ProcessoNegocioUpdatePayload;
  }
  if ((CAMPOS_NUMERO as readonly string[]).includes(campo)) {
    return { [campo]: numeroOuNull(raw) } as ProcessoNegocioUpdatePayload;
  }
  if ((CAMPOS_TEXTO as readonly string[]).includes(campo)) {
    return { [campo]: raw || null } as ProcessoNegocioUpdatePayload;
  }
  return null;
}

export function checklistLinhasFromNegocioPayload(
  payload: ProcessoNegocioUpdatePayload,
): { chave: string; valor: string | null }[] {
  const linhas: { chave: string; valor: string | null }[] = [];
  const rec = payload as Record<string, unknown>;
  for (const campo of CAMPOS_TEXTO) {
    if (rec[campo] === undefined) continue;
    const v = rec[campo];
    linhas.push({
      chave: chaveNegocioChecklist(campo),
      valor: v == null || String(v).trim() === '' ? null : String(v),
    });
  }
  for (const campo of CAMPOS_NUMERO) {
    if (rec[campo] === undefined) continue;
    const v = rec[campo];
    linhas.push({
      chave: chaveNegocioChecklist(campo),
      valor: v == null || v === '' ? null : String(v),
    });
  }
  for (const prefix of PRAZOS) {
    if (
      rec[`${prefix}_modo`] === undefined &&
      rec[`${prefix}_dias`] === undefined &&
      rec[`${prefix}_data`] === undefined
    ) {
      continue;
    }
    const draft = negocioPrazoDraftFromValores(negocioPrazoValoresFromProcessoRow(rec, prefix));
    linhas.push({
      chave: chaveNegocioChecklist(prefix),
      valor: draft.modo ? JSON.stringify(draft) : null,
    });
  }
  if (rec.negociacao_linhas !== undefined) {
    const serial = serializarNegociacaoChecklist(rec.negociacao_linhas);
    linhas.push({
      chave: chaveNegocioChecklist('negociacao_linhas'),
      valor: serial || null,
    });
  }
  return linhas;
}
