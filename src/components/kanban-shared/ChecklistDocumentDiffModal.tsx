'use client';

type Props = {
  open: boolean;
  diferencas: string[];
  onClose: () => void;
};

export function ChecklistDocumentDiffModal({ open, diferencas, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-diff-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 id="checklist-diff-title" className="text-base font-semibold text-stone-900">
            Diferenças encontradas no documento
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Foram detectadas alterações em relação ao modelo, para além de datas, meses, anos, nomes em
            maiúsculas ou CPF.
          </p>
        </div>
        <ul className="max-h-[50vh] list-disc space-y-2 overflow-y-auto px-8 py-4 text-sm text-stone-800">
          {diferencas.map((d, i) => (
            <li key={i} className="pl-1 leading-snug">
              {d}
            </li>
          ))}
        </ul>
        <div className="border-t border-stone-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
