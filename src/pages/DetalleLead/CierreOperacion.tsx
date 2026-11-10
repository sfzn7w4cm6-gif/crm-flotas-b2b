import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { CambioLinea } from '../../lib/lineasService'
import type { LineaOportunidad, Modelo } from '../../lib/types'
import { borradorInicial, cambiosDelBorrador, TablaModelos, type Borrador } from './TablaModelos'

/**
 * Resumen final de la venta, a partir de Cierre: unidades vendidas de cada modelo, su total y
 * los descuentos con los que se cerró. Se puede corregir si al final se vendieron otras unidades.
 */
export function CierreOperacion({
  lineas,
  modelos,
  editaConcesionario,
  editaVentas,
  onGuardarLineas,
}: {
  lineas: LineaOportunidad[] | null
  modelos: Modelo[]
  editaConcesionario: boolean
  editaVentas: boolean
  onGuardarLineas: (cambios: CambioLinea[]) => Promise<void>
}) {
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const permisos = { cantidad: editaConcesionario, concesionario: editaConcesionario, ventas: editaVentas }
  const hayModelos = !!lineas && lineas.length > 0

  const guardar = async () => {
    if (!borrador || !lineas) return
    const { cambios, error: err } = cambiosDelBorrador(lineas, borrador, permisos)
    if (err) {
      setError(err)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      if (cambios.length) await onGuardarLineas(cambios)
      setBorrador(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={`bloque-datos bloque-cierre${borrador ? ' is-editando' : ''}`}>
      <header className="bloque-datos-cabecera">
        <h2>Cierre de la operación</h2>
        {(editaConcesionario || editaVentas) && !borrador && hayModelos && (
          <button
            type="button"
            className="bloque-datos-editar"
            onClick={() => {
              setBorrador(borradorInicial(lineas ?? []))
              setError(null)
            }}
            aria-label="Editar cierre de la operación"
            title="Editar"
          >
            <Icon name="pencil" size={14} />
          </button>
        )}
      </header>
      {lineas === null ? (
        <p className="flow-meta">Cargando…</p>
      ) : !hayModelos ? (
        <p className="flow-meta">No hay modelos en esta oportunidad. Añádelos en «Necesidad y oportunidad» con las unidades vendidas.</p>
      ) : (
        <TablaModelos lineas={lineas} modelos={modelos} borrador={borrador} permisos={permisos} onChange={setBorrador} />
      )}
      {borrador && (
        <div className="bloque-datos-form">
          {error && <p className="wizard-error">{error}</p>}
          <div className="bloque-datos-acciones">
            <button type="button" className="btn-link" onClick={() => setBorrador(null)} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
