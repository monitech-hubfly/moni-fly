import { useState, useEffect, useMemo, useRef } from 'react'

/**
 * Single-select de responsável por área. valueIds é array por compatibilidade mas terá 1 elemento.
 * - pessoas: registros de area_pessoas com profile_full_name opcional
 * - profiles: todos os profiles da empresa para o painel "+ Adicionar responsável"
 * - onOcultarPessoa: (pessoaId) => void — marca ativo=false
 * - onAdicionarProfile: async (profileId) => void — cria area_pessoas
 */
export default function ResponsaveisAreaMultiSelect({
  id = 'responsaveis-area-multi',
  pessoas = [],
  valueIds = [],
  onChange,
  disabled = false,
  emptyHint = '',
  labelId,
  profiles = [],
  onAdicionarProfile,
  onOcultarPessoa,
  salvandoNovaPessoa = false,
}) {
  const [open, setOpen] = useState(false)
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [profileSearch, setProfileSearch] = useState('')
  const [addingProfileId, setAddingProfileId] = useState(null)
  const wrapRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) { setShowAddProfile(false); setProfileSearch('') }
  }, [open])

  useEffect(() => {
    if (showAddProfile) {
      const raf = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
  }, [showAddProfile])

  useEffect(() => {
    if (!open) return
    const onDoc = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = useMemo(
    () => pessoas.filter(p => valueIds.includes(p.id)),
    [pessoas, valueIds]
  )

  const displayName = p => p.profile_full_name || p.nome

  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return '—'
    const s = selected.map(displayName).join(', ')
    return s.length > 48 ? `${s.slice(0, 45)}…` : s
  }, [selected])

  function iniciais(nome) {
    const parts = String(nome || '').trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  function aoEscolherPessoa(pid) {
    if (disabled) return
    onChange([pid])
    setOpen(false)
  }

  async function aoAdicionarProfile(profileId) {
    if (!onAdicionarProfile || addingProfileId) return
    setAddingProfileId(profileId)
    try {
      await onAdicionarProfile(profileId)
    } finally {
      setAddingProfileId(null)
      setShowAddProfile(false)
      setProfileSearch('')
      setOpen(false)
    }
  }

  // Profiles ainda não cadastrados em pessoas (por profile_id ou full_name)
  const pessoasProfileIds = new Set(pessoas.map(p => p.profile_id).filter(Boolean))
  const pessoasNomes = new Set(pessoas.map(p => (p.profile_full_name || p.nome || '').toLowerCase().trim()))
  const profilesDisponiveis = useMemo(() => {
    return profiles.filter(pr => {
      if (pessoasProfileIds.has(pr.id)) return false
      if (pr.full_name && pessoasNomes.has(pr.full_name.toLowerCase().trim())) return false
      return true
    })
  }, [profiles, pessoas])

  const profilesFiltrados = useMemo(() => {
    const q = profileSearch.trim().toLowerCase()
    if (!q) return profilesDisponiveis
    return profilesDisponiveis.filter(pr =>
      (pr.full_name || '').toLowerCase().includes(q) ||
      (pr.email || '').toLowerCase().includes(q)
    )
  }, [profilesDisponiveis, profileSearch])

  const listboxId = `${id}-listbox`
  const podeAdicionar = typeof onAdicionarProfile === 'function'

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
      {emptyHint && pessoas.length === 0 && !open && (
        <p className="responsaveis-multi-hint" role="note">{emptyHint}</p>
      )}
      {open && (
        <div className="responsaveis-multi-panel responsaveis-multi-panel--simples" role="presentation">
          <ul id={listboxId} className="responsaveis-multi-list responsaveis-multi-list--simples" role="listbox" aria-multiselectable="false">
            {pessoas.length === 0 && !showAddProfile && (
              <li className="responsaveis-multi-empty">Nenhum nome nesta área.</li>
            )}
            {pessoas.map(p => {
              const checked = valueIds.includes(p.id)
              const nome = displayName(p)
              return (
                <li key={p.id} role="option" aria-selected={checked} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`responsaveis-multi-option responsaveis-multi-option--nome ${checked ? 'responsaveis-multi-option--selected' : ''}`}
                    onClick={() => aoEscolherPessoa(p.id)}
                    disabled={disabled}
                    style={{ flex: 1 }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#e8eef1', color: '#0e3a4e',
                        fontSize: 9, fontWeight: 700, flexShrink: 0, marginRight: 6,
                      }}
                    >
                      {iniciais(nome)}
                    </span>
                    <span className="responsaveis-multi-option-text">{nome}</span>
                  </button>
                  {typeof onOcultarPessoa === 'function' && (
                    <button
                      type="button"
                      title="Ocultar desta área"
                      aria-label={`Ocultar ${nome}`}
                      onClick={e => { e.stopPropagation(); onOcultarPessoa(p.id) }}
                      disabled={disabled}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#aaa', fontSize: 13, lineHeight: 1,
                        padding: '0 6px', flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {podeAdicionar && (
            <div className="responsaveis-multi-footer responsaveis-multi-footer--simples">
              {showAddProfile ? (
                <div style={{ padding: '6px 8px' }}>
                  <input
                    ref={searchRef}
                    type="text"
                    className="responsaveis-multi-novo-input"
                    placeholder="Buscar por nome ou email…"
                    value={profileSearch}
                    onChange={e => setProfileSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setShowAddProfile(false); setProfileSearch('') } }}
                    style={{ width: '100%', marginBottom: 4 }}
                  />
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 160, overflowY: 'auto' }}>
                    {profilesFiltrados.length === 0 && (
                      <li style={{ padding: '4px 0', fontSize: 12, color: '#888' }}>Nenhum profile encontrado.</li>
                    )}
                    {profilesFiltrados.map(pr => (
                      <li key={pr.id}>
                        <button
                          type="button"
                          className="responsaveis-multi-option responsaveis-multi-option--nome"
                          onClick={() => aoAdicionarProfile(pr.id)}
                          disabled={!!addingProfileId || salvandoNovaPessoa}
                          style={{ width: '100%', textAlign: 'left' }}
                        >
                          <span
                            aria-hidden
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 20, height: 20, borderRadius: '50%',
                              background: '#e8eef1', color: '#0e3a4e',
                              fontSize: 9, fontWeight: 700, flexShrink: 0, marginRight: 6,
                            }}
                          >
                            {iniciais(pr.full_name)}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 13 }}>{pr.full_name || '—'}</span>
                            {pr.email && <span style={{ fontSize: 10, color: '#888' }}>{pr.email}</span>}
                          </span>
                          {addingProfileId === pr.id && <span style={{ marginLeft: 'auto', fontSize: 11 }}>…</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setShowAddProfile(false); setProfileSearch('') }}
                    style={{ marginTop: 4, fontSize: 11 }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="responsaveis-multi-novo-link"
                  onClick={() => setShowAddProfile(true)}
                  disabled={disabled || salvandoNovaPessoa}
                >
                  + Adicionar responsável
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
