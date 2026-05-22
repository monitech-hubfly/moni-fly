import { useState, useEffect, useMemo, useRef } from 'react'

/**
 * Multi-seleção no dropdown: lista só com nomes (clique alterna) + "+ Novo responsável" no rodapé.
 */
export default function ResponsaveisAreaMultiSelect({
  id = 'responsaveis-area-multi',
  pessoas = [],
  valueIds = [],
  onChange,
  disabled = false,
  onAdicionarPessoa,
  salvandoNovaPessoa = false,
  emptyHint = '',
  showClosedHint = true,
  novoResponsavelLabel = '+ Novo responsável',
  labelId
}) {
  const [open, setOpen] = useState(false)
  const [showNovo, setShowNovo] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const wrapRef = useRef(null)
  const novoInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setShowNovo(false)
        setNovoNome('')
      }
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        setOpen(false)
        setShowNovo(false)
        setNovoNome('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (showNovo && open) {
      const idRaf = requestAnimationFrame(() => novoInputRef.current?.focus())
      return () => cancelAnimationFrame(idRaf)
    }
    return undefined
  }, [showNovo, open])

  const selected = useMemo(
    () => pessoas.filter(p => valueIds.includes(p.id)),
    [pessoas, valueIds]
  )

  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return '—'
    const s = selected.map(p => p.nome).join(', ')
    return s.length > 48 ? `${s.slice(0, 45)}…` : s
  }, [selected])

  function toggle(pid) {
    if (disabled) return
    const next = valueIds.includes(pid) ? valueIds.filter(x => x !== pid) : [...valueIds, pid]
    onChange(next)
  }

  function fecharPainel() {
    setOpen(false)
    setShowNovo(false)
    setNovoNome('')
  }

  function aoEscolherPessoa(pid) {
    toggle(pid)
    fecharPainel()
  }

  async function confirmarNovo() {
    const n = novoNome.trim()
    if (!n || !onAdicionarPessoa || salvandoNovaPessoa) return
    const novoId = await onAdicionarPessoa(n)
    if (!novoId) return
    setNovoNome('')
    setShowNovo(false)
    if (!valueIds.includes(novoId)) {
      onChange([...valueIds, novoId])
    }
    setOpen(false)
  }

  const listboxId = `${id}-listbox`
  const podeAdicionar = typeof onAdicionarPessoa === 'function'

  return (
    <div
      className="responsaveis-multi"
      ref={wrapRef}
      role="group"
      aria-labelledby={labelId || undefined}
    >
      <button
        type="button"
        id={id}
        className="responsaveis-multi-trigger responsaveis-multi-trigger--selectlike"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={labelId}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className="responsaveis-multi-trigger-text">{triggerLabel}</span>
        <span className="responsaveis-multi-chevron" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {showClosedHint && emptyHint && pessoas.length === 0 && !open && (
        <p className="responsaveis-multi-hint" role="note">{emptyHint}</p>
      )}
      {open && (
        <div className="responsaveis-multi-panel responsaveis-multi-panel--simples" role="presentation">
          <ul id={listboxId} className="responsaveis-multi-list responsaveis-multi-list--simples" role="listbox" aria-multiselectable="true">
            {pessoas.length === 0 && !showNovo && (
              <li className="responsaveis-multi-empty">Nenhum nome nesta área.</li>
            )}
            {pessoas.map(p => {
              const checked = valueIds.includes(p.id)
              return (
                <li key={p.id} role="option" aria-selected={checked}>
                  <button
                    type="button"
                    className={`responsaveis-multi-option responsaveis-multi-option--nome ${checked ? 'responsaveis-multi-option--selected' : ''}`}
                    onClick={() => aoEscolherPessoa(p.id)}
                    disabled={disabled}
                  >
                    <span className="responsaveis-multi-option-text">{p.nome}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {podeAdicionar && (
            <div className="responsaveis-multi-footer responsaveis-multi-footer--simples">
              {showNovo ? (
                <div className="responsaveis-multi-novo-row">
                  <input
                    ref={novoInputRef}
                    type="text"
                    className="responsaveis-multi-novo-input"
                    placeholder="Nome"
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmarNovo() }
                      if (e.key === 'Escape') { setShowNovo(false); setNovoNome('') }
                    }}
                    disabled={salvandoNovaPessoa}
                    aria-label="Nome do novo responsável"
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm responsaveis-multi-novo-btn"
                    onClick={confirmarNovo}
                    disabled={salvandoNovaPessoa || !novoNome.trim()}
                  >
                    {salvandoNovaPessoa ? '…' : 'OK'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setShowNovo(false); setNovoNome('') }}
                    disabled={salvandoNovaPessoa}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="responsaveis-multi-novo-link"
                  onClick={() => setShowNovo(true)}
                  disabled={disabled || salvandoNovaPessoa}
                >
                  {novoResponsavelLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
