// @ts-nocheck
'use client';

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/hooks/useAuditLog'
import { listarAreas } from '@/utils/areasOrder'
import PeriodoSelect from '@/components/PeriodoSelect'
import { labelPeriodo } from '@/utils/periodos'

export default function Page() {
  const supabase = createClient()
  const [areas, setAreas] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroPeriodoId, setFiltroPeriodoId] = useState('')
  const [filtroPeriodoTipo, setFiltroPeriodoTipo] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [area_id, setArea_id] = useState('')
  const [periodo_id, setPeriodo_id] = useState('')
  const [periodoTipo, setPeriodoTipo] = useState(null)
  const [descricao, setDescricao] = useState('')
  const [meta_valor, setMeta_valor] = useState('')
  const [meta_unidade, setMeta_unidade] = useState('')

  async function carregarAreas() {
    const { data } = await listarAreas(supabase, 'id, nome')
    const list = data || []
    setAreas(list)
    if (!list.length) return
    const ids = new Set(list.map((a) => String(a?.id ?? '')).filter(Boolean))
    const current = filtroArea && ids.has(String(filtroArea)) ? String(filtroArea) : null
    const fromStorage = localStorage.getItem('carometro_ultima_area')
    const next = current || (fromStorage && ids.has(fromStorage) ? fromStorage : null)
    if (next && next !== filtroArea) setFiltroArea(next)
    if (next) localStorage.setItem('carometro_ultima_area', next)
  }

  async function carregarObjetivos() {
    setLoading(true)
    setError(null)
    let q = supabase
      .from('objetivos')
      .select('*, areas(nome), periodos(id, tipo, ano, numero, data_inicio, data_fim)')
      .order('criado_em', { ascending: false })
    if (filtroArea) q = q.eq('area_id', filtroArea)
    if (filtroPeriodoId) q = q.eq('periodo_id', filtroPeriodoId)
    const { data, error: e } = await q
    if (e) {
      setError(e.message)
      setObjetivos([])
    } else {
      setObjetivos(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { carregarAreas() }, [])
  useEffect(() => { carregarObjetivos() }, [filtroArea, filtroPeriodoId])

  function abrirNovo() {
    setEditingId(null)
    setArea_id(filtroArea || (areas[0]?.id || ''))
    setPeriodo_id(filtroPeriodoId || '')
    setPeriodoTipo(filtroPeriodoTipo || 'mes')
    setDescricao('')
    setMeta_valor('')
    setMeta_unidade('')
    setShowForm(true)
  }

  function abrirEditar(o) {
    setEditingId(o.id)
    setArea_id(o.area_id)
    setPeriodo_id(o.periodo_id || '')
    setPeriodoTipo(o.periodos?.tipo || null)
    setDescricao(o.descricao || '')
    setMeta_valor(o.meta_valor ?? '')
    setMeta_unidade(o.meta_unidade || '')
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function salvar(e) {
    e.preventDefault()
    setError(null)
    const payload = { area_id, periodo_id: periodo_id || null, descricao, meta_unidade: meta_unidade || null }
    if (meta_valor !== '') payload.meta_valor = Number(meta_valor)
    const nomeArea = areas.find((a) => a.id === area_id)?.nome
    if (editingId) {
      const { error: e2 } = await supabase.from('objetivos').update(payload).eq('id', editingId)
      if (e2) setError(e2.message)
      else {
        const prev = objetivos.find((o) => o.id === editingId)
        void registrarLog({
          modulo: 'Planejamento',
          area: nomeArea,
          entidade: 'objetivo',
          entidade_id: editingId,
          operacao: 'UPDATE',
          valor_anterior: prev
            ? {
                descricao: prev.descricao,
                meta_valor: prev.meta_valor,
                meta_unidade: prev.meta_unidade
              }
            : null,
          valor_novo: payload,
          descricao: `Alterou objetivo "${descricao || prev?.descricao || editingId}"`
        })
        fecharForm()
        carregarObjetivos()
      }
    } else {
      const { error: e2 } = await supabase.from('objetivos').insert(payload)
      if (e2) setError(e2.message)
      else {
        void registrarLog({
          modulo: 'Planejamento',
          area: nomeArea,
          entidade: 'objetivo',
          entidade_id: null,
          operacao: 'INSERT',
          valor_novo: payload,
          descricao: `Criou objetivo "${descricao || '(sem nome)'}"`
        })
        fecharForm()
        carregarObjetivos()
      }
    }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este objetivo?')) return
    setError(null)
    const prev = objetivos.find((o) => o.id === id)
    const nomeArea = prev?.areas?.nome
    const { error: e } = await supabase.from('objetivos').delete().eq('id', id)
    if (e) setError(e.message)
    else {
      void registrarLog({
        modulo: 'Planejamento',
        area: nomeArea || null,
        entidade: 'objetivo',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev || null,
        descricao: prev ? `Excluiu objetivo "${prev.descricao || id}"` : `Excluiu objetivo ${id}`
      })
      carregarObjetivos()
    }
  }

  return (
    <>
      <h1 className="carometro-page-title">Objetivos / Metas</h1>
      <p className="carometro-page-subtitle">Os objetivos são definidos em reunião com a área, e a própria área pode cadastrá-los aqui. Metas numéricas são opcionais.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="page-actions" style={{ alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Filtrar por área</label>
          <select value={filtroArea} onChange={e => {
            const v = e.target.value
            setFiltroArea(v)
            if (v) localStorage.setItem('carometro_ultima_area', v)
          }} style={{ minWidth: '180px' }}>
            <option value="">Todas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <PeriodoSelect
          value={filtroPeriodoId}
          defaultTipo={filtroPeriodoTipo || 'mes'}
          onChange={(id, tipo) => {
            setFiltroPeriodoId(id || '')
            setFiltroPeriodoTipo(tipo || null)
          }}
        />
        <button type="button" className="btn btn-primary" onClick={abrirNovo}>Novo objetivo</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', maxWidth: '500px' }}>
          <form onSubmit={salvar}>
            <div className="form-group">
              <label>Área</label>
              <select value={area_id} onChange={e => setArea_id(e.target.value)} required>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <PeriodoSelect
                value={periodo_id}
                defaultTipo={periodoTipo || 'mes'}
                onChange={(id, tipo) => {
                  setPeriodo_id(id || '')
                  setPeriodoTipo(tipo || null)
                }}
              />
            </div>
            <div className="form-group">
              <label>Descrição do objetivo</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Meta valor (opcional)</label>
              <input type="number" step="any" value={meta_valor} onChange={e => setMeta_valor(e.target.value)} placeholder="Ex: 100" />
            </div>
            <div className="form-group">
              <label>Unidade da meta (opcional)</label>
              <input value={meta_unidade} onChange={e => setMeta_unidade(e.target.value)} placeholder="Ex: %, unidades" />
            </div>
            <div className="page-actions">
              <button type="submit" className="btn btn-primary">Salvar</button>
              <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p>Carregando…</p>
      ) : objetivos.length === 0 ? (
        <div className="empty-state">Nenhum objetivo. Use os filtros e clique em &quot;Novo objetivo&quot;.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Área</th>
                <th>Período</th>
                <th>Descrição</th>
                <th>Meta</th>
                <th style={{ width: '120px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {objetivos.map(o => (
                <tr key={o.id}>
                  <td>{o.areas?.nome ?? '-'}</td>
                  <td>{o.periodos ? labelPeriodo(o.periodos) : '—'}</td>
                  <td>{o.descricao}</td>
                  <td>{o.meta_valor != null ? `${o.meta_valor} ${o.meta_unidade || ''}` : '-'}</td>
                  <td>
                    <button type="button" className="btn" onClick={() => abrirEditar(o)}>Editar</button>
                    <button type="button" className="btn btn-danger" onClick={() => excluir(o.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
