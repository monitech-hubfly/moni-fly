// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/hooks/useAuditLog'
import { listarAreas } from '@/utils/areasOrder'
import { useAdmin } from '@/context/AdminContext'
import { labelPeriodo } from '@/utils/periodos'
import CalendarioComSemanas from '@/components/CalendarioComSemanas'
import MetaCicloTipoFields from '@/components/MetaCicloTipoFields'
import WorkloadFormDrawer from '@/components/WorkloadFormDrawer'

function valorParaMinutos(valor, unidade) {
  if (valor === '' || valor == null) return null
  const n = Number(valor)
  if (unidade === 'horas') return Math.round(n * 60)
  return Math.round(n)
}
function minutosParaValorEUnidade(m) {
  if (m == null) return { valor: '', unidade: 'horas' }
  if (m >= 60) return { valor: (m / 60) % 1 === 0 ? String(m / 60) : String(Math.round((m / 60) * 100) / 100), unidade: 'horas' }
  return { valor: String(m), unidade: 'minutos' }
}
function formatarTempo(min) {
  if (min == null) return '—'
  if (min >= 60) return (min / 60) % 1 === 0 ? `${min / 60} h` : `${Math.round((min / 60) * 100) / 100} h`
  return `${min} min`
}

/** Rótulo amigável do tipo de multiplicador (descrição cadastrada ou código). */
function descricaoTipoMultiplicador(codigo, tipos) {
  if (codigo == null || String(codigo).trim() === '') return ''
  const row = tipos.find(m => m.value === codigo)
  return row?.label || String(codigo)
}

