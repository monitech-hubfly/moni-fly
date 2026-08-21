'use client';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-[color:var(--moni-text-primary)]">
          {title}
        </h3>
        {description ? (
          <p className="mb-4 text-sm text-[color:var(--moni-text-tertiary)]">{description}</p>
        ) : (
          <div className="mb-4" />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? 'flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700'
                : 'flex-1 rounded-lg bg-[color:var(--moni-navy-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--moni-navy-700)]'
            }
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[color:var(--moni-border-default)] px-4 py-2 text-sm font-medium text-[color:var(--moni-text-secondary)]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
