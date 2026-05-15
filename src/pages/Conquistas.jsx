import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { listarAreas } from '../utils/areasOrder'
import { parseSemanaMetaTexto } from '../utils/metaCiclo'
import {
  intervaloPresetConquistas,
  metaDentroDoIntervalo,
  indicadorConquistaDentroDoIntervalo,
  metaNoPrazo,
  deltaSemanasVsPrazo,
  formatarDataCurtaPt,
  dataEstimadaPrazoMeta,
  dataEstimadaConclusaoMeta
} from '../utils/conquistasData'
import { ConquistasHistoricoMensalChart, ConquistasPorAreaChart } from '../components/ConquistasCharts'

const PRESET_PERIODO = [
  { value: 'tudo', label: 'Todo o período' },
  { value: 'ultimos_6_meses', label: 'Últimos 6 meses' },
  { value: 'ano_atual', label: 'Ano atual' }
]

const TABS = [
  { id: 'todas', label: 'Todas' },
  { id: 'metas', label: 'Metas' },
  { id: 'indicadores', label: 'Indicadores' }
]

const PILLS = [
  { id: 'todos', label: 'Todos' },
  { id: 'no_prazo', label: 'No prazo' },
  { id: 'fora_prazo', label: 'Fora do prazo' },
  { id: 'recorrente', label: 'Recorrente' },
  { id: 'atingivel', label: 'Atingível' }
]

function isMetaRecorrente(m) {
  return String(m?.tipo || '').toLowerCase() !== 'atingivel'
}

function prazoOriginalLabelMeta(meta) {
  if (isMetaRecorrente(meta)) return 'Recorrente'
  const raw = String(meta?.meta_unidade || '').trim()
  if (!raw) return '—'
  const mx = raw.match(/^S\s*(\d+)/i)
  if (mx) return `S${mx[1]}`
  return raw
}

function anoRefPadrao() {
  return new Date().getFullYear()
}

function mesChave(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ultimos6MesesChaves() {
  const now = new Date()
  const keys = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(mesChave(d))
  }
  return keys
}

function ultimos6MesesLabelsPt() {
  const now = new Date()
  const labels = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(
      d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
    )
  }
  return labels
}

function normalizarMetas(rows) {
  const list = rows || []
  return list.slice().sort((a, b) => {
    const da = dataEstimadaConclusaoMeta(a, anoRefPadrao())?.getTime() ?? 0
    const db = dataEstimadaConclusaoMeta(b, anoRefPadrao())?.getTime() ?? 0
    return db - da
  })
}

