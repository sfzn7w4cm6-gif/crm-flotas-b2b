import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { FASES_ACTIVAS, Fase, FaseLabel } from '../lib/types'
import './StatusBadge.css'

// Rampa ordinal neutra (gris frio -> negro EBRO), sin marron: una fase = un
// escalon de claro a oscuro, look moderno y monocromo. "Perdido" es un
// estado terminal aparte, no un paso mas del embudo, asi que usa un token
// critico independiente (rojo), nunca la rampa.
export const FASE_COLORS: Record<Fase, { bg: string; fg: string }> = {
  [Fase.Prospeccion]: { bg: '#f4f4f5', fg: '#27272a' },
  [Fase.PrimerContacto]: { bg: '#e4e4e7', fg: '#27272a' },
  [Fase.Cualificacion]: { bg: '#c9c9ce', fg: '#1d1d1b' },
  [Fase.Propuesta]: { bg: '#9f9fa6', fg: '#ffffff' },
  [Fase.Negociacion]: { bg: '#71717a', fg: '#ffffff' },
  [Fase.Cierre]: { bg: '#52525b', fg: '#ffffff' },
  [Fase.Entrega]: { bg: '#333336', fg: '#ffffff' },
  [Fase.Fidelizacion]: { bg: '#1d1d1b', fg: '#ffffff' },
  [Fase.Perdido]: { bg: '#9c3b30', fg: '#ffffff' },
}

const OPCIONES_FASE: Fase[] = [...FASES_ACTIVAS, Fase.Perdido]

export function FaseDot({ fase, size = 9 }: { fase: Fase; size?: number }) {
  return <span className="fase-dot" style={{ width: size, height: size, background: FASE_COLORS[fase].bg }} />
}

export function FaseBadge({ fase, size = 'md' }: { fase: Fase; size?: 'sm' | 'md' }) {
  const colors = FASE_COLORS[fase]
  return (
    <span
      className={`fase-badge fase-badge-${size}`}
      style={{ background: colors.bg, color: colors.fg, borderColor: 'rgba(29,29,27,0.15)' }}
    >
      {FaseLabel[fase]}
    </span>
  )
}

export function RiesgoBadge({ dias }: { dias: number }) {
  return (
    <span className="riesgo-badge">
      ⚠ Estancado {dias} días
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  return (
    <div className="fase-select" ref={ref}>
      <button type="button" className="filter-select fase-select-trigger" onClick={() => setAbierto((v) => !v)}>
        {value !== '' && <FaseDot fase={value} />}
        <span>{value === '' ? placeholder : FaseLabel[value]}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {abierto && (
        <div className="fase-select-panel" role="listbox">
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
