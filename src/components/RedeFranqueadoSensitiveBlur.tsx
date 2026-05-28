/** Célula mascarada na planilha da rede (não expõe o valor real no DOM). */
export function RedeFranqueadoSensitiveBlur() {
  return (
    <span
      className="inline-block min-w-[5rem] rounded-md bg-stone-300/70 px-3 py-1 text-sm text-stone-600 blur-[5px] select-none"
      title="Visível apenas para administradores"
      aria-label="Dado restrito a administradores"
    >
      ••••••••
    </span>
  );
}
