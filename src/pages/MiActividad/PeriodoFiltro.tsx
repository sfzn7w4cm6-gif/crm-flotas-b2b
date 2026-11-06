import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { mismoPeriodo, nombrePeriodos } from '../../lib/actividadService'
import type { Periodo, PeriodoMulti } from '../../lib/actividadService'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Boton de filtro dentro de una tarjeta: elige uno o varios meses y/o años (ej. agosto +
 *  septiembre). Lista vacía = "Todo" (sin filtrar). `primerAnio` limita los años que se
 *  ofrecen (desde el primer dato). El popover no se cierra al elegir, para poder marcar
 *  varios de seguido; se cierra al hacer clic fuera o con Escape. */
export function PeriodoFiltro({
  value,
  onChange,
  primerAnio,
  etiqueta,
}: {
  value: PeriodoMulti
  onChange: (p: PeriodoMulti) => void
  primerAnio: number
  /** Si se indica, el botón muestra este texto (el periodo elegido) en lugar del icono. */
  etiqueta?: string
}) {
  const hoy = new Date()
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<Periodo['tipo']>(value[0]?.tipo ?? 'mes')
  const [anioVista, setAnioVista] = useState(value[0]?.anio ?? hoy.getFullYear())
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

  const toggle = (p: Periodo) => {
    const yaEsta = value.some((v) => mismoPeriodo(v, p))
    onChange(yaEsta ? value.filter((v) => !mismoPeriodo(v, p)) : [...value, p])
  }
  const filtrado = value.length > 0
  const desde = Math.min(primerAnio, hoy.getFullYear())
  const anios = Array.from({ length: hoy.getFullYear() - desde + 1 }, (_, i) => hoy.getFullYear() - i)

  return (
    <div className="periodo-filtro" ref={ref}>
      <button
        type="button"
        className={etiqueta ? 'periodo-btn-texto' : `periodo-btn${filtrado ? ' is-activo' : ''}`}
        onClick={() => setAbierto((a) => !a)}
        aria-label="Filtrar por periodo"
        aria-expanded={abierto}
        title="Filtrar por mes o año (varios a la vez)"
      >
        {etiqueta ? (
          <>
            {nombrePeriodos(value) === 'Todo' ? etiqueta : nombrePeriodos(value)}
            <Icon name="chevronDown" size={13} />
          </>
        ) : (
          <Icon name="filter" size={14} />
        )}
      </button>

      {abierto && (
        <div className="periodo-pop" role="dialog" aria-label="Elegir uno o varios periodos">
          <div className="periodo-modos">
            <button type="button" className={modo === 'mes' ? 'is-activo' : ''} onClick={() => setModo('mes')}>
              Mes
            </button>
            <button type="button" className={modo === 'anio' ? 'is-activo' : ''} onClick={() => setModo('anio')}>
              Año
            </button>
          </div>

          {modo === 'mes' ? (
            <>
              <div className="periodo-anio-nav">
                <button type="button" disabled={anioVista <= desde} onClick={() => setAnioVista((a) => a - 1)} aria-label="Año anterior">
                  <Icon name="chevronLeft" size={14} />
                </button>
                <span>{anioVista}</span>
                <button
                  type="button"
                  disabled={anioVista >= hoy.getFullYear()}
                  onClick={() => setAnioVista((a) => a + 1)}
                  aria-label="Año siguiente"
                >
                  <Icon name="chevronRight" size={14} />
                </button>
              </div>
              <div className="periodo-rejilla">
                {MESES.map((m, i) => {
                  const p: Periodo = { tipo: 'mes', anio: anioVista, mes: i }
                  const futuro = anioVista === hoy.getFullYear() && i > hoy.getMonth()
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={futuro}
                      className={value.some((v) => mismoPeriodo(v, p)) ? 'is-sel' : ''}
                      onClick={() => toggle(p)}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="periodo-rejilla periodo-rejilla-anios">
              {anios.map((a) => {
                const p: Periodo = { tipo: 'anio', anio: a }
                return (
                  <button key={a} type="button" className={value.some((v) => mismoPeriodo(v, p)) ? 'is-sel' : ''} onClick={() => toggle(p)}>
                    {a}
                  </button>
                )
              })}
            </div>
          )}

          <p className="periodo-nota">{filtrado ? `${nombrePeriodos(value)} elegido${value.length === 1 ? '' : 's'}.` : 'Sin filtrar (todo).'} Puedes marcar varios.</p>

          {filtrado && (
            <button type="button" className="periodo-reset" onClick={() => onChange([])}>
              Quitar filtro (ver todo)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