function semanaNoMes(dataStr) {
  if (!dataStr) return null
  const d = new Date(`${dataStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = d.getMonth() // 0-based
  const first = new Date(year, month, 1)
  // Considera semanas começando na segunda-feira (Monday=0..6)
  const firstDow = (first.getDay() + 6) % 7
  const dayIndex = d.getDate() - 1
  return Math.floor((firstDow + dayIndex) / 7) + 1
}

// ISO week -> datas (Seg..Dom) em UTC, formatadas como YYYY-MM-DD.
function isoWeekStartEnd(isoYear, isoWeek) {
  // Ponto de referência: semana 1 sempre contém 4 de janeiro (ISO).
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7 // 1..7 (Dom->7)
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))

  const start = new Date(week1Monday)
  start.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7)

  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)

  const toYMD = (dt) => dt.toISOString().slice(0, 10)
  return { start: toYMD(start), end: toYMD(end) }
}

const CANETA_OPCOES = [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]

/**
 * Leitura do banco: coluna pode ser boolean (Postgres) ou texto 'sim'/'nao'.
 * Só trata como Sim com valor explícito — evita `?? true`, `||` e defaults perigosos.
 */
function canetaVerdeEstaAtiva(val) {
  return val === true || val === 'sim'
}

/** Gravação: sempre 'sim' | 'nao' (nunca null), inclusive quando o form manda false ou string vazia. */
function canetaVerdeParaSalvar(valorDoForm) {
  return canetaVerdeEstaAtiva(valorDoForm) ? 'sim' : 'nao'
}
const UNIDADE_TEMPO = [{ value: 'minutos', label: 'min' }, { value: 'horas', label: 'h' }]
const RECORRENCIAS_DEFAULT = [
  { codigo: 'unica', descricao: 'Atividade única', ativo: true, ordem: 1 },
  { codigo: 'diaria', descricao: 'Diária', ativo: true, ordem: 2 },
  { codigo: 'semanal', descricao: 'Semanal', ativo: true, ordem: 3 },
  { codigo: 'mensal', descricao: 'Mensal', ativo: true, ordem: 4 },
  { codigo: 'trimestral', descricao: 'Trimestral', ativo: true, ordem: 5 }
]

const RECORRENCIAS_METAS_DEFAULT = [
  { id: 'unica', codigo: 'unica', descricao: 'Atividade única', ativo: true, ordem: 1 },
  { id: 'semanal', codigo: 'semanal', descricao: 'Semanal', ativo: true, ordem: 2 },
  { id: 'quinzenal', codigo: 'quinzenal', descricao: 'Quinzenal', ativo: true, ordem: 3 },
  { id: 'mensal', codigo: 'mensal', descricao: 'Mensal', ativo: true, ordem: 4 },
  { id: 'bimestral', codigo: 'bimestral', descricao: 'Bimestral', ativo: true, ordem: 5 },
  { id: 'trimestral', codigo: 'trimestral', descricao: 'Trimestral', ativo: true, ordem: 6 },
  { id: 'semestral', codigo: 'semestral', descricao: 'Semestral', ativo: true, ordem: 7 },
  { id: 'anual', codigo: 'anual', descricao: 'Anual', ativo: true, ordem: 8 }
]
const MULTIPLICADOR_TIPOS = [
  { value: 'franks', label: 'Franks' },
  { value: 'cpnjs', label: 'CPNJs' },
  { value: 'leads', label: 'Leads' }
]

/** `areas.nome` exato — campo tipo da atividade só nestas áreas. */
const NOMES_AREA_TIPO_ATIVIDADE_PROJETO = new Set([
  'Projetos - Modelo Virtual',
  'Projetos - Executivos Locais'
])

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const TIPOS_INDICADOR = [
  { value: 'quantidade', label: 'Quantidade' },
  { value: 'binario', label: 'Fez / Não fez' },
  { value: 'percentual', label: 'Percentual (%)' },
  { value: 'valor_financeiro', label: 'Valor financeiro (R$)' },
  { value: 'nota', label: 'Nota' },
  { value: 'outro', label: 'Outro' }
]

const OPERADORES_REGRA = [
  { value: 'gte', label: '≥ (maior ou igual)' },
  { value: 'lte', label: '≤ (menor ou igual)' },
  { value: 'eq', label: '= (igual)' },
  { value: 'gt', label: '> (maior que)' },
  { value: 'lt', label: '< (menor que)' },
  { value: 'ne', label: '≠ (diferente)' }
]

/** Erro do PostgREST quando a tabela ainda não foi criada no projeto Supabase. */
function erroTabelaMultiplicadorTiposAusente(msg) {
  const m = String(msg || '').toLowerCase()
  return (
    m.includes('multiplicador_tipos') ||
    (m.includes('could not find') && m.includes('table')) ||
    (m.includes('schema cache') && m.includes('multiplicador'))
  )
}

function erroCheckMultiplicadorTipo(msg) {
  const m = String(msg || '').toLowerCase()
  return m.includes('violates check constraint') && m.includes('multiplicador')
}

const SQL_MULTIPLICADOR_TIPOS = `-- Tipos de multiplicador (Workload). Cole no Supabase → SQL Editor → Run.
CREATE TABLE IF NOT EXISTS multiplicador_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);

INSERT INTO multiplicador_tipos (codigo, descricao, ativo, ordem)
VALUES
  ('franks', 'Franks', true, 1),
  ('cpnjs', 'CPNJs', true, 2),
  ('leads', 'Leads', true, 3)
ON CONFLICT (codigo) DO NOTHING;

-- Se a coluna acoes.multiplicador_tipo tiver CHECK só com valores fixos, rode também:
-- ALTER TABLE acoes DROP CONSTRAINT IF EXISTS acoes_multiplicador_tipo_check;`

const SQL_TIPO_ATIVIDADE = `-- Tipo da atividade + par esteira. Cole no Supabase → SQL Editor → Run.
ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS tipo_atividade varchar(20) DEFAULT NULL
  CHECK (tipo_atividade IN ('modelagem', 'documentacao', NULL));

ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS esteira_par_id uuid DEFAULT NULL
  REFERENCES acoes(id) ON DELETE SET NULL;`

function erroColunaTipoAtividade(msg) {
  const m = String(msg || '').toLowerCase()
  return m.includes('tipo_atividade')
}

function erroColunaEsteiraPar(msg) {
  const m = String(msg || '').toLowerCase()
  return m.includes('esteira_par_id')
}

/** Erro de API por coluna ausente / cache desatualizado em `acoes` (tipo ou esteira). Deve vir antes do fallback genérico de `schema cache`. */
function erroSchemaAcaoTipoOuEsteira(msg) {
  const m = String(msg || '').toLowerCase()
  if (m.includes('esteira_par_id')) return true
  if (
    m.includes('tipo_atividade') &&
    (m.includes('schema cache') || m.includes('could not find') || m.includes('does not exist'))
  ) {
    return true
  }
  return false
}

/** Campos de `acoes` no embed `tarefas → acoes` (inclui tipo_atividade e esteira_par_id para a esteira na UI). */
const ACOES_EMBED_FIELDS =
  'id,tarefa_id,nome,ordem,tempo_estimado_minutos,recorrencia,caneta_verde,multiplicador_valor,multiplicador_tipo,criado_em,tipo_atividade,esteira_par_id'

/** Fallback quando `tipo_atividade` / `esteira_par_id` ainda não existem no PostgREST — nunca esvaziar a lista de comportamentos. */
const ACOES_EMBED_SEM_TIPO_ESTEIRA =
  'id,tarefa_id,nome,ordem,tempo_estimado_minutos,recorrencia,caneta_verde,multiplicador_valor,multiplicador_tipo,criado_em'

/** Erro típico ao filtrar por `status` em tabela que ainda não tem a coluna (migração pendente). */
function erroProvavelColunaStatus(msg) {
  const m = String(msg || '').toLowerCase()
  return m.includes('status') && (m.includes('column') || m.includes('could not find') || m.includes('schema cache'))
}

/** Atualiza só `area` na URL sem apagar `openMeta`, `editAcao`, etc. */
function mergeSetAreaUrl(router, pathname, searchParams, nextAreaId) {
  const p = new URLSearchParams(searchParams.toString())
  if (nextAreaId) p.set('area', String(nextAreaId))
  else p.delete('area')
  const qs = p.toString()
  router.replace(qs ? `${pathname}?${qs}` : pathname)
}

function ordenarAcoesLista(arr) {
  return (arr || [])
    .slice()
    .sort(
      (a, b) =>
        (a.ordem ?? 0) - (b.ordem ?? 0) ||
        new Date(a.criado_em || 0) - new Date(b.criado_em || 0)
    )
}

/** Nome exibido sem sufixo " - DOC" (atividade esteira). */
function nomeBaseAtividadeEsteira(nome) {
  if (!nome || typeof nome !== 'string') return ''
  const s = nome.trim()
  if (s.endsWith(' - DOC')) return s.slice(0, -6).trim()
  return s
}

/**
 * Se `acao` forma par esteira válido com outra linha em `todas` (modelagem ↔ documentação, ids cruzados).
 * Retorna { mod, doc } ou null.
 */
function sidAcao(x) {
  return String(x?.id ?? '')
}

function resolverParEsteira(acao, todas) {
  if (!acao || !todas?.length) return null
  const ta = acao.tipo_atividade
  const pid = acao.esteira_par_id
  if (pid == null || pid === '') return null
  if (ta !== 'modelagem' && ta !== 'documentacao') return null
  const outro = todas.find(x => sidAcao(x) === String(pid))
  if (!outro || sidAcao(outro.esteira_par_id) !== sidAcao(acao)) return null
  const tb = outro.tipo_atividade
  if (tb !== 'modelagem' && tb !== 'documentacao') return null
  const ok =
    (ta === 'modelagem' && tb === 'documentacao') ||
    (ta === 'documentacao' && tb === 'modelagem')
  if (!ok) return null
  return ta === 'modelagem'
    ? { mod: acao, doc: outro }
    : { mod: outro, doc: acao }
}

/**
 * Pares esteira (modelagem + doc com ids cruzados) vs demais linhas.
 * Qualquer ação que entre num par NÃO aparece em `comuns` (evita duplicação na tabela comum).
 */
function particionarAcoesProjetoEsteira(acoes) {
  const sorted = ordenarAcoesLista(acoes)
  const idsNoPar = new Set()
  const esteiras = []
  for (const a of sorted) {
    if (idsNoPar.has(sidAcao(a))) continue
    const par = resolverParEsteira(a, sorted)
    if (par) {
      idsNoPar.add(sidAcao(par.mod))
      idsNoPar.add(sidAcao(par.doc))
      esteiras.push(par)
    }
  }
  const comuns = sorted.filter((a) => !idsNoPar.has(sidAcao(a)))
  return { esteiras, comuns }
}

/** Não derruba a página se dados legados ou inesperados quebrarem o particionamento. */
function particionarAcoesProjetoEsteiraSeguro(acoes) {
  try {
    return particionarAcoesProjetoEsteira(acoes)
  } catch (e) {
    console.error('[Workload] Erro ao particionar ações (esteira):', e)
    return { esteiras: [], comuns: ordenarAcoesLista(acoes) }
  }
}

export default function Page() {
  const { isAdmin } = useAdmin()
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const areaFromUrl = searchParams.get('area')
  const openMetaFromUrl = searchParams.get('openMeta')
  const editAcaoFromUrl = searchParams.get('editAcao')
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState(areaFromUrl || '')
  const [periodoId, setPeriodoId] = useState('')
  const [periodoTipo, setPeriodoTipo] = useState(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [objetivos, setObjetivos] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [expandido, setExpandido] = useState({})
  const [adicionando, setAdicionando] = useState(null)
  const [editando, setEditando] = useState(null)
  const [valorEdit, setValorEdit] = useState('')
  const [valorEditTempo, setValorEditTempo] = useState('')
  const [valorEditUnidade, setValorEditUnidade] = useState('horas')
  const [valorEditCaneta, setValorEditCaneta] = useState('nao')
  const [valorEditRecorrencia, setValorEditRecorrencia] = useState('unica')
  const [valorEditMultiplicadorValor, setValorEditMultiplicadorValor] = useState('')
  const [valorEditMultiplicadorTipo, setValorEditMultiplicadorTipo] = useState('')
  /** null = passo inicial (só nova atividade em área projeto); 'comum' | 'esteira' */
  const [workloadNovoAtividadeTipo, setWorkloadNovoAtividadeTipo] = useState(null)
  /** Edição de par esteira: ids das duas linhas (modelagem + documentação). */
  const [esteiraEdicaoIds, setEsteiraEdicaoIds] = useState(null)
  const [valorEditTempoMod, setValorEditTempoMod] = useState('0')
  const [valorEditUnidadeMod, setValorEditUnidadeMod] = useState('horas')
  const [valorEditRecorrenciaMod, setValorEditRecorrenciaMod] = useState('unica')
  const [valorEditTempoDoc, setValorEditTempoDoc] = useState('0')
  const [valorEditUnidadeDoc, setValorEditUnidadeDoc] = useState('horas')
  const [valorEditRecorrenciaDoc, setValorEditRecorrenciaDoc] = useState('unica')
  const [recorrenciasAtividade, setRecorrenciasAtividade] = useState(RECORRENCIAS_DEFAULT)
  const [multiplicadorTipos, setMultiplicadorTipos] = useState(MULTIPLICADOR_TIPOS)
  /** null | 'add' | string (id da ação ao editar) — fluxo "+ Novo tipo" no select de multiplicador */
  const [novoMultTipoContext, setNovoMultTipoContext] = useState(null)
  const [novoMultTipoDescricao, setNovoMultTipoDescricao] = useState('')
  const [novoMultTipoSalvando, setNovoMultTipoSalvando] = useState(false)
  const [menuAbertoCompId, setMenuAbertoCompId] = useState(null)
  const [canetaLocal, setCanetaLocal] = useState({})
  const [migracaoObjetivoId, setMigracaoObjetivoId] = useState(false)
  const [migracaoCanetaVerde, setMigracaoCanetaVerde] = useState(false)
  const [migracaoIndicadores, setMigracaoIndicadores] = useState(false)
  /** true quando o Supabase não tem a tabela multiplicador_tipos (migração não executada). */
  const [migracaoMultiplicadorTipos, setMigracaoMultiplicadorTipos] = useState(false)
  const [migracaoTipoAtividade, setMigracaoTipoAtividade] = useState(false)
  const [migracaoEsteiraPar, setMigracaoEsteiraPar] = useState(false)
  /** true quando a coluna multiplicador_tipo ainda tem CHECK fixo (franks/cpnjs/leads) e bloqueia tipos novos. */
  const [migracaoMultiplicadorCheck, setMigracaoMultiplicadorCheck] = useState(false)
  const [salvandoCanetaId, setSalvandoCanetaId] = useState(null)
  const [indicadoresByTarefa, setIndicadoresByTarefa] = useState({})
  const [adicionandoIndicador, setAdicionandoIndicador] = useState(null)
  const [editandoIndicadorId, setEditandoIndicadorId] = useState(null)
  const [valorEditIndNome, setValorEditIndNome] = useState('')
  const [valorEditIndTipo, setValorEditIndTipo] = useState('quantidade')
  const [valorEditIndUnidade, setValorEditIndUnidade] = useState('')
  const [valorEditIndMeta, setValorEditIndMeta] = useState('')
  const [valorEditIndVerdeEscuro, setValorEditIndVerdeEscuro] = useState('')
  const [valorEditIndVerdeClaro, setValorEditIndVerdeClaro] = useState('')
  const [valorEditIndAmarelo, setValorEditIndAmarelo] = useState('')
  const [valorEditIndVerdeEscuroOp, setValorEditIndVerdeEscuroOp] = useState('gte')
  const [valorEditIndVerdeClaroOp, setValorEditIndVerdeClaroOp] = useState('gte')
  const [valorEditIndAmareloOp, setValorEditIndAmareloOp] = useState('gte')

  const [metaModalAberto, setMetaModalAberto] = useState(false)
  const [metaEdicaoId, setMetaEdicaoId] = useState(null)
  const [metaModoSemMeta, setMetaModoSemMeta] = useState(false)
  const [metaDesc, setMetaDesc] = useState('')
  const [metaInicio, setMetaInicio] = useState('')
  const [metaFim, setMetaFim] = useState('')
  const [metaPeriodoFimId, setMetaPeriodoFimId] = useState(null)
  const [metaPeriodoLabel, setMetaPeriodoLabel] = useState('')
  const [metaPeriodoDerivando, setMetaPeriodoDerivando] = useState(false)
  const [metaSalvando, setMetaSalvando] = useState(false)
  const [metaErroForm, setMetaErroForm] = useState('')
  const metaDescRef = useRef(null)
  const openMetaHandledRef = useRef(false)
  const editAcaoHandledRef = useRef(false)
  const metaPeriodoFimRequestIdRef = useRef(0)

  const [metaTipoCiclo, setMetaTipoCiclo] = useState('recorrente')
  const [metaPrazoAno, setMetaPrazoAno] = useState('')
  const [metaPrazoMes, setMetaPrazoMes] = useState('')
  const [metaPrazoSemana, setMetaPrazoSemana] = useState('')
  const [semansPrazoLoading, setSemansPrazoLoading] = useState(false)
  const [semansPrazoOpcoes, setSemansPrazoOpcoes] = useState([])

  const [semanasEntregaOpcoes, setSemanasEntregaOpcoes] = useState([])
  const [semanasEntregaLoading, setSemanasEntregaLoading] = useState(false)
  const [metaSemanaEntregaNumero, setMetaSemanaEntregaNumero] = useState('')
  const [metaSemanasEntregaSelecionadas, setMetaSemanasEntregaSelecionadas] = useState([])

  const [metaExcluirId, setMetaExcluirId] = useState(null)
  const [metaExcluindo, setMetaExcluindo] = useState(false)
  const metaExcluirConfirmRef = useRef(null)
  const [semMetaAssociarAberto, setSemMetaAssociarAberto] = useState(false)
  const [semMetaExcluirAberto, setSemMetaExcluirAberto] = useState(false)
  const [semMetaDestinoId, setSemMetaDestinoId] = useState('')
  const [semMetaProcessando, setSemMetaProcessando] = useState(false)

  const [comportamentoExcluirId, setComportamentoExcluirId] = useState(null)
  const [comportamentoExcluindo, setComportamentoExcluindo] = useState(false)
  const compExcluirConfirmRef = useRef(null)

  /** null | [id] | [idMod, idDoc] — esteira remove as duas linhas */
  const [atividadeExcluirIds, setAtividadeExcluirIds] = useState(null)
  const [atividadeExcluindo, setAtividadeExcluindo] = useState(false)
  const atividadeExcluirConfirmRef = useRef(null)

  const anosPrazoRender = [String(ano)]

  function extrairSemanaNumeroMeta(meta) {
    const sMetaUnidade = String(meta?.meta_unidade || '').trim()
    const mUnidade = sMetaUnidade.match(/^S\s*(\d{1,2})$/i)
    if (mUnidade?.[1]) return String(Number(mUnidade[1]))

    const sPeriodo = String(meta?._periodoLabel || '').trim()
    const mPeriodo = sPeriodo.match(/Semana\s*(\d{1,2})/i)
    if (mPeriodo?.[1]) return String(Number(mPeriodo[1]))
    return ''
  }

  function emojiParaComportamento(nome) {
    if (!nome) return '📋'
    const n = nome.toLowerCase()
    if (n.includes('água') || n.includes('agua') || n.includes('hidrat')) return '💧'
    if (n.includes('dormir') || n.includes('descanso') || n.includes('sono')) return '😴'
    if (n.includes('aliment') || n.includes('comer')) return '🍽'
    if (n.includes('exerc') || n.includes('treino')) return '🏃'
    return '📋'
  }

  useEffect(() => {
    let cancel = false
    listarAreas(supabase, 'id, nome').then(({ data }) => {
      if (cancel) return
      const list = data || []
      setAreas(list)
      if (!list.length) return

      const ids = new Set(list.map((a) => String(a?.id ?? '')).filter(Boolean))
      const fromUrl = areaFromUrl && ids.has(String(areaFromUrl)) ? String(areaFromUrl) : null
      const current = areaId && ids.has(String(areaId)) ? String(areaId) : null
      const next = fromUrl || current || String(list[0].id)
      if (next !== areaId) setAreaId(next)

      // Mantém a URL coerente com a lista (evita ficar preso em ?area inválida e carregar vazio).
      if (next && next !== areaFromUrl) {
        mergeSetAreaUrl(router, pathname, searchParams, next)
      }
    })
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!areaFromUrl) return
    if (areaFromUrl === areaId) return
    // Só aplica se a área existir na lista já carregada (evita setar para um id inválido e zerar a tela).
    if (areas.length > 0 && !areas.some((a) => String(a?.id ?? '') === String(areaFromUrl))) return
    setAreaId(areaFromUrl)
  }, [areaFromUrl, areaId, areas])
  async function carregarMultiplicadorTipos() {
    const { data, error } = await supabase.from('multiplicador_tipos').select('codigo, descricao, ativo').order('ordem').order('descricao')
    if (error) {
      if (erroTabelaMultiplicadorTiposAusente(error.message)) {
        setMigracaoMultiplicadorTipos(true)
        setMultiplicadorTipos(MULTIPLICADOR_TIPOS)
        setNovoMultTipoContext(null)
        setNovoMultTipoDescricao('')
      }
      return
    }
    setMigracaoMultiplicadorTipos(false)
    const ativos = (data || []).filter(m => m.ativo !== false).map(m => ({ value: m.codigo, label: m.descricao }))
    setMultiplicadorTipos(prev => {
      const map = new Map(prev.map(m => [m.value, m]))
      ativos.forEach(a => map.set(a.value, a))
      const out = Array.from(map.values())
      out.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
      return out
    })
  }

  function slugCodigoMult(s) {
    let base = String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    if (!base) base = `tipo_${Date.now()}`
    return base.slice(0, 48)
  }

  function onMultTipoSelectChange(e, ctx) {
    const v = e.target.value
    if (v === '__novo__' && isAdmin && !migracaoMultiplicadorTipos) {
      setNovoMultTipoContext(ctx)
      setNovoMultTipoDescricao('')
      return
    }
    setNovoMultTipoContext(null)
    setNovoMultTipoDescricao('')
    setValorEditMultiplicadorTipo(v)
  }

  function cancelarNovoMultTipoWorkload() {
    setNovoMultTipoContext(null)
    setNovoMultTipoDescricao('')
  }

  async function salvarNovoMultTipoWorkload() {
    if (!isAdmin) {
      setError('Apenas administradores podem cadastrar novos tipos de multiplicador.')
      return
    }
    const desc = novoMultTipoDescricao.trim()
    if (!desc) {
      setError('Informe a descrição do novo tipo de multiplicador.')
      return
    }
    setNovoMultTipoSalvando(true)
    setError(null)
    let codigo = slugCodigoMult(desc)
    const taken = new Set(multiplicadorTipos.map(m => m.value))
    let n = 0
    let tryCode = codigo
    while (taken.has(tryCode)) {
      n += 1
      tryCode = `${codigo}_${n}`
    }
    codigo = tryCode
    // Sem .select() no fim: em alguns projetos o RLS permite INSERT mas bloqueia SELECT na linha retornada,
    // e o PostgREST devolve erro em vez de só ignorar o retorno — o tipo até grava e a UI não atualiza.
    const { error: err } = await supabase.from('multiplicador_tipos').insert({
      codigo,
      descricao: desc,
      ativo: true,
      ordem: multiplicadorTipos.length + 1
    })
    setNovoMultTipoSalvando(false)
    if (err) {
      if (erroTabelaMultiplicadorTiposAusente(err.message)) {
        setMigracaoMultiplicadorTipos(true)
        setError(
          'A tabela multiplicador_tipos não existe neste projeto Supabase. Copie o SQL do aviso amarelo acima, execute no SQL Editor e recarregue a página (F5). Enquanto isso, novos tipos não podem ser gravados.'
        )
      } else {
        setError(err.message)
      }
      return
    }
    void registrarLog({
      modulo: 'Workload',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'multiplicador_tipos',
      entidade_id: null,
      operacao: 'INSERT',
      valor_novo: { codigo, descricao: desc, ativo: true, ordem: multiplicadorTipos.length + 1 },
      descricao: `Criou tipo de multiplicador "${desc}"`
    })
    const codigoFinal = codigo
    const labelFinal = desc
    setMultiplicadorTipos(prev => {
      if (prev.some(m => m.value === codigoFinal)) {
        return prev.map(m => (m.value === codigoFinal ? { value: codigoFinal, label: labelFinal } : m))
      }
      return [...prev, { value: codigoFinal, label: labelFinal }]
    })
    await carregarMultiplicadorTipos()
    setMultiplicadorTipos(prev => {
      if (prev.some(m => m.value === codigoFinal)) return prev
      return [...prev, { value: codigoFinal, label: labelFinal }]
    })
    setValorEditMultiplicadorTipo(codigoFinal)
    setNovoMultTipoContext(null)
    setNovoMultTipoDescricao('')
  }

  useEffect(() => {
    supabase.from('recorrencias_atividade').select('codigo, descricao, ativo, ordem').order('ordem').order('descricao').then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        setRecorrenciasAtividade(data.filter(r => r.ativo !== false))
      }
    })
    carregarMultiplicadorTipos()
  }, [])

  const SQL_OBJETIVO_ID = `ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;`
  const SQL_CANETA_VERDE = `ALTER TABLE acoes ADD COLUMN IF NOT EXISTS caneta_verde text CHECK (caneta_verde IS NULL OR caneta_verde IN ('sim', 'nao'));`
  const SQL_ACOES_RECORRENCIA = `ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS recorrencia text CHECK (recorrencia IS NULL OR recorrencia IN ('unica','diaria','semanal','mensal','trimestral')),
  ADD COLUMN IF NOT EXISTS multiplicador_valor int,
  ADD COLUMN IF NOT EXISTS multiplicador_tipo text;`
  const SQL_MULTIPLICADOR_CHECK = `-- Permite qualquer tipo cadastrado em multiplicador_tipos (remove CHECK fixo antigo).
ALTER TABLE acoes DROP CONSTRAINT IF EXISTS acoes_multiplicador_tipo_check;`
  const SQL_INDICADORES = `CREATE TABLE IF NOT EXISTS indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'quantidade' CHECK (tipo IN ('quantidade', 'binario', 'percentual', 'valor_financeiro', 'nota', 'outro')),
  unidade text,
  meta_valor numeric,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indicadores_tarefa_id ON indicadores(tarefa_id);`
  const SQL_INDICADORES_REGRA = `-- Colunas da regra de coloração (execute após a tabela indicadores existir)
ALTER TABLE indicadores
  ADD COLUMN IF NOT EXISTS regra_verde_escuro int CHECK (regra_verde_escuro IS NULL OR (regra_verde_escuro >= 0 AND regra_verde_escuro <= 100)),
  ADD COLUMN IF NOT EXISTS regra_verde_claro int CHECK (regra_verde_claro IS NULL OR (regra_verde_claro >= 0 AND regra_verde_claro <= 100)),
  ADD COLUMN IF NOT EXISTS regra_amarelo int CHECK (regra_amarelo IS NULL OR (regra_amarelo >= 0 AND regra_amarelo <= 100));
-- Operadores por faixa (≥, ≤, =, >, <, ≠)
ALTER TABLE indicadores
  ADD COLUMN IF NOT EXISTS regra_verde_escuro_op text DEFAULT 'gte' CHECK (regra_verde_escuro_op IS NULL OR regra_verde_escuro_op IN ('gte', 'lte', 'eq', 'gt', 'lt', 'ne')),
  ADD COLUMN IF NOT EXISTS regra_verde_claro_op text DEFAULT 'gte' CHECK (regra_verde_claro_op IS NULL OR regra_verde_claro_op IN ('gte', 'lte', 'eq', 'gt', 'lt', 'ne')),
  ADD COLUMN IF NOT EXISTS regra_amarelo_op text DEFAULT 'gte' CHECK (regra_amarelo_op IS NULL OR regra_amarelo_op IN ('gte', 'lte', 'eq', 'gt', 'lt', 'ne'));`

  function withTimeout(promise, ms, label) {
    let t
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} (timeout após ${ms}ms)`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t))
  }

  async function carregar() {
    setLoading(true)
    try {
      if (!areaId) {
        setObjetivos([])
        setTarefas([])
        setIndicadoresByTarefa({})
        return
      }
      setError(null)
      setMigracaoObjetivoId(false)
      if (periodoId) {
        try {
          let objs = []
          let eObjs = null

          if (periodoTipo === 'semana') {
            let res = await withTimeout(
              supabase
                .from('objetivos')
                .select('id, descricao, ordem, meta_unidade')
                .eq('area_id', areaId)
                .eq('status', 'ativo')
                .eq('periodo_id', periodoId)
                .order('ordem'),
              10000,
              'Falha ao carregar metas (objetivos semana)'
            )
            if (res.error && erroProvavelColunaStatus(res.error.message)) {
              res = await withTimeout(
                supabase
                  .from('objetivos')
                  .select('id, descricao, ordem, meta_unidade')
                  .eq('area_id', areaId)
                  .eq('periodo_id', periodoId)
                  .order('ordem'),
                10000,
                'Falha ao carregar metas (objetivos semana, sem filtro status)'
              )
            }
            objs = res.data || []
            eObjs = res.error || null
          } else {
            const { data: periodoSel } = await withTimeout(
              supabase.from('periodos').select('data_inicio, data_fim').eq('id', periodoId).single(),
              10000,
              'Falha ao carregar período selecionado'
            )
            if (periodoSel?.data_inicio && periodoSel?.data_fim) {
              const { data: semanaIds } = await withTimeout(
                supabase
                  .from('periodos')
                  .select('id')
                  .eq('tipo', 'semana')
                  .eq('ativo', true)
                  .lte('data_inicio', periodoSel.data_fim)
                  .gte('data_fim', periodoSel.data_inicio),
                10000,
                'Falha ao buscar semanas do período'
              )
              const ids = (semanaIds || []).map(p => p.id)
              if (ids.length > 0) {
                let res = await withTimeout(
                  supabase
                    .from('objetivos')
                    .select('id, descricao, ordem, meta_unidade')
                    .eq('area_id', areaId)
                    .eq('status', 'ativo')
                    .in('periodo_id', ids)
                    .order('ordem'),
                  10000,
                  'Falha ao carregar metas (objetivos por período)'
                )
                if (res.error && erroProvavelColunaStatus(res.error.message)) {
                  res = await withTimeout(
                    supabase
                      .from('objetivos')
                      .select('id, descricao, ordem, meta_unidade')
                      .eq('area_id', areaId)
                      .in('periodo_id', ids)
                      .order('ordem'),
                    10000,
                    'Falha ao carregar metas (objetivos por período, sem filtro status)'
                  )
                }
                objs = res.data || []
                eObjs = res.error || null
              } else {
                objs = []
              }
            } else {
              objs = []
            }
          }

          if (eObjs && (eObjs.message?.includes('periodo_id') || eObjs.message?.includes('column'))) {
            let res = await withTimeout(
              supabase.from('objetivos').select('id, descricao, ordem, meta_unidade').eq('area_id', areaId).eq('status', 'ativo').order('ordem'),
              10000,
              'Falha ao carregar metas (fallback area)'
            )
            if (res.error && erroProvavelColunaStatus(res.error.message)) {
              res = await withTimeout(
                supabase.from('objetivos').select('id, descricao, ordem, meta_unidade').eq('area_id', areaId).order('ordem'),
                10000,
                'Falha ao carregar metas (fallback area sem status)'
              )
            }
            objs = res.data || []
          }

          // Sempre inclui metas da área no quadro de Metas e Comportamentos.
          // No banco atual, `objetivos.periodo_id` pode nem existir.
          try {
            let resMetas = await withTimeout(
              supabase
                .from('objetivos')
                .select('id, descricao, ordem, meta_unidade')
                .eq('area_id', areaId)
                .eq('status', 'ativo')
                .order('ordem'),
              10000,
              'Falha ao carregar metas da área'
            )
            if (resMetas.error && erroProvavelColunaStatus(resMetas.error.message)) {
              resMetas = await withTimeout(
                supabase
                  .from('objetivos')
                  .select('id, descricao, ordem, meta_unidade')
                  .eq('area_id', areaId)
                  .order('ordem'),
                10000,
                'Falha ao carregar metas da área (sem filtro status)'
              )
            }
            const metasArea = resMetas.data
            const mapById = new Map()
            ;(objs || []).forEach(o => mapById.set(o.id, o))
            ;(metasArea || []).forEach(o => mapById.set(o.id, o))
            objs = Array.from(mapById.values()).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          } catch {
            // Se não conseguir mesclar, mantém a lista já carregada.
          }

          setObjetivos(objs || [])
        } catch (periodErr) {
          const msgLower = (periodErr?.message || '').toLowerCase()
          if (msgLower.includes('periodo_id') && msgLower.includes('objetivos')) {
            // Fallback: se não existe `objetivos.periodo_id`, carrega por área.
            let resFb = await withTimeout(
              supabase.from('objetivos').select('id, descricao, ordem, meta_unidade').eq('area_id', areaId).eq('status', 'ativo').order('ordem'),
              10000,
              'Falha ao carregar metas (fallback area_id: periodo_id ausente)'
            )
            if (resFb.error && erroProvavelColunaStatus(resFb.error.message)) {
              resFb = await withTimeout(
                supabase.from('objetivos').select('id, descricao, ordem, meta_unidade').eq('area_id', areaId).order('ordem'),
                10000,
                'Falha ao carregar metas (fallback area sem status)'
              )
            }
            setObjetivos(resFb.data || [])
          } else {
            throw periodErr
          }
        }
      } else {
        let objs = []
        try {
          let res = await withTimeout(
            supabase
              .from('objetivos')
              .select('id, descricao, ordem, periodo_id, meta_unidade')
              .eq('area_id', areaId)
              .eq('status', 'ativo')
              .order('ordem'),
            10000,
            'Falha ao carregar metas (area com periodo_id)'
          )
          if (res?.error && erroProvavelColunaStatus(res.error.message)) {
            res = await withTimeout(
              supabase
                .from('objetivos')
                .select('id, descricao, ordem, periodo_id, meta_unidade')
                .eq('area_id', areaId)
                .order('ordem'),
              10000,
              'Falha ao carregar metas (area com periodo_id, sem status)'
            )
          }
          if (res?.error) throw res.error
          objs = res?.data || []
        } catch {
          let res = await withTimeout(
            supabase.from('objetivos').select('id, descricao, ordem, meta_unidade').eq('area_id', areaId).eq('status', 'ativo').order('ordem'),
            10000,
            'Falha ao carregar metas (area)'
          )
          if (res?.error && erroProvavelColunaStatus(res.error.message)) {
            res = await withTimeout(
              supabase.from('objetivos').select('id, descricao, ordem, meta_unidade').eq('area_id', areaId).order('ordem'),
              10000,
              'Falha ao carregar metas (area sem status)'
            )
          }
          objs = res?.data || []
        }

        const periodoIds = Array.from(new Set((objs || []).map(o => o?.periodo_id).filter(Boolean)))
        if (periodoIds.length > 0) {
          try {
            const { data: ps } = await withTimeout(
              supabase
                .from('periodos')
                .select('id, tipo, ano, numero, data_inicio, data_fim')
                .in('id', periodoIds),
              10000,
              'Falha ao carregar períodos das metas'
            )
            const byId = {}
            ;(ps || []).forEach(p => {
              byId[p.id] = labelPeriodo(p)
            })
            objs = (objs || []).map(o => ({ ...o, _periodoLabel: byId[o.periodo_id] || '' }))
          } catch {
            objs = (objs || []).map(o => ({ ...o, _periodoLabel: '' }))
          }
        } else {
          objs = (objs || []).map(o => ({ ...o, _periodoLabel: '' }))
        }
        setObjetivos(objs || [])
      }

      const { data: tfs, error: e } = await withTimeout(
        supabase
          .from('tarefas')
          .select(`*, acoes(${ACOES_EMBED_FIELDS})`)
          .eq('area_id', areaId)
          .order('ordem')
          .order('criado_em'),
        10000,
        'Falha ao carregar comportamentos (tarefas)'
      )
      const ordenarAcoes = (arr) =>
        (arr || [])
          .slice()
          .sort(
            (a, b) =>
              (a.ordem ?? 0) - (b.ordem ?? 0) ||
              new Date(a.criado_em || 0) - new Date(b.criado_em || 0)
          )
          .map(a => ({
            ...a,
            caneta_verde: canetaVerdeEstaAtiva(a?.caneta_verde) ? 'sim' : 'nao'
          }))
      const normalizarTarefas = (lista) => (lista || []).map(t => ({ ...t, acoes: ordenarAcoes(t.acoes) }))
      let tarefaIds = []
      if (e && erroSchemaAcaoTipoOuEsteira(e.message)) {
        setMigracaoTipoAtividade(true)
        setMigracaoEsteiraPar(true)
        const trySemTipo = await withTimeout(
          supabase
            .from('tarefas')
            .select(`*, acoes(${ACOES_EMBED_SEM_TIPO_ESTEIRA})`)
            .eq('area_id', areaId)
            .order('ordem')
            .order('criado_em'),
          10000,
          'Falha ao carregar comportamentos (embed sem tipo/esteira)'
        )
        if (!trySemTipo.error) {
          setTarefas(normalizarTarefas(trySemTipo.data || []))
          setError(
            'As colunas tipo_atividade / esteira_par_id ainda não estão disponíveis para a API (migração não aplicada ou schema cache desatualizado). Cole o SQL do aviso no Supabase → SQL Editor; depois em Settings → API use Reload schema e recarregue a página (F5).'
          )
          setCanetaLocal({})
          tarefaIds = (trySemTipo.data || []).map(t => t.id)
        } else {
          setTarefas(normalizarTarefas([]))
          setError(trySemTipo.error?.message || e.message)
          setCanetaLocal({})
          tarefaIds = []
        }
      } else if (e && (e.message?.includes('objetivo_id') || e.message?.includes('schema cache'))) {
        const { data: tfsFallback } = await withTimeout(
          supabase
            .from('tarefas')
            .select(`id, area_id, nome, ordem, acoes(${ACOES_EMBED_FIELDS})`)
            .eq('area_id', areaId)
            .order('ordem')
            .order('criado_em'),
          10000,
          'Falha ao carregar comportamentos (fallback)'
        )
        setTarefas(normalizarTarefas((tfsFallback || []).map(t => ({ ...t, objetivo_id: null }))))
        setMigracaoObjetivoId(true)
        setError('Execute a migração para habilitar metas. Clique para copiar o SQL.')
        setCanetaLocal({})
        tarefaIds = (tfsFallback || []).map(t => t.id)
      } else {
        setTarefas(normalizarTarefas(tfs || []))
        setError(e?.message || null)
        setCanetaLocal({})
        tarefaIds = (tfs || []).map(t => t.id)
      }

      if (tarefaIds.length > 0) {
        let { data: inds, error: errInd } = await withTimeout(
          supabase.from('indicadores').select('*').in('tarefa_id', tarefaIds).eq('status', 'ativo').order('ordem').order('criado_em'),
          10000,
          'Falha ao carregar indicadores'
        )
        if (errInd && erroProvavelColunaStatus(errInd.message)) {
          const rInd = await withTimeout(
            supabase.from('indicadores').select('*').in('tarefa_id', tarefaIds).order('ordem').order('criado_em'),
            10000,
            'Falha ao carregar indicadores (sem filtro status)'
          )
          inds = rInd.data
          errInd = rInd.error
        }
        if (!errInd && inds && inds.length >= 0) {
          const byTarefa = {}
          inds.forEach(i => {
            if (!byTarefa[i.tarefa_id]) byTarefa[i.tarefa_id] = []
            byTarefa[i.tarefa_id].push(i)
          })
          setIndicadoresByTarefa(byTarefa)
        } else {
          setIndicadoresByTarefa({})
        }
      } else {
        setIndicadoresByTarefa({})
      }
    } catch (err) {
      setError(err?.message || String(err))
      setIndicadoresByTarefa({})
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [areaId, periodoId])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (!areaId) return
    const totalAcoes = tarefas.reduce((n, t) => n + (Array.isArray(t.acoes) ? t.acoes.length : 0), 0)
    const metaIdsDbg = new Set((objetivos || []).map((o) => o?.id).filter(Boolean))
    let comMetaNaLista = 0
    let caindoEmSemMeta = 0
    for (const t of tarefas) {
      const oid = t?.objetivo_id
      if (oid && metaIdsDbg.has(oid)) comMetaNaLista += 1
      else caindoEmSemMeta += 1
    }
    console.log('[Workload:debug]', {
      areaId,
      nomeArea: areas.find((a) => a.id === areaId)?.nome,
      isAreaTipoAtividadeProjeto: NOMES_AREA_TIPO_ATIVIDADE_PROJETO.has(
        String(areas.find((a) => a.id === areaId)?.nome || '').trim()
      ),
      tarefas: tarefas.length,
      acoesTotal: totalAcoes,
      objetivos: objetivos.length,
      distribuicaoMetas: { comMetaNaLista, caindoEmSemMeta }
    })
  }, [areaId, tarefas, areas, objetivos])

  useEffect(() => {
    setCanetaLocal({})
  }, [areaId])

  /** Nome da área ativa para o log de auditoria (`useAuditLog` lê `carometro_area`). */
  useEffect(() => {
    const nome = areas.find((a) => a.id === areaId)?.nome?.trim()
    if (!nome || typeof localStorage === 'undefined') return
    try {
      localStorage.setItem('carometro_area', nome)
    } catch {
      /* quota / modo privado */
    }
  }, [areaId, areas])

  useEffect(() => {
    if (!metaModalAberto) return
    setMetaErroForm('')
    const t = setTimeout(() => metaDescRef.current?.focus(), 0)
    const onKeyDown = (e) => {
      if (e.key === 'Escape') fecharMetaModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [metaModalAberto])

  useEffect(() => {
    if (openMetaFromUrl !== '1') {
      openMetaHandledRef.current = false
      return
    }
    if (!areaId) return
    if (openMetaHandledRef.current) return
    openMetaHandledRef.current = true
    abrirMetaModal()
    mergeSetAreaUrl(router, pathname, searchParams, areaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMetaFromUrl, areaId])

  /** Abre edição da atividade ao vir do Planejamento (Gantt) com ?editAcao=uuid */
  useEffect(() => {
    if (!editAcaoFromUrl) {
      editAcaoHandledRef.current = false
      return
    }
    if (!areaId || !tarefas.length) return
    if (editAcaoHandledRef.current) return

    let acao = null
    let compId = null
    let todasAc = []
    for (const t of tarefas) {
      const a = (t.acoes || []).find(x => x.id === editAcaoFromUrl)
      if (a) {
        acao = a
        compId = t.id
        todasAc = t.acoes || []
        break
      }
    }

    const nextSp = new URLSearchParams(searchParams.toString())
    nextSp.delete('editAcao')
    const qsEdit = nextSp.toString()
    router.replace(qsEdit ? `${pathname}?${qsEdit}` : pathname)

    if (!acao) {
      editAcaoHandledRef.current = true
      return
    }

    editAcaoHandledRef.current = true
    setExpandido(prev => ({ ...prev, [`ativ-${compId}`]: true }))
    setNovoMultTipoContext(null)
    setNovoMultTipoDescricao('')
    const par = NOMES_AREA_TIPO_ATIVIDADE_PROJETO.has(String(areas.find(a => a.id === areaId)?.nome || '').trim())
      ? resolverParEsteira(acao, todasAc)
      : null
    if (par) {
      setWorkloadNovoAtividadeTipo('esteira')
      setEsteiraEdicaoIds({ modId: par.mod.id, docId: par.doc.id })
      setEditando(`tarefa-${par.mod.id}`)
      setValorEdit(nomeBaseAtividadeEsteira(par.mod.nome || ''))
      const vm = minutosParaValorEUnidade(par.mod.tempo_estimado_minutos)
      setValorEditTempoMod(vm.valor === '' ? '' : String(Math.round(Number(vm.valor))))
      setValorEditUnidadeMod(vm.unidade)
      setValorEditRecorrenciaMod(par.mod.recorrencia || 'unica')
      const vd = minutosParaValorEUnidade(par.doc.tempo_estimado_minutos)
      setValorEditTempoDoc(vd.valor === '' ? '' : String(Math.round(Number(vd.valor))))
      setValorEditUnidadeDoc(vd.unidade)
      setValorEditRecorrenciaDoc(par.doc.recorrencia || 'unica')
      setValorEditCaneta(canetaVerdeEstaAtiva(par.doc.caneta_verde) ? 'sim' : 'nao')
      setValorEditMultiplicadorValor(par.doc.multiplicador_valor != null ? String(par.doc.multiplicador_valor) : '')
      setValorEditMultiplicadorTipo(par.doc.multiplicador_tipo || '')
      setValorEditTempo('')
      setValorEditUnidade('horas')
      setValorEditRecorrencia('unica')
    } else {
      setWorkloadNovoAtividadeTipo('comum')
      setEsteiraEdicaoIds(null)
      setEditando(`tarefa-${acao.id}`)
      const { valor, unidade } = minutosParaValorEUnidade(acao.tempo_estimado_minutos)
      setValorEdit(acao.nome)
      setValorEditTempo(valor === '' ? '' : String(Math.round(Number(valor))))
      setValorEditUnidade(unidade)
      setValorEditCaneta(canetaVerdeEstaAtiva(acao.caneta_verde) ? 'sim' : 'nao')
      setValorEditRecorrencia(acao.recorrencia || 'unica')
      setValorEditMultiplicadorValor(acao.multiplicador_valor != null ? String(acao.multiplicador_valor) : '')
      setValorEditMultiplicadorTipo(acao.multiplicador_tipo || '')
    }
  }, [editAcaoFromUrl, areaId, tarefas, areas, router, pathname, searchParams])

  useEffect(() => {
    if (!metaExcluirId) return
    const t = setTimeout(() => metaExcluirConfirmRef.current?.focus(), 0)
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !metaExcluindo) setMetaExcluirId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [metaExcluirId, metaExcluindo])

  useEffect(() => {
    if (!comportamentoExcluirId) return
    const t = setTimeout(() => compExcluirConfirmRef.current?.focus(), 0)
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !comportamentoExcluindo) setComportamentoExcluirId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [comportamentoExcluirId, comportamentoExcluindo])

  useEffect(() => {
    if (!atividadeExcluirIds?.length) return
    const t = setTimeout(() => atividadeExcluirConfirmRef.current?.focus(), 0)
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !atividadeExcluindo) setAtividadeExcluirIds(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [atividadeExcluirIds, atividadeExcluindo])

  useEffect(() => {
    if (!metaModalAberto) return
    if (!metaPrazoAno || !metaPrazoMes) return
    carregarSemanasPrazoOpcoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaModalAberto, metaPrazoAno, metaPrazoMes])

  async function carregarSemanasEntregaOpcoes() {
    setSemanasEntregaLoading(true)
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('periodos')
          .select('id, ano, numero, tipo, data_inicio, data_fim, ativo')
          .eq('tipo', 'semana')
          .eq('ativo', true)
          .order('numero'),
        10000,
        'Falha ao carregar semanas de entrega'
      )
      if (error) throw error

      const list = (data || []).map(p => ({
        id: p.id,
        numero: Number(p.numero),
        ano: p.ano,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        tipo: p.tipo,
        mesInicio: p.data_inicio ? (new Date(p.data_inicio).getMonth() + 1) : null
      }))

      // Se a tabela vier completa, reduzimos pra num único (proteção contra duplicatas)
      const uniq = []
      const seen = new Set()
      list.forEach(p => {
        if (!p?.numero || seen.has(p.numero)) return
        seen.add(p.numero)
        uniq.push(p)
      })

      const anoFallback = metaPrazoAno ? Number(metaPrazoAno) : ano
      const fallback = Array.from({ length: 53 }, (_, i) => ({ numero: i + 1, ano: anoFallback }))
      const weeksFinal = uniq.length > 0 ? uniq : fallback
      setSemanasEntregaOpcoes(weeksFinal)
      const primeiro = weeksFinal?.[0]?.numero
      if (primeiro && metaSemanasEntregaSelecionadas.length === 0) {
        setMetaSemanasEntregaSelecionadas([primeiro])
        setMetaSemanaEntregaNumero(String(primeiro))
        definirMetaPeriodoPorSemanaNumero(String(primeiro))
      }
    } catch {
      // fallback: 1..53
      const anoFallback = metaPrazoAno ? Number(metaPrazoAno) : ano
      const fallback = Array.from({ length: 53 }, (_, i) => ({ numero: i + 1, ano: anoFallback }))
      setSemanasEntregaOpcoes(fallback)
      const primeiro = fallback?.[0]?.numero
      if (primeiro && metaSemanasEntregaSelecionadas.length === 0) {
        setMetaSemanasEntregaSelecionadas([primeiro])
        setMetaSemanaEntregaNumero(String(primeiro))
        // sem datas no fallback, mantemos sem filtro
        definirMetaPeriodoPorSemanaNumero(String(primeiro))
      }
    } finally {
      setSemanasEntregaLoading(false)
    }
  }

  async function carregarSemanasPrazoOpcoes() {
    if (!metaPrazoAno || !metaPrazoMes) return
    setSemansPrazoLoading(true)
    try {
      const year = Number(metaPrazoAno)
      const month = Number(metaPrazoMes)
      if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) {
        setSemansPrazoOpcoes([])
        return
      }

      const daysInMonth = new Date(year, month, 0).getDate()
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month - 1, daysInMonth)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      const { data, error } = await withTimeout(
        supabase
          .from('periodos')
          .select('id, ano, numero, tipo, data_inicio, data_fim')
          .eq('tipo', 'semana')
          .eq('ativo', true)
          .eq('ano', year)
          .order('numero'),
        10000,
        'Falha ao carregar semanas do prazo'
      )
      if (error) throw error

      const listRaw = (data || [])
        .map(p => ({
          id: p.id,
          numero: Number(p.numero),
          ano: p.ano,
          data_inicio: p.data_inicio,
          data_fim: p.data_fim
        }))
        .filter(p => p.numero && !Number.isNaN(p.numero))

      const hasUsableDates = listRaw.some(p => p.data_inicio && p.data_fim)

      // Filtra por sobreposição com o mês escolhido:
      // data_inicio <= fimDoMês AND data_fim >= inícioDoMês
      const listMes = hasUsableDates
        ? listRaw.filter(p => {
          const ini = p.data_inicio ? new Date(`${p.data_inicio}T00:00:00`) : null
          const fim = p.data_fim ? new Date(`${p.data_fim}T23:59:59`) : null
          if (!ini || !fim) return false
          return ini.getTime() <= endDate.getTime() && fim.getTime() >= startDate.getTime()
        })
        : listRaw

      const uniq = []
      const seen = new Set()
      listMes.forEach(p => {
        if (seen.has(p.numero)) return
        seen.add(p.numero)
        uniq.push(p)
      })

      const weeksFinal = uniq.length > 0
        ? uniq
        : Array.from({ length: 53 }, (_, i) => ({ numero: i + 1, ano: year }))

      setSemansPrazoOpcoes(weeksFinal)

      const metaSemanaNum = metaPrazoSemana ? Number(metaPrazoSemana) : null
      const temSelecionada = metaSemanaNum != null && weeksFinal.some(w => w.numero === metaSemanaNum)
      if (!temSelecionada) {
        const primeira = weeksFinal?.[0]?.numero
        if (primeira) {
          const str = String(primeira)
          setMetaPrazoSemana(str)
          definirMetaPeriodoPorSemanaNumero(str)
        }
      }
    } catch {
      const weeksFinal = Array.from({ length: 53 }, (_, i) => ({ numero: i + 1, ano: year }))
      setSemansPrazoOpcoes(weeksFinal)
      const primeira = weeksFinal?.[0]?.numero
      if (primeira) {
        const str = String(primeira)
        setMetaPrazoSemana(str)
        definirMetaPeriodoPorSemanaNumero(str)
      }
    } finally {
      setSemansPrazoLoading(false)
    }
  }

  function abrirMetaModal() {
    setMetaEdicaoId(null)
    setMetaModoSemMeta(false)
    setMetaTipoCiclo('recorrente')
    setMetaDesc('')
    setMetaInicio('')
    setMetaFim('')
    setMetaPeriodoFimId(null)
    setMetaPeriodoLabel('')
    setMetaPeriodoDerivando(false)
    setMetaErroForm('')

    setMetaPrazoAno('')
    setMetaPrazoMes('')
    setMetaPrazoSemana('')
    setSemansPrazoOpcoes([])
    setSemansPrazoLoading(false)

    const defaultAno = periodo?.ano != null ? String(periodo.ano) : (anosPrazoRender?.[0] || String(ano))
    const defaultMes = periodo?.data_fim
      ? String(new Date(periodo.data_fim).getMonth() + 1)
      : String(new Date().getMonth() + 1)
    setMetaPrazoAno(defaultAno)
    setMetaPrazoMes(defaultMes)

    setMetaModalAberto(true)
  }

  function abrirMetaModalSemMeta() {
    setMetaEdicaoId(null)
    setMetaModoSemMeta(true)
    setMetaTipoCiclo('recorrente')
    setMetaDesc('')
    setMetaInicio('')
    setMetaFim('')
    setMetaPeriodoFimId(null)
    setMetaPeriodoLabel('')
    setMetaPeriodoDerivando(false)
    setMetaErroForm('')

    setMetaPrazoAno('')
    setMetaPrazoMes('')
    setMetaPrazoSemana('')
    setSemansPrazoOpcoes([])
    setSemansPrazoLoading(false)

    const defaultAno = periodo?.ano != null ? String(periodo.ano) : (anosPrazoRender?.[0] || String(ano))
    const defaultMes = periodo?.data_fim
      ? String(new Date(periodo.data_fim).getMonth() + 1)
      : String(new Date().getMonth() + 1)
    setMetaPrazoAno(defaultAno)
    setMetaPrazoMes(defaultMes)

    setMetaModalAberto(true)
  }

  function abrirMetaModalEdicao(metaId) {
    const meta = objetivos.find(o => o.id === metaId)
    if (!meta) return

    setMetaEdicaoId(metaId)
    setMetaTipoCiclo(meta.tipo === 'atingivel' ? 'atingivel' : 'recorrente')
    setMetaDesc(meta.descricao || '')
    setMetaInicio('')
    setMetaFim('')
    setMetaPeriodoFimId(null)
    setMetaPeriodoLabel('')
    setMetaPeriodoDerivando(false)
    setMetaErroForm('')
    setSemansPrazoOpcoes([])
    setSemansPrazoLoading(false)

    const defaultAno = periodo?.ano != null ? String(periodo.ano) : (anosPrazoRender?.[0] || String(ano))
    const defaultMes = periodo?.data_fim
      ? String(new Date(periodo.data_fim).getMonth() + 1)
      : String(new Date().getMonth() + 1)
    setMetaPrazoAno(defaultAno)
    setMetaPrazoMes(defaultMes)

    const semanaMeta = extrairSemanaNumeroMeta(meta)
    setMetaPrazoSemana(semanaMeta)
    if (semanaMeta) definirMetaPeriodoPorSemanaNumero(semanaMeta)

    setMetaModalAberto(true)
  }

  function fecharMetaModal() {
    if (metaSalvando) return
    setMetaModalAberto(false)
    setMetaEdicaoId(null)
    setMetaModoSemMeta(false)
  }

  function validarMeta() {
    const d = metaDesc.trim()
    if (!d) return 'Informe a meta.'
    if (!areaId) return 'Selecione uma área.'
    if (!metaPrazoAno) return 'Selecione o ano do prazo.'
    if (!metaPrazoSemana) return 'Selecione a semana no calendário.'
    return ''
  }

  async function salvarMetaNova() {
    if (metaSalvando) return
    const msg = validarMeta()
    if (msg) {
      setMetaErroForm(msg)
      return
    }
    setMetaSalvando(true)
    setMetaErroForm('')
    const tipoVal = metaTipoCiclo === 'atingivel' ? 'atingivel' : 'recorrente'
    const payloadBase = {
      area_id: areaId,
      descricao: metaDesc.trim(),
      ordem: objetivos.length,
      // Persistimos a semana selecionada para a visualização (mesmo que `periodos` não aceite semana).
      meta_unidade: `S${metaPrazoSemana}`,
      tipo: tipoVal
    }

    if (metaEdicaoId) {
      try {
        let upPayload = {
          descricao: payloadBase.descricao,
          meta_unidade: payloadBase.meta_unidade,
          tipo: tipoVal
        }
        if (metaPeriodoFimId) upPayload.periodo_id = metaPeriodoFimId
        let { error: eUpd } = await withTimeout(
          supabase
            .from('objetivos')
            .update(upPayload)
            .eq('id', metaEdicaoId),
          10000,
          'Falha ao atualizar meta'
        )
        if (eUpd && String(eUpd.message || '').toLowerCase().includes('tipo')) {
          const { tipo: _x, ...semTipo } = upPayload
          const r2 = await withTimeout(
            supabase.from('objetivos').update(semTipo).eq('id', metaEdicaoId),
            10000,
            'Falha ao atualizar meta (sem tipo)'
          )
          eUpd = r2.error
          upPayload = semTipo
        }
        if (eUpd) throw eUpd

        const prevMeta = objetivos.find((o) => o.id === metaEdicaoId)
        void registrarLog({
          modulo: 'Planejamento',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'objetivo',
          entidade_id: metaEdicaoId,
          operacao: 'UPDATE',
          valor_anterior: prevMeta
            ? { descricao: prevMeta.descricao, meta_unidade: prevMeta.meta_unidade }
            : null,
          valor_novo: upPayload,
          descricao: `Alterou meta "${payloadBase.descricao}"`
        })
        setMetaSalvando(false)
        fecharMetaModal()
        carregar()
      } catch (err) {
        setMetaErroForm(err?.message || 'Não foi possível atualizar a meta.')
      } finally {
        setMetaSalvando(false)
      }
      return
    }

    // Sem vínculo com trimestre: a meta pertence apenas à área e pode ter semana em `meta_unidade`.
    // `periodo_id` é opcional e só é usado quando existir no schema/fluxo.
    const payloadComPeriodoId = { ...payloadBase, periodo_id: metaPeriodoFimId }
    try {
      let { data, error: e } = await withTimeout(
        supabase
          .from('objetivos')
          .insert(payloadComPeriodoId)
          .select('id, area_id, descricao, ordem, periodo_id')
          .single(),
        10000,
        'Falha ao salvar meta'
      )
      if (e && String(e.message || '').toLowerCase().includes('tipo')) {
        const { tipo: _ti, ...insSemTipo } = payloadComPeriodoId
        const rIns = await withTimeout(
          supabase.from('objetivos').insert(insSemTipo).select('id, area_id, descricao, ordem, periodo_id').single(),
          10000,
          'Falha ao salvar meta (sem coluna tipo)'
        )
        data = rIns.data
        e = rIns.error
      }
      if (e) throw e

      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'objetivo',
        entidade_id: data?.id ?? null,
        operacao: 'INSERT',
        valor_novo: payloadComPeriodoId,
        descricao: `Criou meta "${payloadBase.descricao}"`
      })

      if (metaModoSemMeta && data?.id) {
        try {
          const rVinc = await withTimeout(
            supabase
              .from('tarefas')
              .update({ objetivo_id: data.id })
              .eq('area_id', areaId)
              .is('objetivo_id', null),
            10000,
            'Falha ao vincular comportamentos sem meta'
          )
          if (!rVinc?.error) {
            void registrarLog({
              modulo: 'Workload',
              area: areas.find((a) => a.id === areaId)?.nome ?? null,
              entidade: 'tarefa',
              entidade_id: null,
              operacao: 'UPDATE',
              valor_novo: { objetivo_id: data.id, escopo: 'comportamentos_sem_meta_na_area' },
              descricao: `Vinculou comportamentos sem meta à meta "${payloadBase.descricao}"`
            })
          }
        } catch {
          // Melhor esforço: mesmo se a vinculação falhar, a meta permanece criada.
        }
      }

      setMetaSalvando(false)
      fecharMetaModal()
      carregar()
    } catch (err) {
      const msg = err?.message || 'Não foi possível salvar a meta.'
      const msgLower = msg.toLowerCase()

      // Se a coluna `periodo_id` ainda não existe no banco (ou não está no schema cache),
      // permite salvar sem esse campo para o botão não quebrar.
      if (msgLower.includes('periodo_id') && msgLower.includes('objetivos')) {
        try {
          let { data: data2, error: e2 } = await withTimeout(
            supabase
              .from('objetivos')
              .insert(payloadBase)
              .select('id, area_id, descricao, ordem')
              .single(),
            10000,
            'Falha ao salvar meta (fallback sem periodo_id)'
          )
          if (e2 && String(e2.message || '').toLowerCase().includes('tipo')) {
            const { tipo: _t2, ...pb2 } = payloadBase
            const r3 = await withTimeout(
              supabase.from('objetivos').insert(pb2).select('id, area_id, descricao, ordem').single(),
              10000,
              'Falha ao salvar meta (fallback sem tipo)'
            )
            data2 = r3.data
            e2 = r3.error
          }
          if (e2) throw e2

          void registrarLog({
            modulo: 'Planejamento',
            area: areas.find((a) => a.id === areaId)?.nome ?? null,
            entidade: 'objetivo',
            entidade_id: data2?.id ?? null,
            operacao: 'INSERT',
            valor_novo: payloadBase,
            descricao: `Criou meta "${payloadBase.descricao}" (sem periodo_id)`
          })

          if (metaModoSemMeta && data2?.id) {
            try {
              const rVinc2 = await withTimeout(
                supabase
                  .from('tarefas')
                  .update({ objetivo_id: data2.id })
                  .eq('area_id', areaId)
                  .is('objetivo_id', null),
                10000,
                'Falha ao vincular comportamentos sem meta (fallback)'
              )
              if (!rVinc2?.error) {
                void registrarLog({
                  modulo: 'Workload',
                  area: areas.find((a) => a.id === areaId)?.nome ?? null,
                  entidade: 'tarefa',
                  entidade_id: null,
                  operacao: 'UPDATE',
                  valor_novo: { objetivo_id: data2.id, escopo: 'comportamentos_sem_meta_na_area' },
                  descricao: `Vinculou comportamentos sem meta à meta "${payloadBase.descricao}" (fallback)`
                })
              }
            } catch {
              // Melhor esforço: mantém meta criada mesmo se vinculação falhar.
            }
          }

          setMetaSalvando(false)
          fecharMetaModal()
          carregar()
          return
        } catch {
          // segue com o erro original abaixo
        }
      }

      setMetaErroForm(msg)
    } finally {
      setMetaSalvando(false)
    }
  }

  async function atualizarMetaDescricao(metaId, descricao) {
    if (!metaId || metaId === '_sem') return
    const novo = descricao?.trim()
    if (!novo) return
    const prevO = objetivos.find((o) => o.id === metaId)
    const { error: err } = await supabase.from('objetivos').update({ descricao: novo }).eq('id', metaId)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'objetivo',
        entidade_id: metaId,
        operacao: 'UPDATE',
        valor_anterior: prevO ? { descricao: prevO.descricao } : null,
        valor_novo: { descricao: novo },
        descricao: `Alterou descrição da meta "${novo}"`
      })
      setError(null)
      carregar()
      // Atualiza local para garantir que o botão surta efeito mesmo se recarregar falhar
      setObjetivos(prev => prev.map(o => (o.id === metaId ? { ...o, descricao: novo } : o)))
    }
  }

  function solicitarRemoverMeta(metaId) {
    if (!metaId || metaId === '_sem') return
    setMetaExcluirId(metaId)
  }

  async function removerMeta(metaId) {
    if (!metaId || metaId === '_sem') return

    const prevMetaDel = objetivos.find((o) => o.id === metaId)
    // Melhor esforço: desconectar comportamentos (tarefas) da meta antes do delete.
    try {
      const rDisc = await supabase.from('tarefas').update({ objetivo_id: null }).eq('objetivo_id', metaId)
      if (!rDisc?.error) {
        void registrarLog({
          modulo: 'Workload',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'tarefa',
          entidade_id: null,
          operacao: 'UPDATE',
          valor_novo: { objetivo_id: null, escopo: `desvinculadas_de_meta_${metaId}` },
          descricao: `Desvinculou tarefas da meta antes de excluir "${prevMetaDel?.descricao || metaId}"`
        })
      }
    } catch {
      // ignora se a coluna `objetivo_id` ainda nao existir
    }

    const { error: err } = await supabase.from('objetivos').delete().eq('id', metaId)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Planejamento',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'objetivo',
        entidade_id: metaId,
        operacao: 'DELETE',
        valor_anterior: prevMetaDel || null,
        descricao: `Excluiu meta "${prevMetaDel?.descricao || metaId}"`
      })
      setError(null)
      // Atualização local para garantir re-render imediato
      setObjetivos(prev => prev.filter(o => o.id !== metaId))
      setTarefas(prev => prev.map(t => (t.objetivo_id === metaId ? { ...t, objetivo_id: null } : t)))
      carregar()
    }
  }

  async function confirmarRemocaoMeta() {
    if (!metaExcluirId || metaExcluindo) return
    setMetaExcluindo(true)
    try {
      await removerMeta(metaExcluirId)
      setMetaExcluirId(null)
    } finally {
      setMetaExcluindo(false)
    }
  }

  function abrirAssociarSemMeta() {
    const firstMetaId = objetivos.find(o => o.id && o.id !== '_sem')?.id || ''
    setSemMetaDestinoId(firstMetaId)
    setSemMetaAssociarAberto(true)
  }

  async function confirmarAssociarSemMeta() {
    if (!isAdmin) return
    if (!semMetaDestinoId || semMetaProcessando) return
    setSemMetaProcessando(true)
    try {
      const { error: err } = await supabase
        .from('tarefas')
        .update({ objetivo_id: semMetaDestinoId })
        .eq('area_id', areaId)
        .is('objetivo_id', null)
      if (err) {
        setError(err.message || 'Não foi possível associar os comportamentos sem meta.')
      } else {
        void registrarLog({
          modulo: 'Workload',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'tarefa',
          entidade_id: null,
          operacao: 'UPDATE',
          valor_novo: { objetivo_id: semMetaDestinoId, escopo: 'comportamentos_sem_meta_na_area' },
          descricao: 'Associou comportamentos sem meta a uma meta existente'
        })
        setError(null)
        setSemMetaAssociarAberto(false)
        carregar()
      }
    } finally {
      setSemMetaProcessando(false)
    }
  }

  async function confirmarExcluirSemMeta() {
    if (!isAdmin) return
    if (semMetaProcessando) return
    setSemMetaProcessando(true)
    try {
      const { error: err } = await supabase
        .from('tarefas')
        .delete()
        .eq('area_id', areaId)
        .is('objetivo_id', null)
      if (err) {
        setError(err.message || 'Não foi possível excluir os comportamentos sem meta.')
      } else {
        void registrarLog({
          modulo: 'Workload',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'tarefa',
          entidade_id: null,
          operacao: 'DELETE',
          valor_anterior: { escopo: 'comportamentos_sem_meta_na_area' },
          descricao: 'Excluiu todos os comportamentos sem meta da área'
        })
        setError(null)
        setSemMetaExcluirAberto(false)
        carregar()
      }
    } finally {
      setSemMetaProcessando(false)
    }
  }

  async function definirMetaPeriodoPorSemanaNumero(semanaNumero) {
    metaPeriodoFimRequestIdRef.current += 1
    const reqId = metaPeriodoFimRequestIdRef.current

    const numeroNum = Number(semanaNumero)
    const numero = Number.isFinite(numeroNum) ? Math.trunc(numeroNum) : null
    if (numero == null || numero < 1 || numero > 53) {
      setMetaErroForm('Semana inválida (deve estar entre 1 e 53).')
      setMetaPeriodoDerivando(false)
      setMetaPeriodoFimId(null)
      return
    }

    const anoNum = metaPrazoAno ? Number(metaPrazoAno) : ano
    const anoInt = Number.isFinite(anoNum) ? Math.trunc(anoNum) : null
    if (anoInt == null) {
      setMetaErroForm('Ano inválido para determinar o prazo.')
      setMetaPeriodoDerivando(false)
      setMetaPeriodoFimId(null)
      return
    }
    const labelDerivado = `Semana ${String(numero).padStart(2, '0')}/${anoNum ?? ''}`

    setMetaPeriodoFimId(null)
    setMetaPeriodoLabel(labelDerivado)
    setMetaInicio('')
    setMetaFim('')
    setMetaErroForm('')
    if (!numero || Number.isNaN(numero)) return

    setMetaPeriodoDerivando(true)
    try {
      const ano = anoInt

      let query = supabase
        .from('periodos')
        .select('id, data_inicio, data_fim, ano, numero, tipo')
        .eq('tipo', 'semana')
        .eq('ativo', true)
        .eq('numero', numero)

      if (ano != null) query = query.eq('ano', ano)

      const { data: p } = await withTimeout(
        query.limit(1),
        10000,
        'Falha ao determinar período semanal pela semana'
      )

      if (reqId !== metaPeriodoFimRequestIdRef.current) return

      const periodo = Array.isArray(p) ? p[0] : null
      if (!periodo) {
        return
      }

      setMetaPeriodoFimId(periodo.id)
      setMetaInicio(periodo.data_inicio ? String(periodo.data_inicio).slice(0, 10) : '')
      const fimDerivado = periodo.data_fim ? String(periodo.data_fim).slice(0, 10) : ''
      setMetaFim(fimDerivado)
      setMetaPeriodoLabel(labelPeriodo(periodo))
    } catch (err) {
      if (reqId !== metaPeriodoFimRequestIdRef.current) return
      // Mantém label derivado e não bloqueia o cadastro.
    } finally {
      if (reqId === metaPeriodoFimRequestIdRef.current) setMetaPeriodoDerivando(false)
    }
  }

  async function definirMetaPeriodoPorDataFim(novaDataFim) {
    metaPeriodoFimRequestIdRef.current += 1
    const reqId = metaPeriodoFimRequestIdRef.current

    setMetaFim(novaDataFim)
    setMetaPeriodoFimId(null)
    setMetaPeriodoLabel('')
    setMetaInicio('')
    setMetaErroForm('')

    if (!novaDataFim) return

    setMetaPeriodoDerivando(true)
    try {
      const { data: p } = await withTimeout(
        supabase
          .from('periodos')
          .select('id, data_inicio, data_fim, ano, numero, tipo')
          .eq('tipo', 'semana')
          .eq('ativo', true)
          .lte('data_inicio', novaDataFim)
          .gte('data_fim', novaDataFim)
          .order('data_fim', { ascending: true })
          .limit(1),
        10000,
        'Falha ao determinar período semanal'
      )

      if (reqId !== metaPeriodoFimRequestIdRef.current) return

      if (!p || !Array.isArray(p) || p.length === 0) {
        setMetaErroForm('Não foi possível determinar o período semanal pela data fim.')
        return
      }

      const periodo = p[0]

      setMetaPeriodoFimId(periodo.id)
      setMetaInicio(periodo.data_inicio ? String(periodo.data_inicio).slice(0, 10) : '')
      const fimDerivado = periodo.data_fim ? String(periodo.data_fim).slice(0, 10) : novaDataFim
      setMetaFim(fimDerivado)
      setMetaPeriodoLabel(labelPeriodo(periodo))
    } catch (err) {
      if (reqId !== metaPeriodoFimRequestIdRef.current) return
      setMetaErroForm(err?.message || 'Falha ao determinar o período semanal.')
    } finally {
      if (reqId === metaPeriodoFimRequestIdRef.current) setMetaPeriodoDerivando(false)
    }
  }

  const toggle = (tipo, id) => setExpandido(prev => ({ ...prev, [`${tipo}-${id}`]: !prev[`${tipo}-${id}`] }))
  const estaExpandido = (tipo, id) => expandido[`${tipo}-${id}`] !== false

  const metaIdsCarregados = new Set((objetivos || []).map((o) => o?.id).filter(Boolean))
  const tarefasPorObjetivo = {}
  const tarefasSemMeta = []
  tarefas.forEach((t) => {
    const oid = t?.objetivo_id
    if (oid && metaIdsCarregados.has(oid)) {
      if (!tarefasPorObjetivo[oid]) tarefasPorObjetivo[oid] = []
      tarefasPorObjetivo[oid].push(t)
    } else {
      /* Sem meta OU meta não listada no estado (período/RLS/metas arquivadas): não pode sumir da UI. */
      tarefasSemMeta.push(t)
    }
  })

  async function salvarComportamento(objetivoId, nome) {
    if (!nome?.trim() || !areaId) return
    const payload = { area_id: areaId, nome: nome.trim(), ordem: tarefas.length }
    if (objetivoId && objetivoId !== '_sem') payload.objetivo_id = objetivoId
    const { error: err } = await supabase.from('tarefas').insert(payload)
    if (err) {
      if (err.message?.includes('objetivo_id') || err.message?.includes('schema cache')) {
        const { objetivo_id: _, ...payloadSemObjetivo } = payload
        const { error: err2 } = await supabase.from('tarefas').insert(payloadSemObjetivo)
        if (err2) {
          setMigracaoObjetivoId(true)
          setError('Execute a migração para habilitar metas. Clique no aviso para copiar o SQL.')
        } else {
          void registrarLog({
            modulo: 'Workload',
            area: areas.find((a) => a.id === areaId)?.nome ?? null,
            entidade: 'tarefa',
            entidade_id: null,
            operacao: 'INSERT',
            valor_novo: payloadSemObjetivo,
            descricao: `Criou comportamento "${nome.trim()}"`
          })
          setError(null)
          setAdicionando(null)
          carregar()
        }
      } else setError(err.message)
    } else {
      void registrarLog({
        modulo: 'Workload',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'tarefa',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: payload,
        descricao: `Criou comportamento "${nome.trim()}"`
      })
      setError(null)
      setAdicionando(null)
      carregar()
    }
  }

  async function salvarTarefa(tarefaId, nome, tempoValor, tempoUnidade, canetaVerde, recorrencia, multValor, multTipo, tipoAtividade) {
    if (!nome?.trim() || !tarefaId) return
    const payload = {
      tarefa_id: tarefaId,
      nome: nome.trim(),
      tempo_estimado_minutos: valorParaMinutos(tempoValor, tempoUnidade),
      ordem: 0,
      caneta_verde: canetaVerdeParaSalvar(canetaVerde),
      recorrencia: recorrencia || 'unica',
      multiplicador_valor: multValor !== '' && multValor != null && !Number.isNaN(Number(multValor)) ? Number(multValor) : null,
      multiplicador_tipo: multValor !== '' ? (multTipo || null) : null
    }
    if (isAreaTipoAtividadeProjeto) {
      payload.tipo_atividade =
        tipoAtividade === 'modelagem' || tipoAtividade === 'documentacao' ? tipoAtividade : null
    }
    const { error: err } = await supabase.from('acoes').insert(payload)
    if (err) {
      if (isAreaTipoAtividadeProjeto && erroColunaTipoAtividade(err.message)) {
        const { tipo_atividade: _ta, ...semTipo } = payload
        const { error: errT } = await supabase.from('acoes').insert(semTipo)
        if (errT) {
          setError(errT.message)
        } else {
          setMigracaoTipoAtividade(true)
          setError('Atividade salva sem tipo (coluna tipo_atividade ausente). Clique no aviso para copiar o SQL da migração.')
          setAdicionando(null)
          carregar()
        }
        return
      }
      if (err.message && (err.message.includes('caneta_verde') || err.message.includes('recorrencia') || err.message.includes('multiplicador_'))) {
        if (erroCheckMultiplicadorTipo(err.message)) {
          setMigracaoMultiplicadorCheck(true)
          setError('Seu banco ainda bloqueia tipos novos no multiplicador (CHECK fixo). Clique no aviso para copiar o SQL e remover a restrição. Depois recarregue (F5) e salve novamente.')
          setAdicionando(null)
          carregar()
          return
        }
        const { caneta_verde: _, recorrencia: __, multiplicador_valor: ___, multiplicador_tipo: ____, tipo_atividade: _____, ...payloadBasico } = payload
        const { error: err2 } = await supabase.from('acoes').insert(payloadBasico)
        if (err2) {
          setError(err2.message)
        } else {
          void registrarLog({
            modulo: 'Workload',
            area: areas.find((a) => a.id === areaId)?.nome ?? null,
            entidade: 'acao',
            entidade_id: null,
            operacao: 'INSERT',
            valor_novo: payloadBasico,
            descricao: `Criou atividade "${nome.trim()}" (sem campos avançados)`
          })
          setMigracaoCanetaVerde(true)
          setError('Atividade salva sem campos avançados. Execute a migração para habilitar caneta verde, recorrência e multiplicador (clique no aviso para copiar o SQL).')
          setAdicionando(null)
          carregar()
        }
      } else setError(err.message)
    } else {
      void registrarLog({
        modulo: 'Workload',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'acao',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: payload,
        descricao: `Criou atividade "${nome.trim()}"`
      })
      setError(null)
      setMigracaoTipoAtividade(false)
      setAdicionando(null)
      carregar()
      setTimeout(() => {
        document.querySelector(`[data-workload-comp-id="${tarefaId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 400)
    }
  }

  async function salvarAtividadeEsteiraPar(tarefaId) {
    const nomeBase = String(valorEdit || '').trim()
    if (!nomeBase || !tarefaId) return
    const minMod = valorParaMinutos(valorEditTempoMod, valorEditUnidadeMod)
    const minDoc = valorParaMinutos(valorEditTempoDoc, valorEditUnidadeDoc)
    if (minMod == null || minDoc == null) {
      setError('Informe tempos válidos para Modelagem e Documentação.')
      return
    }
    const nomeDoc = `${nomeBase} - DOC`
    const multVal =
      valorEditMultiplicadorValor !== '' && valorEditMultiplicadorValor != null && !Number.isNaN(Number(valorEditMultiplicadorValor))
        ? Number(valorEditMultiplicadorValor)
        : null
    const multTipo = valorEditMultiplicadorValor !== '' ? (valorEditMultiplicadorTipo || null) : null
    const payloadMod = {
      tarefa_id: tarefaId,
      nome: nomeBase,
      tempo_estimado_minutos: minMod,
      ordem: 0,
      caneta_verde: 'nao',
      recorrencia: valorEditRecorrenciaMod || 'unica',
      multiplicador_valor: null,
      multiplicador_tipo: null,
      tipo_atividade: 'modelagem'
    }
    const payloadDoc = {
      tarefa_id: tarefaId,
      nome: nomeDoc,
      tempo_estimado_minutos: minDoc,
      ordem: 0,
      caneta_verde: canetaVerdeParaSalvar(valorEditCaneta),
      recorrencia: valorEditRecorrenciaDoc || 'unica',
      multiplicador_valor: multVal,
      multiplicador_tipo: multTipo,
      tipo_atividade: 'documentacao'
    }
    const { data: insMod, error: eMod } = await supabase.from('acoes').insert(payloadMod).select('id').maybeSingle()
    if (eMod) {
      if (erroSchemaAcaoTipoOuEsteira(eMod.message)) {
        setMigracaoTipoAtividade(true)
        setMigracaoEsteiraPar(true)
        setError(
          'Não foi possível criar a modelagem: migração tipo_atividade / esteira_par_id pendente ou schema cache desatualizado. Execute o SQL do aviso; no Supabase use Reload schema (Settings → API) e tente de novo.'
        )
      } else {
        setError(eMod.message)
      }
      return
    }
    const idMod = insMod?.id
    if (!idMod) {
      setError('Não foi possível obter o id da atividade de modelagem.')
      return
    }
    const { data: insDoc, error: eDoc } = await supabase.from('acoes').insert(payloadDoc).select('id').maybeSingle()
    if (eDoc) {
      const { error: eDel1 } = await supabase.from('acoes').delete().eq('id', idMod)
      if (eDel1) console.error('[rollback] erro ao deletar acao mod:', eDel1.message)
      if (erroSchemaAcaoTipoOuEsteira(eDoc.message)) {
        setMigracaoTipoAtividade(true)
        setMigracaoEsteiraPar(true)
        setError(
          'Não foi possível criar a documentação: migração tipo_atividade / esteira_par_id pendente ou schema cache desatualizado. Execute o SQL do aviso; no Supabase use Reload schema (Settings → API) e tente de novo.'
        )
      } else {
        setError(eDoc.message)
      }
      return
    }
    const idDoc = insDoc?.id
    if (!idDoc) {
      const { error: eDel1 } = await supabase.from('acoes').delete().eq('id', idMod)
      if (eDel1) console.error('[rollback] erro ao deletar acao mod:', eDel1.message)
      setError('Não foi possível obter o id da atividade de documentação.')
      return
    }
    const { error: u1 } = await supabase.from('acoes').update({ esteira_par_id: idDoc }).eq('id', idMod)
    const { error: u2 } = await supabase.from('acoes').update({ esteira_par_id: idMod }).eq('id', idDoc)
    if (u1 || u2) {
      const msg = u1?.message || u2?.message || ''
      const { error: eDel1 } = await supabase.from('acoes').delete().eq('id', idMod)
      if (eDel1) console.error('[rollback] erro ao deletar acao mod:', eDel1.message)
      const { error: eDel2 } = await supabase.from('acoes').delete().eq('id', idDoc)
      if (eDel2) console.error('[rollback] erro ao deletar acao doc:', eDel2.message)
      if (erroColunaEsteiraPar(msg)) {
        setMigracaoEsteiraPar(true)
        setError('Não foi possível vincular o par esteira (coluna esteira_par_id ausente). Clique no aviso para copiar o SQL da migração.')
      } else {
        setError(msg || 'Erro ao vincular par esteira.')
      }
      return
    }
    void registrarLog({
      modulo: 'Workload',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'acao',
      entidade_id: idMod,
      operacao: 'INSERT',
      valor_novo: { par: [payloadMod, payloadDoc], esteira_par_id: [idDoc, idMod] },
      descricao: `Criou atividade esteira "${nomeBase}"`
    })
    setError(null)
    setMigracaoEsteiraPar(false)
    setAdicionando(null)
    carregar()
    setTimeout(() => {
      document.querySelector(`[data-workload-comp-id="${tarefaId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 400)
  }

  async function atualizarAtividadeEsteiraPar() {
    if (!esteiraEdicaoIds?.modId || !esteiraEdicaoIds?.docId) return
    const nomeBase = String(valorEdit || '').trim()
    if (!nomeBase) return
    const minMod = valorParaMinutos(valorEditTempoMod, valorEditUnidadeMod)
    const minDoc = valorParaMinutos(valorEditTempoDoc, valorEditUnidadeDoc)
    if (minMod == null || minDoc == null) {
      setError('Informe tempos válidos para Modelagem e Documentação.')
      return
    }
    const nomeDoc = `${nomeBase} - DOC`
    const multVal =
      valorEditMultiplicadorValor !== '' && valorEditMultiplicadorValor != null && !Number.isNaN(Number(valorEditMultiplicadorValor))
        ? Number(valorEditMultiplicadorValor)
        : null
    const multTipo = valorEditMultiplicadorValor !== '' ? (valorEditMultiplicadorTipo || null) : null
    const upMod = {
      nome: nomeBase,
      tempo_estimado_minutos: minMod,
      recorrencia: valorEditRecorrenciaMod || 'unica',
      caneta_verde: 'nao',
      multiplicador_valor: null,
      multiplicador_tipo: null,
      tipo_atividade: 'modelagem'
    }
    const upDoc = {
      nome: nomeDoc,
      tempo_estimado_minutos: minDoc,
      recorrencia: valorEditRecorrenciaDoc || 'unica',
      caneta_verde: canetaVerdeParaSalvar(valorEditCaneta),
      multiplicador_valor: multVal,
      multiplicador_tipo: multTipo,
      tipo_atividade: 'documentacao'
    }
    const { error: e1 } = await supabase.from('acoes').update(upMod).eq('id', esteiraEdicaoIds.modId)
    if (e1) {
      setError(e1.message)
      return
    }
    const { error: e2 } = await supabase.from('acoes').update(upDoc).eq('id', esteiraEdicaoIds.docId)
    if (e2) {
      setError(e2.message)
      return
    }
    void registrarLog({
      modulo: 'Workload',
      area: areas.find((a) => a.id === areaId)?.nome ?? null,
      entidade: 'acao',
      entidade_id: esteiraEdicaoIds.modId,
      operacao: 'UPDATE',
      valor_novo: { mod: upMod, doc: upDoc },
      descricao: `Alterou atividade esteira "${nomeBase}"`
    })
    setError(null)
    setEditando(null)
    setEsteiraEdicaoIds(null)
    carregar()
  }

  async function atualizarComportamento(id, nome) {
    const prevT = tarefas.find((t) => t.id === id)
    const { error: err } = await supabase.from('tarefas').update({ nome: nome.trim() }).eq('id', id)
    if (err) setError(err.message)
    else {
      void registrarLog({
        modulo: 'Workload',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'tarefa',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prevT ? { nome: prevT.nome } : null,
        valor_novo: { nome: nome.trim() },
        descricao: `Alterou comportamento "${nome.trim()}"`
      })
      setError(null)
      setEditando(null)
      carregar()
    }
  }

  async function setCanetaTarefa(acaoId, valor) {
    if (salvandoCanetaId === acaoId) return
    setSalvandoCanetaId(acaoId)
    setCanetaLocal(prev => ({ ...prev, [acaoId]: valor }))
    const { error: err } = await supabase.from('acoes').update({ caneta_verde: valor }).eq('id', acaoId)
    if (err) {
      setCanetaLocal(prev => { const o = { ...prev }; delete o[acaoId]; return o })
      if (err.message?.includes('caneta_verde') || err.message?.includes('schema cache')) {
        setMigracaoCanetaVerde(true)
        setError('Execute a migração para habilitar caneta verde. Clique no aviso para copiar o SQL.')
      } else {
        setError(err.message)
      }
    } else {
      let prevCaneta = null
      for (const t of tarefas) {
        const a = (t.acoes || []).find((x) => x.id === acaoId)
        if (a) {
          prevCaneta = a.caneta_verde
          break
        }
      }
      void registrarLog({
        modulo: 'Workload',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'acao',
        entidade_id: acaoId,
        operacao: 'UPDATE',
        valor_anterior: { caneta_verde: prevCaneta },
        valor_novo: { caneta_verde: valor },
        descricao: 'Alterou caneta verde da atividade'
      })
      setError(null)
      setMigracaoCanetaVerde(false)
      setTarefas(prev => prev.map(t => ({
        ...t,
        acoes: (t.acoes || []).map(a => a.id === acaoId ? { ...a, caneta_verde: valor } : a)
      })))
      setCanetaLocal(prev => { const o = { ...prev }; delete o[acaoId]; return o })
    }
    setSalvandoCanetaId(null)
  }

  async function atualizarTarefa(id, nome, tempoValor, tempoUnidade, canetaVerde, recorrencia, multValor, multTipo, tipoAtividade) {
    const payload = {
      nome: nome.trim(),
      tempo_estimado_minutos: valorParaMinutos(tempoValor, tempoUnidade),
      caneta_verde: canetaVerdeParaSalvar(canetaVerde),
      recorrencia: recorrencia || 'unica',
      multiplicador_valor: multValor !== '' && multValor != null && !Number.isNaN(Number(multValor)) ? Number(multValor) : null,
      multiplicador_tipo: multValor !== '' ? (multTipo || null) : null
    }
    if (isAreaTipoAtividadeProjeto) {
      payload.tipo_atividade =
        tipoAtividade === 'modelagem' || tipoAtividade === 'documentacao' ? tipoAtividade : null
    }
    const { error: err } = await supabase.from('acoes').update(payload).eq('id', id)
    if (err) {
      if (isAreaTipoAtividadeProjeto && erroColunaTipoAtividade(err.message)) {
        const { tipo_atividade: _ta, ...semTipo } = payload
        const { error: errT } = await supabase.from('acoes').update(semTipo).eq('id', id)
        if (errT) setError(errT.message)
        else {
          setMigracaoTipoAtividade(true)
          setError('Atividade atualizada sem tipo (coluna tipo_atividade ausente). Clique no aviso para copiar o SQL da migração.')
          setEditando(null)
          carregar()
        }
        return
      }
      if (err.message && (err.message.includes('caneta_verde') || err.message.includes('recorrencia') || err.message.includes('multiplicador_'))) {
        if (erroCheckMultiplicadorTipo(err.message)) {
          setMigracaoMultiplicadorCheck(true)
          setError('Seu banco ainda bloqueia tipos novos no multiplicador (CHECK fixo). Clique no aviso para copiar o SQL e remover a restrição. Depois recarregue (F5) e salve novamente.')
          setEditando(null)
          carregar()
          return
        }
        const { caneta_verde: __, recorrencia: ___, multiplicador_valor: ____, multiplicador_tipo: _____, tipo_atividade: ______, ...payloadSemAvancado } = payload
        const { error: err2 } = await supabase.from('acoes').update(payloadSemAvancado).eq('id', id)
        if (err2) setError(err2.message)
        else {
          let prevAc = null
          for (const t of tarefas) {
            const a = (t.acoes || []).find((x) => x.id === id)
            if (a) {
              prevAc = a
              break
            }
          }
          void registrarLog({
            modulo: 'Workload',
            area: areas.find((a) => a.id === areaId)?.nome ?? null,
            entidade: 'acao',
            entidade_id: id,
            operacao: 'UPDATE',
            valor_anterior: prevAc,
            valor_novo: payloadSemAvancado,
            descricao: `Alterou atividade "${payloadSemAvancado.nome}" (sem campos avançados)`
          })
          setMigracaoCanetaVerde(true)
          setError('Atividade atualizada sem campos avançados. Execute a migração para habilitar caneta verde, recorrência e multiplicador (clique no aviso para copiar o SQL).')
          setEditando(null)
          carregar()
        }
      } else setError(err.message)
    } else {
      let prevAc = null
      for (const t of tarefas) {
        const a = (t.acoes || []).find((x) => x.id === id)
        if (a) {
          prevAc = a
          break
        }
      }
      void registrarLog({
        modulo: 'Workload',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'acao',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prevAc,
        valor_novo: payload,
        descricao: `Alterou atividade "${payload.nome}"`
      })
      setError(null)
      setMigracaoTipoAtividade(false)
      setEditando(null)
      carregar()
    }
  }

  function solicitarRemoverComportamento(id) {
    setComportamentoExcluirId(id)
  }

  async function confirmarRemocaoComportamento() {
    if (!comportamentoExcluirId || comportamentoExcluindo) return
    const id = comportamentoExcluirId
    setComportamentoExcluindo(true)
    try {
      const prevT = tarefas.find((t) => t.id === id)
      const { error: err } = await supabase.from('tarefas').delete().eq('id', id)
      if (err) setError(err.message)
      else {
        void registrarLog({
          modulo: 'Workload',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'tarefa',
          entidade_id: id,
          operacao: 'DELETE',
          valor_anterior: prevT || null,
          descricao: `Excluiu comportamento "${prevT?.nome || id}"`
        })
        setError(null)
        setComportamentoExcluirId(null)
        carregar()
      }
    } finally {
      setComportamentoExcluindo(false)
    }
  }

  function solicitarRemoverAtividade(id) {
    let todas = []
    let acao = null
    for (const t of tarefas) {
      const a = (t.acoes || []).find(x => x.id === id)
      if (a) {
        acao = a
        todas = t.acoes || []
        break
      }
    }
    if (!acao) {
      setAtividadeExcluirIds([id])
      return
    }
    const par = isAreaTipoAtividadeProjeto ? resolverParEsteira(acao, todas) : null
    if (par) setAtividadeExcluirIds([par.doc.id, par.mod.id])
    else setAtividadeExcluirIds([id])
  }

  async function confirmarRemocaoAtividade() {
    if (!atividadeExcluirIds?.length || atividadeExcluindo) return
    const ids = [...atividadeExcluirIds]
    setAtividadeExcluindo(true)
    try {
      for (const id of ids) {
        let prevA = null
        for (const t of tarefas) {
          const a = (t.acoes || []).find((x) => x.id === id)
          if (a) {
            prevA = a
            break
          }
        }
        const { error: err } = await supabase.from('acoes').delete().eq('id', id)
        if (err) {
          setError(err.message)
          return
        }
        void registrarLog({
          modulo: 'Workload',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'acao',
          entidade_id: id,
          operacao: 'DELETE',
          valor_anterior: prevA || null,
          descricao: `Excluiu atividade "${prevA?.nome || id}"`
        })
      }
      setError(null)
      setAtividadeExcluirIds(null)
      carregar()
    } finally {
      setAtividadeExcluindo(false)
    }
  }

  function parseRegraVal(v) {
    if (v === '' || v == null) return null
    const n = Number(v)
    return !Number.isNaN(n) && n >= 0 && n <= 100 ? n : null
  }

  async function salvarIndicador(tarefaId, nome, tipo, unidade, metaValor, verdeEscuro, verdeClaro, amarelo, verdeEscuroOp, verdeClaroOp, amareloOp) {
    if (!nome?.trim() || !tarefaId) return
    const lista = indicadoresByTarefa[tarefaId] || []
    const payload = {
      tarefa_id: tarefaId,
      nome: nome.trim(),
      tipo: tipo || 'quantidade',
      unidade: unidade?.trim() || null,
      meta_valor: metaValor !== '' && metaValor != null && !Number.isNaN(Number(metaValor)) ? Number(metaValor) : null,
      ordem: lista.length
    }
    const re = parseRegraVal(verdeEscuro)
    const rc = parseRegraVal(verdeClaro)
    const ra = parseRegraVal(amarelo)
    const opVal = (v) => (v && ['gte', 'lte', 'eq', 'gt', 'lt', 'ne'].includes(v) ? v : 'gte')
    if (re != null) { payload.regra_verde_escuro = re; payload.regra_verde_escuro_op = opVal(verdeEscuroOp) }
    if (rc != null) { payload.regra_verde_claro = rc; payload.regra_verde_claro_op = opVal(verdeClaroOp) }
    if (ra != null) { payload.regra_amarelo = ra; payload.regra_amarelo_op = opVal(amareloOp) }
    let { error: err } = await supabase.from('indicadores').insert(payload)
    if (err && (err.message?.includes('regra_') || err.message?.includes('column'))) {
      delete payload.regra_verde_escuro
      delete payload.regra_verde_claro
      delete payload.regra_amarelo
      delete payload.regra_verde_escuro_op
      delete payload.regra_verde_claro_op
      delete payload.regra_amarelo_op
      const res = await supabase.from('indicadores').insert(payload)
      err = res.error
      if (!err) {
        void registrarLog({
          modulo: 'Indicadores',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'indicadores',
          entidade_id: res?.data?.id ?? null,
          operacao: 'INSERT',
          valor_novo: payload,
          descricao: `Criou indicador "${payload.nome}" (sem colunas de regra)`
        })
        setMigracaoIndicadores(true)
        setError('Indicador salvo. As colunas da regra de coloração ainda não existem no banco. Clique no aviso para copiar o SQL (ALTER TABLE) e execute no Supabase. Depois edite o indicador para definir a regra.')
        setAdicionandoIndicador(null)
        setValorEditIndNome('')
        setValorEditIndTipo('quantidade')
        setValorEditIndUnidade('')
        setValorEditIndMeta('')
        setValorEditIndVerdeEscuro('')
        setValorEditIndVerdeClaro('')
        setValorEditIndAmarelo('')
        setValorEditIndVerdeEscuroOp('gte')
        setValorEditIndVerdeClaroOp('gte')
        setValorEditIndAmareloOp('gte')
        carregar()
        return
      }
    }
    if (err) {
      if (err.message?.includes('indicadores') || err.message?.includes('schema cache') || err.message?.includes('regra_')) {
        setMigracaoIndicadores(true)
        setError('Tabela de indicadores ou colunas de regra não existem. Clique no aviso para copiar o SQL (tabela + colunas) e execute no Supabase → SQL Editor.')
      } else setError(err.message)
    } else {
      void registrarLog({
        modulo: 'Indicadores',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'indicadores',
        entidade_id: null,
        operacao: 'INSERT',
        valor_novo: payload,
        descricao: `Criou indicador "${payload.nome}"`
      })
      setError(null)
      setMigracaoIndicadores(false)
      setAdicionandoIndicador(null)
      setValorEditIndNome('')
      setValorEditIndTipo('quantidade')
      setValorEditIndUnidade('')
      setValorEditIndMeta('')
      setValorEditIndVerdeEscuro('')
      setValorEditIndVerdeClaro('')
      setValorEditIndAmarelo('')
      setValorEditIndVerdeEscuroOp('gte')
      setValorEditIndVerdeClaroOp('gte')
      setValorEditIndAmareloOp('gte')
      carregar()
    }
  }

  async function atualizarIndicador(id, nome, tipo, unidade, metaValor, verdeEscuro, verdeClaro, amarelo, verdeEscuroOp, verdeClaroOp, amareloOp) {
    if (!nome?.trim() || !id) return
    const payload = {
      nome: nome.trim(),
      tipo: tipo || 'quantidade',
      unidade: unidade?.trim() || null,
      meta_valor: metaValor !== '' && metaValor != null && !Number.isNaN(Number(metaValor)) ? Number(metaValor) : null
    }
    const re = parseRegraVal(verdeEscuro)
    const rc = parseRegraVal(verdeClaro)
    const ra = parseRegraVal(amarelo)
    const opVal = (v) => (v && ['gte', 'lte', 'eq', 'gt', 'lt', 'ne'].includes(v) ? v : 'gte')
    payload.regra_verde_escuro = re
    payload.regra_verde_claro = rc
    payload.regra_amarelo = ra
    payload.regra_verde_escuro_op = opVal(verdeEscuroOp)
    payload.regra_verde_claro_op = opVal(verdeClaroOp)
    payload.regra_amarelo_op = opVal(amareloOp)
    let { error: err } = await supabase.from('indicadores').update(payload).eq('id', id)
    if (err && (err.message?.includes('regra_') || err.message?.includes('column'))) {
      delete payload.regra_verde_escuro
      delete payload.regra_verde_claro
      delete payload.regra_amarelo
      delete payload.regra_verde_escuro_op
      delete payload.regra_verde_claro_op
      delete payload.regra_amarelo_op
      const res = await supabase.from('indicadores').update(payload).eq('id', id)
      err = res.error
      if (!err) {
        const prevInd = Object.values(indicadoresByTarefa || {})
          .flat()
          .find((i) => i.id === id)
        void registrarLog({
          modulo: 'Indicadores',
          area: areas.find((a) => a.id === areaId)?.nome ?? null,
          entidade: 'indicadores',
          entidade_id: id,
          operacao: 'UPDATE',
          valor_anterior: prevInd || null,
          valor_novo: payload,
          descricao: `Alterou indicador "${payload.nome}" (sem colunas de regra)`
        })
        setMigracaoIndicadores(true)
        setError('Indicador atualizado. As colunas da regra de coloração ainda não existem no banco. Clique no aviso para copiar o SQL (ALTER TABLE) e execute no Supabase. Depois edite o indicador novamente para definir a regra.')
        setEditandoIndicadorId(null)
        setValorEditIndNome('')
        setValorEditIndTipo('quantidade')
        setValorEditIndUnidade('')
        setValorEditIndMeta('')
        setValorEditIndVerdeEscuro('')
        setValorEditIndVerdeClaro('')
        setValorEditIndAmarelo('')
        setValorEditIndVerdeEscuroOp('gte')
        setValorEditIndVerdeClaroOp('gte')
        setValorEditIndAmareloOp('gte')
        carregar()
        return
      }
    }
    if (err) {
      if (err.message?.includes('indicadores') || err.message?.includes('schema cache') || err.message?.includes('regra_')) {
        setMigracaoIndicadores(true)
        setError('Tabela de indicadores ou colunas de regra não existem. Clique no aviso para copiar o SQL (tabela + colunas) e execute no Supabase → SQL Editor.')
      } else setError(err.message)
    } else {
      const prevInd = Object.values(indicadoresByTarefa || {})
        .flat()
        .find((i) => i.id === id)
      void registrarLog({
        modulo: 'Indicadores',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'indicadores',
        entidade_id: id,
        operacao: 'UPDATE',
        valor_anterior: prevInd || null,
        valor_novo: payload,
        descricao: `Alterou indicador "${payload.nome}"`
      })
      setError(null)
      setMigracaoIndicadores(false)
      setEditandoIndicadorId(null)
      setValorEditIndNome('')
      setValorEditIndTipo('quantidade')
      setValorEditIndUnidade('')
      setValorEditIndMeta('')
      setValorEditIndVerdeEscuro('')
      setValorEditIndVerdeClaro('')
      setValorEditIndAmarelo('')
      setValorEditIndVerdeEscuroOp('gte')
      setValorEditIndVerdeClaroOp('gte')
      setValorEditIndAmareloOp('gte')
      carregar()
    }
  }

  async function removerIndicador(id) {
    if (!window.confirm('Remover este indicador?')) return
    const prevInd = Object.values(indicadoresByTarefa || {})
      .flat()
      .find((i) => i.id === id)
    const { error: err } = await supabase.from('indicadores').delete().eq('id', id)
    if (err) {
      if (err.message?.includes('indicadores') || err.message?.includes('schema cache')) {
        setMigracaoIndicadores(true)
        setError('Tabela de indicadores não existe. Execute a migração. Clique no aviso para copiar o SQL.')
      } else setError(err.message)
    } else {
      void registrarLog({
        modulo: 'Indicadores',
        area: areas.find((a) => a.id === areaId)?.nome ?? null,
        entidade: 'indicadores',
        entidade_id: id,
        operacao: 'DELETE',
        valor_anterior: prevInd || null,
        descricao: `Excluiu indicador "${prevInd?.nome || id}"`
      })
      setError(null)
      setMigracaoIndicadores(false)
      setEditandoIndicadorId(null)
      carregar()
    }
  }

  const nomeArea = areas.find(a => a.id === areaId)?.nome || ''
  const isAreaTipoAtividadeProjeto = useMemo(
    () => NOMES_AREA_TIPO_ATIVIDADE_PROJETO.has(String(nomeArea).trim()),
    [nomeArea]
  )

  const metaSections = (() => {
    const sections = []
    objetivos.forEach(meta => {
      const comps = tarefasPorObjetivo[meta.id] || []
      sections.push({
        metaId: meta.id,
        metaNome: meta.descricao,
        metaEntregaLabel: meta._periodoLabel || meta.meta_unidade || '',
        comps
      })
    })
    if (tarefasSemMeta.length > 0) {
      sections.unshift({ metaId: '_sem', metaNome: 'Sem meta', metaEntregaLabel: '', comps: tarefasSemMeta })
    }
    return sections
  })()

  /** Lista única para exibição: sem agrupamento visual por meta nesta página */
  const comportamentosOrdenados = metaSections.flatMap((s) => s.comps)
  const defaultMetaParaNovoComportamento = objetivos[0]?.id || '_sem'
  const nomeComportamentoExcluir = comportamentoExcluirId
    ? (tarefas.find(t => t.id === comportamentoExcluirId)?.nome || '')
    : ''
  const nomeAtividadeExcluir = atividadeExcluirIds?.length
    ? (() => {
        const firstId = atividadeExcluirIds[0]
        for (const t of tarefas) {
          const a = (t.acoes || []).find(x => x.id === firstId)
          if (a) {
            if (atividadeExcluirIds.length > 1) return nomeBaseAtividadeEsteira(a.nome || '') || a.nome || ''
            return a.nome || ''
          }
        }
        return ''
      })()
    : ''

  const compIdEdit = editando?.startsWith('comp-') ? editando.slice(5) : null
  const acaoIdEdit = editando?.startsWith('tarefa-') ? editando.slice(7) : null
  const compForEdit = compIdEdit ? tarefas.find(t => t.id === compIdEdit) : null
  let acaoForEdit = null
  if (acaoIdEdit) {
    for (const t of tarefas) {
      const a = (t.acoes || []).find(x => x.id === acaoIdEdit)
      if (a) {
        acaoForEdit = a
        break
      }
    }
  }
  const workloadDrawerMode =
    adicionando?.tipo === 'comportamento' ? 'novo-comportamento'
      : adicionando?.tipo === 'tarefa' ? 'nova-atividade'
        : editando?.startsWith('comp-') ? 'editar-comportamento'
          : editando?.startsWith('tarefa-') ? 'editar-atividade'
            : null
  const workloadDrawerAberto = workloadDrawerMode != null
  const workloadDrawerTitle =
    workloadDrawerMode === 'novo-comportamento' ? 'Novo comportamento'
      : workloadDrawerMode === 'nova-atividade' ? 'Nova atividade'
        : workloadDrawerMode === 'editar-comportamento' ? 'Editar comportamento'
          : workloadDrawerMode === 'editar-atividade' ? 'Editar atividade'
            : ''
  const workloadDrawerPrimaryLabel =
    workloadDrawerMode === 'novo-comportamento' ? 'Salvar comportamento'
      : workloadDrawerMode === 'nova-atividade' ? 'Salvar atividade'
        : 'Salvar alterações'

  /** Só trata como fluxo "+ Novo tipo" quando o contexto bate com a tela atual (evita estado obsoleto de outra ação / drawer). */
  const multTipoCtxId = esteiraEdicaoIds?.docId || acaoIdEdit
  const emFluxoNovoTipoMult =
    (workloadDrawerMode === 'nova-atividade' && novoMultTipoContext === 'add' && adicionando?.tipo === 'tarefa' && adicionando.tarefaId) ||
    (workloadDrawerMode === 'editar-atividade' && !!multTipoCtxId && novoMultTipoContext === multTipoCtxId)

  const multSelectValorTipo = emFluxoNovoTipoMult ? '__novo__' : (valorEditMultiplicadorTipo || '')

  const showNovoMultTipoDrawer = isAdmin && emFluxoNovoTipoMult && !migracaoMultiplicadorTipos

  function fecharWorkloadDrawer() {
    cancelarNovoMultTipoWorkload()
    setAdicionando(null)
    setEditando(null)
    setWorkloadNovoAtividadeTipo(null)
    setEsteiraEdicaoIds(null)
    setValorEditTempoMod('0')
    setValorEditUnidadeMod('horas')
    setValorEditRecorrenciaMod('unica')
    setValorEditTempoDoc('0')
    setValorEditUnidadeDoc('horas')
    setValorEditRecorrenciaDoc('unica')
  }

  function handleWorkloadDrawerSubmit(e) {
    e.preventDefault()
    if (
      showNovoMultTipoDrawer &&
      (workloadDrawerMode === 'nova-atividade' || workloadDrawerMode === 'editar-atividade')
    ) {
      setError('Conclua o cadastro do novo tipo (Salvar tipo ou Cancelar) antes de salvar a atividade.')
      return
    }
    if (workloadDrawerMode === 'novo-comportamento') {
      salvarComportamento(defaultMetaParaNovoComportamento, valorEdit)
      return
    }
    if (workloadDrawerMode === 'nova-atividade') {
      const tid = adicionando?.tarefaId
      if (!tid) return
      if (isAreaTipoAtividadeProjeto && workloadNovoAtividadeTipo == null) {
        setError('Selecione Atividade Comum ou Atividade Esteira.')
        return
      }
      if (isAreaTipoAtividadeProjeto && workloadNovoAtividadeTipo === 'esteira') {
        void salvarAtividadeEsteiraPar(tid)
        return
      }
      salvarTarefa(tid, valorEdit, valorEditTempo, valorEditUnidade, valorEditCaneta, valorEditRecorrencia, valorEditMultiplicadorValor, valorEditMultiplicadorTipo, null)
      return
    }
    if (workloadDrawerMode === 'editar-comportamento' && compIdEdit) {
      atualizarComportamento(compIdEdit, valorEdit)
      return
    }
    if (workloadDrawerMode === 'editar-atividade' && acaoIdEdit) {
      cancelarNovoMultTipoWorkload()
      if (esteiraEdicaoIds?.modId && esteiraEdicaoIds?.docId) {
        void atualizarAtividadeEsteiraPar()
        return
      }
      let tipoParaUpdate = null
      if (isAreaTipoAtividadeProjeto) {
        let acEd = null
        let todasEd = []
        for (const t of tarefas) {
          const a = (t.acoes || []).find(x => x.id === acaoIdEdit)
          if (a) {
            acEd = a
            todasEd = t.acoes || []
            break
          }
        }
        if (acEd && (acEd.tipo_atividade === 'modelagem' || acEd.tipo_atividade === 'documentacao')) {
          const parEd = resolverParEsteira(acEd, todasEd)
          if (!parEd) tipoParaUpdate = acEd.tipo_atividade
        }
      }
      void atualizarTarefa(acaoIdEdit, valorEdit, valorEditTempo, valorEditUnidade, valorEditCaneta, valorEditRecorrencia, valorEditMultiplicadorValor, valorEditMultiplicadorTipo, tipoParaUpdate)
    }
  }

  function tempoTotalMinutos(comp) {
    return (comp.acoes || []).reduce((s, a) => s + (a.tempo_estimado_minutos || 0), 0)
  }
  return (
    <>
      <header className="workload-header">
        <div>
          <h1>Comportamentos e Atividades</h1>
          <p className="workload-subtitle">Cadastre comportamentos e atividades do dia a dia (recorrentes ou pontuais), incluindo sua carga horária.</p>
        </div>
        <div className="workload-area-row">
          {areas.length > 0 && (
            <div className="workload-area-field">
              <label className="workload-area-field-label">Área</label>
              <select
                value={areaId}
                onChange={e => {
                  const v = e.target.value
                  setAreaId(v)
                  if (v) mergeSetAreaUrl(router, pathname, searchParams, v)
                }}
                aria-label="Área"
              >
                {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
          )}
          {areaId && (
            <button
              type="button"
              className="workload-add-comp-btn"
              onClick={() => {
                setAdicionando({ tipo: 'comportamento' })
                setValorEdit('')
              }}
            >
              + Comportamento
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          className={`alert ${(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? 'alert-warning' : 'alert-error'}`}
          style={(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? { cursor: 'pointer' } : undefined}
          role={(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? 'button' : undefined}
          tabIndex={(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? 0 : undefined}
          onClick={(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? () => {
            const parts = []
            if (migracaoObjetivoId) parts.push(SQL_OBJETIVO_ID)
            if (migracaoCanetaVerde) parts.push(SQL_CANETA_VERDE, SQL_ACOES_RECORRENCIA)
            if (migracaoIndicadores) parts.push(SQL_INDICADORES, SQL_INDICADORES_REGRA)
            if (migracaoMultiplicadorCheck) parts.push(SQL_MULTIPLICADOR_CHECK)
            if (migracaoTipoAtividade || migracaoEsteiraPar) parts.push(SQL_TIPO_ATIVIDADE)
            const sql = parts.join('\n\n')
            navigator.clipboard?.writeText(sql).then(() => {
              window.alert('SQL copiado! Cole no Supabase (SQL Editor) e execute. Depois recarregue a página.')
            }).catch(() => {})
          } : undefined}
          onKeyDown={(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? (e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() } : undefined}
        >
          {(migracaoObjetivoId || migracaoCanetaVerde || migracaoIndicadores || migracaoMultiplicadorCheck || migracaoTipoAtividade || migracaoEsteiraPar) ? (
            <>⚠️ {error} <span style={{ textDecoration: 'underline', marginLeft: '0.5rem' }}>Clique para copiar o SQL</span></>
          ) : (
            error
          )}
        </div>
      )}

      {migracaoMultiplicadorTipos && (
        <div
          className="alert alert-warning"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer', margin: '0 1rem 1rem' }}
          onClick={() => {
            navigator.clipboard?.writeText(SQL_MULTIPLICADOR_TIPOS).then(() => {
              window.alert('SQL copiado! Abra o Supabase → SQL Editor, cole e clique em Run. Depois recarregue esta página (F5).')
            }).catch(() => {})
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }}
        >
          ⚠️ A tabela <strong>multiplicador_tipos</strong> ainda não existe neste projeto Supabase — por isso novos tipos (ex.: AAA, Perfil) não são salvos nem aparecem no menu.{' '}
          <span style={{ textDecoration: 'underline' }}>Clique aqui para copiar o SQL de criação</span> e execute no SQL Editor; em seguida recarregue a página.
        </div>
      )}

      {!areaId ? null : loading ? (
        <p>Carregando…</p>
      ) : (
        <div className="workload-hierarquia">
          <ul className="workload-cards" aria-label="Comportamentos">
            {comportamentosOrdenados.map((comp) => {
              const acoes = comp.acoes || []
              const partPl = isAreaTipoAtividadeProjeto ? particionarAcoesProjetoEsteiraSeguro(acoes) : null
              const contagemListaPl = partPl ? partPl.esteiras.length + partPl.comuns.length : acoes.length
              const acoesTabelaComuns = isAreaTipoAtividadeProjeto && partPl ? partPl.comuns : acoes
              const tabelaComunsSemToggleTopo =
                Boolean(isAreaTipoAtividadeProjeto && partPl && partPl.esteiras.length > 0 && partPl.comuns.length > 0)
              const totalMin = tempoTotalMinutos(comp)
              const atividadesAbertas = estaExpandido('ativ', comp.id)
              return (
                <li key={comp.id} className="workload-card" data-workload-comp-id={comp.id}>
                  <header className="workload-card-header">
                    <div className="workload-card-header-left">
                      <span className="workload-card-emoji" aria-hidden>{emojiParaComportamento(comp.nome)}</span>
                      <span className="workload-card-title">{comp.nome}</span>
                    </div>
                    {editando !== `comp-${comp.id}` && (
                      <div className="workload-card-header-actions">
                        <button type="button" className="btn-icon" onClick={() => { setEditando(`comp-${comp.id}`); setValorEdit(comp.nome) }} title="Editar comportamento">✎</button>
                        <button type="button" className="btn-icon btn-danger" onClick={() => solicitarRemoverComportamento(comp.id)} title="Excluir comportamento">✕</button>
                      </div>
                    )}
                  </header>

                        <div className="workload-card-body">
                          <section className="workload-card-section">
                            <div className="workload-atividades-wrap">
                              {isAreaTipoAtividadeProjeto && partPl && partPl.esteiras.length > 0 ? (
                                <>
                                  <div className="workload-esteira-toolbar">
                                    <button
                                      type="button"
                                      className="workload-section-toggle workload-section-toggle-inline"
                                      onClick={() => toggle('ativ', comp.id)}
                                      aria-expanded={atividadesAbertas}
                                    >
                                      <span className="workload-section-chevron" aria-hidden>{atividadesAbertas ? '▾' : '▸'}</span>
                                      <span className="workload-section-title">Atividade</span>
                                    </button>
                                    <span className="workload-section-meta">{contagemListaPl} atividades · {formatarTempo(totalMin)}</span>
                                  </div>
                                  <table
                                    className="workload-atividades-table workload-atividades-table--esteira"
                                    role="table"
                                    aria-label="Atividades esteira"
                                  >
                                    <colgroup>
                                      <col />
                                      <col className="workload-col-esteira-mt" />
                                      <col className="workload-col-esteira-mr" />
                                      <col className="workload-col-esteira-dt" />
                                      <col className="workload-col-esteira-dr" />
                                      <col className="workload-col-esteira-can" />
                                      <col className="workload-col-esteira-ac" />
                                    </colgroup>
                                    <thead>
                                      <tr>
                                        <th scope="col" className="workload-th-atividade-plain workload-th-esteira">
                                          Atividade
                                        </th>
                                        <th scope="col" className="workload-th-tempo workload-th-esteira">
                                          Tempo mod.
                                        </th>
                                        <th scope="col" className="workload-th-recorrencia workload-th-esteira">
                                          Recorrência mod.
                                        </th>
                                        <th scope="col" className="workload-th-tempo workload-th-esteira">
                                          Tempo doc.
                                        </th>
                                        <th scope="col" className="workload-th-recorrencia workload-th-esteira">
                                          Recorrência doc.
                                        </th>
                                        <th scope="col" className="workload-th-caneta workload-th-esteira">
                                          Caneta verde
                                        </th>
                                        <th scope="col" className="workload-col-actions workload-th-acoes workload-th-esteira">
                                          Ações
                                        </th>
                                      </tr>
                                    </thead>
                                    {atividadesAbertas ? (
                                      <tbody className="workload-atividades-tbody">
                                        {partPl.esteiras.map((par) => (
                                          <tr key={par.mod.id} className="workload-atividade-row">
                                            <td data-label="Atividade">
                                              <span className="workload-atividade-nome">{nomeBaseAtividadeEsteira(par.mod.nome || '')}</span>
                                            </td>
                                            <td data-label="Tempo mod.">
                                              <span className={`workload-tempo-badge ${(par.mod.tempo_estimado_minutos || 0) >= 60 ? 'hours' : ''}`}>
                                                {formatarTempo(par.mod.tempo_estimado_minutos)}
                                              </span>
                                            </td>
                                            <td data-label="Recorrência mod." className="workload-td-esteira-rec">
                                              <div className="workload-atividade-meta workload-atividade-meta--esteira-rec">
                                                <span
                                                  className={`workload-tag workload-tag-recorrencia ${
                                                    par.mod.recorrencia ? `workload-tag-recorrencia-${par.mod.recorrencia}` : ''
                                                  }`}
                                                >
                                                  {par.mod.recorrencia
                                                    ? (recorrenciasAtividade.find(r => r.codigo === par.mod.recorrencia)?.descricao || par.mod.recorrencia)
                                                    : '—'}
                                                </span>
                                              </div>
                                            </td>
                                            <td data-label="Tempo doc.">
                                              <span className={`workload-tempo-badge ${(par.doc.tempo_estimado_minutos || 0) >= 60 ? 'hours' : ''}`}>
                                                {formatarTempo(par.doc.tempo_estimado_minutos)}
                                              </span>
                                            </td>
                                            <td data-label="Recorrência doc." className="workload-td-esteira-rec">
                                              <div className="workload-atividade-meta workload-atividade-meta--esteira-rec">
                                                <span
                                                  className={`workload-tag workload-tag-recorrencia ${
                                                    par.doc.recorrencia ? `workload-tag-recorrencia-${par.doc.recorrencia}` : ''
                                                  }`}
                                                >
                                                  {par.doc.recorrencia
                                                    ? (recorrenciasAtividade.find(r => r.codigo === par.doc.recorrencia)?.descricao || par.doc.recorrencia)
                                                    : '—'}
                                                </span>
                                              </div>
                                            </td>
                                            <td data-label="Caneta verde">
                                              <button
                                                type="button"
                                                className={`workload-caneta-badge ${canetaVerdeEstaAtiva(canetaLocal[par.doc.id] ?? par.doc.caneta_verde) ? 'on' : ''}`}
                                                onClick={() =>
                                                  setCanetaTarefa(
                                                    par.doc.id,
                                                    canetaVerdeEstaAtiva(canetaLocal[par.doc.id] ?? par.doc.caneta_verde) ? 'nao' : 'sim'
                                                  )
                                                }
                                                disabled={salvandoCanetaId === par.doc.id}
                                                title="Caneta verde: clique para alternar"
                                                aria-pressed={canetaVerdeEstaAtiva(canetaLocal[par.doc.id] ?? par.doc.caneta_verde)}
                                              >
                                                {canetaVerdeEstaAtiva(canetaLocal[par.doc.id] ?? par.doc.caneta_verde) ? 'Sim' : 'Não'}
                                              </button>
                                            </td>
                                            <td data-label="Ações" className="workload-col-actions">
                                              <div className="workload-task-actions">
                                                <button
                                                  type="button"
                                                  className="btn-icon"
                                                  onClick={() => {
                                                    cancelarNovoMultTipoWorkload()
                                                    setWorkloadNovoAtividadeTipo('esteira')
                                                    setEsteiraEdicaoIds({ modId: par.mod.id, docId: par.doc.id })
                                                    setEditando(`tarefa-${par.mod.id}`)
                                                    setValorEdit(nomeBaseAtividadeEsteira(par.mod.nome || ''))
                                                    const vm = minutosParaValorEUnidade(par.mod.tempo_estimado_minutos)
                                                    setValorEditTempoMod(vm.valor === '' ? '' : String(Math.round(Number(vm.valor))))
                                                    setValorEditUnidadeMod(vm.unidade)
                                                    setValorEditRecorrenciaMod(par.mod.recorrencia || 'unica')
                                                    const vd = minutosParaValorEUnidade(par.doc.tempo_estimado_minutos)
                                                    setValorEditTempoDoc(vd.valor === '' ? '' : String(Math.round(Number(vd.valor))))
                                                    setValorEditUnidadeDoc(vd.unidade)
                                                    setValorEditRecorrenciaDoc(par.doc.recorrencia || 'unica')
                                                    setValorEditCaneta(canetaVerdeEstaAtiva(par.doc.caneta_verde) ? 'sim' : 'nao')
                                                    setValorEditMultiplicadorValor(par.doc.multiplicador_valor != null ? String(par.doc.multiplicador_valor) : '')
                                                    setValorEditMultiplicadorTipo(par.doc.multiplicador_tipo || '')
                                                  }}
                                                  title="Editar atividade esteira"
                                                >
                                                  ✎
                                                </button>
                                                <button
                                                  type="button"
                                                  className="btn-icon btn-danger"
                                                  onClick={() => solicitarRemoverAtividade(par.mod.id)}
                                                  title="Excluir atividade esteira"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                        {(!adicionando || adicionando.tarefaId !== comp.id) && partPl.comuns.length === 0 ? (
                                          <tr className="workload-atividade-add-link-row">
                                            <td colSpan={7} className="workload-atividade-add-link-cell">
                                              <button
                                                type="button"
                                                className="workload-add-task-link"
                                                onClick={() => {
                                                  cancelarNovoMultTipoWorkload()
                                                  setEsteiraEdicaoIds(null)
                                                  setAdicionando({ tipo: 'tarefa', tarefaId: comp.id })
                                                  setValorEdit('')
                                                  setValorEditTempo('0')
                                                  setValorEditUnidade('horas')
                                                  setValorEditCaneta('nao')
                                                  setValorEditRecorrencia('unica')
                                                  setValorEditMultiplicadorValor('')
                                                  setValorEditMultiplicadorTipo('')
                                                  setWorkloadNovoAtividadeTipo(null)
                                                }}
                                              >
                                                + Adicionar atividade
                                              </button>
                                            </td>
                                          </tr>
                                        ) : null}
                                      </tbody>
                                    ) : null}
                                  </table>
                                </>
                              ) : null}
                              {isAreaTipoAtividadeProjeto && partPl && partPl.esteiras.length > 0 && partPl.comuns.length > 0 ? (
                                <div className="workload-atividades-mix-divider" role="separator" aria-hidden />
                              ) : null}
                              {(!isAreaTipoAtividadeProjeto || !partPl || partPl.comuns.length > 0 || (partPl.esteiras.length === 0 && partPl.comuns.length === 0)) ? (
                                <table
                                  className="workload-atividades-table workload-atividades-table--comportamento-atividades"
                                  role="table"
                                >
                                  <colgroup>
                                    <col className="workload-col-atividade" />
                                    {isAreaTipoAtividadeProjeto ? <col className="workload-col-tipo" /> : null}
                                    <col className="workload-col-tempo" />
                                    <col className="workload-col-caneta" />
                                    <col className="workload-col-recorrencia" />
                                    <col className="workload-col-mult" />
                                    <col className="workload-col-acoes" />
                                  </colgroup>
                                  <thead>
                                    {tabelaComunsSemToggleTopo ? (
                                      <tr>
                                        <th scope="col" className="workload-th-atividade-plain">Atividade</th>
                                        {isAreaTipoAtividadeProjeto ? (
                                          <th scope="col" className="workload-th-tipo">Tipo</th>
                                        ) : null}
                                        <th scope="col" className="workload-th-tempo">Tempo</th>
                                        <th scope="col" className="workload-th-caneta">Caneta verde</th>
                                        <th scope="col" className="workload-th-recorrencia">Recorrência</th>
                                        <th scope="col" className="workload-th-mult">
                                          <div className="workload-mult-col-stack">
                                            <span className="workload-th-mult-inner">Multiplicador</span>
                                            <span className="workload-th-mult-sub">valor · descrição</span>
                                          </div>
                                        </th>
                                        <th scope="col" className="workload-col-actions workload-th-acoes">Ações</th>
                                      </tr>
                                    ) : (
                                      <tr>
                                        <th scope="col" className="workload-th-atividade-toggle">
                                          <div className="workload-th-atividade-head">
                                            <button
                                              type="button"
                                              className="workload-section-toggle workload-section-toggle-inline"
                                              onClick={() => toggle('ativ', comp.id)}
                                              aria-expanded={atividadesAbertas}
                                            >
                                              <span className="workload-section-chevron" aria-hidden>{atividadesAbertas ? '▾' : '▸'}</span>
                                              <span className="workload-section-title">Atividade</span>
                                            </button>
                                            <span className="workload-section-meta">{contagemListaPl} atividades · {formatarTempo(totalMin)}</span>
                                          </div>
                                        </th>
                                        {isAreaTipoAtividadeProjeto ? (
                                          <th scope="col" className="workload-th-tipo">Tipo</th>
                                        ) : null}
                                        <th scope="col" className="workload-th-tempo">Tempo</th>
                                        <th scope="col" className="workload-th-caneta">Caneta verde</th>
                                        <th scope="col" className="workload-th-recorrencia">Recorrência</th>
                                        <th scope="col" className="workload-th-mult">
                                          <div className="workload-mult-col-stack">
                                            <span className="workload-th-mult-inner">Multiplicador</span>
                                            <span className="workload-th-mult-sub">valor · descrição</span>
                                          </div>
                                        </th>
                                        <th scope="col" className="workload-col-actions workload-th-acoes">Ações</th>
                                      </tr>
                                    )}
                                  </thead>
                                  {atividadesAbertas && (
                                  <tbody className="workload-atividades-tbody">
                              {acoesTabelaComuns.map((acao) => (
                                <tr key={acao.id} className="workload-atividade-row">
                                      <td data-label="Atividade">
                                        <span className="workload-atividade-nome">{acao.nome}</span>
                                      </td>
                                      {isAreaTipoAtividadeProjeto ? (
                                        <td data-label="Tipo" className="workload-td-tipo">
                                          {acao.tipo_atividade === 'modelagem' ? (
                                            <span className="workload-col-tipo-tag workload-col-tipo-tag--modelagem" title="Modelagem">
                                              Modelagem
                                            </span>
                                          ) : acao.tipo_atividade === 'documentacao' ? (
                                            <span className="workload-col-tipo-tag workload-col-tipo-tag--documentacao" title="Documentação">
                                              Documentação
                                            </span>
                                          ) : (
                                            <span className="workload-col-tipo-dash">—</span>
                                          )}
                                        </td>
                                      ) : null}
                                      <td data-label="Tempo">
                                        <span className={`workload-tempo-badge ${(acao.tempo_estimado_minutos || 0) >= 60 ? 'hours' : ''}`}>
                                          {formatarTempo(acao.tempo_estimado_minutos)}
                                        </span>
                                      </td>
                                      <td data-label="Caneta verde">
                                        <button
                                          type="button"
                                          className={`workload-caneta-badge ${canetaVerdeEstaAtiva(canetaLocal[acao.id] ?? acao.caneta_verde) ? 'on' : ''}`}
                                          onClick={() =>
                                            setCanetaTarefa(
                                              acao.id,
                                              canetaVerdeEstaAtiva(canetaLocal[acao.id] ?? acao.caneta_verde) ? 'nao' : 'sim'
                                            )
                                          }
                                          disabled={salvandoCanetaId === acao.id}
                                          title="Caneta verde: clique para alternar"
                                          aria-pressed={canetaVerdeEstaAtiva(canetaLocal[acao.id] ?? acao.caneta_verde)}
                                        >
                                          {canetaVerdeEstaAtiva(canetaLocal[acao.id] ?? acao.caneta_verde) ? 'Sim' : 'Não'}
                                        </button>
                                      </td>
                                      <td data-label="Recorrência">
                                        <div className="workload-atividade-meta workload-atividade-meta--nowrap">
                                          <span
                                            className={`workload-tag workload-tag-recorrencia ${
                                              acao.recorrencia ? `workload-tag-recorrencia-${acao.recorrencia}` : ''
                                            }`}
                                          >
                                            {acao.recorrencia
                                              ? (recorrenciasAtividade.find(r => r.codigo === acao.recorrencia)?.descricao || acao.recorrencia)
                                              : '—'}
                                          </span>
                                        </div>
                                      </td>
                                      <td data-label="Multiplicador">
                                        <div className="workload-mult-col-cell">
                                          <div className="workload-atividade-meta workload-atividade-meta--mult">
                                            {(() => {
                                              const hasValor =
                                                acao.multiplicador_valor != null && !Number.isNaN(Number(acao.multiplicador_valor))
                                              const desc = descricaoTipoMultiplicador(acao.multiplicador_tipo, multiplicadorTipos)
                                              const hasTipo = Boolean(desc)
                                              if (!hasValor && !hasTipo) {
                                                return (
                                                  <span className="workload-mult-circulo workload-mult-circulo--vazio">—</span>
                                                )
                                              }
                                              return (
                                                <div className="workload-mult-display">
                                                  {hasValor ? (
                                                    <span className="workload-mult-valor">×{acao.multiplicador_valor}</span>
                                                  ) : null}
                                                  {hasTipo ? (
                                                    <span className="workload-mult-desc">{desc}</span>
                                                  ) : null}
                                                </div>
                                              )
                                            })()}
                                          </div>
                                        </div>
                                      </td>
                                      <td data-label="Ações" className="workload-col-actions">
                                        <div className="workload-task-actions">
                                          <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={() => {
                                              cancelarNovoMultTipoWorkload()
                                              const parCtx = isAreaTipoAtividadeProjeto ? resolverParEsteira(acao, ordenarAcoesLista(acoes)) : null
                                              if (parCtx?.mod && parCtx?.doc) {
                                                setWorkloadNovoAtividadeTipo('esteira')
                                                setEsteiraEdicaoIds({ modId: parCtx.mod.id, docId: parCtx.doc.id })
                                                setEditando(`tarefa-${parCtx.mod.id}`)
                                                setValorEdit(nomeBaseAtividadeEsteira(parCtx.mod.nome || ''))
                                                const vm = minutosParaValorEUnidade(parCtx.mod.tempo_estimado_minutos)
                                                setValorEditTempoMod(vm.valor === '' ? '' : String(Math.round(Number(vm.valor))))
                                                setValorEditUnidadeMod(vm.unidade)
                                                setValorEditRecorrenciaMod(parCtx.mod.recorrencia || 'unica')
                                                const vd = minutosParaValorEUnidade(parCtx.doc.tempo_estimado_minutos)
                                                setValorEditTempoDoc(vd.valor === '' ? '' : String(Math.round(Number(vd.valor))))
                                                setValorEditUnidadeDoc(vd.unidade)
                                                setValorEditRecorrenciaDoc(parCtx.doc.recorrencia || 'unica')
                                                setValorEditCaneta(canetaVerdeEstaAtiva(parCtx.doc.caneta_verde) ? 'sim' : 'nao')
                                                setValorEditMultiplicadorValor(parCtx.doc.multiplicador_valor != null ? String(parCtx.doc.multiplicador_valor) : '')
                                                setValorEditMultiplicadorTipo(parCtx.doc.multiplicador_tipo || '')
                                                return
                                              }
                                              setWorkloadNovoAtividadeTipo(isAreaTipoAtividadeProjeto ? 'comum' : null)
                                              setEsteiraEdicaoIds(null)
                                              const { valor, unidade } = minutosParaValorEUnidade(acao.tempo_estimado_minutos)
                                              setEditando(`tarefa-${acao.id}`)
                                              setValorEdit(acao.nome)
                                              setValorEditTempo(valor === '' ? '' : String(Math.round(Number(valor))))
                                              setValorEditUnidade(unidade)
                                              setValorEditCaneta(canetaVerdeEstaAtiva(acao.caneta_verde) ? 'sim' : 'nao')
                                              setValorEditRecorrencia(acao.recorrencia || 'unica')
                                              setValorEditMultiplicadorValor(acao.multiplicador_valor != null ? String(acao.multiplicador_valor) : '')
                                              setValorEditMultiplicadorTipo(acao.multiplicador_tipo || '')
                                            }}
                                            title="Editar atividade"
                                          >
                                            ✎
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-icon btn-danger"
                                            onClick={() => solicitarRemoverAtividade(acao.id)}
                                            title="Excluir atividade"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </td>
                                </tr>
                              ))}
                              {(!adicionando || adicionando.tarefaId !== comp.id) && (
                                <tr className="workload-atividade-add-link-row">
                                  <td colSpan={isAreaTipoAtividadeProjeto ? 7 : 6} className="workload-atividade-add-link-cell">
                                    <button
                                      type="button"
                                      className="workload-add-task-link"
                                      onClick={() => {
                                        cancelarNovoMultTipoWorkload()
                                        setEsteiraEdicaoIds(null)
                                        setAdicionando({ tipo: 'tarefa', tarefaId: comp.id });
                                        setValorEdit('');
                                        setValorEditTempo('0');
                                        setValorEditUnidade('horas');
                                        setValorEditCaneta('nao');
                                        setValorEditRecorrencia('unica');
                                        setValorEditMultiplicadorValor('');
                                        setValorEditMultiplicadorTipo('');
                                        setWorkloadNovoAtividadeTipo(null)
                                      }}
                                    >
                                      + Adicionar atividade
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                                  )}
                                </table>
                              ) : null}
                              </div>
                          </section>
                        </div>
                </li>
              )
            })}
          </ul>

          {areaId && comportamentosOrdenados.length === 0 && !adicionando && (
            <p style={{ textAlign: 'center', color: 'var(--moni-texto-suave)', marginTop: '2rem' }}>
              Nenhum comportamento nesta área. Use &quot;+ Comportamento&quot; para começar.
            </p>
          )}
        </div>
      )}

      <WorkloadFormDrawer
        open={workloadDrawerAberto}
        title={workloadDrawerTitle}
        onClose={fecharWorkloadDrawer}
        footer={(
          <>
            <button type="button" className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--cancel" onClick={fecharWorkloadDrawer}>
              Cancelar
            </button>
            <button
              type="submit"
              form="workload-drawer-form"
              className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--save"
              disabled={
                workloadDrawerMode === 'nova-atividade' &&
                isAreaTipoAtividadeProjeto &&
                workloadNovoAtividadeTipo == null
              }
            >
              {workloadDrawerPrimaryLabel}
            </button>
          </>
        )}
      >
        <>
        <form id="workload-drawer-form" onSubmit={handleWorkloadDrawerSubmit} className="workload-drawer-form-inner">
          {(workloadDrawerMode === 'novo-comportamento' || workloadDrawerMode === 'editar-comportamento') && (
            <>
              <div className="workload-drawer-field">
                <label className="workload-drawer-label" htmlFor="workload-wd-comp-nome">Nome do comportamento</label>
                <input
                  id="workload-wd-comp-nome"
                  className="workload-drawer-control"
                  value={valorEdit}
                  onChange={e => setValorEdit(e.target.value)}
                  required={workloadDrawerMode === 'novo-comportamento'}
                  autoComplete="off"
                />
              </div>
              <div className="workload-drawer-field">
                <label className="workload-drawer-label" htmlFor="workload-wd-comp-area">Área</label>
                <select
                  id="workload-wd-comp-area"
                  className="workload-drawer-control"
                  value={workloadDrawerMode === 'editar-comportamento' ? (compForEdit?.area_id || '') : areaId}
                  onChange={e => {
                    if (workloadDrawerMode === 'editar-comportamento') return
                    const v = e.target.value
                    setAreaId(v)
                    if (v) mergeSetAreaUrl(router, pathname, searchParams, v)
                  }}
                  disabled={workloadDrawerMode === 'editar-comportamento'}
                >
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            </>
          )}
          {(workloadDrawerMode === 'nova-atividade' || workloadDrawerMode === 'editar-atividade') && (
            <>
              {isAreaTipoAtividadeProjeto && workloadDrawerMode === 'nova-atividade' && (
                <div className="workload-drawer-field workload-drawer-field--full" role="radiogroup" aria-label="Tipo de atividade">
                  <span className="workload-drawer-label">Tipo de atividade</span>
                  <div className="workload-escolha-atividade-row">
                    <label
                      className={`workload-escolha-atividade-card${workloadNovoAtividadeTipo === 'comum' ? ' workload-escolha-atividade-card--comum-ativa' : ''}`}
                    >
                      <input
                        type="radio"
                        name="workload-tipo-atividade-novo"
                        checked={workloadNovoAtividadeTipo === 'comum'}
                        onChange={() => setWorkloadNovoAtividadeTipo('comum')}
                      />
                      <span className="workload-escolha-atividade-card-text">Atividade Comum</span>
                      <span className="workload-escolha-atividade-hint">Campos únicos, comportamento padrão</span>
                    </label>
                    <label
                      className={`workload-escolha-atividade-card${workloadNovoAtividadeTipo === 'esteira' ? ' workload-escolha-atividade-card--esteira-ativa' : ''}`}
                    >
                      <input
                        type="radio"
                        name="workload-tipo-atividade-novo"
                        checked={workloadNovoAtividadeTipo === 'esteira'}
                        onChange={() => setWorkloadNovoAtividadeTipo('esteira')}
                      />
                      <span className="workload-escolha-atividade-card-text">Atividade Esteira</span>
                      <span className="workload-escolha-atividade-hint">Modelagem + Documentação juntas</span>
                    </label>
                  </div>
                </div>
              )}
              {(!isAreaTipoAtividadeProjeto || workloadDrawerMode === 'editar-atividade' || workloadNovoAtividadeTipo != null) && (
                <>
                  <div className="workload-drawer-field workload-drawer-field--full">
                    <label className="workload-drawer-label" htmlFor="workload-wd-ac-nome">Nome da atividade</label>
                    <input
                      id="workload-wd-ac-nome"
                      className="workload-drawer-control"
                      value={valorEdit}
                      onChange={e => setValorEdit(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  {(!isAreaTipoAtividadeProjeto ||
                    workloadNovoAtividadeTipo === 'comum' ||
                    (workloadDrawerMode === 'editar-atividade' && !esteiraEdicaoIds)) && (
                    <>
                      <div className="workload-drawer-grid2">
                        <div className="workload-drawer-field">
                          <span className="workload-drawer-label" id="workload-wd-ac-tempo-label">Tempo</span>
                          <div className="workload-drawer-tempo-row" role="group" aria-labelledby="workload-wd-ac-tempo-label">
                            <input
                              type="number"
                              className="workload-drawer-control"
                              min={0}
                              step="any"
                              value={valorEditTempo}
                              onChange={e => setValorEditTempo(e.target.value)}
                            />
                            <select
                              className="workload-drawer-control workload-drawer-tempo-unidade"
                              value={valorEditUnidade}
                              onChange={e => setValorEditUnidade(e.target.value)}
                              aria-label="Unidade de tempo"
                            >
                              {UNIDADE_TEMPO.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="workload-drawer-field">
                          <label className="workload-drawer-label" htmlFor="workload-wd-ac-caneta">Caneta verde</label>
                          <select
                            id="workload-wd-ac-caneta"
                            className="workload-drawer-control"
                            value={valorEditCaneta}
                            onChange={e => setValorEditCaneta(e.target.value)}
                          >
                            {CANETA_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="workload-drawer-grid2">
                        <div className="workload-drawer-field">
                          <label className="workload-drawer-label" htmlFor="workload-wd-ac-rec">Recorrência</label>
                          <select
                            id="workload-wd-ac-rec"
                            className="workload-drawer-control"
                            value={valorEditRecorrencia}
                            onChange={e => setValorEditRecorrencia(e.target.value)}
                          >
                            {recorrenciasAtividade.map(r => (
                              <option key={r.codigo} value={r.codigo}>{r.descricao}</option>
                            ))}
                          </select>
                        </div>
                        <div className="workload-drawer-field">
                          <span className="workload-drawer-label" id="workload-wd-ac-mult-label">Multiplicador</span>
                          <div className="workload-drawer-mult-row" role="group" aria-labelledby="workload-wd-ac-mult-label">
                            <input
                              type="number"
                              className="workload-drawer-control"
                              min={0}
                              step="any"
                              value={valorEditMultiplicadorValor}
                              onChange={e => setValorEditMultiplicadorValor(e.target.value)}
                            />
                            <select
                              className="workload-drawer-control"
                              key={`mult-tipos-${multiplicadorTipos.map(m => m.value).sort().join('|')}`}
                              value={multSelectValorTipo}
                              onChange={e => onMultTipoSelectChange(e, workloadDrawerMode === 'nova-atividade' ? 'add' : multTipoCtxId)}
                              aria-label="Tipo de multiplicador"
                            >
                              <option value="">—</option>
                              {multiplicadorTipos.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                              {isAdmin && !migracaoMultiplicadorTipos && <option value="__novo__">+ Novo tipo…</option>}
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {((isAreaTipoAtividadeProjeto && workloadNovoAtividadeTipo === 'esteira') || Boolean(esteiraEdicaoIds)) && (
                    <>
                      <div className="workload-drawer-esteira-bloco workload-drawer-esteira-bloco--mod">
                        <div className="workload-drawer-esteira-bloco-label">Modelagem</div>
                        <div className="workload-drawer-grid2">
                          <div className="workload-drawer-field">
                            <span className="workload-drawer-label" id="workload-wd-mod-tempo-label">Tempo</span>
                            <div className="workload-drawer-tempo-row" role="group" aria-labelledby="workload-wd-mod-tempo-label">
                              <input
                                type="number"
                                className="workload-drawer-control"
                                min={0}
                                step="any"
                                value={valorEditTempoMod}
                                onChange={e => setValorEditTempoMod(e.target.value)}
                              />
                              <select
                                className="workload-drawer-control workload-drawer-tempo-unidade"
                                value={valorEditUnidadeMod}
                                onChange={e => setValorEditUnidadeMod(e.target.value)}
                                aria-label="Unidade de tempo modelagem"
                              >
                                {UNIDADE_TEMPO.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="workload-drawer-field">
                            <label className="workload-drawer-label" htmlFor="workload-wd-mod-rec">Recorrência</label>
                            <select
                              id="workload-wd-mod-rec"
                              className="workload-drawer-control"
                              value={valorEditRecorrenciaMod}
                              onChange={e => setValorEditRecorrenciaMod(e.target.value)}
                            >
                              {recorrenciasAtividade.map(r => (
                                <option key={r.codigo} value={r.codigo}>{r.descricao}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="workload-drawer-esteira-bloco workload-drawer-esteira-bloco--doc">
                        <div className="workload-drawer-esteira-bloco-label">Documentação</div>
                        <div className="workload-drawer-grid2">
                          <div className="workload-drawer-field">
                            <span className="workload-drawer-label" id="workload-wd-doc-tempo-label">Tempo</span>
                            <div className="workload-drawer-tempo-row" role="group" aria-labelledby="workload-wd-doc-tempo-label">
                              <input
                                type="number"
                                className="workload-drawer-control"
                                min={0}
                                step="any"
                                value={valorEditTempoDoc}
                                onChange={e => setValorEditTempoDoc(e.target.value)}
                              />
                              <select
                                className="workload-drawer-control workload-drawer-tempo-unidade"
                                value={valorEditUnidadeDoc}
                                onChange={e => setValorEditUnidadeDoc(e.target.value)}
                                aria-label="Unidade de tempo documentação"
                              >
                                {UNIDADE_TEMPO.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="workload-drawer-field">
                            <label className="workload-drawer-label" htmlFor="workload-wd-doc-rec">Recorrência</label>
                            <select
                              id="workload-wd-doc-rec"
                              className="workload-drawer-control"
                              value={valorEditRecorrenciaDoc}
                              onChange={e => setValorEditRecorrenciaDoc(e.target.value)}
                            >
                              {recorrenciasAtividade.map(r => (
                                <option key={r.codigo} value={r.codigo}>{r.descricao}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="workload-drawer-grid2">
                        <div className="workload-drawer-field">
                          <label className="workload-drawer-label" htmlFor="workload-wd-est-caneta">Caneta verde</label>
                          <select
                            id="workload-wd-est-caneta"
                            className="workload-drawer-control"
                            value={valorEditCaneta}
                            onChange={e => setValorEditCaneta(e.target.value)}
                          >
                            {CANETA_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="workload-drawer-field">
                          <span className="workload-drawer-label" id="workload-wd-est-mult-label">Multiplicador</span>
                          <div className="workload-drawer-mult-row" role="group" aria-labelledby="workload-wd-est-mult-label">
                            <input
                              type="number"
                              className="workload-drawer-control"
                              min={0}
                              step="any"
                              value={valorEditMultiplicadorValor}
                              onChange={e => setValorEditMultiplicadorValor(e.target.value)}
                            />
                            <select
                              className="workload-drawer-control"
                              key={`mult-tipos-est-${multiplicadorTipos.map(m => m.value).sort().join('|')}`}
                              value={multSelectValorTipo}
                              onChange={e => onMultTipoSelectChange(e, workloadDrawerMode === 'nova-atividade' ? 'add' : multTipoCtxId)}
                              aria-label="Tipo de multiplicador"
                            >
                              <option value="">—</option>
                              {multiplicadorTipos.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                              {isAdmin && !migracaoMultiplicadorTipos && <option value="__novo__">+ Novo tipo…</option>}
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </form>
        {(workloadDrawerMode === 'nova-atividade' || workloadDrawerMode === 'editar-atividade') && showNovoMultTipoDrawer && (
          <div className="workload-novo-mult-tipo">
            <input
              type="text"
              value={novoMultTipoDescricao}
              onChange={e => setNovoMultTipoDescricao(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                e.stopPropagation()
                void salvarNovoMultTipoWorkload()
              }}
              placeholder="Descrição do novo tipo"
              aria-label="Descrição do novo tipo de multiplicador"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                void salvarNovoMultTipoWorkload()
              }}
              disabled={novoMultTipoSalvando}
            >
              {novoMultTipoSalvando ? 'Salvando…' : 'Salvar tipo'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                cancelarNovoMultTipoWorkload()
              }}
            >
              Cancelar
            </button>
          </div>
        )}
        </>
      </WorkloadFormDrawer>

      {metaModalAberto && (
        <div
          className="meta-modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) fecharMetaModal() }}
        >
          <div
            className="meta-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meta-modal-title"
          >
            <div className="meta-modal-header">
              <div>
                <div id="meta-modal-title" className="meta-modal-title">{metaEdicaoId ? 'EDITAR META' : 'DEFINIR META'}</div>
              </div>
              <button type="button" className="meta-modal-close" onClick={fecharMetaModal} aria-label="Fechar">✕</button>
            </div>

    <div className="meta-modal-body">
              <div className="meta-form-group">
                <label>Informe a Meta</label>
                <textarea
                  ref={metaDescRef}
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  placeholder="Ex.: 5 NOVOS FRANKS MÊS"
                  rows={3}
                  required
                />
              </div>

              <div className="meta-form-group">
                <MetaCicloTipoFields
                  idPrefix="workload-meta-ciclo"
                  value={metaTipoCiclo}
                  onChange={setMetaTipoCiclo}
                />
              </div>

              <div className="meta-form-group">
                <label>Prazo para conclusão da Meta</label>
                <select
                  value={metaPrazoAno}
                  onChange={(e) => {
                    const v = e.target.value
                    setMetaPrazoAno(v)
                    // Limpa o período atual até recalcular via seleção/efeito.
                    setMetaPrazoSemana('')
                    setMetaPeriodoFimId(null)
                    setMetaPeriodoLabel('')
                    setMetaInicio('')
                    setMetaFim('')
                    setMetaErroForm('')
                  }}
                >
                  {(anosPrazoRender || []).map(a => (
                    <option key={a} value={String(a)}>{a}</option>
                  ))}
                </select>

                <CalendarioComSemanas
                  ano={metaPrazoAno ? Number(metaPrazoAno) : Number(ano)}
                  mesInicial={metaPrazoMes ? Math.max(0, Math.min(11, Number(metaPrazoMes) - 1)) : new Date().getMonth()}
                  selectedSemanaNum={metaPrazoSemana ? Number(metaPrazoSemana) : null}
                  onSelectSemanaNumero={(semanaNumero) => {
                    const str = String(semanaNumero)
                    setMetaPrazoSemana(str)
                    definirMetaPeriodoPorSemanaNumero(str)
                  }}
                />

                <div className="meta-prazo-selected-hint">
                  {metaPeriodoDerivando
                    ? 'Determinando período da semana…'
                    : metaPrazoSemana
                      ? `Prazo selecionado: S${metaPrazoSemana}`
                      : 'Selecione a semana no calendário.'}
                </div>
              </div>

              {metaErroForm && <div className="meta-form-error" role="alert">{metaErroForm}</div>}
            </div>

            <div className="meta-modal-footer">
              <button type="button" className="btn" onClick={fecharMetaModal} disabled={metaSalvando}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={salvarMetaNova}
                disabled={metaSalvando || metaPeriodoDerivando || !metaPrazoSemana || !isAdmin}
              >
                {metaSalvando ? 'Salvando…' : (metaEdicaoId ? 'Salvar alterações' : 'Salvar meta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {metaExcluirId && (
        <div
          className="meta-delete-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !metaExcluindo) setMetaExcluirId(null)
          }}
        >
          <div
            className="meta-delete-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meta-delete-title"
          >
            <div className="meta-delete-modal-header">
              <div id="meta-delete-title" className="meta-delete-modal-title">Excluir meta</div>
              <button
                type="button"
                className="meta-delete-modal-close"
                onClick={() => setMetaExcluirId(null)}
                aria-label="Fechar"
                disabled={metaExcluindo}
              >
                ✕
              </button>
            </div>
            <div className="meta-delete-modal-body">
              Tem certeza que deseja excluir esta meta?
            </div>
            <div className="meta-delete-modal-footer">
              <button type="button" className="btn" onClick={() => setMetaExcluirId(null)} disabled={metaExcluindo}>
                Cancelar
              </button>
              <button
                ref={metaExcluirConfirmRef}
                type="button"
                className="btn btn-danger"
                onClick={confirmarRemocaoMeta}
                disabled={metaExcluindo || !isAdmin}
              >
                {metaExcluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {semMetaAssociarAberto && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !semMetaProcessando) setSemMetaAssociarAberto(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sem-meta-associar-title">
            <div className="modal-header">
              <h2 id="sem-meta-associar-title">Associar comportamentos sem meta</h2>
              <button type="button" className="modal-close-btn" onClick={() => setSemMetaAssociarAberto(false)} disabled={semMetaProcessando} aria-label="Fechar">×</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Meta de destino</label>
                <select value={semMetaDestinoId} onChange={(e) => setSemMetaDestinoId(e.target.value)}>
                  <option value="">Selecione uma meta</option>
                  {objetivos.filter(m => m.id !== '_sem').map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setSemMetaAssociarAberto(false)} disabled={semMetaProcessando}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarAssociarSemMeta}
                disabled={semMetaProcessando || !semMetaDestinoId || !isAdmin}
              >
                {semMetaProcessando ? 'Salvando…' : 'Associar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {semMetaExcluirAberto && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !semMetaProcessando) setSemMetaExcluirAberto(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sem-meta-excluir-title">
            <div className="modal-header">
              <h2 id="sem-meta-excluir-title">Excluir comportamentos sem meta</h2>
              <button type="button" className="modal-close-btn" onClick={() => setSemMetaExcluirAberto(false)} disabled={semMetaProcessando} aria-label="Fechar">×</button>
            </div>
            <div className="modal-body">
              <p className="modal-hint">Tem certeza que deseja excluir todos os comportamentos que estão sem meta nesta área?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setSemMetaExcluirAberto(false)} disabled={semMetaProcessando}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={confirmarExcluirSemMeta} disabled={semMetaProcessando || !isAdmin}>
                {semMetaProcessando ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {comportamentoExcluirId && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !comportamentoExcluindo) setComportamentoExcluirId(null)
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comportamento-excluir-title"
            aria-describedby="comportamento-excluir-desc"
          >
            <div className="modal-header">
              <div>
                <h2 id="comportamento-excluir-title">Remover comportamento</h2>
                {nomeComportamentoExcluir ? (
                  <p className="modal-subtitle">{nomeComportamentoExcluir}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !comportamentoExcluindo && setComportamentoExcluirId(null)}
                disabled={comportamentoExcluindo}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p id="comportamento-excluir-desc" className="modal-hint" style={{ margin: 0 }}>
                Remover este comportamento e todas as tarefas?
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setComportamentoExcluirId(null)} disabled={comportamentoExcluindo}>
                Cancelar
              </button>
              <button
                ref={compExcluirConfirmRef}
                type="button"
                className="btn btn-danger"
                onClick={confirmarRemocaoComportamento}
                disabled={comportamentoExcluindo}
              >
                {comportamentoExcluindo ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {atividadeExcluirIds?.length ? (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !atividadeExcluindo) setAtividadeExcluirIds(null)
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="atividade-excluir-title"
            aria-describedby="atividade-excluir-desc"
          >
            <div className="modal-header">
              <div>
                <h2 id="atividade-excluir-title">
                  {atividadeExcluirIds.length > 1 ? 'Remover atividade esteira' : 'Remover atividade'}
                </h2>
                {nomeAtividadeExcluir ? (
                  <p className="modal-subtitle">{nomeAtividadeExcluir}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !atividadeExcluindo && setAtividadeExcluirIds(null)}
                disabled={atividadeExcluindo}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p id="atividade-excluir-desc" className="modal-hint" style={{ margin: 0 }}>
                {atividadeExcluirIds.length > 1
                  ? 'Serão removidas as duas linhas do par (modelagem e documentação). Deseja continuar?'
                  : 'Remover esta atividade?'}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setAtividadeExcluirIds(null)} disabled={atividadeExcluindo}>
                Cancelar
              </button>
              <button
                ref={atividadeExcluirConfirmRef}
                type="button"
                className="btn btn-danger"
                onClick={confirmarRemocaoAtividade}
                disabled={atividadeExcluindo}
              >
                {atividadeExcluindo ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </>
  )
}
