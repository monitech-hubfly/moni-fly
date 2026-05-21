'use client';

export type MultiSelectCheckboxVariant = 'times' | 'responsaveis';

export type MultiSelectCheckboxOption = { id: string; label: string };

const VARIANT_STYLES: Record<
  MultiSelectCheckboxVariant,
  { pillBg: string; pillText: string; checkboxChecked: string }
> = {
  times: { pillBg: '#EEEDFE', pillText: '#3C3489', checkboxChecked: '#534AB7' },
  responsaveis: { pillBg: '#EAF3DE', pillText: '#3B6D11', checkboxChecked: '#3B6D11' },
};

type Props = {
  options: MultiSelectCheckboxOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder: string;
  variant: MultiSelectCheckboxVariant;
  listClassName?: string;
};

export function MultiSelectCheckbox({
  options,
  selectedIds,
  onToggle,
  placeholder,
  variant,
  listClassName = 'max-h-24',
}: Props) {
  const styles = VARIANT_STYLES[variant];
  const selectedSet = new Set(selectedIds);
  const selectedPills = options.filter((o) => selectedSet.has(o.id));

  return (
    <div
      className="overflow-hidden rounded-md"
      style={{ border: '0.5px solid var(--moni-border-default)' }}
    >
      <div className="flex min-h-[1.5rem] flex-wrap items-center gap-1 px-2 py-1">
        {selectedPills.length === 0 ? (
          <span className="text-[10px] leading-snug text-stone-500">{placeholder}</span>
        ) : (
          selectedPills.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium leading-tight"
              style={{ backgroundColor: styles.pillBg, color: styles.pillText }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => onToggle(o.id)}
                className="text-[10px] leading-none opacity-70 hover:opacity-100"
                style={{ color: styles.pillText }}
                aria-label={`Remover ${o.label}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <ul
        className={`overflow-y-auto border-t border-[color:var(--moni-border-default)] ${listClassName}`}
        role="listbox"
        aria-multiselectable="true"
      >
        {options.map((o) => {
          const checked = selectedSet.has(o.id);
          return (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => onToggle(o.id)}
                className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[10px] leading-snug text-stone-800 hover:bg-stone-50"
              >
                <span
                  className="flex h-3 w-3 shrink-0 items-center justify-center rounded border"
                  style={{
                    borderColor: checked ? styles.checkboxChecked : 'var(--moni-border-default)',
                    backgroundColor: checked ? styles.checkboxChecked : 'transparent',
                  }}
                  aria-hidden
                >
                  {checked ? (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2 w-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  ) : null}
                </span>
                <span>{o.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
