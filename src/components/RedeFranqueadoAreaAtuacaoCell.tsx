'use client';

import { useId } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { areaAtuacaoParaLinhasExibicao } from '@/lib/rede-area-atuacao';

export const REDE_AREA_ATUACAO_MAX_LINHAS = 3;

type Props = {
  text: string | null | undefined;
  titleText?: string | null;
  /** Controlado pela tabela: linha expandida para ver todas as cidades. */
  expanded?: boolean;
  /** Exibe botão local de expandir (default true quando há mais de 3 linhas). */
  showExpandControl?: boolean;
  onToggleExpand?: () => void;
};

/**
 * Célula de área de atuação: um `UF - Cidade` por linha.
 * Acima de 3 linhas, mostra só as 3 primeiras até expandir.
 */
export function RedeFranqueadoAreaAtuacaoCell({
  text,
  titleText,
  expanded = false,
  showExpandControl = true,
  onToggleExpand,
}: Props) {
  const controlId = useId();
  const raw = text ?? '';
  const linhas = areaAtuacaoParaLinhasExibicao(raw);
  const tip =
    (titleText != null && String(titleText).trim()
      ? String(titleText).trim()
      : linhas.length > 0
        ? linhas.join('\n')
        : raw.trim()) || undefined;

  if (linhas.length === 0) {
    return <span className="text-[var(--moni-text-tertiary)]">—</span>;
  }

  const precisaColapsar = linhas.length > REDE_AREA_ATUACAO_MAX_LINHAS;
  const visiveis =
    expanded || !precisaColapsar ? linhas : linhas.slice(0, REDE_AREA_ATUACAO_MAX_LINHAS);
  const restantes = linhas.length - REDE_AREA_ATUACAO_MAX_LINHAS;

  return (
    <div
      className="flex min-w-0 max-w-[min(16rem,100%)] flex-col gap-0.5 text-xs leading-snug text-[var(--moni-text-secondary)]"
      title={!expanded && precisaColapsar ? tip : undefined}
      data-rede-area-atuacao="linhas"
    >
      {visiveis.map((linha, i) => (
        <div
          key={`${i}-${linha}`}
          className="block min-w-0 max-w-full whitespace-normal break-words"
        >
          {linha}
        </div>
      ))}
      {precisaColapsar && showExpandControl && onToggleExpand ? (
        <button
          type="button"
          id={controlId}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="mt-0.5 inline-flex min-h-[28px] w-fit items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-semibold text-[color:var(--moni-navy-800,#0C2633)] underline-offset-2 hover:underline"
          aria-expanded={expanded}
          aria-controls={controlId}
        >
          {expanded ? (
            <>
              <Minimize2 className="h-3 w-3 shrink-0" aria-hidden />
              Minimizar
            </>
          ) : (
            <>
              <Maximize2 className="h-3 w-3 shrink-0" aria-hidden />
              +{restantes} {restantes === 1 ? 'cidade' : 'cidades'}
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

/** Quantidade de linhas de exibição da área de atuação (para decidir se a linha é expansível). */
export function redeAreaAtuacaoLinhaCount(text: string | null | undefined): number {
  return areaAtuacaoParaLinhasExibicao(text ?? '').length;
}

export function redeRowConteudoExpansivel(areaAtuacao: string | null | undefined): boolean {
  return redeAreaAtuacaoLinhaCount(areaAtuacao) > REDE_AREA_ATUACAO_MAX_LINHAS;
}
