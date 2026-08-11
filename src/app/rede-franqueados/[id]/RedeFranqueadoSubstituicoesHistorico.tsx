'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { RedeSubstituicaoSnapshotVinculos } from '@/lib/rede-franqueado-anexos-colunas';
import {
  pickAnexosRedeFranqueadoFromRow,
  REDE_FRANQUEADO_COLUNAS_ANEXO_PATH,
  REDE_SUBSTITUICAO_SNAPSHOT_VINCULOS_KEY,
} from '@/lib/rede-franqueado-anexos-colunas';
import { formatNFranquiaRedeExibicao } from '@/lib/rede-franqueados';
import type { RedeSubstituicaoRow } from '@/lib/rede-franqueado-substituicao';

type Props = {
  substituicoes: RedeSubstituicaoRow[];
};

function contarDocsArquivados(snapshot: Record<string, unknown>): number {
  const anexos = pickAnexosRedeFranqueadoFromRow(snapshot);
  let n = REDE_FRANQUEADO_COLUNAS_ANEXO_PATH.filter((k) => anexos[k]).length;
  const vinc = snapshot[REDE_SUBSTITUICAO_SNAPSHOT_VINCULOS_KEY] as RedeSubstituicaoSnapshotVinculos | undefined;
  if (vinc?.franqueado_spe?.length) {
    for (const spe of vinc.franqueado_spe) {
      for (const k of [
        'anexo_contrato_social_path',
        'anexo_cnpj_path',
        'anexo_inscricao_municipal_path',
        'anexo_certidao_junta_path',
        'anexo_conta_bancaria_path',
        'anexo_inscricao_estadual_path',
      ]) {
        if (String(spe[k] ?? '').trim()) n += 1;
      }
    }
  }
  if (vinc?.franqueado_empresas?.length) {
    for (const emp of vinc.franqueado_empresas) {
      for (const k of Object.keys(emp)) {
        if (k.endsWith('_path') && String(emp[k] ?? '').trim()) n += 1;
      }
    }
  }
  return n;
}

function formatData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function RedeFranqueadoSubstituicoesHistorico({ substituicoes }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!substituicoes.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-[color:var(--moni-text-tertiary)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[color:var(--moni-navy-800)]">
          Histórico de substituições
        </h2>
        <span className="text-xs text-[color:var(--moni-text-tertiary)]">
          ({substituicoes.length} registro{substituicoes.length === 1 ? '' : 's'})
        </span>
      </div>
      <p className="mb-3 text-xs text-[color:var(--moni-text-secondary)]">
        Franqueados anteriores substituídos nesta unidade. Não aparecem na tabela operacional, mas o cadastro
        fica arquivado aqui.
      </p>
      <ul className="space-y-2">
        {substituicoes.map((s) => {
          const aberto = openId === s.id;
          const snap = s.snapshot;
          const nome =
            s.nome_anterior ??
            String(snap.nome_completo ?? '').trim() ??
            'Franqueado anterior';
          const fk = formatNFranquiaRedeExibicao(
            s.n_franquia_anterior ?? (snap.n_franquia as string | null),
            typeof snap.ordem === 'number' ? snap.ordem : null,
          );
          const docsArquivados = contarDocsArquivados(snap);
          return (
            <li
              key={s.id}
              className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]"
            >
              <button
                type="button"
                onClick={() => setOpenId(aberto ? null : s.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-sm font-medium text-[color:var(--moni-text-primary)]">
                  {fk ? `${fk} · ` : ''}
                  {nome}
                </span>
                <span className="flex items-center gap-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
                  {formatData(s.substituido_em)}
                  {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {aberto ? (
                <div className="border-t border-[color:var(--moni-border-default)] px-3 py-2 text-xs text-[color:var(--moni-text-secondary)]">
                  <dl className="grid gap-1 sm:grid-cols-2">
                    {(
                      [
                        ['Status', snap.status_franquia],
                        ['E-mail', snap.email_frank],
                        ['Telefone', snap.telefone_frank],
                        ['Regional', snap.regional],
                        ['Área', snap.area_atuacao],
                        ['Classificação', snap.classificacao_franqueado],
                      ] as [string, unknown][]
                    ).map(([lab, val]) =>
                      val != null && String(val).trim() !== '' ? (
                        <div key={lab}>
                          <dt className="font-semibold text-[color:var(--moni-text-tertiary)]">{lab}</dt>
                          <dd>{String(val)}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                  {s.processo_step_one_id ? (
                    <p className="mt-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
                      Processo Step One arquivado: {s.processo_step_one_id.slice(0, 8)}…
                    </p>
                  ) : null}
                  {docsArquivados > 0 ? (
                    <p className="mt-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
                      {docsArquivados} documento{docsArquivados === 1 ? '' : 's'} arquivado
                      {docsArquivados === 1 ? '' : 's'} neste snapshot (paths preservados no histórico).
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
