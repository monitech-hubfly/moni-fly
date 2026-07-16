import { areaAtuacaoParaLinhasExibicao } from '@/lib/rede-area-atuacao';

type Props = {
  text: string | null | undefined;
  titleText?: string | null;
};

/**
 * Célula de área de atuação: sempre um `UF - Cidade` por bloco (div),
 * inclusive quando o valor no banco ainda está em prosa legado.
 */
export function RedeFranqueadoAreaAtuacaoCell({ text, titleText }: Props) {
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

  return (
    <div
      className="flex min-w-0 max-w-[min(16rem,100%)] flex-col gap-0.5 text-xs leading-snug text-[var(--moni-text-secondary)]"
      title={tip}
      data-rede-area-atuacao="linhas"
    >
      {linhas.map((linha, i) => (
        <div
          key={`${i}-${linha}`}
          className="block min-w-0 max-w-full whitespace-normal break-words"
        >
          {linha}
        </div>
      ))}
    </div>
  );
}
