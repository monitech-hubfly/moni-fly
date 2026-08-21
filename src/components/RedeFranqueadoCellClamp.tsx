/**
 * Célula da Rede de Franqueados: no máximo 3 linhas visíveis quando colapsada; conteúdo completo ao expandir.
 */
export function RedeFranqueadoCellClamp({
  text,
  titleText,
  expanded = false,
}: {
  text: string;
  /** Tooltip (ex.: valor bruto quando `text` é só formatação). Default = `text`. */
  titleText?: string;
  expanded?: boolean;
}) {
  const raw = text ?? '';
  const trimmed = raw.trim();
  const display = trimmed.length > 0 ? raw.trim() : '—';
  const tipRaw = titleText ?? raw;
  const titleAttr = !expanded && tipRaw.trim().length > 0 ? tipRaw : undefined;

  return (
    <div className="min-w-0 max-w-[min(14rem,100%)]">
      <span
        className={`min-w-0 max-w-full overflow-hidden break-words leading-snug ${
          expanded ? '' : 'line-clamp-3'
        }`}
        title={titleAttr}
      >
        {display}
      </span>
    </div>
  );
}
