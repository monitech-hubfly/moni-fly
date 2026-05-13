/**
 * Célula da Rede de Franqueados: no máximo 2 linhas visíveis; conteúdo completo no hover (`title`).
 */
export function RedeFranqueadoCellClamp({
  text,
  titleText,
}: {
  text: string;
  /** Tooltip (ex.: valor bruto quando `text` é só formatação). Default = `text`. */
  titleText?: string;
}) {
  const raw = text ?? '';
  const trimmed = raw.trim();
  const display = trimmed.length > 0 ? raw.trim() : '—';
  const tipRaw = titleText ?? raw;
  const titleAttr = tipRaw.trim().length > 0 ? tipRaw : undefined;

  return (
    // Outer width: em `table-layout: auto`, `max-width` no `<td>` pode ser ignorado; o wrapper fixa o limite para o clamp.
    // Inner: não usar `display:block` junto com `line-clamp` — o clamp depende de `-webkit-box`.
    <div className="min-w-0 max-w-[min(14rem,100%)]">
      <span className="min-w-0 max-w-full overflow-hidden break-words leading-snug line-clamp-2" title={titleAttr}>
        {display}
      </span>
    </div>
  );
}
