import { useEffect, useMemo, useState } from 'react'

/** Retorna o número da semana ISO (1-53) para uma data. Segunda = início da semana. */
function getSemanaISO(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  date.setDate(date.getDate() + 4 - day)
  const first = new Date(date.getFullYear(), 0, 1)
  return Math.ceil((((date - first) / 86400000) + 1) / 7)
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarioComSemanas({
  ano: anoProp,
  className = '',
  mesInicial,
  selectedSemanaNum,
  onSelectSemanaNumero
}) {
  const ano = anoProp || new Date().getFullYear()
  const [mesAtual, setMesAtual] = useState(mesInicial ?? new Date().getMonth())

  useEffect(() => {
    if (mesInicial == null) return
    setMesAtual(mesInicial)
  }, [mesInicial])

  const primeiroDia = new Date(ano, mesAtual, 1)
  const ultimoDia = new Date(ano, mesAtual + 1, 0)

  const inicioGrid = new Date(primeiroDia)
  const diaSemana = primeiroDia.getDay() || 7
  inicioGrid.setDate(primeiroDia.getDate() - (diaSemana - 1))
  if (inicioGrid > primeiroDia) inicioGrid.setDate(inicioGrid.getDate() - 7)

  const dias = []
  const cursor = new Date(inicioGrid)
  while (dias.length < 42) {
    dias.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  const semanas = useMemo(() => {
    const lista = []
    for (let i = 0; i < 6; i++) {
      const semanaDias = dias.slice(i * 7, (i + 1) * 7)
      const primeiroDiaSemana = semanaDias[0]
      const numSemana = primeiroDiaSemana ? getSemanaISO(primeiroDiaSemana) : null
      lista.push({ numSemana, dias: semanaDias })
    }
    return lista
  }, [dias])

  const ehDoMes = (d) => d.getMonth() === mesAtual
  const ehHoje = (d) => {
    const h = new Date()
    return d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()
  }

  return (
    <div className={`calendario-com-semanas ${className}`}>
      <div className="calendario-header">
        <button
          type="button"
          className="btn btn-calendario"
          onClick={() => setMesAtual(m => (m === 0 ? 11 : m - 1))}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="calendario-titulo">{MESES[mesAtual]} {ano}</span>
        <button
          type="button"
          className="btn btn-calendario"
          onClick={() => setMesAtual(m => (m === 11 ? 0 : m + 1))}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <table className="calendario-mes">
        <thead>
          <tr>
            <th className="calendario-col-semana">Semana</th>
            {DIAS.map(d => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {semanas.map((s, i) => (
            <tr key={i}>
              <td
                className={`calendario-col-semana calendario-num-semana ${
                  selectedSemanaNum && s.numSemana === selectedSemanaNum ? 'calendario-col-semana-selecionada' : ''
                }`}
              >
                {s.numSemana ? (
                  <button
                    type="button"
                    className={`calendario-semana-btn ${
                      selectedSemanaNum && s.numSemana === selectedSemanaNum ? 'calendario-semana-btn--selected' : ''
                    }`}
                    onClick={() => onSelectSemanaNumero?.(s.numSemana)}
                    disabled={!onSelectSemanaNumero}
                    aria-label={`Selecionar semana ${s.numSemana}`}
                  >
                    S{s.numSemana}
                  </button>
                ) : (
                  '—'
                )}
              </td>

              {s.dias.map((d, j) => (
                <td
                  key={j}
                  className={`calendario-dia ${ehDoMes(d) ? '' : 'calendario-dia-fora'} ${ehHoje(d) ? 'calendario-dia-hoje' : ''}`}
                >
                  {d.getDate()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

