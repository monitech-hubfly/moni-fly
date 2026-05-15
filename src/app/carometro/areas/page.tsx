// @ts-nocheck
'use client';

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/hooks/useAuditLog'
import { listarAreas } from '@/utils/areasOrder'

const AREAS_PADRAO = [
  'Marketing', 'Comercial', 'Portfólio', 'Acoplamento', 'Produto', 'Projetos',
  'Homologações', 'Wayzer - Nath', 'Wayzer - Rafa', 'Frank Moní', 'Processos',
  'Ferramentas', 'Crédito', 'Moní Capital', 'Controladoria', 'Adm', 'Jurídico'
]

function proximaOrdemSugerida(lista) {
  const nums = (lista || []).map(a => Number(a.ordem) || 0)
  return (nums.length ? Math.max(...nums) : 0) + 10
}

export default function Page() {
  const supabase = createClient()
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [ordem, setOrdem] = useState(0)
  const [seedando, setSeedando] = useState(false)

  async function carregar() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await listarAreas(supabase, '*')
    if (e) {
      setError(e.message)
      setAreas([])
    } else {
      setAreas(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleSeed() {
    setSeedando(true)
    setError(null)
    for (let i = 0; i < AREAS_PADRAO.length; i++) {
      const n = AREAS_PADRAO[i]
      let { error: e } = await supabase.from('areas').insert({
        nome: n,
        ativo: true,
        ordem: (i + 1) * 10
      })
      if (e && String(e.message || '').toLowerCase().includes('ordem')) {
        ({ error: e } = await supabase.from('areas').insert({ nome: n, ativo: true }))
      }
      if (e) {
        setError(e.message)
        break
      }
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'areas',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: { nome: n, ativo: true, ordem: (i + 1) * 10 },
        descricao: `Criou área (padrão) "${n}"`
      })
    }
    setSeedando(false)
    carregar()
  }

  function abrirNovo() {
    setEditingId(null)
    setNome('')
    setAtivo(true)
    setOrdem(proximaOrdemSugerida(areas))
    setShowForm(true)
  }

  function abrirEditar(a) {
    setEditingId(a.id)
    setNome(a.nome)
    setAtivo(a.ativo ?? true)
    setOrdem(Number(a.ordem) || 0)
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditingId(null)
    setNome('')
    setAtivo(true)
    setOrdem(0)
  }

  async function salvar(e) {
    e.preventDefault()
    setError(null)
    const ordemNum = Math.max(0, Math.floor(Number(ordem) || 0))
    if (editingId) {
      let { error: e2 } = await supabase.from('areas').update({ nome, ativo, ordem: ordemNum }).eq('id', editingId)
      if (e2 && String(e2.message || '').toLowerCase().includes('ordem')) {
        ({ error: e2 } = await supabase.from('areas').update({ nome, ativo }).eq('id', editingId))
      }
      if (e2) setError(e2.message)
      else {
        const prev = areas.find((a) => a.id === editingId)
        void registrarLog({
          modulo: 'Cadastros',
          area: nome,
          entidade: 'areas',
          entidade_id: editingId,
          operacao: 'UPDATE',
          valor_anterior: prev ? { nome: prev.nome, ativo: prev.ativo, ordem: prev.ordem } : null,
          valor_novo: { nome, ativo, ordem: ordemNum },
          descricao: `Alterou área "${nome}"`
        })
        fecharForm()
        carregar()
      }
    } else {
      let { error: e2 } = await supabase.from('areas').insert({ nome, ativo, ordem: ordemNum })
      if (e2 && String(e2.message || '').toLowerCase().includes('ordem')) {
        ({ error: e2 } = await supabase.from('areas').insert({ nome, ativo }))
      }
      if (e2) setError(e2.message)
      else {
        void registrarLog({
          modulo: 'Cadastros',
          area: nome,
          entidade: 'areas',
          entidade_id: null,
          operacao: 'INSERT',
          valor_novo: { nome, ativo, ordem: ordemNum },
          descricao: `Criou área "${nome}"`
        })
        fecharForm()
        carregar()
      }
    }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta área?')) return
    setError(null)
    const prev = areas.find((a) => a.id === id)
    const { error: e } = await supabase.from('areas').delete().eq('id', id)
    if (e) setError(e.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: prev?.nome || null,
        entidade: 'areas',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev || null,
        descricao: prev ? `Excluiu área "${prev.nome}"` : 'Excluiu área'
      })
      carregar()
    }
  }

  return (
    <>
      <h1>Áreas</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="page-actions">
        <button type="button" className="btn btn-primary" onClick={abrirNovo}>Nova área</button>
        {areas.length === 0 && (
          <button type="button" className="btn" onClick={handleSeed} disabled={seedando}>
            {seedando ? 'Cadastrando…' : 'Cadastrar áreas padrão (17 áreas)'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', maxWidth: '420px' }}>
          <form onSubmit={salvar}>
            <div className="form-group">
              <label htmlFor="area-ordem">Ordem na lista (filtros)</label>
              <input
                id="area-ordem"
                type="number"
                min={0}
                step={1}
                value={ordem}
                onChange={e => {
                  const v = e.target.value
                  setOrdem(v === '' ? 0 : Math.max(0, parseInt(v, 10) || 0))
                }}
                required
              />
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Número menor aparece primeiro nos seletores de área (Gantt, Workload, Indicadores, etc.).
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="area-nome">Nome</label>
              <input id="area-nome" value={nome} onChange={e => setNome(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo
              </label>
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
      ) : areas.length === 0 ? (
        <div className="empty-state">Nenhuma área. Clique em &quot;Nova área&quot; ou &quot;Cadastrar áreas padrão&quot;.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '88px' }}>Ordem</th>
                <th>Nome</th>
                <th>Ativo</th>
                <th style={{ width: '120px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {areas.map(a => (
                <tr key={a.id}>
                  <td>{Number(a.ordem) || 0}</td>
                  <td>{a.nome}</td>
                  <td>{a.ativo ? 'Sim' : 'Não'}</td>
                  <td>
                    <button type="button" className="btn" onClick={() => abrirEditar(a)}>Editar</button>
                    <button type="button" className="btn btn-danger" onClick={() => excluir(a.id)}>Excluir</button>
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
