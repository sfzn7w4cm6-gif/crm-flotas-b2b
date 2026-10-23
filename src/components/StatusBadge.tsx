import { Fase, FaseLabel } from '../lib/types'
import './StatusBadge.css'

// Rampa ordinal en escala de grises/negro EBRO (no marron): una fase = un
// escalon de claro a oscuro, look moderno y monocromo. "Perdido" es un
// estado terminal aparte, no un paso mas del embudo, asi que usa un token
// critico independiente (rojo), nunca la rampa.
export const FASE_COLORS: Record<Fase, { bg: string; fg: string }> = {
  [Fase.Prospeccion]: { bg: '#ece9e3', fg: '#1d1d1b' },
  [Fase.PrimerContacto]: { bg: '#d7d3c9', fg: '#1d1d1b' },
  [Fase.Cualificacion]: { bg: '#b8b3a5', fg: '#1d1d1b' },
  [Fase.Propuesta]: { bg: '#8f8a7b', fg: '#ffffff' },
  [Fase.Negociacion]: { bg: '#6e695c', fg: '#ffffff' },
  [Fase.Cierre]: { bg: '#4b473e', fg: '#ffffff' },
  [Fase.Entrega]: { bg: '#2e2c27', fg: '#ffffff' },
  [Fase.Fidelizacion]: { bg: '#1d1d1b', fg: '#ffffff' },
  [Fase.Perdido]: { bg: '#9c3b30', fg: '#ffffff' },
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
