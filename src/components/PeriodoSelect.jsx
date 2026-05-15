import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { TIPOS_PERIODO, labelPeriodo } from '../utils/periodos'

export default function PeriodoSelect({ value, onChange, defaultTipo = 'trimestre', onlyTipos, className }) {
  const [tipo, setTipo] = useState(defaultTipo)
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(false)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  function withTimeout(promise, ms, label) {
    let t
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} (timeout após ${ms}ms)`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t))
  }

  const tiposDisponiveis = useMemo(() => {
    // Removido filtro de "Semana" conforme regra da tela.
    const base = TIPOS_PERIODO.filter(t => t.value !== 'semana')
    if (!onlyTipos || onlyTipos.length === 0) return base
    const set = new Set(onlyTipos)
    return base.filter(t => set.has(t.value))
  }, [onlyTipos])

  useEffect(() => {
    if (!tiposDisponiveis.some(t => t.value === tipo)) {
      setTipo(tiposDisponiveis[0]?.value || 'trimestre')
    }
  }, [tiposDisponiveis, tipo])

  useEffect(() => {
    async function run() {
      setLoading(true)
      setPeriodos([])
      try {
        const query = supabase
          .from('periodos')
          .select('*')
          .eq('tipo', tipo)
          .eq('ativo', true)
          .order('ano', { ascending: false })
          .order('numero', { ascending: true })
        const { data, error } = await withTimeout(query, 10000, 'Falha ao carregar períodos')
        if (error) {
          setPeriodos([])
          return
        }
        setPeriodos(data || [])
      } catch {
        setPeriodos([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [tipo])

  useEffect(() => {
    if (!periodos.length) return
    if (value && periodos.some(p => p.id === value)) return
    // tenta auto-selecionar o período atual (hoje dentro do intervalo); senão pega o primeiro
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const atual = periodos.find(p => {
      const ini = new Date(p.data_inicio)
      const fim = new Date(p.data_fim)
      ini.setHours(0, 0, 0, 0)
      fim.setHours(0, 0, 0, 0)
      return hoje >= ini && hoje <= fim
    })
    onChangeRef.current?.(atual?.id || periodos[0].id, tipo)
  }, [periodos, value, tipo])

  // Se não houver nenhum período cadastrado para o tipo selecionado,
  // garantimos que o valor "selecionado" seja limpo no pai (evita consultas por período antigo).
  useEffect(() => {
    if (loading) return
    if (periodos.length !== 0) return
    if (!value) return
    onChangeRef.current?.(null, tipo)
  }, [loading, periodos.length, value, tipo])

  return (
    <div className={['periodo-select-root', className].filter(Boolean).join(' ')}>
      <div className="form-group">
        <label>Período</label>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value)
            // Não chamar onChange(null): isso limpava periodoId no pai, semanas=[] e o Gantt “apagava”
            // todas as barras até o próximo período — efeito de piscar / sumir dados.
            // O efeito abaixo ([periodos, value, tipo]) define o novo id quando a lista carregar.
          }}
        >
          {tiposDisponiveis.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Seleção</label>
        <select value={value || ''} onChange={e => onChange?.(e.target.value || null, tipo)} disabled={loading || periodos.length === 0}>
          {periodos.length === 0 ? (
            <option value="">{loading ? 'Carregando…' : 'Nenhum período'}</option>
          ) : (
            periodos.map(p => (
              <option key={p.id} value={p.id}>{labelPeriodo(p)}</option>
            ))
          )}
        </select>
      </div>
    </div>
  )
}

