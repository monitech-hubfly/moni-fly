// @ts-nocheck
'use client';

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/hooks/useAuditLog'
import { listarAreas } from '@/utils/areasOrder'
import CalendarioComSemanas from '@/components/CalendarioComSemanas'

function formatarData(d) {
  if (!d) return '—'
  // Datas vindas do Supabase como DATE (YYYY-MM-DD) devem ser tratadas como "date-only",
  // senão o JS pode aplicar timezone e exibir um dia diferente.
  const s = typeof d === 'string' ? d.slice(0, 10) : null
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-').map(n => Number(n))
    const x = new Date(Date.UTC(y, m - 1, day))
    return x.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const x = new Date(d)
  return x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TIPOS_PERIODO = [
  { value: 'semana', label: 'Semana', min: 1, max: 53 },
  { value: 'mes', label: 'Mês', min: 1, max: 12 },
  { value: 'bimestre', label: 'Bimestre', min: 1, max: 6 },
  { value: 'trimestre', label: 'Trimestre', min: 1, max: 4 },
  { value: 'semestre', label: 'Semestre', min: 1, max: 2 },
  { value: 'ano', label: 'Ano', min: null, max: null }
]

export default function Page() {
  const supabase = createClient()
  const [areas, setAreas] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [loadingPeriodos, setLoadingPeriodos] = useState(true)
  const [migracaoPeriodos, setMigracaoPeriodos] = useState(false)
  const [showFormPeriodo, setShowFormPeriodo] = useState(false)
  const [formPeriodoTipo, setFormPeriodoTipo] = useState('mes')
  const [formPeriodoAno, setFormPeriodoAno] = useState(new Date().getFullYear())
  const [formPeriodoNumero, setFormPeriodoNumero] = useState(1)
  const [formPeriodoInicio, setFormPeriodoInicio] = useState('')
  const [formPeriodoFim, setFormPeriodoFim] = useState('')
  const [salvandoPeriodo, setSalvandoPeriodo] = useState(false)
  const [editPeriodoId, setEditPeriodoId] = useState(null)
  const [editPeriodoInicio, setEditPeriodoInicio] = useState('')
  const [editPeriodoFim, setEditPeriodoFim] = useState('')
  const [excluindoPeriodoId, setExcluindoPeriodoId] = useState(null)
  const [recorrencias, setRecorrencias] = useState([])
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [loadingRecorrencias, setLoadingRecorrencias] = useState(true)

  // Recorrência usada para CLASSIFICACOES de metas (separada de recorrencias_atividade).
  // Se a tabela ainda nao existir no Supabase, a tela funciona com fallback em memoria.
  const RECORRENCIAS_METAS_DEFAULT = [
    { id: 'mock-unica', codigo: 'unica', descricao: 'Atividade única', ativo: true, ordem: 1 },
    { id: 'mock-semanal', codigo: 'semanal', descricao: 'Semanal', ativo: true, ordem: 2 },
    { id: 'mock-quinzenal', codigo: 'quinzenal', descricao: 'Quinzenal', ativo: true, ordem: 3 },
    { id: 'mock-mensal', codigo: 'mensal', descricao: 'Mensal', ativo: true, ordem: 4 },
    { id: 'mock-bimestral', codigo: 'bimestral', descricao: 'Bimestral', ativo: true, ordem: 5 },
    { id: 'mock-trimestral', codigo: 'trimestral', descricao: 'Trimestral', ativo: true, ordem: 6 },
    { id: 'mock-semestral', codigo: 'semestral', descricao: 'Semestral', ativo: true, ordem: 7 },
    { id: 'mock-anual', codigo: 'anual', descricao: 'Anual', ativo: true, ordem: 8 }
  ]
  const [recorrenciasMetas, setRecorrenciasMetas] = useState([])
  const [loadingRecorrenciasMetas, setLoadingRecorrenciasMetas] = useState(true)
  // (Sem botão "Pré-cadastrar" agora)
  const [detalheErroRecorrenciasMetas, setDetalheErroRecorrenciasMetas] = useState('')
  const [editRecMetaId, setEditRecMetaId] = useState(null)
  const [editRecMetaDescricao, setEditRecMetaDescricao] = useState('')
  const [excluindoRecMetaId, setExcluindoRecMetaId] = useState(null)

  const [showFormNovaRecMeta, setShowFormNovaRecMeta] = useState(false)
  const [formNovaRecMetaDescricao, setFormNovaRecMetaDescricao] = useState('')
  const [formNovaRecMetaAtivo, setFormNovaRecMetaAtivo] = useState(true)
  const [salvandoNovaRecMeta, setSalvandoNovaRecMeta] = useState(false)
  const [error, setError] = useState(null)
  const [anoCalendario, setAnoCalendario] = useState(new Date().getFullYear())
  const [editRecId, setEditRecId] = useState(null)
  const [editRecDescricao, setEditRecDescricao] = useState('')
  const [multiplicadorTipos, setMultiplicadorTipos] = useState([])
  const [loadingMultiplicador, setLoadingMultiplicador] = useState(true)
  const [showFormMult, setShowFormMult] = useState(false)
  const [formMultCodigo, setFormMultCodigo] = useState('')
  const [formMultDescricao, setFormMultDescricao] = useState('')
  const [salvandoMult, setSalvandoMult] = useState(false)
  const [editMultId, setEditMultId] = useState(null)
  const [editMultDescricao, setEditMultDescricao] = useState('')
  const [excluindoMultId, setExcluindoMultId] = useState(null)

  async function carregarAreas() {
    setLoadingAreas(true)
    const { data } = await listarAreas(supabase, 'id, nome, ativo, ordem')
    setAreas(data || [])
    setLoadingAreas(false)
  }

  async function carregarRecorrencias() {
    setLoadingRecorrencias(true)
    const { data, error } = await supabase.from('recorrencias_atividade').select('*').order('ordem').order('descricao')
    if (!error) setRecorrencias(data || [])
    setLoadingRecorrencias(false)
  }

  async function carregarRecorrenciasMetas() {
    setLoadingRecorrenciasMetas(true)
    setDetalheErroRecorrenciasMetas('')
    try {
      const { data, error } = await supabase
        .from('recorrencias_metas')
        .select('*')
        .order('ordem')
        .order('descricao')

      if (error) {
        setRecorrenciasMetas(RECORRENCIAS_METAS_DEFAULT)
        const msg = String(error?.message || '')
        setDetalheErroRecorrenciasMetas(msg || 'Erro ao carregar recorrências de metas.')
        return
      }

      const lista = data || []
      if (!lista.length) {
        setRecorrenciasMetas(RECORRENCIAS_METAS_DEFAULT)
      } else setRecorrenciasMetas(lista)
    } catch {
      setRecorrenciasMetas(RECORRENCIAS_METAS_DEFAULT)
      setDetalheErroRecorrenciasMetas('Falha ao carregar recorrências de metas.')
    } finally {
      setLoadingRecorrenciasMetas(false)
    }
  }

  async function salvarRecorrenciaMetaDescricao(id) {
    if (!id) return
    const descricao = editRecMetaDescricao.trim()
    if (!descricao) return
    setError(null)
    const prev = recorrenciasMetas.find((x) => x.id === id)
    const { error } = await supabase.from('recorrencias_metas').update({ descricao }).eq('id', id)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'metas',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev ? { descricao: prev.descricao } : null,
        valor_novo: { descricao },
        descricao: `Alterou recorrência de meta "${descricao}"`
      })
      setEditRecMetaId(null)
      setEditRecMetaDescricao('')
      carregarRecorrenciasMetas()
    }
  }

  async function alternarRecorrenciaMetaAtiva(id, ativoAtual) {
    if (!id) return
    setError(null)
    const prev = recorrenciasMetas.find((x) => x.id === id)
    const { error } = await supabase.from('recorrencias_metas').update({ ativo: !ativoAtual }).eq('id', id)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'metas',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev ? { ativo: ativoAtual } : null,
        valor_novo: { ativo: !ativoAtual },
        descricao: `Alterou ativo da recorrência de meta "${prev?.descricao || id}"`
      })
      carregarRecorrenciasMetas()
    }
  }

  function abrirFormNovaRecMeta() {
    setShowFormNovaRecMeta(true)
    setFormNovaRecMetaDescricao('')
    setFormNovaRecMetaAtivo(true)
    setError(null)
    setDetalheErroRecorrenciasMetas('')
  }

  function cancelarFormNovaRecMeta() {
    setShowFormNovaRecMeta(false)
    setFormNovaRecMetaDescricao('')
    setFormNovaRecMetaAtivo(true)
  }

  function slugifyCodigo(text) {
    const t = String(text || '').trim().toLowerCase()
    if (!t) return ''
    const semAcentos = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return semAcentos
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function validarRecMetaForm(descricao) {
    const d = String(descricao || '').trim()
    if (!d) return 'Informe uma descrição para a recorrência.'
    return ''
  }

  async function salvarNovaRecorrenciaMeta(e) {
    e?.preventDefault?.()
    if (salvandoNovaRecMeta) return
    const descricao = formNovaRecMetaDescricao.trim()
    const msg = validarRecMetaForm(descricao)
    if (msg) {
      setError(msg)
      return
    }
    setError(null)
    setDetalheErroRecorrenciasMetas('')

    const ativo = Boolean(formNovaRecMetaAtivo)
    const codigo = slugifyCodigo(descricao)
    if (!codigo) {
      setError('Não foi possível gerar um código para a recorrência. Ajuste a descrição.')
      return
    }
    setSalvandoNovaRecMeta(true)
    try {
      const maxOrdem = recorrenciasMetas.reduce((mx, x) => Math.max(mx, Number(x.ordem ?? 0)), 0)
      const { error } = await supabase.from('recorrencias_metas').insert({
        codigo,
        descricao,
        ativo,
        ordem: maxOrdem + 1
      })
      if (error) {
        setError(error.message)
        return
      }
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'metas',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: { codigo, descricao, ativo, ordem: maxOrdem + 1 },
        descricao: `Criou recorrência de meta "${descricao}"`
      })
      cancelarFormNovaRecMeta()
      await carregarRecorrenciasMetas()
    } finally {
      setSalvandoNovaRecMeta(false)
    }
  }

  async function excluirRecorrenciaMeta(id) {
    if (!id) return
    if (!window.confirm('Excluir esta recorrência?')) return
    setError(null)
    setDetalheErroRecorrenciasMetas('')

    setExcluindoRecMetaId(id)
    try {
      const prev = recorrenciasMetas.find((x) => x.id === id)
      const { error } = await supabase.from('recorrencias_metas').delete().eq('id', id)
      if (error) {
        setError(error.message)
        return
      }
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'metas',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev || null,
        descricao: prev ? `Excluiu recorrência de meta "${prev.descricao || id}"` : `Excluiu recorrência de meta ${id}`
      })
      await carregarRecorrenciasMetas()
    } finally {
      setExcluindoRecMetaId(null)
    }
  }

  async function carregarMultiplicadorTipos() {
    setLoadingMultiplicador(true)
    const { data, error } = await supabase.from('multiplicador_tipos').select('*').order('ordem').order('descricao')
    if (!error) setMultiplicadorTipos(data || [])
    setLoadingMultiplicador(false)
  }

  useEffect(() => { carregarAreas() }, [])
  useEffect(() => { carregarPeriodos() }, [])
  useEffect(() => { carregarRecorrencias() }, [])
  useEffect(() => { carregarRecorrenciasMetas() }, [])
  useEffect(() => { carregarMultiplicadorTipos() }, [])

  async function carregarPeriodos() {
    setLoadingPeriodos(true)
    setMigracaoPeriodos(false)
    const { data, error: e } = await supabase.from('periodos').select('*').order('ano', { ascending: false }).order('tipo').order('numero')
    if (e) {
      setPeriodos([])
      if (e.message?.includes('schema cache') || e.message?.includes('Could not find the table') || e.message?.includes('periodos')) {
        setMigracaoPeriodos(true)
        setError('A tabela "periodos" ainda não existe no Supabase. Clique aqui para copiar o SQL (arquivo supabase-periodos.sql) e execute no Supabase → SQL Editor. Depois recarregue a página.')
      } else setError(e.message)
    } else setPeriodos(data || [])
    setLoadingPeriodos(false)
  }

  function labelPeriodo(p) {
    if (!p) return '—'
    const num = p.numero != null ? Number(p.numero) : null
    const ano = p.ano
    switch (p.tipo) {
      case 'ano': return `Ano ${ano}`
      case 'semestre': return `Semestre ${num}/${ano}`
      case 'bimestre': return `Bimestre ${num}/${ano}`
      case 'trimestre': return `Trimestre ${num}/${ano}`
      case 'mes': return `Mês ${String(num).padStart(2, '0')}/${ano}`
      case 'semana': return `Semana ${String(num).padStart(2, '0')}/${ano}`
      default: return `${p.tipo} ${num ?? ''}/${ano}`
    }
  }

  function faixaNumeroPorTipo(tipo) {
    const t = TIPOS_PERIODO.find(x => x.value === tipo)
    return { min: t?.min ?? null, max: t?.max ?? null }
  }

  function abrirEdicaoPeriodo(p) {
    setEditPeriodoId(p.id)
    setEditPeriodoInicio(p.data_inicio ? String(p.data_inicio).slice(0, 10) : '')
    setEditPeriodoFim(p.data_fim ? String(p.data_fim).slice(0, 10) : '')
  }

  function cancelarEdicaoPeriodo() {
    setEditPeriodoId(null)
    setEditPeriodoInicio('')
    setEditPeriodoFim('')
  }

  function validarPeriodoForm(tipo, ano, numero, ini, fim) {
    if (!tipo || !ano || !ini || !fim) return 'Preencha tipo, ano e datas.'
    const { min, max } = faixaNumeroPorTipo(tipo)
    if (tipo !== 'ano') {
      const n = Number(numero)
      if (Number.isNaN(n)) return 'Número inválido.'
      if (min != null && n < min) return `Número deve ser ≥ ${min}.`
      if (max != null && n > max) return `Número deve ser ≤ ${max}.`
    }
    if (new Date(ini) > new Date(fim)) return 'Data fim precisa ser maior ou igual à data início.'
    return null
  }

  async function salvarPeriodo(e) {
    e.preventDefault()
    const msg = validarPeriodoForm(formPeriodoTipo, formPeriodoAno, formPeriodoNumero, formPeriodoInicio, formPeriodoFim)
    if (msg) { setError(msg); return }
    setError(null)
    setSalvandoPeriodo(true)
    const payload = {
      tipo: formPeriodoTipo,
      ano: Number(formPeriodoAno),
      numero: formPeriodoTipo === 'ano' ? null : Number(formPeriodoNumero),
      data_inicio: formPeriodoInicio,
      data_fim: formPeriodoFim,
      ativo: true
    }
    const { error: err } = await supabase.from('periodos').insert(payload)
    setSalvandoPeriodo(false)
    if (err) {
      if (err.message?.includes('schema cache') || err.message?.includes('Could not find the table') || err.message?.includes('periodos')) {
        setMigracaoPeriodos(true)
        setError('A tabela "periodos" ainda não existe no Supabase. Clique aqui para copiar o SQL (arquivo supabase-periodos.sql) e execute no Supabase → SQL Editor. Depois recarregue a página.')
      } else setError(err.message)
    } else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'periodos',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: payload,
        descricao: `Criou período (${payload.tipo} ${payload.numero ?? ''}/${payload.ano})`
      })
      setShowFormPeriodo(false)
      setFormPeriodoInicio('')
      setFormPeriodoFim('')
      carregarPeriodos()
    }
  }

  async function salvarEdicaoPeriodo(id) {
    if (!id) return
    const msg = validarPeriodoForm('ano', 2000, null, editPeriodoInicio, editPeriodoFim)
    if (msg) { setError(msg); return }
    setError(null)
    const prev = periodos.find((p) => p.id === id)
    const { error: err } = await supabase
      .from('periodos')
      .update({ data_inicio: editPeriodoInicio, data_fim: editPeriodoFim })
      .eq('id', id)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'periodos',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev
          ? { data_inicio: prev.data_inicio, data_fim: prev.data_fim }
          : null,
        valor_novo: { data_inicio: editPeriodoInicio, data_fim: editPeriodoFim },
        descricao: `Alterou datas do período ${labelPeriodo(prev) || id}`
      })
      cancelarEdicaoPeriodo()
      carregarPeriodos()
    }
  }

  async function excluirPeriodo(id) {
    if (!window.confirm('Excluir este período? Registros vinculados podem ser afetados.')) return
    setError(null)
    setExcluindoPeriodoId(id)
    const prev = periodos.find((p) => p.id === id)
    const { error: err } = await supabase.from('periodos').delete().eq('id', id)
    setExcluindoPeriodoId(null)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'periodos',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev || null,
        descricao: `Excluiu período ${labelPeriodo(prev) || id}`
      })
      carregarPeriodos()
    }
  }

  async function salvarRecorrenciaDescricao(id) {
    if (!editRecDescricao.trim()) return
    setError(null)
    const prev = recorrencias.find((r) => r.id === id)
    const { error } = await supabase
      .from('recorrencias_atividade')
      .update({ descricao: editRecDescricao.trim() })
      .eq('id', id)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'comportamentos',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev ? { descricao: prev.descricao } : null,
        valor_novo: { descricao: editRecDescricao.trim() },
        descricao: `Alterou recorrência de atividade "${editRecDescricao.trim()}"`
      })
      setEditRecId(null)
      setEditRecDescricao('')
      carregarRecorrencias()
    }
  }

  async function alternarRecorrenciaAtiva(id, ativoAtual) {
    setError(null)
    const prev = recorrencias.find((r) => r.id === id)
    const { error } = await supabase.from('recorrencias_atividade').update({ ativo: !ativoAtual }).eq('id', id)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'comportamentos',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev ? { ativo: ativoAtual } : null,
        valor_novo: { ativo: !ativoAtual },
        descricao: `Alterou ativo da recorrência "${prev?.descricao || id}"`
      })
      carregarRecorrencias()
    }
  }

  async function salvarNovoMultiplicadorTipo(e) {
    e.preventDefault()
    const codigo = formMultCodigo.trim().toLowerCase().replace(/\s+/g, '_')
    const descricao = formMultDescricao.trim()
    if (!codigo || !descricao) return
    setError(null)
    setSalvandoMult(true)
    const { error: err } = await supabase.from('multiplicador_tipos').insert({ codigo, descricao, ativo: true, ordem: (multiplicadorTipos.length + 1) })
    setSalvandoMult(false)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'multiplicador_tipos',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: { codigo, descricao, ativo: true, ordem: multiplicadorTipos.length + 1 },
        descricao: `Criou tipo de multiplicador "${descricao}"`
      })
      setFormMultCodigo('')
      setFormMultDescricao('')
      setShowFormMult(false)
      carregarMultiplicadorTipos()
    }
  }

  function abrirEdicaoMult(m) {
    setEditMultId(m.id)
    setEditMultDescricao(m.descricao)
  }

  function cancelarFormMult() {
    setShowFormMult(false)
    setFormMultCodigo('')
    setFormMultDescricao('')
  }

  function cancelarEdicaoMult() {
    setEditMultId(null)
    setEditMultDescricao('')
  }

  async function alternarMultiplicadorAtivo(id, ativoAtual) {
    setError(null)
    const prev = multiplicadorTipos.find((m) => m.id === id)
    const { error } = await supabase.from('multiplicador_tipos').update({ ativo: !ativoAtual }).eq('id', id)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'multiplicador_tipos',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev ? { ativo: ativoAtual } : null,
        valor_novo: { ativo: !ativoAtual },
        descricao: `Alterou ativo do multiplicador "${prev?.descricao || id}"`
      })
      carregarMultiplicadorTipos()
    }
  }

  async function salvarEdicaoMultDescricao() {
    if (!editMultId || !editMultDescricao.trim()) return
    setError(null)
    const prev = multiplicadorTipos.find((m) => m.id === editMultId)
    const { error } = await supabase
      .from('multiplicador_tipos')
      .update({ descricao: editMultDescricao.trim() })
      .eq('id', editMultId)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'multiplicador_tipos',
        entidade_id: editMultId,
        operacao: 'UPDATE',
        valor_anterior: prev ? { descricao: prev.descricao } : null,
        valor_novo: { descricao: editMultDescricao.trim() },
        descricao: `Alterou multiplicador "${editMultDescricao.trim()}"`
      })
      setEditMultId(null)
      setEditMultDescricao('')
      carregarMultiplicadorTipos()
    }
  }

  async function excluirMultiplicadorTipo(id) {
    if (!window.confirm('Excluir este tipo de multiplicador? Atividades que usam este tipo podem ficar sem label.')) return
    setError(null)
    setExcluindoMultId(id)
    const prev = multiplicadorTipos.find((m) => m.id === id)
    const { error } = await supabase.from('multiplicador_tipos').delete().eq('id', id)
    setExcluindoMultId(null)
    if (error) setError(error.message)
    else {
      void registrarLog({
        modulo: 'Cadastros',
        area: null,
        entidade: 'multiplicador_tipos',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev || null,
        descricao: prev ? `Excluiu multiplicador "${prev.descricao || id}"` : `Excluiu multiplicador ${id}`
      })
      if (editMultId === id) cancelarEdicaoMult()
      carregarMultiplicadorTipos()
    }
  }

  return (
    <>
      <h1>Cadastros</h1>
      <p>Gerencie áreas, usuários e o calendário de períodos com data início e fim.</p>
      {error && (
        <div
          className={`alert ${migracaoPeriodos ? 'alert-warning' : 'alert-error'}`}
          style={migracaoPeriodos ? { cursor: 'pointer' } : undefined}
          role={migracaoPeriodos ? 'button' : undefined}
          tabIndex={migracaoPeriodos ? 0 : undefined}
          onClick={migracaoPeriodos ? async () => {
            const sql = `-- Abra o arquivo supabase-periodos.sql no projeto e execute no Supabase → SQL Editor.\n-- (Este aviso aparece porque a tabela \"periodos\" ainda não existe.)`
            navigator.clipboard?.writeText(sql).then(() => {
              window.alert('Instrução copiada! Abra o arquivo supabase-periodos.sql, copie o conteúdo e execute no Supabase → SQL Editor. Depois recarregue a página.')
            }).catch(() => {})
          } : undefined}
          onKeyDown={migracaoPeriodos ? (e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() } : undefined}
        >
          {migracaoPeriodos ? (
            <>⚠️ {error} <span style={{ textDecoration: 'underline', marginLeft: '0.5rem' }}>Clique para copiar a instrução</span></>
          ) : (
            error
          )}
        </div>
      )}

      <div className="cadastros-grid">
        <section className="card cadastro-card">
          <h2 className="cadastro-card-title">Áreas</h2>
          <p className="cadastro-card-desc">Unidades ou setores que possuem comportamentos e tarefas na Workload.</p>
          {loadingAreas ? (
            <p>Carregando…</p>
          ) : areas.length === 0 ? (
            <p className="empty-state">Nenhuma área cadastrada.</p>
          ) : (
            <ul className="cadastro-list">
              {areas.map(a => (
                <li key={a.id} className={a.ativo !== false ? '' : 'inativo'}>
                  <span style={{ opacity: 0.75, marginRight: '0.35rem' }}>{Number(a.ordem) || 0}.</span>
                  {a.nome}
                </li>
              ))}
            </ul>
          )}
          <Link href="/carometro/areas" className="btn btn-primary cadastro-link">Gerenciar Áreas</Link>
        </section>

        <section className="card cadastro-card">
          <h2 className="cadastro-card-title">Usuários</h2>
          <p className="cadastro-card-desc">Contas de acesso ao sistema (em implementação).</p>
          <p className="empty-state">Em breve.</p>
        </section>

        <section className="card cadastro-card cadastro-card-wide">
          <h2 className="cadastro-card-title">Calendário (Períodos)</h2>
          <p className="cadastro-card-desc">
            Cadastre períodos flexíveis com data início e fim. Você pode criar períodos do tipo Semana, Mês, Bimestre, Trimestre, Semestre ou Ano. Esses períodos serão usados para filtrar as outras abas.
          </p>
          <div className="cadastro-calendario-visual">
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Calendário com número da semana</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <label>Ano:</label>
              <select value={anoCalendario} onChange={e => setAnoCalendario(Number(e.target.value))} style={{ width: 90 }}>
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <CalendarioComSemanas ano={anoCalendario} />
          </div>
          <div className="cadastro-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowFormPeriodo(!showFormPeriodo)}>
              {showFormPeriodo ? 'Cancelar' : '+ Novo período'}
            </button>
          </div>
          {showFormPeriodo && (
            <form onSubmit={salvarPeriodo} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Cadastrar período</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tipo</label>
                  <select
                    value={formPeriodoTipo}
                    onChange={e => {
                      const t = e.target.value
                      setFormPeriodoTipo(t)
                      const { min } = faixaNumeroPorTipo(t)
                      if (min != null) setFormPeriodoNumero(min)
                    }}
                    style={{ minWidth: 150 }}
                  >
                    {TIPOS_PERIODO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Ano</label>
                  <input type="number" min="2020" max="2035" value={formPeriodoAno} onChange={e => setFormPeriodoAno(Number(e.target.value))} style={{ width: 100 }} />
                </div>
                {formPeriodoTipo !== 'ano' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nº</label>
                    <input
                      type="number"
                      value={formPeriodoNumero}
                      onChange={e => setFormPeriodoNumero(Number(e.target.value))}
                      style={{ width: 100 }}
                      min={faixaNumeroPorTipo(formPeriodoTipo).min ?? undefined}
                      max={faixaNumeroPorTipo(formPeriodoTipo).max ?? undefined}
                    />
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data início</label>
                  <input type="date" value={formPeriodoInicio} onChange={e => setFormPeriodoInicio(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data fim</label>
                  <input type="date" value={formPeriodoFim} onChange={e => setFormPeriodoFim(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={salvandoPeriodo}>
                  {salvandoPeriodo ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
          {loadingPeriodos ? (
            <p>Carregando…</p>
          ) : periodos.length === 0 ? (
            <p className="empty-state">Nenhum período cadastrado ainda.</p>
          ) : (
            <div className="table-wrap">
              <table className="cadastro-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Tipo</th>
                    <th>Ano</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th style={{ width: 160 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {periodos.map(p => (
                    <tr key={p.id}>
                      <td>{labelPeriodo(p)}</td>
                      <td>{p.tipo}</td>
                      <td>{p.ano}</td>
                      {editPeriodoId === p.id ? (
                        <>
                          <td><input type="date" value={editPeriodoInicio} onChange={e => setEditPeriodoInicio(e.target.value)} className="cadastro-edit-input" /></td>
                          <td><input type="date" value={editPeriodoFim} onChange={e => setEditPeriodoFim(e.target.value)} className="cadastro-edit-input" /></td>
                          <td>
                            <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }} onClick={() => salvarEdicaoPeriodo(p.id)}>Salvar</button>
                            <button type="button" className="btn" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }} onClick={cancelarEdicaoPeriodo}>Cancelar</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{formatarData(p.data_inicio)}</td>
                          <td>{formatarData(p.data_fim)}</td>
                          <td>
                            <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }} onClick={() => abrirEdicaoPeriodo(p)}>Editar</button>
                            <button type="button" className="btn danger" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }} disabled={excluindoPeriodoId === p.id} onClick={() => excluirPeriodo(p.id)}>
                              {excluindoPeriodoId === p.id ? '…' : 'Excluir'}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card cadastro-card cadastro-card-wide">
          <h2 className="cadastro-card-title">Classificacoes de Metas</h2>
          <p className="cadastro-card-desc">
            Lista editavel de recorrência que pode ser usada quando uma META tiver classificações.
            (Prazo para conclusao da meta sera definido na tela de METAS por semana.)
          </p>

          {detalheErroRecorrenciasMetas && (
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
              Nao foi possivel carregar `recorrencias_metas`. Detalhe:
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: '#7a5a00' }}>
                {detalheErroRecorrenciasMetas}
              </div>
            </div>
          )}

          <div className="cadastro-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn"
              onClick={abrirFormNovaRecMeta}
            >
              + Nova recorrência
            </button>
          </div>

          {showFormNovaRecMeta && (
            <form onSubmit={salvarNovaRecorrenciaMeta} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Nova recorrência</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Descrição</label>
                  <input
                    value={formNovaRecMetaDescricao}
                    onChange={e => setFormNovaRecMetaDescricao(e.target.value)}
                    placeholder="Ex.: Semanal"
                    className="cadastro-edit-input"
                    style={{ width: 320 }}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={formNovaRecMetaAtivo}
                      onChange={e => setFormNovaRecMetaAtivo(e.target.checked)}
                    />
                    Ativa
                  </label>
                </div>
                <button type="submit" className="btn btn-primary" disabled={salvandoNovaRecMeta}>
                  {salvandoNovaRecMeta ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" className="btn" disabled={salvandoNovaRecMeta} onClick={cancelarFormNovaRecMeta}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {loadingRecorrenciasMetas ? (
            <p>Carregando…</p>
          ) : (
            <div className="table-wrap">
              <table className="cadastro-table">
                <thead>
                  <tr>
                    <th>Recorrencia</th>
                    <th style={{ width: 180 }}>Ativo</th>
                    <th style={{ width: 160 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recorrenciasMetas.map(r => (
                    <tr key={r.id || r.codigo}>
                      <td>
                        {editRecMetaId === r.id ? (
                          <input
                            className="cadastro-edit-input"
                            value={editRecMetaDescricao}
                            onChange={e => setEditRecMetaDescricao(e.target.value)}
                            placeholder="Descrição"
                          />
                        ) : (
                          r.descricao
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn ${r.ativo ? 'btn-primary' : ''}`}
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => alternarRecorrenciaMetaAtiva(r.id, Boolean(r.ativo))}
                          disabled={!r.id}
                          title={r.id ? '' : 'Use Pré-cadastrar para persistir'}
                        >
                          {r.ativo ? 'Sim' : 'Não'}
                        </button>
                      </td>
                      <td>
                        {editRecMetaId === r.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => salvarRecorrenciaMetaDescricao(r.id)}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              className="btn"
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => { setEditRecMetaId(null); setEditRecMetaDescricao('') }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                              disabled={!r.id}
                              onClick={() => { setEditRecMetaId(r.id); setEditRecMetaDescricao(r.descricao) }}
                              title={r.id ? '' : 'Use Pré-cadastrar para persistir'}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`btn ${excluindoRecMetaId === r.id ? '' : 'btn-danger'}`}
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                              disabled={!r.id || excluindoRecMetaId === r.id}
                              onClick={() => excluirRecorrenciaMeta(r.id)}
                              title="Excluir"
                            >
                              {excluindoRecMetaId === r.id ? '…' : 'Excluir'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Seções abaixo do calendário removidas a pedido */}
      </div>
    </>
  )
}
