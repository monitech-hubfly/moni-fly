// @ts-nocheck
'use client';

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/hooks/useAuditLog'
import { listarAreas } from '@/utils/areasOrder'
import CalendarioComSemanas from '@/components/CalendarioComSemanas'
import { useAdmin } from '@/context/AdminContext'

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

const AREAS_PADRAO = [
  'Marketing', 'Comercial', 'Portfólio', 'Acoplamento', 'Produto', 'Projetos',
  'Homologações', 'Wayzer - Nath', 'Wayzer - Rafa', 'Frank Moní', 'Processos',
  'Ferramentas', 'Crédito', 'Moní Capital', 'Controladoria', 'Adm', 'Jurídico'
]

const NOMES_AREA_PROTEGIDOS = [
  'adm', 'controladoria', 'comercial',
  'portfólio', 'portfolio',
  'acoplamento', 'wayzer - nath', 'wayzer - rafa',
  'projetos - executivos locais',
  'produto', 'projetos - modelo virtual', 'projetos',
  'jurídico', 'juridico'
]

function proximaOrdemSugerida(lista) {
  const nums = (lista || []).map(a => Number(a.ordem) || 0)
  return (nums.length ? Math.max(...nums) : 0) + 10
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
  const { isAdmin } = useAdmin()
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
  const [excluirConfirm, setExcluirConfirm] = useState(null)
  const [excluirConfirmando, setExcluirConfirmando] = useState(false)
  const [areaFormModo, setAreaFormModo] = useState(null)
  const [areaEditandoId, setAreaEditandoId] = useState(null)
  const [nomeAreaEdit, setNomeAreaEdit] = useState('')
  const [ativoAreaEdit, setAtivoAreaEdit] = useState(true)
  const [salvandoArea, setSalvandoArea] = useState(false)
  const [seedandoAreas, setSeedandoAreas] = useState(false)
  const [reordenandoAreaId, setReordenandoAreaId] = useState(null)
  const [dragAreaId, setDragAreaId] = useState(null)

  const [responsaveis, setResponsaveis] = useState([])
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [hasProfileIdCol, setHasProfileIdCol] = useState(false)
  const [responsavelModalAberto, setResponsavelModalAberto] = useState(false)
  const [responsavelEditando, setResponsavelEditando] = useState(null)
  const [respNomeEdit, setRespNomeEdit] = useState('')
  const [respProfileIdEdit, setRespProfileIdEdit] = useState('')
  const [salvandoResponsavel, setSalvandoResponsavel] = useState(false)

  async function carregarAreas() {
    setLoadingAreas(true)
    const { data } = await listarAreas(supabase, 'id, nome, ativo, ordem')
    setAreas(data || [])
    setLoadingAreas(false)
  }

  function abrirNovaArea() {
    setAreaEditandoId(null)
    setAreaFormModo('novo')
    setNomeAreaEdit('')
    setAtivoAreaEdit(true)
    setError(null)
  }

  function iniciarEdicaoArea(area) {
    setAreaFormModo(null)
    setAreaEditandoId(area.id)
    setNomeAreaEdit(area.nome || '')
    setAtivoAreaEdit(area.ativo ?? true)
    setError(null)
  }

  function cancelarEdicaoArea() {
    setAreaFormModo(null)
    setAreaEditandoId(null)
    setNomeAreaEdit('')
    setAtivoAreaEdit(true)
  }

  async function salvarEdicaoArea(id) {
    if (!id || salvandoArea) return
    const nome = nomeAreaEdit.trim()
    if (!nome) return
    setError(null)
    setSalvandoArea(true)
    try {
      const prev = areas.find((a) => a.id === id)
      const ordemNum = Math.max(0, Math.floor(Number(prev?.ordem) || 0))
      const ativo = Boolean(ativoAreaEdit)
      let { error: e2 } = await supabase.from('areas').update({ nome, ativo, ordem: ordemNum }).eq('id', id)
      if (e2 && String(e2.message || '').toLowerCase().includes('ordem')) {
        ({ error: e2 } = await supabase.from('areas').update({ nome, ativo }).eq('id', id))
      }
      if (e2) {
        setError(e2.message)
        return
      }
      void registrarLog({
        modulo: 'Cadastros',
        area: nome,
        entidade: 'areas',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prev ? { nome: prev.nome, ativo: prev.ativo, ordem: prev.ordem } : null,
        valor_novo: { nome, ativo, ordem: ordemNum },
        descricao: `Alterou área "${nome}"`
      })
      cancelarEdicaoArea()
      await carregarAreas()
    } finally {
      setSalvandoArea(false)
    }
  }

  async function salvarArea() {
    if (areaFormModo !== 'novo' || salvandoArea) return
    const nome = nomeAreaEdit.trim()
    if (!nome) return
    setError(null)
    setSalvandoArea(true)
    try {
      const ordemNum = proximaOrdemSugerida(areas)
      let { error: e2 } = await supabase.from('areas').insert({ nome, ativo: true, ordem: ordemNum })
      if (e2 && String(e2.message || '').toLowerCase().includes('ordem')) {
        ({ error: e2 } = await supabase.from('areas').insert({ nome, ativo: true }))
      }
      if (e2) {
        setError(e2.message)
        return
      }
      void registrarLog({
        modulo: 'Cadastros',
        area: nome,
        entidade: 'areas',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: { nome, ativo: true, ordem: ordemNum },
        descricao: `Criou área "${nome}"`
      })
      cancelarEdicaoArea()
      await carregarAreas()
    } finally {
      setSalvandoArea(false)
    }
  }

  function solicitarExclusaoArea(id) {
    if (!id) return
    const prev = areas.find((a) => a.id === id)
    setExcluirConfirm({
      tipo: 'area',
      id,
      titulo: 'Excluir área',
      mensagem: prev
        ? `Excluir a área "${prev.nome}"? Registros vinculados podem ser afetados.`
        : 'Excluir esta área? Registros vinculados podem ser afetados.'
    })
  }

  async function executarExclusaoArea(id) {
    if (!id) return
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
      if (areaEditandoId === id || areaFormModo === id) cancelarEdicaoArea()
      await carregarAreas()
    }
  }

  async function moverArea(id, direction) {
    if (reordenandoAreaId) return
    const idx = areas.findIndex((a) => a.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= areas.length) return
    const atual = areas[idx]
    const vizinho = areas[swapIdx]
    const ordemAtual = Number(atual.ordem) || 0
    const ordemVizinho = Number(vizinho.ordem) || 0
    setReordenandoAreaId(id)
    setError(null)
    try {
      let { error: e1 } = await supabase.from('areas').update({ ordem: ordemVizinho }).eq('id', atual.id)
      if (e1 && String(e1.message || '').toLowerCase().includes('ordem')) {
        setError(e1.message)
        return
      }
      let { error: e2 } = await supabase.from('areas').update({ ordem: ordemAtual }).eq('id', vizinho.id)
      if (e2 && String(e2.message || '').toLowerCase().includes('ordem')) {
        setError(e2.message)
        return
      }
      if (e1 || e2) {
        setError(e1?.message || e2?.message)
        return
      }
      await carregarAreas()
    } finally {
      setReordenandoAreaId(null)
    }
  }

  async function handleSeedAreas() {
    setSeedandoAreas(true)
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
    setSeedandoAreas(false)
    await carregarAreas()
  }

  function solicitarExclusaoPeriodo(id) {
    setExcluirConfirm({
      tipo: 'periodo',
      id,
      titulo: 'Excluir período',
      mensagem: 'Excluir este período? Registros vinculados podem ser afetados.'
    })
  }

  function solicitarExclusaoRecorrenciaMeta(id) {
    setExcluirConfirm({
      tipo: 'recMeta',
      id,
      titulo: 'Excluir recorrência',
      mensagem: 'Excluir esta recorrência? Registros vinculados podem ser afetados.'
    })
  }

  async function confirmarExclusaoModal() {
    if (!excluirConfirm || excluirConfirmando) return
    setExcluirConfirmando(true)
    try {
      const { tipo, id } = excluirConfirm
      if (tipo === 'periodo') await executarExclusaoPeriodo(id)
      else if (tipo === 'recMeta') await executarExclusaoRecorrenciaMeta(id)
      else if (tipo === 'area') await executarExclusaoArea(id)
      else if (tipo === 'mult') await executarExclusaoMultiplicador(id)
      else if (tipo === 'responsavel') await executarExclusaoResponsavel(id)
      setExcluirConfirm(null)
    } finally {
      setExcluirConfirmando(false)
    }
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
        .from('recorrencias_atividade')
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
    const { error } = await supabase.from('recorrencias_atividade').update({ descricao }).eq('id', id)
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
    const { error } = await supabase.from('recorrencias_atividade').update({ ativo: !ativoAtual }).eq('id', id)
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
      const { error } = await supabase.from('recorrencias_atividade').insert({
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

  async function executarExclusaoRecorrenciaMeta(id) {
    if (!id) return
    setError(null)
    setDetalheErroRecorrenciasMetas('')

    setExcluindoRecMetaId(id)
    try {
      const prev = recorrenciasMetas.find((x) => x.id === id)
      const { error } = await supabase.from('recorrencias_atividade').delete().eq('id', id)
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
  useEffect(() => {
    if (isAdmin) {
      carregarResponsaveis()
      carregarProfiles()
    }
  }, [isAdmin])

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

  async function executarExclusaoPeriodo(id) {
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
    if (!id) return
    setExcluirConfirm({
      tipo: 'mult',
      id,
      titulo: 'Excluir multiplicador',
      mensagem: 'Excluir este tipo de multiplicador? Atividades que usam este tipo podem ficar sem label.'
    })
  }

  async function executarExclusaoMultiplicador(id) {
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

  async function carregarResponsaveis() {
    setLoadingResponsaveis(true)
    const { data: comProfile, error: errProfile } = await supabase
      .from('area_pessoas')
      .select('id, nome, area_id, ativo, profile_id, areas(nome)')
      .order('nome')
    if (!errProfile && comProfile !== null) {
      setHasProfileIdCol(true)
      // Enriquecer com dados do profile via join em memória
      // Busca profiles direto para garantir dados atualizados (independente do state)
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email').order('full_name')
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]))
      const enriched = (comProfile || []).map(r => ({
        ...r,
        profiles: r.profile_id ? (profilesMap.get(r.profile_id) ? { full_name: profilesMap.get(r.profile_id)?.full_name, email: profilesMap.get(r.profile_id)?.email } : null) : null
      }))
      setResponsaveis(enriched)
    } else {
      setHasProfileIdCol(false)
      const { data: semProfile } = await supabase
        .from('area_pessoas')
        .select('id, nome, area_id, ativo, areas(nome)')
        .order('nome')
      setResponsaveis(semProfile || [])
    }
    setLoadingResponsaveis(false)
  }

  async function carregarProfiles() {
    const { data } = await supabase.from('profiles').select('id, full_name, email').order('full_name')
    setProfiles(data || [])
  }

  function abrirEditarResponsavel(r) {
    setResponsavelEditando(r)
    setRespNomeEdit(r.nome || '')
    setRespProfileIdEdit(r.profile_id || '')
    setResponsavelModalAberto(true)
  }

  function fecharResponsavelModal() {
    setResponsavelModalAberto(false)
    setResponsavelEditando(null)
    setRespNomeEdit('')
    setRespProfileIdEdit('')
  }

  async function salvarResponsavel() {
    if (!responsavelEditando || salvandoResponsavel) return
    const nome = respNomeEdit.trim()
    if (!nome) return
    const nomeAntigo = String(responsavelEditando.nome || '').trim()
    const areaIdResp = responsavelEditando.area_id
    setSalvandoResponsavel(true)
    const updateData = { nome }
    if (hasProfileIdCol) updateData.profile_id = respProfileIdEdit || null
    const { error: e } = await supabase.from('area_pessoas').update(updateData).eq('id', responsavelEditando.id)
    if (!e) {
      // Propagar vínculo de profile: se um profile foi vinculado, atualizar responsavel para full_name
      if (hasProfileIdCol && respProfileIdEdit) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', respProfileIdEdit)
            .maybeSingle()
          const fullName = (profileData as { full_name?: string } | null)?.full_name?.trim()
          if (fullName && fullName.toLowerCase() !== nomeAntigo.toLowerCase()) {
            const { data: tarefasDataP } = await supabase
              .from('tarefas')
              .select('acoes(id)')
              .eq('area_id', areaIdResp)
            const acaoIdsP = (tarefasDataP || []).flatMap((t: any) => (t.acoes || []).map((a: any) => a.id)).filter(Boolean)
            if (acaoIdsP.length > 0) {
              const { data: gpRowsP } = await supabase
                .from('gantt_planejamento')
                .select('id, responsavel')
                .in('acao_id', acaoIdsP)
                .not('responsavel', 'is', null)
              const aAtualizar = (gpRowsP || []).filter((row: any) =>
                String(row.responsavel || '').split(',').some((n: string) => n.trim().toLowerCase() === nomeAntigo.toLowerCase())
              )
              if (aAtualizar.length > 0) {
                const updates = aAtualizar.map((row: any) => {
                  const novaString = String(row.responsavel || '')
                    .split(',')
                    .map((n: string) => n.trim().toLowerCase() === nomeAntigo.toLowerCase() ? fullName : n.trim())
                    .join(', ')
                  return supabase.from('gantt_planejamento').update({ responsavel: novaString }).eq('id', row.id)
                })
                const resultados = await Promise.all(updates)
                const erros = resultados.filter((r: any) => r.error)
                if (erros.length > 0) {
                  console.error('[salvarResponsavel] erros ao propagar profile para gantt:', erros.map((r: any) => r.error))
                }
              }
            }
          }
        } catch (errProfile) {
          console.error('[salvarResponsavel] erro ao propagar profile para gantt_planejamento:', errProfile)
        }
      }
      // Propagar renomeação para gantt_planejamento (case-insensitive, tolerante a espaços)
      if (nomeAntigo && areaIdResp && nomeAntigo.toLowerCase() !== nome.toLowerCase()) {
        try {
          const { data: tarefasData } = await supabase
            .from('tarefas')
            .select('acoes(id)')
            .eq('area_id', areaIdResp)
          const acaoIds = (tarefasData || []).flatMap(t => (t.acoes || []).map(a => a.id)).filter(Boolean)
          if (acaoIds.length > 0) {
            const { data: gpRows } = await supabase
              .from('gantt_planejamento')
              .select('id, responsavel')
              .in('acao_id', acaoIds)
              .not('responsavel', 'is', null)
            const aAtualizar = (gpRows || []).filter(row =>
              String(row.responsavel || '').split(',').some(n => n.trim().toLowerCase() === nomeAntigo.toLowerCase())
            )
            if (aAtualizar.length > 0) {
              const updates = aAtualizar.map(row => {
                const novaString = String(row.responsavel || '')
                  .split(',')
                  .map(n => n.trim().toLowerCase() === nomeAntigo.toLowerCase() ? nome : n.trim())
                  .join(', ')
                return supabase.from('gantt_planejamento').update({ responsavel: novaString }).eq('id', row.id)
              })
              const resultados = await Promise.all(updates)
              const erros = resultados.filter(r => r.error)
              if (erros.length > 0) {
                console.error('[salvarResponsavel] erros ao atualizar gantt_planejamento:', erros.map(r => r.error))
                setError('Responsável atualizado. Alguns registros do Gantt podem precisar de ajuste manual.')
              }
            }
          }
        } catch (errGantt) {
          console.error('[salvarResponsavel] erro ao propagar renomeação para gantt_planejamento:', errGantt)
          setError('Responsável atualizado. Alguns registros do Gantt podem precisar de ajuste manual.')
        }
      }
      fecharResponsavelModal()
      await carregarResponsaveis()
    }
    setSalvandoResponsavel(false)
  }

  function solicitarExclusaoResponsavel(r) {
    setExcluirConfirm({
      tipo: 'responsavel',
      id: r.id,
      titulo: 'Excluir responsável',
      mensagem: `Excluir "${r.nome}"? Registros vinculados no planejamento podem ser afetados.`
    })
  }

  async function executarExclusaoResponsavel(id) {
    setError(null)
    const resp = responsaveis.find(r => r.id === id)
    const { error: e } = await supabase.from('area_pessoas').delete().eq('id', id)
    if (e) {
      setError(e.message)
    } else {
      // Remover nome do responsável excluído de gantt_planejamento (case-insensitive)
      if (resp?.nome && resp?.area_id) {
        const nomeExcluido = String(resp.nome).trim()
        const areaIdResp = resp.area_id
        try {
          const { data: tarefasData } = await supabase
            .from('tarefas')
            .select('acoes(id)')
            .eq('area_id', areaIdResp)
          const acaoIds = (tarefasData || []).flatMap(t => (t.acoes || []).map(a => a.id)).filter(Boolean)
          if (acaoIds.length > 0) {
            const { data: gpRows } = await supabase
              .from('gantt_planejamento')
              .select('id, responsavel')
              .in('acao_id', acaoIds)
              .not('responsavel', 'is', null)
            const aAtualizar = (gpRows || []).filter(row =>
              String(row.responsavel || '').split(',').some(n => n.trim().toLowerCase() === nomeExcluido.toLowerCase())
            )
            if (aAtualizar.length > 0) {
              const updates = aAtualizar.map(row => {
                const novaString = String(row.responsavel || '')
                  .split(',')
                  .map(n => n.trim())
                  .filter(n => n.toLowerCase() !== nomeExcluido.toLowerCase())
                  .join(', ')
                return supabase.from('gantt_planejamento').update({ responsavel: novaString }).eq('id', row.id)
              })
              const resultados = await Promise.all(updates)
              const erros = resultados.filter(r => r.error)
              if (erros.length > 0) {
                console.error('[executarExclusaoResponsavel] erros ao atualizar gantt_planejamento:', erros.map(r => r.error))
              }
            }
          }
        } catch (errGantt) {
          console.error('[executarExclusaoResponsavel] erro ao propagar exclusão para gantt_planejamento:', errGantt)
        }
      }
      await carregarResponsaveis()
    }
  }

  return (
    <div className="cadastros-page">
      <h1 className="carometro-page-title">Cadastros</h1>
      <p className="carometro-page-subtitle">Gerencie áreas, usuários e o calendário de períodos com data início e fim.</p>
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

      <div className="cadastros-top-grid">
        <section className="cadastro-card">
          <div className="cadastro-section-header">
            <div className="cadastro-section-header-text">
              <h2>Áreas</h2>
              <p>Unidades ou setores com comportamentos e tarefas na Workload.</p>
            </div>
            <button
              type="button"
              className="cadastro-header-btn"
              onClick={abrirNovaArea}
              disabled={areaFormModo === 'novo' || Boolean(areaEditandoId)}
            >
              + Nova área
            </button>
          </div>
          <div className="cadastro-section-body cadastro-section-body--flush">
            {loadingAreas ? (
              <p style={{ padding: '0 1.25rem' }}>Carregando…</p>
            ) : areas.length === 0 && areaFormModo !== 'novo' ? (
              <div style={{ padding: '0 1.25rem 1rem' }}>
                <p className="empty-state">Nenhuma área cadastrada.</p>
                <button
                  type="button"
                  className="cadastro-header-btn"
                  style={{ marginTop: '0.75rem' }}
                  onClick={handleSeedAreas}
                  disabled={seedandoAreas}
                >
                  {seedandoAreas ? 'Cadastrando…' : 'Cadastrar áreas padrão (17 áreas)'}
                </button>
              </div>
            ) : (
              <div style={{ padding: 0 }}>
                {areaFormModo === 'novo' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 16px',
                      borderBottom: '0.5px solid #e0d9ce',
                      background: '#f7fbf5'
                    }}
                  >
                    <span style={{ fontSize: 14, color: '#ccc9be', flexShrink: 0 }}>⠿</span>
                    <span style={{ fontSize: 11, color: '#aaa89e', minWidth: 18, textAlign: 'right', flexShrink: 0 }}>—</span>
                    <input
                      value={nomeAreaEdit}
                      onChange={e => setNomeAreaEdit(e.target.value)}
                      placeholder="Nome da área"
                      style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '0.5px solid #D3D1C7', fontSize: 13 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); salvarArea() }
                        if (e.key === 'Escape') cancelarEdicaoArea()
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={salvarArea}
                        disabled={salvandoArea}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 5,
                          fontSize: 11,
                          fontWeight: 500,
                          background: '#2F4A3A',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {salvandoArea ? '…' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicaoArea}
                        disabled={salvandoArea}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 5,
                          fontSize: 11,
                          fontWeight: 500,
                          background: '#fff',
                          color: '#5f5e5a',
                          border: '0.5px solid #D3D1C7',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {areas.map((area, index) => (
                  <div
                    key={area.id}
                    draggable={!areaFormModo && !areaEditandoId && !reordenandoAreaId}
                    onDragStart={() => setDragAreaId(area.id)}
                    onDragEnd={() => setDragAreaId(null)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={async () => {
                      if (!dragAreaId || dragAreaId === area.id) return
                      const fromIdx = areas.findIndex(a => a.id === dragAreaId)
                      const toIdx = index
                      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
                      const fromArea = areas[fromIdx]
                      const toArea = areas[toIdx]
                      setReordenandoAreaId(dragAreaId)
                      setDragAreaId(null)
                      try {
                        const fromOrdem = Number(fromArea.ordem) || 0
                        const toOrdem = Number(toArea.ordem) || 0
                        await supabase.from('areas').update({ ordem: toOrdem }).eq('id', fromArea.id)
                        await supabase.from('areas').update({ ordem: fromOrdem }).eq('id', toArea.id)
                        await carregarAreas()
                      } finally {
                        setReordenandoAreaId(null)
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 16px',
                      borderBottom: '0.5px solid #f5f2ec',
                      background: dragAreaId === area.id ? '#f0f7eb' : areaEditandoId === area.id ? '#f7fbf5' : '#fff',
                      transition: 'background 0.1s',
                      opacity: dragAreaId === area.id ? 0.5 : 1
                    }}
                    onMouseEnter={e => {
                      if (areaEditandoId !== area.id && dragAreaId !== area.id) e.currentTarget.style.background = '#faf9f6'
                    }}
                    onMouseLeave={e => {
                      if (areaEditandoId !== area.id && dragAreaId !== area.id) e.currentTarget.style.background = '#fff'
                    }}
                  >
                    <span
                      style={{ fontSize: 14, color: '#ccc9be', cursor: (!areaFormModo && !areaEditandoId) ? 'grab' : 'default', flexShrink: 0 }}
                      title="Arrastar para reordenar"
                    >⠿</span>
                    <span style={{ fontSize: 11, color: '#aaa89e', minWidth: 18, textAlign: 'right', flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    {areaEditandoId === area.id ? (
                      <>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <input
                            value={nomeAreaEdit}
                            onChange={e => setNomeAreaEdit(e.target.value)}
                            style={{ padding: '5px 8px', borderRadius: 5, border: '0.5px solid #D3D1C7', fontSize: 13 }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); salvarEdicaoArea(area.id) }
                              if (e.key === 'Escape') cancelarEdicaoArea()
                            }}
                            autoFocus
                          />
                          {(() => {
                            const nomeOrigNorm = String(area.nome || '').trim().normalize('NFC').toLowerCase()
                            const nomeNovoNorm = nomeAreaEdit.trim().normalize('NFC').toLowerCase()
                            if (!NOMES_AREA_PROTEGIDOS.includes(nomeOrigNorm)) return null
                            if (nomeNovoNorm === nomeOrigNorm) return null
                            return (
                              <div style={{
                                background: '#FAEEDA',
                                border: '0.5px solid #EF9F27',
                                borderRadius: 6,
                                padding: '8px 12px',
                                fontSize: 12,
                                color: '#633806',
                                marginTop: 6
                              }}>
                                ⚠️ Atenção: esta área tem um nome especial usado pelo Planejamento (Gantt). Renomear pode alterar o comportamento de visualização do Gantt para esta área. Confirme se deseja prosseguir.
                              </div>
                            )
                          })()}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAtivoAreaEdit(v => !v)}
                          title={ativoAreaEdit ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: 40,
                            height: 22,
                            borderRadius: 11,
                            border: 'none',
                            cursor: 'pointer',
                            background: ativoAreaEdit ? '#2F4A3A' : '#ccc9be',
                            transition: 'background 0.2s',
                            flexShrink: 0,
                            padding: 0
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            top: 3,
                            left: ativoAreaEdit ? 21 : 3,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: '#fff',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.18)'
                          }} />
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#1D2F25', flex: 1 }}>{area.nome}</span>
                    )}
                    {areaEditandoId !== area.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          const novoAtivo = !(area.ativo !== false)
                          const prev = area
                          const { error: e } = await supabase.from('areas').update({ ativo: novoAtivo }).eq('id', area.id)
                          if (!e) {
                            void registrarLog({
                              modulo: 'Cadastros',
                              area: area.nome,
                              entidade: 'areas',
                              entidade_id: area.id,
                              operacao: 'UPDATE',
                              valor_anterior: { ativo: prev.ativo },
                              valor_novo: { ativo: novoAtivo },
                              descricao: `Alterou ativo da área "${area.nome}"`
                            })
                            await carregarAreas()
                          }
                        }}
                        disabled={Boolean(areaFormModo) || Boolean(areaEditandoId)}
                        title={area.ativo !== false ? 'Clique para desativar' : 'Clique para ativar'}
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: 40,
                          height: 22,
                          borderRadius: 11,
                          border: 'none',
                          cursor: Boolean(areaFormModo) || Boolean(areaEditandoId) ? 'not-allowed' : 'pointer',
                          background: area.ativo !== false ? '#2F4A3A' : '#ccc9be',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                          padding: 0
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          top: 3,
                          left: area.ativo !== false ? 21 : 3,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.18)'
                        }} />
                      </button>
                    )}
                    {areaEditandoId === area.id ? (
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => salvarEdicaoArea(area.id)}
                          disabled={salvandoArea}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            background: '#2F4A3A',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {salvandoArea ? '…' : 'Salvar'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicaoArea}
                          disabled={salvandoArea}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            background: '#fff',
                            color: '#5f5e5a',
                            border: '0.5px solid #D3D1C7',
                            cursor: 'pointer'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => iniciarEdicaoArea(area)}
                          disabled={Boolean(areaFormModo) || Boolean(areaEditandoId)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: '#fff',
                            color: '#2F4A3A',
                            border: '0.5px solid #2F4A3A'
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarExclusaoArea(area.id)}
                          disabled={Boolean(areaFormModo) || Boolean(areaEditandoId)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: '#fff',
                            color: '#A32D2D',
                            border: '0.5px solid #f09595'
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="cadastro-card">
          <div className="cadastro-section-header">
            <div className="cadastro-section-header-text">
              <h2>Classificacoes de Metas</h2>
              <p>
                Lista editavel de recorrência que pode ser usada quando uma META tiver classificações.
                (Prazo para conclusao da meta sera definido na tela de METAS por semana.)
              </p>
            </div>
            <button
              type="button"
              className="cadastro-header-btn"
              onClick={abrirFormNovaRecMeta}
            >
              + Nova recorrência
            </button>
          </div>
          <div className="cadastro-section-body cadastro-section-body--flush">
          {detalheErroRecorrenciasMetas && (
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
              Nao foi possivel carregar `recorrencias_metas`. Detalhe:
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: '#7a5a00' }}>
                {detalheErroRecorrenciasMetas}
              </div>
            </div>
          )}

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
                <button type="submit" className="btn-cadastro-primary" disabled={salvandoNovaRecMeta}>
                  {salvandoNovaRecMeta ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" className="btn-cadastro-secondary" disabled={salvandoNovaRecMeta} onClick={cancelarFormNovaRecMeta}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {loadingRecorrenciasMetas ? (
            <p>Carregando…</p>
          ) : (
            <div className="table-wrap">
              <table className="cadastro-table cadastro-table--metas">
                <thead>
                  <tr>
                    <th>Recorrencia</th>
                    <th className="cadastro-th-center">Ativo</th>
                    <th className="cadastro-th-center">Ações</th>
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
                      <td className="cadastro-td-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={r.ativo}
                          className={`cadastro-toggle ${r.ativo ? 'cadastro-toggle--on' : ''}`}
                          onClick={() => alternarRecorrenciaMetaAtiva(r.id, Boolean(r.ativo))}
                          disabled={!r.id}
                          title={r.id ? '' : 'Use Pré-cadastrar para persistir'}
                        >
                          <span className="cadastro-sr-only">{r.ativo ? 'Ativo' : 'Inativo'}</span>
                        </button>
                      </td>
                      <td className="cadastro-td-center">
                        {editRecMetaId === r.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="cadastro-btn-table cadastro-btn-table--edit"
                              onClick={() => salvarRecorrenciaMetaDescricao(r.id)}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              className="cadastro-btn-table cadastro-btn-table--cancel"
                              onClick={() => { setEditRecMetaId(null); setEditRecMetaDescricao('') }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn-edit"
                              disabled={!r.id}
                              onClick={() => { setEditRecMetaId(r.id); setEditRecMetaDescricao(r.descricao) }}
                              title={r.id ? '' : 'Use Pré-cadastrar para persistir'}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn-del"
                              disabled={!r.id || excluindoRecMetaId === r.id}
                              onClick={() => solicitarExclusaoRecorrenciaMeta(r.id)}
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
          </div>
        </section>

      </div>

      <section className="cadastro-card cadastro-card--full">
          <div className="cadastro-section-header">
            <div className="cadastro-section-header-text">
              <h2>Calendário (Períodos)</h2>
              <p>
                Cadastre períodos flexíveis com data início e fim. Você pode criar períodos do tipo Semana, Mês, Bimestre, Trimestre, Semestre ou Ano. Esses períodos serão usados para filtrar as outras abas.
              </p>
            </div>
            <button
              type="button"
              className="cadastro-header-btn"
              onClick={() => setShowFormPeriodo(!showFormPeriodo)}
            >
              {showFormPeriodo ? 'Cancelar' : '+ Novo período'}
            </button>
          </div>
          <div className="cadastro-section-body">
          <div className="cadastro-calendario-visual">
            <div className="cadastro-calendario-toolbar">
              <label className="cadastro-calendario-ano-label" htmlFor="cadastro-ano-select">Ano:</label>
              <select
                id="cadastro-ano-select"
                className="cadastro-calendario-ano-select"
                value={anoCalendario}
                onChange={e => setAnoCalendario(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <CalendarioComSemanas ano={anoCalendario} className="cadastros-calendario" />
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
                <button type="submit" className="btn-cadastro-primary" disabled={salvandoPeriodo}>
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
                      <td><span className={`cadastro-tag-periodo cadastro-tag-periodo--${p.tipo || 'ano'}`}>{p.tipo}</span></td>
                      <td>{p.ano}</td>
                      {editPeriodoId === p.id ? (
                        <>
                          <td><input type="date" value={editPeriodoInicio} onChange={e => setEditPeriodoInicio(e.target.value)} className="cadastro-edit-input" /></td>
                          <td><input type="date" value={editPeriodoFim} onChange={e => setEditPeriodoFim(e.target.value)} className="cadastro-edit-input" /></td>
                          <td>
                            <button type="button" className="btn-cadastro-primary" style={{ marginRight: '0.25rem' }} onClick={() => salvarEdicaoPeriodo(p.id)}>Salvar</button>
                            <button type="button" className="cadastro-btn-table cadastro-btn-table--cancel" onClick={cancelarEdicaoPeriodo}>Cancelar</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{formatarData(p.data_inicio)}</td>
                          <td>{formatarData(p.data_fim)}</td>
                          <td>
                            <button type="button" className="btn-edit" onClick={() => abrirEdicaoPeriodo(p)}>Editar</button>
                            <button type="button" className="btn-del" disabled={excluindoPeriodoId === p.id} onClick={() => solicitarExclusaoPeriodo(p.id)}>
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
          </div>
        </section>



        {/* Seções abaixo do calendário removidas a pedido */}

      {isAdmin && (
        <section className="cadastro-card cadastro-card--full">
          <div className="cadastro-section-header">
            <div className="cadastro-section-header-text">
              <h2>Responsáveis</h2>
              <p>Pessoas cadastradas por área. Usadas no Planejamento (Gantt). Para adicionar, use o seletor de responsáveis no Gantt.</p>
            </div>
          </div>
          <div className="cadastro-section-body">
            {loadingResponsaveis ? (
              <p style={{ padding: '0 1.25rem' }}>Carregando…</p>
            ) : responsaveis.length === 0 ? (
              <p className="empty-state">Nenhum responsável cadastrado. Adicione pelo Gantt.</p>
            ) : (
              <div className="table-wrap">
                <table className="cadastro-table">
                  <thead>
                    <tr>
                      <th>Apelido</th>
                      <th>Área</th>
                      <th>Vínculo (profile)</th>
                      <th style={{ width: 140 }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responsaveis.map(r => (
                      <tr key={r.id}>
                        <td>{r.nome}</td>
                        <td>{r.areas?.nome || '—'}</td>
                        <td>{r.profiles?.email || (hasProfileIdCol ? 'Sem vínculo' : '—')}</td>
                        <td>
                          <button type="button" className="btn-edit" onClick={() => abrirEditarResponsavel(r)}>Editar</button>
                          <button type="button" className="btn-del" onClick={() => solicitarExclusaoResponsavel(r)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {excluirConfirm && (
        <div
          className="workload-remove-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !excluirConfirmando) setExcluirConfirm(null)
          }}
        >
          <div
            className="workload-remove-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cadastros-excluir-title"
            aria-describedby="cadastros-excluir-desc"
          >
            <div className="workload-remove-modal-header">
              <div>
                <h2 id="cadastros-excluir-title" className="workload-remove-modal-title">
                  {excluirConfirm.titulo}
                </h2>
              </div>
              <button
                type="button"
                className="workload-remove-modal-close"
                onClick={() => !excluirConfirmando && setExcluirConfirm(null)}
                disabled={excluirConfirmando}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="workload-remove-modal-body">
              <p id="cadastros-excluir-desc">{excluirConfirm.mensagem}</p>
            </div>
            <div className="workload-remove-modal-footer">
              <button
                type="button"
                className="workload-remove-modal-btn workload-remove-modal-btn--cancel"
                onClick={() => setExcluirConfirm(null)}
                disabled={excluirConfirmando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="workload-remove-modal-btn workload-remove-modal-btn--danger"
                onClick={confirmarExclusaoModal}
                disabled={excluirConfirmando}
              >
                {excluirConfirmando ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {responsavelModalAberto && responsavelEditando && (
        <div
          className="workload-remove-modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !salvandoResponsavel) fecharResponsavelModal() }}
        >
          <div
            className="workload-remove-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resp-edit-title"
          >
            <div className="workload-remove-modal-header">
              <div>
                <h2 id="resp-edit-title" className="workload-remove-modal-title">Editar responsável</h2>
              </div>
              <button
                type="button"
                className="workload-remove-modal-close"
                onClick={fecharResponsavelModal}
                disabled={salvandoResponsavel}
                aria-label="Fechar"
              >×</button>
            </div>
            <div className="workload-remove-modal-body">
              <div className="form-group">
                <label>Apelido</label>
                <input
                  value={respNomeEdit}
                  onChange={e => setRespNomeEdit(e.target.value)}
                  className="cadastro-edit-input"
                  style={{ width: '100%' }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') salvarResponsavel() }}
                />
              </div>
              {hasProfileIdCol && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Vínculo com profile</label>
                  <select
                    value={respProfileIdEdit}
                    onChange={e => setRespProfileIdEdit(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Sem vínculo</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name ? `${p.full_name} — ${p.email}` : p.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="workload-remove-modal-footer">
              <button
                type="button"
                className="workload-remove-modal-btn workload-remove-modal-btn--cancel"
                onClick={fecharResponsavelModal}
                disabled={salvandoResponsavel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="workload-remove-modal-btn"
                style={{ background: '#2F4A3A', color: '#fff' }}
                onClick={salvarResponsavel}
                disabled={salvandoResponsavel}
              >
                {salvandoResponsavel ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