export default function Conquistas() {
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState('')
  const [presetPeriodo, setPresetPeriodo] = useState('ultimos_6_meses')
  const [tab, setTab] = useState('todas')
  const [pill, setPill] = useState('todos')
  const [metas, setMetas] = useState([])
  const [indConquistas, setIndConquistas] = useState([])
  const [loading, setLoading] = useState(false)
  const [erroIndicadores, setErroIndicadores] = useState(null)

  const intervalo = useMemo(() => intervaloPresetConquistas(presetPeriodo), [presetPeriodo])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErroIndicadores(null)
    try {
      let qMeta = supabase
        .from('objetivos')
        .select('id, descricao, meta_unidade, concluido_em, comentario_conclusao, area_id, tipo')
        .eq('status', 'concluido')
      if (areaId) qMeta = qMeta.eq('area_id', areaId)
      let { data: dm, error: eMeta } = await qMeta
      if (eMeta && String(eMeta.message || '').toLowerCase().includes('status')) {
        const r2 = await supabase
          .from('objetivos')
          .select('id, descricao, meta_unidade, concluido_em, comentario_conclusao, area_id, tipo')
        dm = r2.data
        eMeta = r2.error
      }
      if (eMeta) throw eMeta
      const metasNorm = normalizarMetas(dm || []).filter(m => metaDentroDoIntervalo(m, intervalo))
      setMetas(metasNorm)

      let qInd = supabase
        .from('indicador_conquistas')
        .select(
          'id, indicador_id, area_id, nome, unidade, prazo_original, data_conclusao, semana_conclusao, ano_iso_conclusao, ultimo_valor, no_prazo'
        )
        .order('data_conclusao', { ascending: false })
      if (areaId) qInd = qInd.eq('area_id', areaId)
      if (intervalo) {
        qInd = qInd
          .gte('data_conclusao', intervalo.start.toISOString())
          .lte('data_conclusao', intervalo.end.toISOString())
      }
      const { data: di, error: eInd } = await qInd
      if (eInd) {
        const m = String(eInd.message || '')
        if (m.toLowerCase().includes('indicador_conquistas') || m.includes('schema') || m.includes('Could not find')) {
          setIndConquistas([])
          setErroIndicadores(
            'Conquistas de indicadores: execute no Supabase o arquivo supabase-indicador-conquistas.sql e recarregue.'
          )
        } else {
          setIndConquistas([])
          setErroIndicadores(m)
        }
      } else {
        setIndConquistas(di || [])
      }
    } catch (e) {
      setMetas([])
      setIndConquistas([])
      setErroIndicadores(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [areaId, intervalo])

  useEffect(() => {
    listarAreas(supabase, 'id, nome').then(({ data }) => setAreas(data || []))
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const nomeArea = useCallback(
    id => (areas.find(a => String(a.id) === String(id))?.nome || '—').trim() || '—',
    [areas]
  )

  const itensMetas = useMemo(
    () =>
      (metas || []).map(m => ({
        kind: 'meta',
        id: `m-${m.id}`,
        raw: m,
        areaId: m.area_id,
        nome: String(m.descricao || '—').trim() || '—',
        noPrazo: metaNoPrazo(m),
        recorrente: isMetaRecorrente(m),
        atingivelTipo: String(m?.tipo || '').toLowerCase() === 'atingivel'
      })),
    [metas]
  )

  const itensInd = useMemo(
    () =>
      (indConquistas || []).map(r => ({
        kind: 'indicador',
        id: `i-${r.id}`,
        raw: r,
        areaId: r.area_id,
        nome: String(r.nome || '—').trim() || '—',
        noPrazo: Boolean(r.no_prazo),
        recorrente: false,
        atingivelTipo: true
      })),
    [indConquistas]
  )

  const unificado = useMemo(() => [...itensMetas, ...itensInd], [itensMetas, itensInd])

  const filtrado = useMemo(() => {
    let base = unificado
    if (tab === 'metas') base = itensMetas
    if (tab === 'indicadores') base = itensInd

    if (pill === 'no_prazo') base = base.filter(x => x.noPrazo)
    else if (pill === 'fora_prazo') base = base.filter(x => !x.noPrazo)
    else if (pill === 'recorrente') base = base.filter(x => x.kind === 'meta' && x.recorrente)
    else if (pill === 'atingivel')
      base = base.filter(x => (x.kind === 'meta' && x.atingivelTipo) || x.kind === 'indicador')

    return base
  }, [unificado, itensMetas, itensInd, tab, pill])

  const kpi = useMemo(() => {
    const nm = itensMetas.length
    const ni = itensInd.length
    const total = nm + ni
    const noPrazo =
      itensMetas.filter(x => x.noPrazo).length + itensInd.filter(x => x.noPrazo).length
    const taxa = total > 0 ? Math.round((noPrazo / total) * 100) : 0
    return { total, nm, ni, taxa }
  }, [itensMetas, itensInd])

  /** Gráfico 1: por área (respeita filtro de período + área do topo). */
  const chartPorArea = useMemo(() => {
    const ids = areaId ? [areaId] : [...new Set(areas.map(a => a.id).filter(Boolean))]
    if (ids.length === 0) {
      return { labels: ['—'], metasPorArea: [0], indPorArea: [0] }
    }
    const labels = ids.map(id => nomeArea(id))
    const metasPorArea = ids.map(aid => itensMetas.filter(x => String(x.areaId) === String(aid)).length)
    const indPorArea = ids.map(aid => itensInd.filter(x => String(x.areaId) === String(aid)).length)
    return { labels, metasPorArea, indPorArea }
  }, [areaId, areas, itensMetas, itensInd, nomeArea])

  /** Gráfico 2: últimos 6 meses, filtro só por área (dados dos itens já filtrados por área no load). */
  const chartHistorico = useMemo(() => {
    const keys = ultimos6MesesChaves()
    const labels = ultimos6MesesLabelsPt()
    const ok = keys.map(() => 0)
    const bad = keys.map(() => 0)
    const idx = k => keys.indexOf(k)

    const contar = item => {
      let d = null
      if (item.kind === 'meta') {
        d = dataEstimadaConclusaoMeta(item.raw, anoRefPadrao())
      } else if (item.raw?.data_conclusao) {
        d = new Date(item.raw.data_conclusao)
      }
      if (!d || Number.isNaN(d.getTime())) return
      const k = mesChave(d)
      const i = idx(k)
      if (i < 0) return
      if (item.noPrazo) ok[i] += 1
      else bad[i] += 1
    }

    unificado.forEach(contar)

    return { labels, noPrazoPorMes: ok, foraPrazoPorMes: bad }
  }, [unificado])

  const filtradoMetasSec = useMemo(() => filtrado.filter(x => x.kind === 'meta'), [filtrado])
  const filtradoIndSec = useMemo(() => filtrado.filter(x => x.kind === 'indicador'), [filtrado])

  function renderCardMeta(m) {
    const noPrazoItem = m.noPrazo
    const ar = nomeArea(m.raw.area_id)
    const prazoSn = parseSemanaMetaTexto(m.raw.meta_unidade)
    const dPrazo = dataEstimadaPrazoMeta(m.raw, anoRefPadrao())
    const prazoLinha =
      prazoSn != null
        ? `S${prazoSn}${dPrazo ? ` · ${formatarDataCurtaPt(dPrazo)}` : ''}`
        : prazoOriginalLabelMeta(m.raw)
    const dConc = dataEstimadaConclusaoMeta(m.raw, anoRefPadrao())
    const semConc = parseSemanaMetaTexto(m.raw.concluido_em)
    const conclSemTxt = semConc != null ? `S${semConc}` : (String(m.raw.concluido_em || '').trim() || '—')
    const conclLinha =
      dConc != null && !Number.isNaN(dConc.getTime())
        ? `${conclSemTxt} · ${formatarDataCurtaPt(dConc)}`
        : conclSemTxt
    const delta = deltaSemanasVsPrazo(m.raw.meta_unidade, semConc)
    const tipoTxt = isMetaRecorrente(m.raw) ? 'Recorrente' : 'Atingível'
    return (
      <li key={m.id} className="conquistas-card">
        <div className={`conquistas-card__icon conquistas-card__icon--meta${noPrazoItem ? '' : ' conquistas-card__icon--late'}`} aria-hidden>
          ✓
        </div>
        <div className="conquistas-card__body">
          <div className="conquistas-card__nome">{m.nome}</div>
          <div className="conquistas-card__sub">
            {ar} · {tipoTxt}
          </div>
          <div className="conquistas-card__linhas">
            <span className="conquistas-card__linha-label">Prazo original:</span> {prazoLinha}
          </div>
          <div className="conquistas-card__linhas">
            <span className="conquistas-card__linha-label">Concluído em:</span> {conclLinha}
            {delta && delta.modo === 'antes' && delta.n > 0 ? (
              <span className="conquistas-card__delta conquistas-card__delta--ok"> ▲ {delta.n} sem. antes</span>
            ) : null}
            {delta && delta.modo === 'depois' && delta.n > 0 ? (
              <span className="conquistas-card__delta conquistas-card__delta--bad"> ▼ {delta.n} sem. atrasado</span>
            ) : null}
          </div>
        </div>
        <div className="conquistas-card__badges">
          <span className={`conquistas-badge conquistas-badge--${noPrazoItem ? 'ok' : 'late'}`}>
            {noPrazoItem ? 'No prazo' : 'Fora do prazo'}
          </span>
          <span className="conquistas-badge conquistas-badge--tipo-meta">Meta</span>
        </div>
      </li>
    )
  }

  function renderCardIndicador(row) {
    const r = row.raw
    const noPrazoItem = row.noPrazo
    const ar = nomeArea(r.area_id)
    const prazoSn = parseSemanaMetaTexto(r.prazo_original)
    const anoConc = r.ano_iso_conclusao != null ? Number(r.ano_iso_conclusao) : anoRefPadrao()
    const dPrazo = dataEstimadaPrazoMeta({ meta_unidade: r.prazo_original }, anoConc)
    const prazoLinha =
      prazoSn != null
        ? `S${prazoSn}${dPrazo ? ` · ${formatarDataCurtaPt(dPrazo)}` : ''}`
        : String(r.prazo_original || '—').trim() || '—'
    const dConc = r.data_conclusao ? new Date(r.data_conclusao) : null
    const conclLinha =
      dConc && !Number.isNaN(dConc.getTime())
        ? `S${r.semana_conclusao} · ${formatarDataCurtaPt(dConc)}`
        : '—'
    const delta = deltaSemanasVsPrazo(r.prazo_original, r.semana_conclusao)
    const unidade = String(r.unidade || '').trim()
    const ultimo = String(r.ultimo_valor || '').trim()
    return (
      <li key={row.id} className="conquistas-card">
        <div className={`conquistas-card__icon conquistas-card__icon--ind${noPrazoItem ? '' : ' conquistas-card__icon--late'}`} aria-hidden>
          ✓
        </div>
        <div className="conquistas-card__body">
          <div className="conquistas-card__nome">{row.nome}</div>
          <div className="conquistas-card__sub">
            {ar} · Atingível{unidade ? ` · ${unidade}` : ''}
          </div>
          <div className="conquistas-card__linhas">
            <span className="conquistas-card__linha-label">Prazo original:</span> {prazoLinha}
          </div>
          <div className="conquistas-card__linhas">
            <span className="conquistas-card__linha-label">Concluído em:</span> {conclLinha}
            {delta && delta.modo === 'antes' && delta.n > 0 ? (
              <span className="conquistas-card__delta conquistas-card__delta--ok"> ▲ {delta.n} sem. antes</span>
            ) : null}
            {delta && delta.modo === 'depois' && delta.n > 0 ? (
              <span className="conquistas-card__delta conquistas-card__delta--bad"> ▼ {delta.n} sem. atrasado</span>
            ) : null}
          </div>
          {ultimo ? (
            <div className="conquistas-card__ultimo-valor">
              Último valor: <strong>= {ultimo}</strong>
            </div>
          ) : null}
        </div>
        <div className="conquistas-card__badges">
          <span className={`conquistas-badge conquistas-badge--${noPrazoItem ? 'ok' : 'late'}`}>
            {noPrazoItem ? 'No prazo' : 'Fora do prazo'}
          </span>
          <span className="conquistas-badge conquistas-badge--tipo-ind">Indicador</span>
        </div>
      </li>
    )
  }

  return (
    <>
      <header className="gantt-page-header conquistas-header">
        <div className="gantt-page-header__left">
          <h1 className="gantt-page-header__title">Conquistas</h1>
          <p className="gantt-page-header__subtitle" style={{ margin: 0 }}>
            Metas e indicadores atingíveis concluídos, com visão por área e período.
          </p>
        </div>
        <div className="conquistas-filtros-topo">
          <label className="conquistas-filtro-lab" htmlFor="conquistas-area">Área</label>
          <select
            id="conquistas-area"
            className="conquistas-filtro-select"
            value={areaId}
            onChange={e => setAreaId(e.target.value)}
            aria-label="Filtrar por área"
          >
            <option value="">Todas as áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
          <label className="conquistas-filtro-lab" htmlFor="conquistas-periodo">Período</label>
          <select
            id="conquistas-periodo"
            className="conquistas-filtro-select"
            value={presetPeriodo}
            onChange={e => setPresetPeriodo(e.target.value)}
            aria-label="Filtrar por período"
          >
            {PRESET_PERIODO.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </header>

      {erroIndicadores && !loading && (
        <div className="alert alert-warning" role="status" style={{ marginBottom: '1rem' }}>
          {erroIndicadores}
        </div>
      )}

      {loading ? (
        <p className="gantt-metas-empty">Carregando…</p>
      ) : (
        <>
          <section className="conquistas-kpis" aria-label="Resumo">
            <div className="conquistas-kpi">
              <div className="conquistas-kpi__val">{kpi.total}</div>
              <div className="conquistas-kpi__lab">Total concluídas</div>
            </div>
            <div className="conquistas-kpi">
              <div className="conquistas-kpi__val">{kpi.nm}</div>
              <div className="conquistas-kpi__lab">Metas concluídas</div>
            </div>
            <div className="conquistas-kpi">
              <div className="conquistas-kpi__val">{kpi.ni}</div>
              <div className="conquistas-kpi__lab">Indicadores concluídos</div>
            </div>
            <div className="conquistas-kpi">
              <div className="conquistas-kpi__val">{kpi.taxa}%</div>
              <div className="conquistas-kpi__lab">Taxa no prazo</div>
            </div>
          </section>

          <nav className="conquistas-tabs" aria-label="Tipo de conquista">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                className={`conquistas-tab${tab === t.id ? ' conquistas-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="conquistas-pills" role="tablist" aria-label="Filtro rápido">
            {PILLS.map(p => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={pill === p.id}
                className={`conquistas-pill${pill === p.id ? ' conquistas-pill--active' : ''}`}
                onClick={() => setPill(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <section className="conquistas-lista-wrap" aria-label="Lista de conquistas">
            {filtrado.length === 0 ? (
              <p className="gantt-metas-empty">Nenhuma conquista neste filtro.</p>
            ) : tab === 'todas' ? (
              <>
                <div className="conquistas-secao">
                  <h2 className="conquistas-secao__titulo">
                    Metas
                    <span className="conquistas-secao__badge conquistas-secao__badge--meta">{filtradoMetasSec.length}</span>
                  </h2>
                  <ul className="conquistas-cards">
                    {filtradoMetasSec.map(x => renderCardMeta(x))}
                  </ul>
                </div>
                <hr className="conquistas-separador" />
                <div className="conquistas-secao">
                  <h2 className="conquistas-secao__titulo">
                    Indicadores
                    <span className="conquistas-secao__badge conquistas-secao__badge--ind">{filtradoIndSec.length}</span>
                  </h2>
                  <ul className="conquistas-cards">
                    {filtradoIndSec.map(x => renderCardIndicador(x))}
                  </ul>
                </div>
              </>
            ) : (
              <ul className="conquistas-cards">
                {filtrado.map(x => (x.kind === 'meta' ? renderCardMeta(x) : renderCardIndicador(x)))}
              </ul>
            )}
          </section>

          <section className="conquistas-graficos" aria-label="Gráficos">
            <h2 className="conquistas-graficos__titulo">Conquistas por área</h2>
            <ConquistasPorAreaChart
              labels={chartPorArea.labels}
              metasPorArea={chartPorArea.metasPorArea}
              indicadoresPorArea={chartPorArea.indPorArea}
            />
            <h2 className="conquistas-graficos__titulo" style={{ marginTop: '2rem' }}>
              Histórico mensal (últimos 6 meses)
            </h2>
            <p className="conquistas-graficos__hint">
              Contagem por mês de conclusão; eixo filtrado pela área selecionada acima (ou todas).
            </p>
            <ConquistasHistoricoMensalChart
              labels={chartHistorico.labels}
              noPrazoPorMes={chartHistorico.noPrazoPorMes}
              foraPrazoPorMes={chartHistorico.foraPrazoPorMes}
            />
          </section>
        </>
      )}
    </>
  )
}
