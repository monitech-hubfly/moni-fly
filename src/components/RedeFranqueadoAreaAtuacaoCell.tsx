import { areaAtuacaoParaLinhasExibicao } from '@/lib/rede-area-atuacao';

type Props = {
  text: string | null | undefined;
  titleText?: string | null;
};

export function RedeFranqueadoAreaAtuacaoCell({ text, titleText }: Props) {
  const raw = text ?? '';
  const linhas = areaAtuacaoParaLinhasExibicao(raw);
  const tip = (titleText ?? raw).trim() || undefined;

  if (linhas.length === 0) {
    return <span className="text-[var(--moni-text-tertiary)]">—</span>;
  }

  return (
    <div
      className="min-w-0 max-w-[min(16rem,100%)] max-h-[3.9rem] overflow-hidden text-xs leading-snug text-[var(--moni-text-secondary)]"
      title={tip}
    >
      {linhas.map((linha, i) => (
        <div key={`${i}-${linha}`} className="block min-w-0 max-w-full break-words">
          {linha}
        </div>
      ))}
    </div>
  );
}
