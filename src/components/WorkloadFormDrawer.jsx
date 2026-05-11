import { useEffect, useState } from 'react'

/**
 * Drawer lateral para formulários (Workload). Somente layout — conteúdo e ações vêm do pai.
 * @param {string} [panelClassName] — classes extra no painel (ex.: largura alternativa)
 * @param {string} [titleId] — id do título para aria-labelledby (default: workload-form-drawer-title)
 * @param {boolean} [closeDisabled] — desabilita botão fechar (ex.: durante gravação)
 */
export default function WorkloadFormDrawer({ open, title, onClose, children, footer, panelClassName, rootClassName, titleId = 'workload-form-drawer-title', closeDisabled, ariaDescribedBy }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (closeDisabled) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, closeDisabled])

  if (!open) return null

  return (
    <div
      className={`workload-form-drawer-root ${entered ? 'workload-form-drawer-root--open' : ''}${rootClassName ? ` ${rootClassName}` : ''}`}
      aria-hidden={!open}
    >
      <div
        className="workload-form-drawer-overlay"
        onMouseDown={(e) => {
          // Evita fechar no mesmo gesto que abriu o drawer (mousedown no botão → overlay pinta antes do mouseup).
          if (e.target !== e.currentTarget || closeDisabled || !entered) return
          onClose()
        }}
        aria-hidden
      />
      <aside
        className={`workload-form-drawer-panel${panelClassName ? ` ${panelClassName}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {})}
      >
        <header className="workload-form-drawer-header">
          <h2 id={titleId} className="workload-form-drawer-title">{title}</h2>
          <button type="button" className="workload-form-drawer-close" onClick={onClose} disabled={closeDisabled} aria-label="Fechar">
            ✕
          </button>
        </header>
        <div className="workload-form-drawer-body">
          {children}
        </div>
        {footer != null && (
          <footer className="workload-form-drawer-footer">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}
