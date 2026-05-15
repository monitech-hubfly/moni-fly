/**
 * Toggle Recorrente / Atingível para meta (objetivo) ou indicador (persistido como `meta_ciclo_tipo` no indicador).
 * @param {'recorrente'|'atingivel'} value
 * @param {(v: 'recorrente'|'atingivel') => void} onChange
 * @param {'meta'|'indicador'} [context='meta'] — ajusta textos de ajuda.
 */
export default function MetaCicloTipoFields({ value, onChange, idPrefix = 'meta-ciclo', context = 'meta' }) {
  const v = value === 'atingivel' ? 'atingivel' : 'recorrente'
  const isInd = context === 'indicador'
  const hintAting =
    isInd
      ? 'Este indicador tem um resultado final. Quando concluído, sai do monitoramento no planejamento.'
      : 'Esta meta tem um resultado final. Quando concluída, sai do monitoramento.'
  const hintRec =
    isInd
      ? 'Este indicador é contínuo e será monitorado sem prazo de encerramento.'
      : 'Esta meta é contínua e será monitorada sem prazo de encerramento.'
  return (
    <div className="meta-ciclo-tipo-block">
      <span className="meta-ciclo-tipo-label" id={`${idPrefix}-label`}>Tipo</span>
      <div
        className="meta-ciclo-tipo-segment"
        role="group"
        aria-labelledby={`${idPrefix}-label`}
      >
        <button
          type="button"
          className={`meta-ciclo-tipo-segment__btn${v === 'recorrente' ? ' meta-ciclo-tipo-segment__btn--active' : ''}`}
          onClick={() => onChange('recorrente')}
        >
          Recorrente
        </button>
        <button
          type="button"
          className={`meta-ciclo-tipo-segment__btn${v === 'atingivel' ? ' meta-ciclo-tipo-segment__btn--active' : ''}`}
          onClick={() => onChange('atingivel')}
        >
          Atingível
        </button>
      </div>
      <p className="meta-ciclo-tipo-hint">
        {v === 'atingivel' ? hintAting : hintRec}
      </p>
    </div>
  )
}
