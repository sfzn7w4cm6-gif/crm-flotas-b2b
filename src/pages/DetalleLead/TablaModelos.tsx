import { descuentoTotal, descuentoTotalLineas, formatoPorcentaje } from '../../lib/descuento'
import type { CambioLinea } from '../../lib/lineasService'
import type { LineaOportunidad, Modelo } from '../../lib/types'

// Tabla de modelos de la oportunidad con sus unidades y sus dos descuentos. La usan la oferta
// (descuentos), el cierre de la operación (unidades y descuentos finales) y la ventana de cambio
// de fase. Sin borrador se muestra en lectura; con borrador, los campos que cada uno puede tocar.

export interface FilaBorrador {
  cantidad: string
  concesionario: string
  ventas: string
}
export type Borrador = Record<string, FilaBorrador>

export interface PermisosTabla {
  /** Unidades de cada modelo (solo en el cierre). */
  cantidad: boolean
  concesionario: boolean
  ventas: boolean
}

const texto = (n: number | null | undefined) => (n == null ? '' : String(n))

export function borradorInicial(lineas: LineaOportunidad[]): Borrador {
  return Object.fromEntries(
    lineas.map((l) => [l.fl_lineaoportunidadid, { cantidad: String(l.fl_cantidad), concesionario: texto(l.fl_descuentoconcesionario), ventas: texto(l.fl_descuentoventas) }]),
  )
}

/** Lo que ha cambiado respecto a las líneas guardadas, o el error si algún valor no vale. */
export function cambiosDelBorrador(lineas: LineaOportunidad[], borrador: Borrador, permisos: PermisosTabla): { cambios: CambioLinea[]; error?: string } {
  const cambios: CambioLinea[] = []
  for (const l of lineas) {
    const b = borrador[l.fl_lineaoportunidadid]
    if (!b) continue
    const pct = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
    const dc = pct(b.concesionario)
    const dv = pct(b.ventas)
    for (const n of [dc, dv]) if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) return { cambios: [], error: 'Cada descuento debe estar entre el 0 % y el 100 %.' }
    if ((dc ?? 0) + (dv ?? 0) > 100) return { cambios: [], error: 'La suma de los dos descuentos de un modelo no puede superar el 100 %.' }
    const cant = Number(b.cantidad)
    if (permisos.cantidad && (!Number.isInteger(cant) || cant < 1)) return { cambios: [], error: 'Las unidades de cada modelo deben ser un número entero de 1 o más.' }
    const c: CambioLinea = { lineaId: l.fl_lineaoportunidadid }
    if (permisos.cantidad && cant !== l.fl_cantidad) c.cantidad = cant
    if (permisos.concesionario && dc !== (l.fl_descuentoconcesionario ?? null)) c.descuentoConcesionario = dc
    if (permisos.ventas && dv !== (l.fl_descuentoventas ?? null)) c.descuentoVentas = dv
    if (Object.keys(c).length > 1) cambios.push(c)
  }
  return { cambios }
}

/** Las líneas tal y como quedarían con el borrador (para comprobar obligatorios antes de guardar). */
export function lineasConBorrador(lineas: LineaOportunidad[], borrador: Borrador | null): LineaOportunidad[] {
  if (!borrador) return lineas
  return lineas.map((l) => {
    const b = borrador[l.fl_lineaoportunidadid]
    if (!b) return l
    const n = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
    return { ...l, fl_cantidad: Number(b.cantidad) || l.fl_cantidad, fl_descuentoconcesionario: n(b.concesionario), fl_descuentoventas: n(b.ventas) }
  })
}

export function TablaModelos({
  lineas,
  modelos,
  borrador,
  permisos,
  onChange,
  pendienteMarca,
}: {
  lineas: LineaOportunidad[]
  modelos: Modelo[]
  /** null: solo lectura. */
  borrador: Borrador | null
  permisos: PermisosTabla
  onChange: (b: Borrador) => void
  /** Texto del % de marca vacío cuando falta (p. ej. "Pendiente"). */
  pendienteMarca?: string
}) {
  const nombre = new Map(modelos.map((m) => [m.fl_modeloid, m.fl_nombre]))
  const vistas = lineasConBorrador(lineas, borrador)
  const totalUnidades = vistas.reduce((acc, l) => acc + (l.fl_cantidad || 0), 0)
  const set = (id: string, campo: keyof FilaBorrador, v: string) => borrador && onChange({ ...borrador, [id]: { ...borrador[id], [campo]: v } })

  const input = (id: string, campo: keyof FilaBorrador, editable: boolean, etiqueta: string) =>
    borrador && editable ? (
      <input
        type="number"
        className="tabla-modelos-input"
        min={campo === 'cantidad' ? 1 : 0}
        max={campo === 'cantidad' ? undefined : 100}
        step={campo === 'cantidad' ? 1 : 0.01}
        value={borrador[id]?.[campo] ?? ''}
        onChange={(e) => set(id, campo, e.target.value)}
        aria-label={etiqueta}
      />
    ) : null

  return (
    <div className="tabla-modelos-wrap">
      <table className="tabla-modelos">
        <thead>
          <tr>
            <th>Modelo</th>
            <th className="num">Unidades</th>
            <th className="num">Dto. concesionario</th>
            <th className="num">Dto. marca</th>
            <th className="num">Dto. total</th>
          </tr>
        </thead>
        <tbody>
          {vistas.map((l) => {
            const id = l.fl_lineaoportunidadid
            const n = nombre.get(l._fl_modelo_value) ?? l.fl_titulo
            return (
              <tr key={id}>
                <td>{n}</td>
                <td className="num">{input(id, 'cantidad', permisos.cantidad, `Unidades de ${n}`) ?? l.fl_cantidad}</td>
                <td className="num">{input(id, 'concesionario', permisos.concesionario, `Descuento del concesionario de ${n}`) ?? formatoPorcentaje(l.fl_descuentoconcesionario)}</td>
                <td className="num">
                  {input(id, 'ventas', permisos.ventas, `Descuento de marca de ${n}`) ??
                    (l.fl_descuentoventas == null && l.fl_descuentoconcesionario != null && pendienteMarca ? (
                      <span className="oferta-pendiente">{pendienteMarca}</span>
                    ) : (
                      formatoPorcentaje(l.fl_descuentoventas)
                    ))}
                </td>
                <td className="num">
                  <strong>{formatoPorcentaje(descuentoTotal(l))}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{totalUnidades} uds.</td>
            <td />
            <td />
            <td className="num" title="Media ponderada por unidades">
              <strong>{formatoPorcentaje(descuentoTotalLineas(vistas))}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
