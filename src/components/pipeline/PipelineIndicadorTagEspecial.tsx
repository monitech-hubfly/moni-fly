type Props = {
  className?: string;
  /** Tamanho compacto para células de tabela. */
  compact?: boolean;
};

/** Indicador visual da tag padronizada «⭐Especial» no pipeline consolidado. */
export function PipelineIndicadorTagEspecial({ className, compact }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${compact ? 'text-[11px]' : 'text-[13px]'} ${className ?? ''}`}
      aria-label="Tag Especial"
      title="Tag Especial"
    >
      ⭐
    </span>
  );
}
