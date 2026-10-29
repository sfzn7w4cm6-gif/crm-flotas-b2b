import { useEffect, useState } from 'react'
import { fetchModelos } from '../../lib/catalogosService'
import { borrarLinea, crearLinea, fetchLineas, guardarResumenLineas } from '../../lib/lineasService'
import type { LineaOportunidad, Modelo } from '../../lib/types'

/**
 * Modelos del catálogo y cantidad de cada uno dentro de la oportunidad. Sustituyen al texto libre
 * "Modelos de interés"; los leads anteriores conservan ese texto hasta que se les añade una línea.
 */
export function LineasOportunidad({
  leadId,
  textoAnterior,
  soloLectura,
  onLineas,
}: {
  leadId: string
  textoAnterior?: string
  soloLectura: boolean
  /** Avisa del nº de líneas al cargar y tras cada cambio (la ventana de cambio de fase lo necesita). */
  onLineas?: (n: number) => void
}) {
  const [lineas, setLineas] = useState<LineaOportunidad[] | null>(null)
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [modeloId, setModeloId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tras el primer cambio, el texto anterior ya no aplica: el resumen pasa a salir de las líneas.
  const [editadas, setEditadas] = useState(false)

  useEffect(() => {
    Promise.all([fetchLineas(leadId), fetchModelos()])
      .then(([l, m]) => {
        setLineas(l)
        setModelos(m)
        onLineas?.(l.length)
      })
      .catch(() => setLineas([]))
  }, [leadId])

  const nombre = new Map(modelos.map((m) => [m.fl_modeloid, m.fl_nombre]))
  const total = (lineas ?? []).reduce((acc, l) => acc + l.fl_cantidad, 0)

  const aplicar = async (accion: () => Promise<void>) => {
    setGuardando(true)
    setError(null)
    try {
      await accion()
      const nuevas = await fetchLineas(leadId)
      await guardarResumenLineas(leadId, nuevas, modelos)
      setLineas(nuevas)
      setEditadas(true)
      onLineas?.(nuevas.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const anadir = () => {
    const modelo = modelos.find((m) => m.fl_modeloid === modeloId)
    const n = Number(cantidad)
    if (!modelo || !Number.isInteger(n) || n < 1) return
    aplicar(() => crearLinea(leadId, modelo, n)).then(() => {
      setModeloId('')
      setCantidad('1')
    })
  }

  if (lineas === null) return <p className="flow-meta">Cargando modelos…</p>

  return (
    <div className="lineas-oportunidad">
      <span className="resumen-label">Modelos de interés</span>
      {lineas.length === 0 ? (
        <p className="flow-meta">{!editadas && textoAnterior ? `${textoAnterior} (texto anterior, sin modelo exacto)` : 'Sin modelos añadidos.'}</p>
      ) : (
        <ul className="lineas-lista">
          {lineas.map((l) => (
            <li key={l.fl_lineaoportunidadid}>
              <span>{nombre.get(l._fl_modelo_value) ?? l.fl_titulo}</span>
              <span className="lineas-cantidad">{l.fl_cantidad} ud.</span>
              {!soloLectura && (
                <button
                  type="button"
                  className="btn-link"
                  disabled={guardando}
                  onClick={() => aplicar(() => borrarLinea(l.fl_lineaoportunidadid))}
                  aria-label="Quitar modelo"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
          <li className="lineas-total">
            <span>Total</span>
            <span className="lineas-cantidad">{total} vehículos</span>
          </li>
        </ul>
      )}
      {!soloLectura && (
        <div className="lineas-nueva">
          <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} disabled={guardando}>
            <option value="">Añadir modelo…</option>
            {modelos.map((m) => (
              <option key={m.fl_modeloid} value={m.fl_modeloid}>
                {m.fl_nombre}
              </option>
            ))}
          </select>
          <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} disabled={guardando} aria-label="Cantidad" />
          <button type="button" className="btn-secondary" disabled={guardando || !modeloId} onClick={anadir}>
            Añadir
          </button>
        </div>
      )}
      {error && <p className="wizard-error">{error}</p>}
    </div>
  )
}
