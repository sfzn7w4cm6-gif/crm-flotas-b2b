import { useEffect, useRef, useState, type MouseEvent as EventoRaton } from 'react'
import { Icon } from './Icon'
import { FASES_ACTIVAS, Fase, FaseLabel } from '../lib/types'
import './StatusBadge.css'

// Un tono propio por fase, apagado y sin azul (decisión del negocio): gris, arena, ámbar,
// terracota, malva y, para las ganadas, verde y oliva. Perdido en rojo apagado.
// bg/fg: etiqueta (fondo muy suave y texto del mismo tono). dot: punto, líneas y barras;
// onDot: texto legible encima de dot (oscuro en los tonos claros, blanco en los intensos).
export const FASE_COLORS: Record<Fase, { bg: string; fg: string; dot: string; onDot: string }> = {
  [Fase.Prospeccion]: { bg: '#f1f0ed', fg: '#5c5b56', dot: '#a3a29c', onDot: '#1d1d1b' },
  [Fase.PrimerContacto]: { bg: '#f6efe3', fg: '#7a5b2a', dot: '#c9a46b', onDot: '#1d1d1b' },
  [Fase.Cualificacion]: { bg: '#fbf1d6', fg: '#7d5b00', dot: '#d9a21b', onDot: '#1d1d1b' },
  [Fase.Propuesta]: { bg: '#f9e9df', fg: '#94482a', dot: '#d27a4e', onDot: '#ffffff' },
  [Fase.Negociacion]: { bg: '#f4e9f1', fg: '#74405f', dot: '#a36a93', onDot: '#ffffff' },
  [Fase.Cierre]: { bg: '#e6f3ea', fg: '#1f6b38', dot: '#3f9a5c', onDot: '#ffffff' },
  [Fase.Entrega]: { bg: '#edf1e3', fg: '#4a6129', dot: '#6f8b45', onDot: '#ffffff' },
  [Fase.Perdido]: { bg: '#fbe9e7', fg: '#9c3b30', dot: '#c0564a', onDot: '#ffffff' },
}

const OPCIONES_FASE: Fase[] = [...FASES_ACTIVAS, Fase.Perdido]

export function FaseDot({ fase, size = 9 }: { fase: Fase; size?: number }) {
  return <span className="fase-dot" style={{ width: size, height: size, background: FASE_COLORS[fase].dot }} />
}

export function FaseBadge({ fase, size = 'md', conPunto }: { fase: Fase; size?: 'sm' | 'md'; /** Punto del color de la fase delante (cabecera de la ficha). */ conPunto?: boolean }) {
  const colors = FASE_COLORS[fase]
  return (
    <span
      className={`fase-badge fase-badge-${size}${conPunto ? ' fase-badge-punto' : ''}`}
      style={{ background: colors.bg, color: colors.fg }}
    >
      {conPunto && <FaseDot fase={fase} size={8} />}
      {FaseLabel[fase]}
    </span>
  )
}


/** Desplegable de fase con puntos de color (sustituye al <select> nativo con
 * <option> pintadas, que se renderiza mal/feo en el navegador). */
export function FaseSelect({
  value,
  onChange,
  placeholder = 'Todas las fases',
  opciones = OPCIONES_FASE,
}: {
  value: Fase | ''
  onChange: (fase: Fase | '') => void
  placeholder?: string
  opciones?: Fase[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; maxHeight: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    // El panel va fijo en pantalla: si se desplaza lo de detrás, se cierra para no quedar descolocado.
    const desplazar = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', desplazar, true)
    window.addEventListener('resize', desplazar)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', desplazar, true)
      window.removeEventListener('resize', desplazar)
    }
  }, [abierto])

  const alternar = (e: EventoRaton<HTMLButtonElement>) => {
    if (!abierto) {
      // Se abre hacia abajo si cabe; si no, hacia arriba.
      const r = e.currentTarget.getBoundingClientRect()
      const abajo = window.innerHeight - r.bottom - 16
      const arriba = r.top - 16
      const haciaArriba = abajo < 220 && arriba > abajo
      const maxHeight = Math.min(320, haciaArriba ? arriba : abajo)
      setPos({ top: haciaArriba ? r.top - 8 - maxHeight : r.bottom + 8, left: r.left, minWidth: Math.max(210, r.width), maxHeight })
    }
    setAbierto((v) => !v)
  }

  return (
    <div className="fase-select" ref={ref}>
      <button type="button" className="filter-select fase-select-trigger" onClick={alternar}>
        {value !== '' && <FaseDot fase={value} />}
        <span>{value === '' ? placeholder : FaseLabel[value]}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {abierto && (
        <div className="fase-select-panel" role="listbox" ref={panel} style={pos ?? undefined}>
          <button
            type="button"
            className={`fase-select-item${value === '' ? ' is-active' : ''}`}
            onClick={() => {
              onChange('')
              setAbierto(false)
            }}
          >
            {placeholder}
          </button>
          {opciones.map((f) => (
            <button
              key={f}
              type="button"
              className={`fase-select-item${value === f ? ' is-active' : ''}`}
              onClick={() => {
                onChange(f)
                setAbierto(false)
              }}
            >
              <FaseDot fase={f} />
              {FaseLabel[f]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Etiqueta naranja de las oportunidades a la espera del descuento de ventas. */
export function DescuentoPendienteBadge({ corto }: { corto?: boolean }) {
  return (
    <span className="descuento-pendiente-badge" title="El concesionario ha indicado su descuento. Falta el descuento de marca.">
      <Icon name="warning" size={12} />
      {corto ? 'Pendiente de marca' : 'Pendiente de descuento de marca'}
    </span>
  )
}
