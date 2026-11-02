import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import './AvisoDescuentos.css'

/**
 * Letrero naranja para el equipo de ventas con las oportunidades que esperan su descuento.
 * Con 'enlace' lleva a la lista ya filtrada; con 'onVer', filtra en la misma pantalla.
 */
export function AvisoDescuentos({ n, enlace, onVer }: { n: number; enlace?: string; onVer?: () => void }) {
  if (n === 0) return null
  const texto = n === 1 ? 'Hay 1 oportunidad esperando el descuento de ventas.' : `Hay ${n} oportunidades esperando el descuento de ventas.`
  return (
    <div className="aviso-descuentos" role="status">
      <Icon name="warning" size={16} />
      <span>{texto}</span>
      {enlace && (
        <Link to={enlace} className="aviso-descuentos-accion">
          Ver y poner descuento
        </Link>
      )}
      {onVer && (
        <button type="button" className="aviso-descuentos-accion" onClick={onVer}>
          Ver solo esas
        </button>
      )}
    </div>
  )
}

/** Filtro de un clic: solo las oportunidades a la espera del descuento de ventas. */
export function FiltroDescuentoPendiente({ activo, onChange }: { activo: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`filtro-chip filtro-descuento${activo ? ' is-activo' : ''}`} aria-pressed={activo} onClick={() => onChange(!activo)}>
      <span className="filtro-chip-texto">Falta descuento de ventas</span>
    </button>
  )
}
