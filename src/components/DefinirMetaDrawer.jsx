import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../services/supabase'
import { registrarLog } from '../hooks/useAuditLog'
import CalendarioComSemanas from './CalendarioComSemanas'
import WorkloadFormDrawer from './WorkloadFormDrawer'
import MetaCicloTipoFields from './MetaCicloTipoFields'

function metaModalPrazoValido(ano, semana) {
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

/**
 * Gaveta lateral para criar/editar meta (objetivo) da área — mesmo fluxo que existia no modal do Gantt.
 */
export default function DefinirMetaDrawer({
  open,
  onClose,
  areaId,
  periodo = null,
  metaParaEditar = null,
  onSucesso
}) {
  const [metaDesc, setMetaDesc] = useState('')
  const [metaPrazoAno, setMetaPrazoAno] = useState('')
  const [metaPrazoMes, setMetaPrazoMes] = useState('')
  const [metaPrazoSemana, setMetaPrazoSemana] = useState('')
  const [metaSalvando, setMetaSalvando] = useState(false)
  const [metaErroForm, setMetaErroForm] = useState('')
  const [metaPeriodoDerivando, setMetaPeriodoDerivando] = useState(false)
  const [metaPeriodoFimId, setMetaPeriodoFimId] = useState(null)
  const [metaTipoCiclo, setMetaTipoCiclo] = useState('recorrente')
  const metaDescRef = useRef(null)

  useEffect(() => {
    if (!open || !areaId) return
    const anoDefault =
      (periodo?.ano != null ? Number(periodo.ano) : undefined) ||
      new Date().getFullYear()
    const anoRef =
      (periodo?.ano != null ? Number(periodo.ano) : undefined) ||
      new Date().getFullYear()

    setMetaErroForm('')
    setMetaSalvando(false)
    setMetaPeriodoDerivando(false)
    setMetaPeriodoFimId(null)

    if (metaParaEditar?.id) {
      const meta = metaParaEditar
      setMetaTipoCiclo(meta.tipo === 'atingivel' ? 'atingivel' : 'recorrente')
      const raw = String(meta.meta_unidade || '').trim()
      const m = raw.match(/^S\s*(\d+)/i)
      const sem = m ? Math.min(53, Math.max(1, Number(m[1]))) : null
      setMetaDesc(meta.descricao || '')
      setMetaPrazoAno(String(anoRef))
      if (sem != null) {
        const approx = new Date(anoRef, 0, 1 + (sem - 1) * 7)
        setMetaPrazoMes(String(Math.min(12, Math.max(1, approx.getMonth() + 1))))
        setMetaPrazoSemana(String(sem))
      } else {
        setMetaPrazoMes(String(new Date().getMonth() + 1))
        setMetaPrazoSemana('')
      }
      setTimeout(() => {
        metaDescRef.current?.focus?.()
        if (sem != null) definirMetaPeriodoPorSemanaNumero(sem, anoRef)
      }, 0)
    } else {
      setMetaTipoCiclo('recorrente')
      setMetaDesc('')
      setMetaPrazoAno(String(anoDefault))
      setMetaPrazoMes(String((new Date()).getMonth() + 1))
      setMetaPrazoSemana('')
      setTimeout(() => metaDescRef.current?.focus?.(), 0)
    }
  }, [open, areaId, metaParaEditar?.id, periodo?.ano])

  const anosPrazoRender = useMemo(() => {
    const set = new Set()
    if (metaPrazoAno) set.add(String(metaPrazoAno))
    set.add(String(new Date().getFullYear()))
    return Array.from(set).sort((a, b) => Number(a) - Number(b))
  }, [metaPrazoAno])

  async function definirMetaPeriodoPorSemanaNumero(semanaNumero, anoExplicito) {
    setMetaPeriodoDerivando(true)
    setMetaPeriodoFimId(null)
    const anoStr =
      anoExplicito != null && String(anoExplicito).trim() !== ''
        ? String(anoExplicito).trim()
        : String(metaPrazoAno ?? '').trim()
    try {
      if (!anoStr || semanaNumero == null || !Number.isFinite(Number(semanaNumero))) return
      const { data } = await supabase
        .from('periodos')
        .select('id')
        .eq('tipo', 'semana')
        .eq('ano', Number(anoStr))
        .eq('numero', Number(semanaNumero))
        .limit(1)
      const p0 = Array.isArray(data) ? data[0] : null
      setMetaPeriodoFimId(p0?.id ?? null)
    } catch {
      setMetaPeriodoFimId(null)
    } finally {
      setMetaPeriodoDerivando(false)
    }
  }

  async function salvarMeta() {
    if (!areaId) {
      setMetaErroForm('Selecione uma área antes de salvar.')
      return
    }
    const desc = (metaDesc || '').trim()
    if (!desc) {
      setMetaErroForm('Informe a meta antes de salvar.')
      return
    }
    const tipoVal = metaTipoCiclo === 'atingivel' ? 'atingivel' : 'recorrente'
    const exigePrazo = tipoVal === 'atingivel'
    const semanaNumSalvar =
      exigePrazo && metaModalPrazoValido(metaPrazoAno, metaPrazoSemana)
        ? Number(String(metaPrazoSemana).trim())
        : null
    if (exigePrazo && semanaNumSalvar == null) {
      setMetaErroForm('Selecione o prazo (ano e semana).')
      return
    }
    const metaEditandoId = metaParaEditar?.id || null

    setMetaSalvando(true)
    setMetaErroForm('')
    try {
      if (metaEditandoId) {
        const payloadUpdate = {
          descricao: desc,
          meta_unidade: exigePrazo && semanaNumSalvar != null ? `S${semanaNumSalvar}` : null,
          tipo: tipoVal
        }
        const withPeriodo = metaPeriodoFimId ? { ...payloadUpdate, periodo_id: metaPeriodoFimId } : payloadUpdate
        let resUp = await supabase.from('objetivos').update(withPeriodo).eq('id', metaEditandoId)
        let valorNovoLog = withPeriodo
        if (resUp?.error && (resUp.error.message?.includes('periodo_id') || resUp.error.message?.includes('column'))) {
          resUp = await supabase.from('objetivos').update(payloadUpdate).eq('id', metaEditandoId)
          valorNovoLog = payloadUpdate
        }
        if (resUp?.error && String(resUp.error.message || '').toLowerCase().includes('tipo')) {
          const { tipo: _omitTipo, ...semTipo } = valorNovoLog
          resUp = await supabase.from('objetivos').update(semTipo).eq('id', metaEditandoId)
          valorNovoLog = semTipo
        }
        if (resUp?.error) throw resUp.error
        void registrarLog({
          modulo: 'Planejamento',
          area: null,
          entidade: 'objetivo',
          entidade_id: metaEditandoId,
          operacao: 'UPDATE',
          valor_anterior: metaParaEditar
            ? { descricao: metaParaEditar.descricao, meta_unidade: metaParaEditar.meta_unidade }
            : null,
          valor_novo: valorNovoLog,
          descricao: `Alterou meta (objetivo) "${desc}"`
        })
      } else {
        const { count } = await supabase
          .from('objetivos')
          .select('id', { count: 'exact', head: true })
          .eq('area_id', areaId)
        const ordem = (typeof count === 'number' ? count : 0) + 1

        const payloadBase = {
          area_id: areaId,
          descricao: desc,
          ordem,
          meta_unidade: exigePrazo && semanaNumSalvar != null ? `S${semanaNumSalvar}` : null,
          tipo: tipoVal
        }

        const payloadWithMaybePeriodo =
          metaPeriodoFimId ? { ...payloadBase, periodo_id: metaPeriodoFimId } : payloadBase

        let payloadInseridoLog = payloadWithMaybePeriodo
        let res = await supabase
          .from('objetivos')
          .insert(payloadWithMaybePeriodo)
          .select('id')
          .maybeSingle()

        if (res?.error && (res.error.message?.includes('periodo_id') || res.error.message?.includes('column'))) {
          res = await supabase
            .from('objetivos')
            .insert(payloadBase)
            .select('id')
            .maybeSingle()
          payloadInseridoLog = payloadBase
        }
        if (res?.error && String(res.error.message || '').toLowerCase().includes('tipo')) {
          const { tipo: _t1, ...semTipoIns } = payloadInseridoLog
          res = await supabase.from('objetivos').insert(semTipoIns).select('id').maybeSingle()
          payloadInseridoLog = semTipoIns
        }

        if (res?.error) throw res.error
        void registrarLog({
          modulo: 'Planejamento',
          area: null,
          entidade: 'objetivo',
          entidade_id: res?.data?.id ?? null,
          operacao: 'INSERT',
          valor_novo: payloadInseridoLog,
          descricao: `Criou meta (objetivo) "${desc}"`
        })
      }

      onClose()
      if (onSucesso) await onSucesso()
    } catch (e) {
      const msg = e?.message || 'Erro ao salvar a meta.'
      setMetaErroForm(msg)
    } finally {
      setMetaSalvando(false)
    }
  }

  const titulo = metaParaEditar?.id ? 'Editar meta' : 'Definir meta'
  const tipoEfetivo = metaTipoCiclo === 'atingivel' ? 'atingivel' : 'recorrente'
  const exibirPrazo = tipoEfetivo === 'atingivel'

  return (
    <WorkloadFormDrawer
      open={open}
      title={titulo}
      titleId="definir-meta-drawer-title"
      rootClassName="definir-meta-drawer-z"
      panelClassName="definir-meta-drawer-panel"
      closeDisabled={metaSalvando}
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--cancel"
            onClick={onClose}
            disabled={metaSalvando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="definir-meta-drawer-form"
            className="workload-form-drawer-footer-btn workload-form-drawer-footer-btn--save"
            disabled={
              metaSalvando ||
              metaPeriodoDerivando ||
              (exibirPrazo && !metaModalPrazoValido(metaPrazoAno, metaPrazoSemana))
            }
          >
            {metaSalvando ? 'Salvando...' : (metaParaEditar?.id ? 'Salvar alterações' : 'Salvar meta')}
          </button>
        </>
      )}
    >
      <form
        id="definir-meta-drawer-form"
        className="workload-drawer-form-inner"
        onSubmit={(e) => {
          e.preventDefault()
          salvarMeta()
        }}
      >
        <div className="form-group">
          <label htmlFor="definir-meta-desc">Informe a Meta</label>
          <textarea
            id="definir-meta-desc"
            ref={metaDescRef}
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            placeholder="Descreva a meta..."
            rows={1}
            required
          />
        </div>

        <div className="form-group">
          <MetaCicloTipoFields
            idPrefix="definir-meta-ciclo"
            value={metaTipoCiclo}
            onChange={setMetaTipoCiclo}
          />
        </div>

        <div className="form-group">
          {exibirPrazo ? (
            <>
              <label htmlFor="definir-meta-ano">Prazo para conclusão da Meta</label>
              <select
                id="definir-meta-ano"
                value={metaPrazoAno}
                onChange={(e) => {
                  const v = e.target.value
                  setMetaPrazoAno(v)
                  setMetaPrazoSemana('')
                  setMetaPeriodoFimId(null)
                  setMetaPeriodoDerivando(false)
                  setMetaErroForm('')
                }}
              >
                {(anosPrazoRender || []).map(a => (
                  <option key={a} value={String(a)}>{a}</option>
                ))}
              </select>

              <CalendarioComSemanas
                ano={metaPrazoAno ? Number(metaPrazoAno) : new Date().getFullYear()}
                mesInicial={
                  metaPrazoMes
                    ? Math.max(0, Math.min(11, Number(metaPrazoMes) - 1))
                    : new Date().getMonth()
                }
                selectedSemanaNum={metaPrazoSemana ? Number(metaPrazoSemana) : null}
                onSelectSemanaNumero={(semanaNumero) => {
                  if (semanaNumero == null || !Number.isFinite(Number(semanaNumero))) return
                  const n = Math.trunc(Number(semanaNumero))
                  if (n < 1 || n > 53) return
                  setMetaPrazoSemana(String(n))
                  setMetaErroForm('')
                  definirMetaPeriodoPorSemanaNumero(n, metaPrazoAno)
                }}
              />

              <div className="modal-hint" style={{ textAlign: 'center' }}>
                {metaPeriodoDerivando
                  ? 'Determinando período da semana...'
                  : metaPrazoSemana
                    ? `Prazo selecionado: S${metaPrazoSemana}`
                    : 'Selecione a semana no calendário.'}
              </div>
            </>
          ) : (
            <div className="modal-hint" style={{ textAlign: 'center' }}>
              Esta meta é contínua e será monitorada sem prazo de encerramento.
            </div>
          )}
        </div>

        {metaErroForm && <div className="alert alert-error" role="alert">{metaErroForm}</div>}
      </form>
    </WorkloadFormDrawer>
  )
}
