import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import './TablaDesplazable.css'

/**
 * Contenedor de tabla ancha: si no caben todas las columnas, muestra una flecha en el borde
 * para desplazarla hacia ese lado (además de la barra de desplazamiento de siempre).
 */
export function TablaDesplazable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hayIzquierda, setHayIzquierda] = useState(false)
  const [hayDerecha, setHayDerecha] = useState(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setHayIzquierda(el.scrollLeft > 2)
    setHayDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    if (el.firstElementChild) obs.observe(el.firstElementChild)
    return () => obs.disconnect()
  }, [medir])

  const mover = (lado: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: lado * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className="tabla-desplazable">
      <div className="table-wrap" ref={ref} onScroll={medir}>
        {children}
      </div>
      {hayIzquierda && (
        <div className="tabla-desplazable-borde is-izquierda">
          <button type="button" className="tabla-desplazable-btn" onClick={() => mover(-1)} aria-label="Ver las columnas de la izquierda" title="Ver las columnas de la izquierda">
            <Icon name="chevronLeft" size={16} />
          </button>
        </div>
      )}
      {hayDerecha && (
        <div className="tabla-desplazable-borde is-derecha">
          <button type="button" className="tabla-desplazable-btn" onClick={() => mover(1)} aria-label="Ver más columnas" title="Ver más columnas">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
