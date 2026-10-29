import { Icon } from '../../components/Icon'
import { CAMPOS, type CampoFase } from '../../lib/camposFase'
import { FaseLabel } from '../../lib/types'
import type { Fase } from '../../lib/types'

/**
 * Franja discreta sobre la ficha con lo que falta de la fase actual: qué es obligatorio,
 * cuántos recomendados quedan y una línea fina con lo completado.
 */
export function AvisoFase({
  fase,
  obligatorios,
  opcionales,
  total,
  onCompletar,
}: {
  fase: Fase
  obligatorios: CampoFase[]
  opcionales: CampoFase[]
  total: number
  onCompletar: () => void
}) {
  const pendientes = obligatorios.length + opcionales.length
  const pct = total > 0 ? Math.round(((total - pendientes) / total) * 100) : 100
  const urgente = obligatorios.length > 0
  const nombreFase = FaseLabel[fase].replace(/^\d+\.\s*/, '')

  return (
    <div className={`aviso-fase${urgente ? ' is-urgente' : ''}`}>
      <div className="aviso-fase-contenido">
        <span className="aviso-fase-punto" aria-hidden="true" />
        <div className="aviso-fase-texto">
          <span className="aviso-fase-titulo">
            {urgente
              ? `Faltan ${obligatorios.length} ${obligatorios.length === 1 ? 'dato' : 'datos'} de ${nombreFase}`
              : `${opcionales.length} ${opcionales.length === 1 ? 'dato recomendado' : 'datos recomendados'} por completar`}
          </span>
          <span className="aviso-fase-detalle">
            {urgente
              ? obligatorios.map((c) => CAMPOS[c]?.label).join(' · ')
              : 'Puedes avanzar de fase sin ellos, pero ayudan a hacer mejor el seguimiento.'}
          </span>
        </div>
        <button type="button" className="aviso-fase-btn" onClick={onCompletar}>
          Completar
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
      <div className="aviso-fase-progreso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Ficha completa al ${pct} %`}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
