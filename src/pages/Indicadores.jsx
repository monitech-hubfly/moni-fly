import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { registrarLog } from '../hooks/useAuditLog'
import { listarAreas } from '../utils/areasOrder'
import { useAdmin } from '../context/AdminContext'
import WorkloadFormDrawer from '../components/WorkloadFormDrawer'
import DefinirMetaDrawer from '../components/DefinirMetaDrawer'
import MetaCicloTipoFields from '../components/MetaCicloTipoFields'
import CalendarioComSemanas from '../components/CalendarioComSemanas'
import { normalizarSemaforo, faixaTextoResumo, ESCALA_OPCOES, escalaTipoDoIndicador } from '../utils/semaforoFaixas'
import { parseSemanaMetaTexto } from '../utils/metaCiclo'
import { concluirIndicadorAtingivel } from '../utils/indicadorConquista'
import { listarEscalasCustom, salvarNovaEscalaCustom, notificarEscalasCustomAtualizadas, getEscalaCustom } from '../utils/escalasCustom'

const SQL_SEMAFORO_FAIXAS = `ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS semaforo_faixas jsonb;`
const SQL_INDICADORES_POR_AREA = `ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id) ON DELETE CASCADE;
ALTER TABLE indicadores ALTER COLUMN tarefa_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_indicadores_area_id ON indicadores(area_id);`

const SQL_INDICADOR_OBJETIVO_ID = `ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_indicadores_objetivo_id ON indicadores(objetivo_id);`

const FAIXA_LABELS = [
  { titulo: 'Faixa 1 (melhor)' },
  { titulo: 'Faixa 2' },
  { titulo: 'Faixa 3' },
  { titulo: 'Faixa 4 (crítico)' }
]

const OPERADORES = [
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' },
  { label: '=', value: 'eq' },
  { label: '>', value: 'gt' },
  { label: '>=', value: 'gte' }
]

const OPERADORES_SO_IGUAL = [{ label: '=', value: 'eq' }]

function faixasDefault() {
  return [
    { cor: '#1e7a3a', limite: '', comparacao: 'gte' },
    { cor: '#52b36f', limite: '', comparacao: 'gte' },
    { cor: '#f2c94c', limite: '', comparacao: 'gte' },
    { cor: '#d24141', limite: '', comparacao: 'lt' }
  ]
}

function faixasFromInd(ind) {
  const { faixas: parsed } = normalizarSemaforo(ind)
  if (parsed && parsed.length >= 4) {
    return parsed.map((f, i) => ({
      cor: f.cor || faixasDefault()[i].cor,
      limite: f.limite != null && f.limite !== '' ? String(f.limite) : '',
      comparacao: ['lt', 'lte', 'eq', 'gt', 'gte'].includes(f.comparacao) ? f.comparacao : faixasDefault()[i].comparacao
    }))
  }
  // Fallback: modelo legado (regra_*), para o modal "Editar" vir preenchido
  const temLegado =
    ind?.regra_verde_escuro != null ||
    ind?.regra_verde_claro != null ||
    ind?.regra_amarelo != null
  if (temLegado) {
    const base = faixasDefault()
    const op = (v, fallback) => (['lt', 'lte', 'eq', 'gt', 'gte'].includes(v) ? v : fallback)
    const ultimoLimite = ind.regra_amarelo != null
      ? String(ind.regra_amarelo)
      : (ind.regra_verde_claro != null ? String(ind.regra_verde_claro) : '')
    return [
      {
        cor: base[0].cor,
        limite: ind.regra_verde_escuro != null ? String(ind.regra_verde_escuro) : '',
        comparacao: op(ind.regra_verde_escuro_op, base[0].comparacao)
      },
      {
        cor: base[1].cor,
        limite: ind.regra_verde_claro != null ? String(ind.regra_verde_claro) : '',
        comparacao: op(ind.regra_verde_claro_op, base[1].comparacao)
      },
      {
        cor: base[2].cor,
        limite: ind.regra_amarelo != null ? String(ind.regra_amarelo) : '',
        comparacao: op(ind.regra_amarelo_op, base[2].comparacao)
      },
      {
        cor: base[3].cor,
        // No modelo legado só existem 3 regras. Para a Faixa 4 (crítico),
        // usamos o último limite configurado como referência (normalmente o amarelo),
        // mantendo operador padrão de "abaixo de".
        limite: ultimoLimite,
        comparacao: 'lt'
      }
    ]
  }
  return faixasDefault()
}

function mapFaixasToLegacyRegras(faixas) {
  const out = {}
  const n = (i) => {
    const v = faixas[i]?.limite
    if (v === '' || v == null) return null
    const num = Number(v)
    return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : null
  }
  const re = n(0)
  const rc = n(1)
  const ra = n(2)
  if (re != null) {
    out.regra_verde_escuro = re
    out.regra_verde_escuro_op = faixas[0]?.comparacao || 'gte'
  }
  if (rc != null) {
    out.regra_verde_claro = rc
    out.regra_verde_claro_op = faixas[1]?.comparacao || 'gte'
  }
  if (ra != null) {
    out.regra_amarelo = ra
    out.regra_amarelo_op = faixas[2]?.comparacao || 'gte'
  }
  return out
}

