'use client';

type KanbanSlaJustificativaModalProps = {
  open: boolean;
  faseOrigemNome: string;
  faseDestinoNome: string;
  justificativaExistente?: string | null;
  obrigatoria: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  salvando: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function KanbanSlaJustificativaModal({
  open,
  faseOrigemNome,
  faseDestinoNome,
  justificativaExistente,
  obrigatoria,
  draft,
  onDraftChange,
  salvando,
  onCancel,
  onConfirm,
}: KanbanSlaJustificativaModalProps) {
  if (!open) return null;

  const existente = String(justificativaExistente ?? '').trim();
  const confirmDisabled = salvando || (obrigatoria && !draft.trim());

  return (
    <div
      className="fixed inset-0 z-[225] flex items-center justify-center p-4"
      style={{ background: 'rgba(12, 38, 51, 0.45)' }}
    >
      <div
        className="w-full max-w-md bg-white p-6 shadow-xl moni-form-novo-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="justificativa-sla-titulo"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <h3
          id="justificativa-sla-titulo"
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Justificativa de quebra de SLA
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          O SLA da fase &ldquo;{faseOrigemNome}&rdquo; está vencido.
          {faseDestinoNome
            ? ` Informe a justificativa para avançar para "${faseDestinoNome}".`
            : ' Informe a justificativa antes de avançar o card.'}
        </p>

        {existente && !obrigatoria ? (
          <div
            className="mt-4 px-3 py-2 text-sm"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              background: 'var(--moni-surface-subtle, #fafafa)',
              color: 'var(--moni-text-secondary)',
            }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--moni-text-tertiary)' }}>
              Justificativa já registrada nesta fase
            </p>
            <p className="mt-1 whitespace-pre-wrap">{existente}</p>
            <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Você pode complementar abaixo ou confirmar sem alterações.
            </p>
          </div>
        ) : null}

        <label className="mt-4 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
          {obrigatoria ? 'Justificativa' : 'Complemento (opcional)'}
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={4}
            className="mt-1 w-full resize-none px-3 py-2 text-sm focus:outline-none"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              fontFamily: 'var(--moni-font-sans)',
              minHeight: '44px',
            }}
            placeholder={
              obrigatoria ? 'Descreva o motivo da quebra de SLA…' : 'Adicione informações, se necessário…'
            }
            disabled={salvando}
            autoFocus
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={salvando}
            onClick={onCancel}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-secondary)',
              fontFamily: 'var(--moni-font-sans)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-navy-800)',
              fontFamily: 'var(--moni-font-sans)',
            }}
          >
            {salvando ? 'Salvando…' : obrigatoria ? 'Confirmar e avançar' : 'Confirmar e avançar'}
          </button>
        </div>
      </div>
    </div>
  );
}
