import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { anoIsoParaSemanaNoIntervalo, isoWeek } from '@/utils/periodos'
import { registrarLog } from '@/hooks/useAuditLog'

function fmtDataHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

/**
 * @param {'atividade'|'indicador'} props.tipo
 * @param {string} props.referenciaId — acao_id ou indicador_id
 * @param {string} props.nome
 * @param {number[]} props.semanas — ISOs da grade do período
 * @param {object|null} props.periodoRow — linha `periodos` (data_inicio, data_fim, ano)
 * @param {number} [props.semanaAno] — ano civil fallback para rótulos de data (opcional)
 * @param {() => void} props.onClose
 * @param {() => void} [props.onSaved]
 */
export default function ComentarioModal({
  tipo,
  referenciaId,
  nome,
  semanas,
  periodoRow,
  semanaAno: semanaAnoProp,
  onClose,
  onSaved
}) {
  const supabase = createClient()
  const tabela = tipo === 'atividade' ? 'comentarios_atividade' : 'comentarios_indicador'
  const colRef = tipo === 'atividade' ? 'acao_id' : 'indicador_id'
  const arquivoSql =
    tipo === 'atividade' ? 'supabase-comentarios-atividades.sql' : 'supabase-comentarios-indicadores.sql'

  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)
  const [semanaIsoSel, setSemanaIsoSel] = useState('')
  const [texto, setTexto] = useState('')
  const cardRef = useRef(null)
  const selectRef = useRef(null)

  const opcoesSemana = useMemo(() => {
    const arr = (semanas || []).map(n => Number(n)).filter(Number.isFinite)
    const uniq = [...new Set(arr)].sort((a, b) => a - b)
    const anoFallback =
      Number.isFinite(Number(semanaAnoProp)) ? Number(semanaAnoProp) : new Date().getFullYear()
    return uniq.map(iso => {
      const anoIso = anoIsoParaSemanaNoIntervalo(iso, periodoRow?.data_inicio, periodoRow?.data_fim)
      const datas = getDatasSemanaCurtaModal(iso, periodoRow, anoFallback)
      return { iso, anoIso, label: `S${iso} — ${datas}` }
    })
  }, [semanas, periodoRow, semanaAnoProp])

  const carregar = useCallback(async () => {
    if (!referenciaId) return
    setLoading(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from(tabela)
        .select('id, semana_iso, semana_ano, texto, created_at')
        .eq(colRef, referenciaId)
        .order('semana_iso', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setLista(data || [])
    } catch (err) {
      const msg = String(err?.message || err || '')
      if (msg.includes('schema cache') || msg.includes('does not exist')) {
        setErro(
          `A tabela de comentários ainda não foi criada no banco de dados. Rode o arquivo ${arquivoSql} no SQL Editor do Supabase.`
        )
      } else if (/row-level security|violates row-level security/i.test(msg)) {
        setErro(
          'As políticas de segurança (RLS) impedem listar comentários. Execute o arquivo supabase-comentarios-rls.sql no SQL Editor do Supabase.'
        )
      } else {
        setErro('Erro ao carregar comentários: ' + msg)
      }
      setLista([])
    } finally {
      setLoading(false)
    }
  }, [referenciaId, tabela, colRef, arquivoSql])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (opcoesSemana.length && !semanaIsoSel) {
      setSemanaIsoSel(String(opcoesSemana[0].iso))
    }
  }, [opcoesSemana, semanaIsoSel])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      const el = selectRef.current || cardRef.current?.querySelector('select, textarea, button')
      el?.focus?.()
    })
    return () => cancelAnimationFrame(t)
  }, [])

  const anoDaSelecionada = useMemo(() => {
    const n = Number(semanaIsoSel)
    const hit = opcoesSemana.find(o => o.iso === n)
    return hit?.anoIso ?? anoIsoParaSemanaNoIntervalo(n, periodoRow?.data_inicio, periodoRow?.data_fim)
  }, [semanaIsoSel, opcoesSemana, periodoRow])

  const salvar = async () => {
    const txt = String(texto || '').trim()
    if (!txt) {
      setErro('Digite o texto do comentário.')
      return
    }
    const iso = Number(semanaIsoSel)
    if (!Number.isFinite(iso)) {
      setErro('Selecione a semana.')
      return
    }
    setSaving(true)
    setErro(null)
    const row = {
      texto: txt,
      semana_iso: iso,
      semana_ano: anoDaSelecionada,
      [colRef]: referenciaId
    }
    try {
      const { error } = await supabase.from(tabela).insert(row)
      if (error) throw error
      void registrarLog({
        modulo: 'Planejamento',
        area: null,
        entidade: tabela,
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: row,
        descricao: `Criou comentário (${tipo}) "${(txt || '').slice(0, 60)}"`
      })
      setTexto('')
      await carregar()
      onSaved?.()
    } catch (err) {
      const msg = String(err?.message || err || '')
      if (msg.includes('schema cache') || msg.includes('does not exist')) {
        setErro(
          `A tabela de comentários ainda não foi criada no banco de dados. Rode o arquivo ${arquivoSql} no SQL Editor do Supabase.`
        )
      } else if (/row-level security|violates row-level security/i.test(msg)) {
        setErro(
          'As políticas de segurança (RLS) da tabela impedem salvar. Execute o arquivo supabase-comentarios-rls.sql no SQL Editor do Supabase (mesmo padrão do Planejamento / gantt_planejamento).'
        )
      } else {
        setErro('Erro ao salvar comentário: ' + msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const excluir = async id => {
    if (!id) return
    setSaving(true)
    setErro(null)
    try {
      const { error } = await supabase.from(tabela).delete().eq('id', id)
      if (error) throw error
      const prev = lista.find((x) => x.id === id) || null
      void registrarLog({
        modulo: 'Planejamento',
        area: null,
        entidade: tabela,
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev,
        descricao: `Excluiu comentário (${tipo}) "${(prev?.texto || '').slice(0, 60) || id}"`
      })
      await carregar()
      onSaved?.()
    } catch (err) {
      const msg = String(err?.message || err || '')
      if (msg.includes('schema cache') || msg.includes('does not exist')) {
        setErro(
          `A tabela de comentários ainda não foi criada no banco de dados. Rode o arquivo ${arquivoSql} no SQL Editor do Supabase.`
        )
      } else if (/row-level security|violates row-level security/i.test(msg)) {
        setErro(
          'As políticas de segurança (RLS) da tabela impedem excluir. Execute o arquivo supabase-comentarios-rls.sql no SQL Editor do Supabase.'
        )
      } else {
        setErro('Erro ao excluir comentário: ' + msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const grupos = useMemo(() => {
    const map = new Map()
    for (const row of lista) {
      const k = `${row.semana_ano}|${row.semana_iso}`
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(row)
    }
    const keys = [...map.keys()].sort((a, b) => {
      const [ya, wa] = a.split('|').map(Number)
      const [yb, wb] = b.split('|').map(Number)
      if (ya !== yb) return ya - yb
      return wa - wb
    })
    return keys.map(k => ({ key: k, semana_iso: Number(k.split('|')[1]), rows: map.get(k) }))
  }, [lista])

  return (
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(29, 47, 37, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comentario-modal-titulo"
        style={{
          background: "#ffffff",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          width: "min(520px, calc(100% - 32px))",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={e => e.stopPropagation()}
      >
        <header style={{
          background: "#1D2F25",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
          <div>
            <h2 id="comentario-modal-titulo" style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#C8E6A0" }}>Comentários</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(200,230,160,0.7)', marginTop: 2 }}>{nome || '—'}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(200,230,160,0.7)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0 }}>
            ×
          </button>
        </header>
        <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14, background: "#ffffff" }}>
          {erro && (
            <div className="alert alert-warning" style={{ marginBottom: 0 }}>
              <strong>Atenção:</strong> {erro}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="comentario-semana" style={{ fontSize: 12, fontWeight: 500, color: "#1D2F25" }}>Semana</label>
            <select
              ref={selectRef}
              id="comentario-semana"
              style={{ fontSize: 13, border: "0.5px solid #e0d9ce", borderRadius: 6, padding: "8px 10px", background: "#fafaf7", width: "100%" }}
              value={semanaIsoSel}
              onChange={e => setSemanaIsoSel(e.target.value)}
            >
              {opcoesSemana.map(o => (
                <option key={`${o.anoIso}-${o.iso}`} value={String(o.iso)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="comentario-texto" style={{ fontSize: 12, fontWeight: 500, color: "#1D2F25" }}>Texto</label>
            <textarea
              id="comentario-texto"
              style={{ fontSize: 13, border: "0.5px solid #e0d9ce", borderRadius: 6, padding: "10px 12px", background: "#fafaf7", width: "100%", resize: "vertical", minHeight: 80, boxSizing: "border-box" }}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Andamento, bloqueios ou observações desta semana..."
              rows={3}
            />
          </div>
          <button
            type="button"
            style={{ background: "#2F4A3A", color: "#D4EDAA", border: "none", padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", alignSelf: "flex-end" }}
            disabled={saving || loading}
            onClick={() => void salvar()}
          >
            Salvar comentário
          </button>
          <div style={{ borderTop: "0.5px solid #e0d9ce", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#888780", marginBottom: 8 }}>Comentários salvos</div>
            {loading ? (
              <p className="modal-hint">Carregando…</p>
            ) : grupos.length === 0 ? (
              <p className="modal-hint">Nenhum comentário ainda.</p>
            ) : (
              <ul className="gantt-comentario-modal-lista">
                {grupos.map(g => (
                  <li key={g.key}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#888780", marginBottom: 4, marginTop: 8 }}>S{g.semana_iso}</div>
                    <ul className="gantt-comentario-modal-lista gantt-comentario-modal-lista--itens">
                      {g.rows.map(r => (
                        <li key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fafaf7", border: "0.5px solid #e0d9ce", borderRadius: 6, padding: "10px 12px", marginBottom: 6, listStyle: "none" }}>
                          <div className="gantt-comentario-modal-item-conteudo">
                            <div style={{ fontSize: 11, color: "#888780", marginBottom: 3 }}>{fmtDataHora(r.created_at)}</div>
                            <div style={{ fontSize: 13, color: "#1D2F25", lineHeight: 1.4 }}>{r.texto}</div>
                          </div>
                          <button
                            type="button"
                            style={{ background: "transparent", border: "none", color: "#888780", fontSize: 16, cursor: "pointer", padding: 0, flexShrink: 0 }}
                            title="Excluir"
                            disabled={saving}
                            onClick={() => void excluir(r.id)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getDatasSemanaCurtaModal(semanaISO, periodoRow, anoFallback) {
  const sn = Number(semanaISO)
  if (!Number.isFinite(sn) || sn < 1 || sn > 53) return ''
  if (periodoRow?.data_inicio && periodoRow?.data_fim) {
    const ini = new Date(`${periodoRow.data_inicio}T12:00:00`)
    const fim = new Date(`${periodoRow.data_fim}T12:00:00`)
    if (!Number.isNaN(ini.getTime()) && !Number.isNaN(fim.getTime()) && ini <= fim) {
      let sample = null
      for (let t = ini.getTime(); t <= fim.getTime(); t += 86400000) {
        const cur = new Date(t)
        if (isoWeek(cur) === sn) {
          sample = cur
          break
        }
      }
      if (sample) {
        const d0 = new Date(sample.getFullYear(), sample.getMonth(), sample.getDate())
        const dow = d0.getDay()
        const monday = new Date(d0)
        monday.setDate(d0.getDate() - (dow === 0 ? 6 : dow - 1))
        const domingo = new Date(monday)
        domingo.setDate(monday.getDate() + 6)
        const fmt = dt => `${dt.getDate()}/${dt.getMonth() + 1}`
        if (monday.getMonth() !== domingo.getMonth()) {
          return `${fmt(monday)}–${fmt(domingo)}`
        }
        return `${monday.getDate()}–${fmt(domingo)}`
      }
    }
  }
  const y = Number.isFinite(anoFallback) ? anoFallback : new Date().getFullYear()
  const simples = new Date(Date.UTC(y, 0, 1 + (sn - 1) * 7))
  const diaSemana = simples.getUTCDay() || 7
  const segunda = new Date(simples)
  segunda.setUTCDate(simples.getUTCDate() - diaSemana + 1)
  const domingo = new Date(segunda)
  domingo.setUTCDate(segunda.getUTCDate() + 6)
  const fmt = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
  if (segunda.getUTCMonth() !== domingo.getUTCMonth()) {
    return `${fmt(segunda)}–${fmt(domingo)}`
  }
  return `${segunda.getUTCDate()}–${fmt(domingo)}`
}