function limiteParaPersistir(limite, modalEscalaKey) {
  if (limite === '' || limite == null) return null
  if (typeof modalEscalaKey === 'string' && modalEscalaKey.startsWith('custom:')) {
    const def = getEscalaCustom(modalEscalaKey.slice(7))
    if (!def) return String(limite).trim()
    if (def.modo === 'lista') return String(limite).trim()
    const n = Number(String(limite).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (modalEscalaKey === 'percentual' || modalEscalaKey === 'numero') {
    const n = Number(String(limite).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return String(limite).trim()
}

/** Ano + número de semana ISO (1–53), mesmo critério do modal «Definir meta». */
function indicadorModalPrazoValido(ano, semana) {
  const a = String(ano ?? '').trim()
  const s = String(semana ?? '').trim()
  if (!a || !s) return false
  const an = Number(a)
  const sn = Number(s)
  return (
    Number.isFinite(an) &&
    Number.isFinite(sn) &&
    an >= 2000 &&
    an <= 2100 &&
    sn >= 1 &&
    sn <= 53
  )
}

export default function Indicadores() {
  const { isAdmin } = useAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const areaFromUrl = searchParams.get('area')
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState(areaFromUrl || '')
  const [tarefas, setTarefas] = useState([])
  const [indicadoresByTarefa, setIndicadoresByTarefa] = useState({})
  const [indicadoresArea, setIndicadoresArea] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [migracaoSemaforo, setMigracaoSemaforo] = useState(false)
  const [migracaoIndicadoresArea, setMigracaoIndicadoresArea] = useState(false)
  const [migracaoObjetivoIndicador, setMigracaoObjetivoIndicador] = useState(false)
  const [metasArea, setMetasArea] = useState([])

  const [modalAberto, setModalAberto] = useState(false)
  const [salvandoModal, setSalvandoModal] = useState(false)
  const [modalModo, setModalModo] = useState('criar') // 'criar' | 'editar'
  const [modalEditId, setModalEditId] = useState(null)
  const [modalDescricao, setModalDescricao] = useState('')
  const [modalObjetivoId, setModalObjetivoId] = useState('')
  /** Pré-definida ou chave custom:uuid */
  const [modalEscala, setModalEscala] = useState('numero')
  const [modalFaixas, setModalFaixas] = useState(faixasDefault)
  const [modalMetaCicloTipo, setModalMetaCicloTipo] = useState('recorrente')
  /** Prazo (semana ISO) para indicador atingível — espelha DefinirMetaDrawer + CalendarioComSemanas. */
  const [modalIndPrazoAno, setModalIndPrazoAno] = useState('')
  const [modalIndPrazoMes, setModalIndPrazoMes] = useState('')
  const [modalIndPrazoSemana, setModalIndPrazoSemana] = useState('')
  const [escalasCustom, setEscalasCustom] = useState(() => listarEscalasCustom())
  const [metaDrawerAberto, setMetaDrawerAberto] = useState(false)
  const [concluindoIndicadorId, setConcluindoIndicadorId] = useState(null)
  const [modalNovaEscalaAberto, setModalNovaEscalaAberto] = useState(false)
  const [novaEscalaNome, setNovaEscalaNome] = useState('')
  /** @type {'lista'|'percentual'|'numero'} */
  const [novaEscalaModo, setNovaEscalaModo] = useState('lista')
  const [novaEscalaValores, setNovaEscalaValores] = useState(['', ''])
  const [salvandoNovaEscala, setSalvandoNovaEscala] = useState(false)
  const [erroNovaEscala, setErroNovaEscala] = useState('')
  const modalTituloId = 'indicadores-modal-title'
  const metaSelectRef = useRef(null)
  const descInputRef = useRef(null)

  const anosPrazoModalIndicador = useMemo(() => {
    const set = new Set()
    if (modalIndPrazoAno) set.add(String(modalIndPrazoAno))
    set.add(String(new Date().getFullYear()))
    return Array.from(set).sort((a, b) => Number(a) - Number(b))
  }, [modalIndPrazoAno])

  function resetModalPrazoIndicadorForm() {
    const y = new Date().getFullYear()
    setModalIndPrazoAno(String(y))
    setModalIndPrazoMes(String(new Date().getMonth() + 1))
    setModalIndPrazoSemana('')
  }

  function preencherModalPrazoIndicadorDeInd(ind) {
    const anoRef = new Date().getFullYear()
    const sem = parseSemanaMetaTexto(ind?.meta_unidade)
    setModalIndPrazoAno(String(anoRef))
    if (sem != null) {
      const approx = new Date(anoRef, 0, 1 + (sem - 1) * 7)
      setModalIndPrazoMes(String(Math.min(12, Math.max(1, approx.getMonth() + 1))))
      setModalIndPrazoSemana(String(sem))
    } else {
      setModalIndPrazoMes(String(new Date().getMonth() + 1))
      setModalIndPrazoSemana('')
    }
  }

  const defEscalaModal = useMemo(() => {
    if (typeof modalEscala === 'string' && modalEscala.startsWith('custom:')) {
      return getEscalaCustom(modalEscala.slice(7))
    }
    return null
  }, [modalEscala])

  useEffect(() => {
    const fn = () => setEscalasCustom(listarEscalasCustom())
    window.addEventListener('carometro-escalas-custom-changed', fn)
    window.addEventListener('storage', fn)
    return () => {
      window.removeEventListener('carometro-escalas-custom-changed', fn)
      window.removeEventListener('storage', fn)
    }
  }, [])

  useEffect(() => {
    listarAreas(supabase, 'id, nome').then(({ data }) => {
      const list = data || []
      setAreas(list)
      if (list.length && !areaFromUrl && !areaId) setAreaId(list[0].id)
      if (list.length && areaFromUrl) setAreaId(areaFromUrl)
    })
  }, [])
  useEffect(() => {
    if (areaFromUrl && areaFromUrl !== areaId) setAreaId(areaFromUrl)
  }, [areaFromUrl])

  const carregar = useCallback(async () => {
    if (!areaId) {
      setTarefas([])
      setIndicadoresByTarefa({})
      setIndicadoresArea([])
      setMetasArea([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: tfs, error: e } = await supabase
        .from('tarefas')
        .select('id, nome, ordem, area_id')
        .eq('area_id', areaId)
        .order('ordem')
        .order('criado_em')
      if (e) throw e
      const listaT = tfs || []
      setTarefas(listaT)
      let mesas = []
      try {
        let { data: om, error: em } = await supabase
          .from('objetivos')
          .select('id, descricao, ordem, meta_unidade')
          .eq('area_id', areaId)
          .eq('status', 'ativo')
          .order('ordem', { ascending: true })
        if (em && String(em.message || '').toLowerCase().includes('status')) {
          const r0 = await supabase
            .from('objetivos')
            .select('id, descricao, ordem, meta_unidade')
            .eq('area_id', areaId)
            .order('ordem', { ascending: true })
          om = r0.data
          em = r0.error
        }
        if (!em) mesas = om || []
      } catch {
        mesas = []
      }
      setMetasArea(mesas)
      const tarefaIds = listaT.map(t => t.id)
      // Indicadores da área (novo modelo)
      let areaInds = []
      try {
        let { data: indsArea, error: errArea } = await supabase
          .from('indicadores')
          .select('*')
          .eq('area_id', areaId)
          .eq('status', 'ativo')
          .order('ordem')
          .order('criado_em')
        if (errArea && String(errArea.message || '').toLowerCase().includes('status')) {
          const r1 = await supabase
            .from('indicadores')
            .select('*')
            .eq('area_id', areaId)
            .order('ordem')
            .order('criado_em')
          indsArea = r1.data
          errArea = r1.error
          if (!errArea && Array.isArray(indsArea)) {
            indsArea = indsArea.filter(i => String(i?.status || '').toLowerCase() !== 'concluido')
          }
        }
        if (errArea) throw errArea
        areaInds = indsArea || []
        setMigracaoIndicadoresArea(false)
      } catch (errArea) {
        if (String(errArea?.message || errArea).includes('area_id')) {
          setMigracaoIndicadoresArea(true)
          areaInds = []
        } else {
          throw errArea
        }
      }
      setIndicadoresArea(areaInds)

      // Indicadores por comportamento (modelo legado)
      if (tarefaIds.length === 0) {
        setIndicadoresByTarefa({})
        return
      }
      let { data: inds, error: errInd } = await supabase
        .from('indicadores')
        .select('*')
        .in('tarefa_id', tarefaIds)
        .eq('status', 'ativo')
        .order('ordem')
        .order('criado_em')
      if (errInd && String(errInd.message || '').toLowerCase().includes('status')) {
        const r2 = await supabase
          .from('indicadores')
          .select('*')
          .in('tarefa_id', tarefaIds)
          .order('ordem')
          .order('criado_em')
        inds = r2.data
        errInd = r2.error
        if (!errInd && Array.isArray(inds)) {
          inds = inds.filter(i => String(i?.status || '').toLowerCase() !== 'concluido')
        }
      }
      if (errInd) throw errInd
      const byTarefa = {}
      ;(inds || []).forEach(i => {
        if (!byTarefa[i.tarefa_id]) byTarefa[i.tarefa_id] = []
        byTarefa[i.tarefa_id].push(i)
      })
      setIndicadoresByTarefa(byTarefa)
    } catch (err) {
      setError(err?.message || String(err))
      setIndicadoresByTarefa({})
      setIndicadoresArea([])
    } finally {
      setLoading(false)
    }
  }, [areaId])

  useEffect(() => { carregar() }, [carregar])

  async function handleConcluirIndicador(ind) {
    if (!ind?.id) return
    const aid = ind.area_id || areaId
    if (!aid) {
      setError('Área não identificada para concluir este indicador.')
      return
    }
    if (String(ind.status || '').toLowerCase() === 'concluido') return
    const nome = String(ind.nome || '').trim() || '—'
    if (!window.confirm(`Concluir o indicador atingível "${nome}"? O registro irá para Conquistas e ele sairá da lista ativa.`)) return
    setConcluindoIndicadorId(ind.id)
    setError(null)
    const r = await concluirIndicadorAtingivel(supabase, ind, aid)
    setConcluindoIndicadorId(null)
    if (!r.ok) {
      setError(r.message)
      return
    }
    void registrarLog({
      modulo: 'Indicadores',
      area: areas.find(a => a.id === areaId)?.nome ?? null,
      entidade: 'indicadores',
      entidade_id: ind.id,
      operacao: 'UPDATE',
      valor_novo: { status: 'concluido' },
      descricao: `Concluiu indicador atingível "${ind.nome || ind.id}"`
    })
    await carregar()
  }

  useEffect(() => {
    if (!modalAberto) return
    const t = setTimeout(() => {
      if (metasArea.length > 0) metaSelectRef.current?.focus?.()
      else descInputRef.current?.focus?.()
    }, 0)
    return () => clearTimeout(t)
  }, [modalAberto, metasArea.length])

  function abrirModalCriar() {
    setError(null)
    setModalModo('criar')
    setModalEditId(null)
    setModalDescricao('')
    setModalObjetivoId(metasArea[0]?.id || '')
    setModalEscala('numero')
    setModalFaixas(faixasDefault())
    setModalMetaCicloTipo('recorrente')
    resetModalPrazoIndicadorForm()
    setModalAberto(true)
  }

  function abrirModalEditar(ind) {
    if (!ind) return
    setError(null)
    setModalModo('editar')
    setModalEditId(ind.id)
    setModalDescricao(ind.nome || '')
    setModalObjetivoId(ind.objetivo_id || '')
    setModalEscala(escalaTipoDoIndicador(ind))
    setModalFaixas(faixasFromInd(ind))
    setModalMetaCicloTipo(ind.meta_ciclo_tipo === 'atingivel' ? 'atingivel' : 'recorrente')
    preencherModalPrazoIndicadorDeInd(ind)
    setModalAberto(true)
  }

  function fecharModalNovaEscala() {
    if (salvandoNovaEscala) return
    setModalNovaEscalaAberto(false)
    setErroNovaEscala('')
    setNovaEscalaNome('')
    setNovaEscalaModo('lista')
    setNovaEscalaValores(['', ''])
  }

  async function confirmarNovaEscala() {
    setErroNovaEscala('')
    setSalvandoNovaEscala(true)
    const res = salvarNovaEscalaCustom({
      nome: novaEscalaNome,
      modo: novaEscalaModo,
      valores: novaEscalaModo === 'lista' ? novaEscalaValores : undefined
    })
    setSalvandoNovaEscala(false)
    if (!res.ok) {
      setErroNovaEscala(res.erro)
      return
    }
    notificarEscalasCustomAtualizadas()
    setEscalasCustom(listarEscalasCustom())
    setModalEscala(`custom:${res.escala.id}`)
    if (res.escala.modo === 'lista') {
      setModalFaixas(prev => prev.map(row => ({ ...row, comparacao: 'eq' })))
    }
    fecharModalNovaEscala()
  }

  function fecharModal() {
    if (salvandoModal) return
    fecharModalNovaEscala()
    setModalObjetivoId('')
    resetModalPrazoIndicadorForm()
    setModalAberto(false)
  }

  /** Fecha a gaveta ou, se o modal de nova escala estiver aberto, apenas ele. */
  function fecharIndicadorDrawer() {
    if (salvandoModal) return
    if (metaDrawerAberto) {
      fecharMetaDrawerIndicadores()
      return
    }
    if (modalNovaEscalaAberto) {
      if (!salvandoNovaEscala) fecharModalNovaEscala()
      return
    }
    fecharModal()
  }

  function fecharMetaDrawerIndicadores() {
    setMetaDrawerAberto(false)
  }

  function abrirDefinirMetas() {
    if (!areaId) {
      setError('Selecione uma área antes de definir metas.')
      return
    }
    setError(null)
    setMetaDrawerAberto(true)
  }

  function setFaixaCor(i, cor) {
    setModalFaixas(prev => prev.map((f, j) => (j === i ? { ...f, cor } : f)))
  }
  function setFaixaLimite(i, limite) {
    setModalFaixas(prev => prev.map((f, j) => (j === i ? { ...f, limite } : f)))
  }
  function setFaixaComparacao(i, comparacao) {
    setModalFaixas(prev => prev.map((f, j) => (j === i ? { ...f, comparacao } : f)))
  }

  async function salvarIndicadorModal() {
    if (!isAdmin) return
    if (!areaId || !modalDescricao.trim()) {
      setError('Informe a descrição do indicador.')
      return
    }
    if (modalModo === 'criar' && metasArea.length === 0) {
      setError('Não há metas cadastradas para esta área. Use «Definir metas» ou o Planejamento (Gantt) para cadastrar metas antes de criar indicadores.')
      return
    }
    if (metasArea.length > 0 && !modalObjetivoId) {
      setError('Selecione a meta à qual este indicador pertence.')
      return
    }
    const cicloTipo = modalMetaCicloTipo === 'atingivel' ? 'atingivel' : 'recorrente'
    const exigePrazoInd = cicloTipo === 'atingivel'
    const semanaNumSalvarInd =
      exigePrazoInd && indicadorModalPrazoValido(modalIndPrazoAno, modalIndPrazoSemana)
        ? Number(String(modalIndPrazoSemana).trim())
        : null
    if (exigePrazoInd && semanaNumSalvarInd == null) {
      setError('Selecione o prazo (ano e semana) para indicador atingível.')
      return
    }
    const metaUnidadeInd =
      exigePrazoInd && semanaNumSalvarInd != null ? `S${semanaNumSalvarInd}` : null

    const lista = indicadoresArea || []
    let tipoDb = 'quantidade'
    let unidadeLabel = null
    let semaforoPayload

    if (typeof modalEscala === 'string' && modalEscala.startsWith('custom:')) {
      const cid = modalEscala.slice(7)
      const def = getEscalaCustom(cid)
      if (!def) {
        setError('A escala personalizada não foi encontrada neste navegador. Crie-a de novo ou escolha outro tipo.')
        return
      }
      tipoDb = def.modo === 'percentual' ? 'percentual' : def.modo === 'numero' ? 'quantidade' : 'outro'
      unidadeLabel = def.nome
      semaforoPayload = {
        escala_tipo: 'custom',
        escala_custom_id: cid,
        faixas: modalFaixas.map((f, i) => ({
          cor: f.cor,
          limite: limiteParaPersistir(f.limite, modalEscala),
          comparacao: f.comparacao || faixasDefault()[i].comparacao
        }))
      }
    } else {
      const optTipo = ESCALA_OPCOES.find(o => o.id === modalEscala)
      tipoDb = optTipo?.dbTipo || 'quantidade'
      unidadeLabel = optTipo?.label || null
      semaforoPayload = {
        escala_tipo: modalEscala,
        faixas: modalFaixas.map((f, i) => ({
          cor: f.cor,
          limite: limiteParaPersistir(f.limite, modalEscala),
          comparacao: f.comparacao || faixasDefault()[i].comparacao
        }))
      }
    }

    const payload = {
      area_id: areaId,
      tarefa_id: null,
      nome: modalDescricao.trim(),
      tipo: tipoDb,
      unidade: unidadeLabel,
      ordem: lista.length,
      semaforo_faixas: semaforoPayload,
      meta_ciclo_tipo: cicloTipo,
      meta_unidade: metaUnidadeInd,
      ...(modalObjetivoId ? { objetivo_id: modalObjetivoId } : { objetivo_id: null })
    }
    Object.assign(payload, mapFaixasToLegacyRegras(modalFaixas))

    setSalvandoModal(true)
    setError(null)
    let fallbackSemaforo = false
    let fallbackObjetivo = false
    let err = null
    let working = { ...payload }

    async function aplicarSalvar(p) {
      if (modalModo === 'editar' && modalEditId) {
        const { area_id, tarefa_id, ordem, ...toUpdate } = p
        return supabase.from('indicadores').update(toUpdate).eq('id', modalEditId)
      }
      return supabase.from('indicadores').insert(p)
    }

    let res = await aplicarSalvar(working)
    err = res.error
    if (err?.message?.includes('objetivo_id')) {
      setMigracaoObjetivoIndicador(true)
      fallbackObjetivo = true
      const { objetivo_id: _o, ...semObj } = working
      working = semObj
      res = await aplicarSalvar(working)
      err = res.error
    }
    if (err && (err.message?.includes('semaforo_faixas') || err.message?.includes('column'))) {
      setMigracaoSemaforo(true)
      fallbackSemaforo = true
      const { semaforo_faixas: _, ...semColuna } = working
      working = semColuna
      res = await aplicarSalvar(working)
      err = res.error
    }
    if (err && err.message?.includes('objetivo_id')) {
      setMigracaoObjetivoIndicador(true)
      fallbackObjetivo = true
      const { objetivo_id: _o2, ...semObj2 } = working
      working = semObj2
      res = await aplicarSalvar(working)
      err = res.error
    }
    if (err && String(err.message || '').toLowerCase().includes('meta_ciclo_tipo')) {
      const { meta_ciclo_tipo: _mc, ...semCiclo } = working
      working = semCiclo
      res = await aplicarSalvar(working)
      err = res.error
    }
    if (err && String(err.message || '').toLowerCase().includes('meta_unidade')) {
      const { meta_unidade: _mu, ...semMu } = working
      working = semMu
      res = await aplicarSalvar(working)
      err = res.error
    }
    if (err && (err.message?.includes('area_id') || err.message?.includes('tarefa_id') || err.message?.includes('null value'))) {
      setMigracaoIndicadoresArea(true)
      setError('Seu banco ainda está no modelo antigo (indicador por comportamento). Clique para copiar o SQL de migração.')
      setSalvandoModal(false)
      return
    }
    setSalvandoModal(false)
    if (err) {
      setError(err.message)
      return
    }
    const nomeAreaLog = areas.find((a) => a.id === areaId)?.nome || null
    if (modalModo === 'editar' && modalEditId) {
      const prevInd = lista.find((i) => i.id === modalEditId)
      void registrarLog({
        modulo: 'Indicadores',
        area: nomeAreaLog,
        entidade: 'indicadores',
        entidade_id: modalEditId,
        operacao: 'UPDATE',
        valor_anterior: prevInd || null,
        valor_novo: working,
        descricao: `Alterou indicador "${working.nome || prevInd?.nome || modalEditId}"`
      })
    } else {
      void registrarLog({
        modulo: 'Indicadores',
        area: nomeAreaLog,
        entidade: 'indicadores',
        entidade_id: res?.data?.id ?? null,
        operacao: 'INSERT',
        valor_novo: working,
        descricao: `Criou indicador "${working.nome || '(sem nome)'}"`
      })
    }
    if (!fallbackSemaforo) setMigracaoSemaforo(false)
    if (!fallbackObjetivo) setMigracaoObjetivoIndicador(false)
    setModalObjetivoId('')
    setModalAberto(false)
    await carregar()
  }

  async function removerIndicador(id) {
    if (!window.confirm('Remover este indicador?')) return
    const prev =
      (indicadoresArea || []).find((i) => i.id === id) ||
      Object.values(indicadoresByTarefa || {})
        .flat()
        .find((i) => i.id === id)
    const nomeAreaLog = areas.find((a) => a.id === areaId)?.nome || null
    const { error: err } = await supabase.from('indicadores').delete().eq('id', id)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Indicadores',
        area: nomeAreaLog,
        entidade: 'indicadores',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prev || null,
        descricao: prev ? `Excluiu indicador "${prev.nome || id}"` : `Excluiu indicador ${id}`
      })
      await carregar()
    }
  }

  const nomeArea = areas.find(a => a.id === areaId)?.nome || ''

  const temAlgumIndicador = useMemo(() => {
    return (indicadoresArea?.length || 0) > 0 || tarefas.some(t => (indicadoresByTarefa[t.id] || []).length > 0)
  }, [tarefas, indicadoresByTarefa, indicadoresArea])

  /** Indicadores da área agrupados por meta (ordem das metas da área; «Sem meta» por último). */
  const secoesMetasIndicadores = useMemo(() => {
    const list = indicadoresArea || []
    const metaPorId = new Map((metasArea || []).map(m => [m.id, m]))
    const porMeta = new Map()
    const semMeta = []
    for (const ind of list) {
      const oid = ind.objetivo_id
      if (oid && metaPorId.has(oid)) {
        if (!porMeta.has(oid)) porMeta.set(oid, [])
        porMeta.get(oid).push(ind)
      } else {
        semMeta.push(ind)
      }
    }
    const sections = []
    for (const m of metasArea || []) {
      const inds = porMeta.get(m.id)
      if (inds && inds.length) {
        sections.push({ key: m.id, meta: m, titulo: (m.descricao || '').trim() || 'Meta', indicadores: inds })
      }
    }
    if (semMeta.length) {
      sections.push({
        key: '_sem',
        meta: null,
        titulo: 'Sem meta',
        indicadores: semMeta
      })
    }
    return sections
  }, [indicadoresArea, metasArea])

  function renderLinhaIndicador(ind, isLastInGroup) {
    const faixas = faixasFromInd(ind)
    const escala = escalaTipoDoIndicador(ind)
    const ciclo = ind.meta_ciclo_tipo === 'atingivel' ? 'atingivel' : 'recorrente'
    const semNum = parseSemanaMetaTexto(ind.meta_unidade)
    const tipoBadgeTxt =
      ciclo === 'atingivel' && semNum != null
        ? `Atingível · S${semNum}`
        : ciclo === 'atingivel'
          ? 'Atingível'
          : 'Recorrente'
    const chipTone = i => (i <= 1 ? 'g' : i === 2 ? 'y' : 'r')
    return (
      <tr
        key={ind.id}
        className={`indicadores-mega-data-row workload-atividade-row indicadores-ind-row${isLastInGroup ? ' indicadores-mega-data-row--last' : ''}`}
      >
        <td className="indicadores-mega-td indicadores-mega-td--desc" data-label="Descrição">
          <span className="indicadores-mega-desc" title={ind.nome}>{ind.nome}</span>
        </td>
        <td className="indicadores-mega-td indicadores-mega-td--tipo" data-label="Tipo">
          <span className="indicadores-mega-tipo-pill">{tipoBadgeTxt}</span>
        </td>
        <td className="indicadores-mega-td indicadores-mega-td--unidade" data-label="Unidade">
          <span className="indicadores-mega-unidade" title={ind.unidade || undefined}>{ind.unidade || '—'}</span>
        </td>
        <td className="indicadores-mega-td indicadores-mega-td--semaforo" data-label="Semáforo">
          <div className="indicadores-mega-semaforo-chips" aria-label="Configuração do semáforo">
            {faixas.map((f, i) => (
              <span
                key={i}
                className={`indicadores-mega-semaforo-chip indicadores-mega-semaforo-chip--${chipTone(i)}`}
                title={`Faixa ${i + 1}: ${faixaTextoResumo(f, escala)}`}
              >
                <span className="indicadores-mega-semaforo-chip-dot" aria-hidden />
                <span className="indicadores-mega-semaforo-chip-txt">{faixaTextoResumo(f, escala)}</span>
              </span>
            ))}
          </div>
        </td>
        <td className="indicadores-mega-td indicadores-mega-td--conquista" data-label="Conquista">
          {ciclo === 'atingivel' && String(ind.status || '').toLowerCase() !== 'concluido' ? (
            <button
              type="button"
              className="indicadores-mega-conquista-btn"
              title="Concluir indicador atingível"
              disabled={Boolean(concluindoIndicadorId) || (!(ind.area_id || areaId))}
              onClick={() => handleConcluirIndicador(ind)}
            >
              {concluindoIndicadorId === ind.id ? '…' : '✓'}
            </button>
          ) : (
            <span className="indicadores-mega-conquista-dash">—</span>
          )}
        </td>
        {isAdmin && (
          <td data-label="Ações" className="indicadores-mega-td indicadores-mega-td--acoes">
            <div className="indicadores-mega-acoes">
              <button
                type="button"
                className="indicadores-mega-acao-btn indicadores-mega-acao-btn--edit"
                onClick={() => abrirModalEditar(ind)}
                title="Editar indicador"
              >
                ✎
              </button>
              <button
                type="button"
                className="indicadores-mega-acao-btn indicadores-mega-acao-btn--del"
                onClick={() => removerIndicador(ind.id)}
                title="Remover indicador"
              >
                ✕
              </button>
            </div>
          </td>
        )}
      </tr>
    )
  }

  const indicadoresMegaColSpan = isAdmin ? 6 : 5

  return (
    <>
      <div className="indicadores-page-shell">
        <header className="indicadores-topbar">
          <div className="indicadores-topbar-titles">
            <h1 className="indicadores-topbar-h1">Indicadores</h1>
            <p className="indicadores-topbar-sub workload-subtitle">
              Indicadores dos comportamentos cadastrados em Comportamentos e Atividades, por área.
            </p>
          </div>
          <div className="indicadores-topbar-actions">
            <button type="button" className="indicadores-btn-outline" onClick={abrirDefinirMetas}>
              Definir metas
            </button>
            {areas.length > 0 && (
              <div className="indicadores-topbar-area-field">
                <label className="indicadores-topbar-area-label" htmlFor="indicadores-area">Área</label>
                <select
                  id="indicadores-area"
                  className="indicadores-topbar-area-select"
                  value={areaId}
                  onChange={e => {
                    setAreaId(e.target.value)
                    if (e.target.value) setSearchParams({ area: e.target.value })
                  }}
                  aria-label="Área"
                >
                  <option value="">Selecione</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {areaId && isAdmin && (
              <button
                type="button"
                className="indicadores-btn-primary"
                onClick={abrirModalCriar}
                disabled={metasArea.length === 0}
                title={metasArea.length === 0 ? 'Cadastre metas para esta área no Planejamento (Gantt) antes de criar indicadores.' : undefined}
              >
                + Criar Indicador
              </button>
            )}
          </div>
        </header>

        <div className="indicadores-content-pad">
      {error && (
        <div
          className={`alert ${migracaoSemaforo ? 'alert-warning' : 'alert-error'}`}
          style={migracaoSemaforo ? { cursor: 'pointer' } : undefined}
          role={migracaoSemaforo ? 'button' : undefined}
          tabIndex={migracaoSemaforo ? 0 : undefined}
          onClick={migracaoSemaforo ? () => {
            navigator.clipboard?.writeText(SQL_SEMAFORO_FAIXAS).then(() => {
              window.alert('SQL copiado! Execute no Supabase (SQL Editor) e recarregue a página.')
            }).catch(() => {})
          } : undefined}
        >
          {migracaoSemaforo ? <>⚠️ {error} <span style={{ textDecoration: 'underline', marginLeft: '0.5rem' }}>Clique para copiar o SQL (coluna semaforo_faixas)</span></> : error}
        </div>
      )}

      {migracaoIndicadoresArea && !migracaoSemaforo && (
        <div
          className="alert alert-warning"
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => {
            navigator.clipboard?.writeText(SQL_INDICADORES_POR_AREA).then(() => {
              window.alert('SQL copiado! Execute no Supabase (SQL Editor) e recarregue a página.')
            }).catch(() => {})
          }}
        >
          ⚠️ Clique para copiar o SQL de migração (indicadores por área).
          <span style={{ textDecoration: 'underline', marginLeft: '0.5rem' }}>Copiar SQL</span>
        </div>
      )}

      {migracaoObjetivoIndicador && !migracaoSemaforo && (
        <div
          className="alert alert-warning"
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => {
            navigator.clipboard?.writeText(SQL_INDICADOR_OBJETIVO_ID).then(() => {
              window.alert('SQL copiado! Execute no Supabase (SQL Editor) e recarregue a página.')
            }).catch(() => {})
          }}
        >
          ⚠️ Clique para copiar o SQL de migração (coluna objetivo_id em indicadores).
          <span style={{ textDecoration: 'underline', marginLeft: '0.5rem' }}>Copiar SQL</span>
        </div>
      )}

      {!areaId ? (
        <p className="indicadores-page-hint">Selecione uma área.</p>
      ) : loading ? (
        <p className="indicadores-loading-txt">Carregando…</p>
      ) : (
        <div className="indicadores-workload-root">
          {!temAlgumIndicador ? (
            <p className="indicadores-workload-empty">
              Nenhum indicador cadastrado. Use &quot;+ Criar Indicador&quot; para adicionar.
            </p>
          ) : (
            <div className="indicadores-table-card">
              <table className="indicadores-mega-table" role="table">
                <colgroup>
                  <col className="indicadores-mega-col-desc" />
                  <col className="indicadores-mega-col-tipo" />
                  <col className="indicadores-mega-col-unidade" />
                  <col className="indicadores-mega-col-semaforo" />
                  <col className="indicadores-mega-col-conquista" />
                  {isAdmin ? <col className="indicadores-mega-col-acoes" /> : null}
                </colgroup>
                <tbody>
                  {secoesMetasIndicadores.map(sec => (
                    <Fragment key={sec.key}>
                      <tr className="indicadores-mega-grupo-faixa">
                        <td colSpan={indicadoresMegaColSpan}>
                          <div className="indicadores-mega-grupo-faixa-inner">
                            <div
                              className={
                                sec.key === '_sem'
                                  ? 'indicadores-mega-grupo-ic indicadores-mega-grupo-ic--sem'
                                  : 'indicadores-mega-grupo-ic indicadores-mega-grupo-ic--meta'
                              }
                              aria-hidden
                            >
                              {sec.key === '_sem' ? (
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                                  <rect x="9" y="3" width="6" height="4" rx="1" />
                                </svg>
                              ) : (
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <circle cx="12" cy="12" r="8" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </div>
                            <span className="indicadores-mega-grupo-titulo" title={sec.titulo}>{sec.titulo}</span>
                            {sec.meta?.meta_unidade ? (
                              <span className="indicadores-mega-badge-week">{sec.meta.meta_unidade}</span>
                            ) : null}
                            {sec.key === '_sem' ? (
                              <span className="indicadores-mega-badge-nometa">Sem meta definida</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      <tr className="indicadores-mega-colhead-row">
                        <th scope="col" className="indicadores-mega-th">Descrição</th>
                        <th scope="col" className="indicadores-mega-th">Tipo</th>
                        <th scope="col" className="indicadores-mega-th">Unidade</th>
                        <th scope="col" className="indicadores-mega-th indicadores-mega-th--semaforo">Semáforo</th>
                        <th scope="col" className="indicadores-mega-th">Conquista</th>
                        {isAdmin ? <th scope="col" className="indicadores-mega-th indicadores-mega-th--acoes">Ações</th> : null}
                      </tr>
                      {sec.indicadores.map((ind, idx, arr) =>
                        renderLinhaIndicador(ind, idx === arr.length - 1)
                      )}
                    </Fragment>
                  ))}

                  {tarefas.some(t => (indicadoresByTarefa[t.id] || []).length > 0) && (
                    <Fragment key="_legado-bloco">
                      <tr className="indicadores-mega-grupo-faixa indicadores-mega-grupo-faixa--legado-intro">
                        <td colSpan={indicadoresMegaColSpan}>
                          <div className="indicadores-mega-grupo-faixa-inner">
                            <span className="indicadores-mega-grupo-legado-txt">
                              Indicadores vinculados a comportamentos (modelo anterior por tarefa).
                            </span>
                          </div>
                        </td>
                      </tr>
                      {tarefas.map(t => {
                        const inds = indicadoresByTarefa[t.id] || []
                        if (inds.length === 0) return null
                        return (
                          <Fragment key={t.id}>
                            <tr className="indicadores-mega-grupo-faixa">
                              <td colSpan={indicadoresMegaColSpan}>
                                <div className="indicadores-mega-grupo-faixa-inner">
                                  <div className="indicadores-mega-grupo-ic indicadores-mega-grupo-ic--meta" aria-hidden>
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 2l4 6H8l4-6z" />
                                      <path d="M5 10h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10z" />
                                    </svg>
                                  </div>
                                  <span className="indicadores-mega-grupo-titulo" title={t.nome}>{t.nome}</span>
                                  <span className="indicadores-mega-badge-week">Comportamento</span>
                                </div>
                              </td>
                            </tr>
                            <tr className="indicadores-mega-colhead-row">
                              <th scope="col" className="indicadores-mega-th">Descrição</th>
                              <th scope="col" className="indicadores-mega-th">Tipo</th>
                              <th scope="col" className="indicadores-mega-th">Unidade</th>
                              <th scope="col" className="indicadores-mega-th indicadores-mega-th--semaforo">Semáforo</th>
                              <th scope="col" className="indicadores-mega-th">Conquista</th>
                              {isAdmin ? <th scope="col" className="indicadores-mega-th indicadores-mega-th--acoes">Ações</th> : null}
                            </tr>
                            {inds.map((ind, idx, arr) => renderLinhaIndicador(ind, idx === arr.length - 1))}
                          </Fragment>
                        )
                      })}
                    </Fragment>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </div>
      </div>

      <WorkloadFormDrawer
        open={modalAberto}
        title={modalModo === 'editar' ? 'Editar indicador' : 'Criar indicador'}
        titleId={modalTituloId}
        panelClassName="indicadores-form-drawer-panel"
        closeDisabled={salvandoModal}
        ariaDescribedBy="indicadores-modal-desc"
        onClose={fecharIndicadorDrawer}
        footer={(
          <>
            <button type="button" className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--cancel" onClick={fecharIndicadorDrawer} disabled={salvandoModal}>
              Cancelar
            </button>
            <button
              type="submit"
              form="indicadores-drawer-form"
              className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--save"
              disabled={
                salvandoModal
                || !isAdmin
                || (metasArea.length > 0 && !modalObjetivoId)
                || (modalModo === 'criar' && metasArea.length === 0)
                || (
                  modalMetaCicloTipo === 'atingivel'
                  && !indicadorModalPrazoValido(modalIndPrazoAno, modalIndPrazoSemana)
                )
              }
            >
              {salvandoModal ? 'Salvando…' : (modalModo === 'editar' ? 'Salvar alterações' : 'Salvar indicador')}
            </button>
          </>
        )}
      >
        <form
          id="indicadores-drawer-form"
          className="workload-drawer-form-inner indicadores-drawer-form"
          onSubmit={(e) => {
            e.preventDefault()
            salvarIndicadorModal()
          }}
        >
          <p id="indicadores-modal-desc" className="modal-subtitle indicadores-drawer-subtitle">
            {modalModo === 'editar'
              ? `Edite o indicador da área ${nomeArea ? `(${nomeArea})` : ''}, vincule à meta e ajuste o semáforo.`
              : `Crie um indicador da área ${nomeArea ? `(${nomeArea})` : ''}, vincule à meta e configure o semáforo.`}
          </p>
          <div className="modal-field">
            <label htmlFor="ind-modal-meta">Meta</label>
            {metasArea.length > 0 ? (
              <select
                ref={metaSelectRef}
                id="ind-modal-meta"
                value={modalObjetivoId}
                onChange={e => setModalObjetivoId(e.target.value)}
                aria-required="true"
              >
                    <option value="">Selecione</option>
                    {metasArea.map(m => (
                      <option key={m.id} value={m.id}>{(m.descricao || '').trim() || 'Meta'}</option>
                    ))}
                    {modalObjetivoId && !metasArea.some(m => m.id === modalObjetivoId) && (
                      <option value={modalObjetivoId}>Meta removida ou indisponível — selecione outra</option>
                    )}
                  </select>
                ) : (
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                    Não há metas para esta área.{' '}
                    <button type="button" className="btn btn-sm" onClick={() => { setMetaDrawerAberto(true) }}>
                      Definir metas
                    </button>
                  </p>
                )}
              </div>
              <div className="modal-field">
                <label htmlFor="ind-modal-desc">Descrição</label>
                <input
                  ref={descInputRef}
                  id="ind-modal-desc"
                  value={modalDescricao}
                  onChange={e => setModalDescricao(e.target.value)}
                  placeholder="Nome ou descrição do indicador"
                  autoComplete="off"
                />
              </div>
              <div className="modal-field">
                <MetaCicloTipoFields
                  idPrefix="ind-meta-ciclo"
                  context="indicador"
                  value={modalMetaCicloTipo}
                  onChange={(v) => {
                    setModalMetaCicloTipo(v)
                    if (v === 'recorrente') {
                      setModalIndPrazoSemana('')
                      setModalIndPrazoMes(String(new Date().getMonth() + 1))
                    }
                  }}
                />
              </div>
              {modalMetaCicloTipo === 'atingivel' && (
                <div className="modal-field">
                  <label htmlFor="ind-modal-prazo-ano">Prazo para conclusão</label>
                  <select
                    id="ind-modal-prazo-ano"
                    value={modalIndPrazoAno}
                    onChange={(e) => {
                      setModalIndPrazoAno(e.target.value)
                      setModalIndPrazoSemana('')
                    }}
                  >
                    {(anosPrazoModalIndicador || []).map(a => (
                      <option key={a} value={String(a)}>{a}</option>
                    ))}
                  </select>
                  <CalendarioComSemanas
                    ano={modalIndPrazoAno ? Number(modalIndPrazoAno) : new Date().getFullYear()}
                    mesInicial={
                      modalIndPrazoMes
                        ? Math.max(0, Math.min(11, Number(modalIndPrazoMes) - 1))
                        : new Date().getMonth()
                    }
                    selectedSemanaNum={modalIndPrazoSemana ? Number(modalIndPrazoSemana) : null}
                    onSelectSemanaNumero={(semanaNumero) => {
                      if (semanaNumero == null || !Number.isFinite(Number(semanaNumero))) return
                      const n = Math.trunc(Number(semanaNumero))
                      if (n < 1 || n > 53) return
                      setModalIndPrazoSemana(String(n))
                      setError(null)
                    }}
                  />
                  <div className="modal-hint" style={{ textAlign: 'center' }}>
                    {modalIndPrazoSemana
                      ? `Prazo selecionado: S${modalIndPrazoSemana}`
                      : 'Selecione a semana no calendário.'}
                  </div>
                </div>
              )}
              <fieldset className="indicadores-modal-faixas">
                <legend className="indicadores-modal-faixas-legend">Configurações do semáforo (4 faixas)</legend>

                <div className="modal-field indicadores-modal-escala-field">
                  <label htmlFor="ind-modal-escala">Tipo de escala</label>
                  <select
                    id="ind-modal-escala"
                    value={modalEscala}
                    onChange={(e) => {
                      const next = e.target.value
                      if (next === '__add_escala__') {
                        setErroNovaEscala('')
                        setNovaEscalaNome('')
                        setNovaEscalaModo('lista')
                        setNovaEscalaValores(['', ''])
                        setModalNovaEscalaAberto(true)
                        return
                      }
                      setModalEscala(next)
                      const def = next.startsWith('custom:') ? getEscalaCustom(next.slice(7)) : null
                      if (next === 'sim_nao' || next === 'status_3' || def?.modo === 'lista') {
                        setModalFaixas(prev => prev.map(row => ({ ...row, comparacao: 'eq' })))
                      }
                    }}
                  >
                    {ESCALA_OPCOES.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                    {escalasCustom.length > 0 && (
                      <optgroup label="Escalas personalizadas">
                        {escalasCustom.map(ec => (
                          <option key={ec.id} value={`custom:${ec.id}`}>{ec.nome}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__add_escala__">+ Adicionar escala…</option>
                  </select>
                  <p className="indicadores-modal-escala-hint text-muted">
                    {modalEscala === 'percentual' && 'Informe limites entre 0 e 100. O lançamento no Gantt será um percentual.'}
                    {modalEscala === 'numero' && 'Informe limites numéricos. O lançamento será um número.'}
                    {modalEscala === 'sim_nao' && 'Cada faixa define um valor (SIM ou NÃO). No lançamento, escolhe-se SIM ou NÃO.'}
                    {modalEscala === 'status_3' && 'Cada faixa define um estado (OK, Andamento ou Não OK). Combine as 4 cores como preferir.'}
                    {defEscalaModal?.modo === 'lista' && (
                      <>
                        Escala personalizada &quot;{defEscalaModal.nome}&quot;: cada faixa escolhe um valor da lista; no Gantt o lançamento usa a mesma lista (comparação por igualdade).
                      </>
                    )}
                    {defEscalaModal?.modo === 'percentual' && (
                      <>Escala personalizada &quot;{defEscalaModal.nome}&quot;: limites entre 0 e 100.</>
                    )}
                    {defEscalaModal?.modo === 'numero' && (
                      <>Escala personalizada &quot;{defEscalaModal.nome}&quot;: limites numéricos.</>
                    )}
                  </p>
                </div>

                <div className="indicadores-semaforo-grid indicadores-semaforo-grid--header indicadores-semaforo-grid--3cols">
                  <div className="indicadores-semaforo-col indicadores-semaforo-col--faixa">
                    <span className="indicadores-faixa-label">Faixa</span>
                  </div>
                  <div className="indicadores-semaforo-col">
                    <span className="indicadores-faixa-label">
                      {(modalEscala === 'sim_nao' || modalEscala === 'status_3' || defEscalaModal?.modo === 'lista') ? 'Valor da faixa' : 'Limite'}
                    </span>
                  </div>
                  <div className="indicadores-semaforo-col">
                    <span className="indicadores-faixa-label">Condição</span>
                  </div>
                </div>

                {FAIXA_LABELS.map((fl, i) => {
                  const ops = (modalEscala === 'sim_nao' || modalEscala === 'status_3' || defEscalaModal?.modo === 'lista')
                    ? OPERADORES_SO_IGUAL
                    : OPERADORES
                  return (
                    <div key={i} className="indicadores-semaforo-grid indicadores-semaforo-grid--3cols">
                      <div className="indicadores-semaforo-col indicadores-semaforo-col--faixa">
                        <div className="indicadores-faixa-cor-wrap">
                          <div className="indicadores-faixa-cor-picker">
                            <span
                              className="indicadores-faixa-color-preview"
                              style={{ background: modalFaixas[i]?.cor || '#ccc' }}
                              aria-hidden
                            />
                            <input
                              type="color"
                              className="indicadores-faixa-color-input-overlay"
                              value={modalFaixas[i]?.cor || '#1e7a3a'}
                              onChange={e => setFaixaCor(i, e.target.value)}
                              aria-label={`Cor da ${fl.titulo}`}
                            />
                          </div>
                          <span className="indicadores-faixa-label">{fl.titulo}</span>
                        </div>
                      </div>
                      <div className="indicadores-semaforo-col">
                        {(modalEscala === 'percentual' || defEscalaModal?.modo === 'percentual') && (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="indicadores-faixa-limite"
                            value={modalFaixas[i]?.limite ?? ''}
                            onChange={e => setFaixaLimite(i, e.target.value)}
                            placeholder="0–100"
                            aria-label={`Limite ${fl.titulo}`}
                          />
                        )}
                        {(modalEscala === 'numero' || defEscalaModal?.modo === 'numero') && (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="indicadores-faixa-limite"
                            value={modalFaixas[i]?.limite ?? ''}
                            onChange={e => setFaixaLimite(i, e.target.value)}
                            placeholder="Limite"
                            aria-label={`Limite ${fl.titulo}`}
                          />
                        )}
                        {modalEscala === 'sim_nao' && (
                          <select
                            className="indicadores-faixa-limite"
                            value={modalFaixas[i]?.limite ?? ''}
                            onChange={e => setFaixaLimite(i, e.target.value)}
                            aria-label={`Valor ${fl.titulo}`}
                          >
                            <option value="">—</option>
                            <option value="SIM">SIM</option>
                            <option value="NAO">NÃO</option>
                          </select>
                        )}
                        {modalEscala === 'status_3' && (
                          <select
                            className="indicadores-faixa-limite"
                            value={modalFaixas[i]?.limite ?? ''}
                            onChange={e => setFaixaLimite(i, e.target.value)}
                            aria-label={`Valor ${fl.titulo}`}
                          >
                            <option value="">—</option>
                            <option value="OK">OK</option>
                            <option value="ANDAMENTO">Andamento</option>
                            <option value="NAO_OK">Não OK</option>
                          </select>
                        )}
                        {defEscalaModal?.modo === 'lista' && (
                          <select
                            className="indicadores-faixa-limite"
                            value={modalFaixas[i]?.limite ?? ''}
                            onChange={e => setFaixaLimite(i, e.target.value)}
                            aria-label={`Valor ${fl.titulo}`}
                          >
                            <option value="">—</option>
                            {(defEscalaModal.valores || []).map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="indicadores-semaforo-col">
                        <select
                          className="indicadores-semaforo-operador"
                          value={modalFaixas[i]?.comparacao || faixasDefault()[i].comparacao}
                          onChange={e => setFaixaComparacao(i, e.target.value)}
                          aria-label={`Condição da ${fl.titulo}`}
                        >
                          {ops.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </fieldset>
        </form>
      </WorkloadFormDrawer>

      {modalNovaEscalaAberto && (
        <div
          className="modal-overlay indicadores-modal-nova-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) fecharModalNovaEscala() }}
        >
          <div
            className="modal-card indicadores-modal-card indicadores-modal-nova-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="indicadores-nova-escala-title"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="indicadores-nova-escala-title">Nova escala personalizada</h2>
                <p className="modal-subtitle">Defina nome e tipo. A escala fica salva neste navegador para todos os indicadores.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={fecharModalNovaEscala}
                disabled={salvandoNovaEscala}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="modal-body indicadores-modal-body">
              <div className="modal-field">
                <label htmlFor="nova-escala-nome">Nome da escala</label>
                <input
                  id="nova-escala-nome"
                  value={novaEscalaNome}
                  onChange={e => setNovaEscalaNome(e.target.value)}
                  placeholder="Ex.: Nível de maturidade"
                  autoComplete="off"
                />
              </div>
              <div className="modal-field">
                <label htmlFor="nova-escala-modo">Como o semáforo compara o lançamento</label>
                <select
                  id="nova-escala-modo"
                  value={novaEscalaModo}
                  onChange={e => setNovaEscalaModo(e.target.value)}
                >
                  <option value="lista">Lista de valores (escolha um por faixa e no lançamento)</option>
                  <option value="percentual">Percentual (0–100)</option>
                  <option value="numero">Número</option>
                </select>
              </div>
              {novaEscalaModo === 'lista' && (
                <div className="modal-field indicadores-nova-escala-valores">
                  <label>Valores possíveis (mínimo 2, sem repetir)</label>
                  {novaEscalaValores.map((val, idx) => (
                    <div key={idx} className="indicadores-nova-escala-valor-row">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const next = [...novaEscalaValores]
                          next[idx] = e.target.value
                          setNovaEscalaValores(next)
                        }}
                        placeholder={`Valor ${idx + 1}`}
                        aria-label={`Valor ${idx + 1}`}
                      />
                      {novaEscalaValores.length > 2 && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setNovaEscalaValores(novaEscalaValores.filter((_, j) => j !== idx))}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setNovaEscalaValores([...novaEscalaValores, ''])}
                  >
                    + Adicionar valor
                  </button>
                </div>
              )}
              {erroNovaEscala && (
                <div className="alert alert-error" role="alert">{erroNovaEscala}</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={fecharModalNovaEscala} disabled={salvandoNovaEscala}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarNovaEscala}
                disabled={salvandoNovaEscala || !isAdmin}
              >
                {salvandoNovaEscala ? 'Salvando…' : 'Criar escala e usar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DefinirMetaDrawer
        open={metaDrawerAberto}
        onClose={fecharMetaDrawerIndicadores}
        areaId={areaId}
        periodo={null}
        metaParaEditar={null}
        onSucesso={carregar}
      />
    </>
  )
}
