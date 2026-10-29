import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon'
import { normalizarTexto } from '../../lib/formato'
import './Filtros.css'

// Filtros de las listas: botones pequeños en forma de píldora que abren un panel.
// FiltroMulti permite marcar varias opciones; FiltroSimple, una.

export interface OpcionFiltro<T> {
  value: T
  label: string
  /** Color del punto delante de la etiqueta (p. ej. la fase). */
  dot?: string
}

function usePanel() {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])
  return { abierto, setAbierto, ref }
}

function Disparador({ activo, abierto, onClick, children }: { activo: boolean; abierto: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`filtro-chip${activo ? ' is-activo' : ''}`} onClick={onClick} aria-expanded={abierto}>
      {children}
      <Icon name="chevronDown" size={13} />
    </button>
  )
}

export function FiltroMulti<T extends string | number>({
  etiqueta,
  opciones,
  value,
  onChange,
}: {
  etiqueta: string
  opciones: OpcionFiltro<T>[]
  value: T[]
  onChange: (v: T[]) => void
}) {
  const { abierto, setAbierto, ref } = usePanel()
  const [q, setQ] = useState('')
  const buscable = opciones.length > 8
  const visibles = q ? opciones.filter((o) => normalizarTexto(o.label).includes(normalizarTexto(q))) : opciones
  const sel = new Set(value)
  const unica = value.length === 1 ? opciones.find((o) => o.value === value[0]) : undefined

  const alternar = (v: T) => onChange(sel.has(v) ? value.filter((x) => x !== v) : [...value, v])

  return (
    <div className="filtro" ref={ref}>
      <Disparador activo={value.length > 0} abierto={abierto} onClick={() => setAbierto((a) => !a)}>
        {unica?.dot && <span className="filtro-dot" style={{ background: unica.dot }} />}
        <span className="filtro-chip-texto">{unica ? unica.label : etiqueta}</span>
        {value.length > 1 && <span className="filtro-cuenta">{value.length}</span>}
      </Disparador>
      {abierto && (
        <div className="filtro-panel" role="listbox" aria-multiselectable="true" aria-label={etiqueta}>
          {buscable && (
            <div className="filtro-buscar">
              <Icon name="search" size={13} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${etiqueta.toLowerCase()}…`} />
            </div>
          )}
          <div className="filtro-opciones">
            {visibles.length === 0 && <p className="filtro-vacio">Sin resultados</p>}
            {visibles.map((o) => (
              <label key={String(o.value)} className="filtro-opcion">
                <input type="checkbox" checked={sel.has(o.value)} onChange={() => alternar(o.value)} />
                {o.dot && <span className="filtro-dot" style={{ background: o.dot }} />}
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <button type="button" className="filtro-limpiar" onClick={() => onChange([])}>
              Quitar selección
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function FiltroSimple<T extends string>({
  opciones,
  value,
  porDefecto,
  onChange,
}: {
  opciones: OpcionFiltro<T>[]
  value: T
  /** La opción que equivale a "sin filtrar": con ella el botón no se marca como activo. */
  porDefecto: T
  onChange: (v: T) => void
}) {
  const { abierto, setAbierto, ref } = usePanel()
  const actual = opciones.find((o) => o.value === value)
  return (
    <div className="filtro" ref={ref}>
      <Disparador activo={value !== porDefecto} abierto={abierto} onClick={() => setAbierto((a) => !a)}>
        <span className="filtro-chip-texto">{actual?.label}</span>
      </Disparador>
      {abierto && (
        <div className="filtro-panel" role="listbox">
          <div className="filtro-opciones">
            {opciones.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`filtro-opcion filtro-opcion-simple${o.value === value ? ' is-sel' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  setAbierto(false)
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Buscador de las listas: busca en todos los campos, tareas y notas. */
export function Buscador({ value, onChange, placeholder = 'Buscar en todo…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="buscador">
      <Icon name="search" size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Buscar" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda">
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  )
}
