import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { FiltroMulti } from '../../components/filtros/Filtros'
import { FASES_ACTIVAS, FaseLabel } from '../../lib/types'
import type { Concesionario, Fase, Ubicacion, Zona } from '../../lib/types'
import { NOMBRE_DIMENSION, type DimensionTabla, type VistaPersonal } from './vistasPersonales'
import '../../components/charts/charts.css'

const DIMENSIONES = Object.keys(NOMBRE_DIMENSION) as DimensionTabla[]

export function DialogoVista({
  inicial,
  zonas,
  concesionarios,
  ubicaciones,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  /** null = vista nueva. */
  inicial: VistaPersonal | null
  zonas: Zona[]
  concesionarios: Concesionario[]
  ubicaciones: Ubicacion[]
  onGuardar: (v: VistaPersonal) => void
  onBorrar?: () => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [principal, setPrincipal] = useState<DimensionTabla>(inicial?.principal ?? 'concesionario')
  const [hijo, setHijo] = useState<DimensionTabla | ''>(inicial?.hijo ?? '')
  const [fases, setFases] = useState<Fase[]>(inicial?.fases ?? [...FASES_ACTIVAS])
  const [perdidos, setPerdidos] = useState(inicial?.perdidos ?? true)
  const [zonasSel, setZonasSel] = useState<string[]>(inicial?.zonas ?? [])
  const [concSel, setConcSel] = useState<string[]>(inicial?.concesionarios ?? [])

  const alternarFase = (f: Fase) => setFases((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : FASES_ACTIVAS.filter((x) => x === f || xs.includes(x))))
  // Con zonas elegidas, solo se ofrecen los concesionarios con alguna sede en ellas.
  const concesionariosOfrecidos = zonasSel.length
    ? concesionarios.filter((c) => ubicaciones.some((u) => u._fl_concesionario_value === c.fl_concesionarioid && !!u._fl_zona_value && zonasSel.includes(u._fl_zona_value)))
    : concesionarios
  const valida = nombre.trim() !== ''

  const guardar = () => {
    if (!valida) return
    onGuardar({
      id: inicial?.id ?? `v${Date.now()}`,
      nombre: nombre.trim(),
      principal,
      hijo: hijo && hijo !== principal ? hijo : undefined,
      fases,
      perdidos,
      zonas: zonasSel,
      concesionarios: concSel.filter((c) => concesionariosOfrecidos.some((x) => x.fl_concesionarioid === c)),
    })
  }

  return (
    <div className="table-modal-backdrop" onClick={onCerrar}>
      <div className="table-modal vista-dialogo" role="dialog" aria-modal="true" aria-label={inicial ? 'Editar vista' : 'Nueva vista'} onClick={(e) => e.stopPropagation()}>
        <div className="table-modal-header">
          <h2>{inicial ? 'Editar vista' : 'Nueva vista'}</h2>
          <button type="button" className="table-modal-close" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="table-modal-body vista-dialogo-cuerpo">
          <div className="field">
            <label htmlFor="vista-nombre">Nombre</label>
            <input id="vista-nombre" value={nombre} placeholder="Por ejemplo: Zona Norte por sede" onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>

          <div className="vista-dialogo-fila">
            <div className="field">
              <label htmlFor="vista-principal">Agrupar por</label>
              <select id="vista-principal" value={principal} onChange={(e) => setPrincipal(e.target.value as DimensionTabla)}>
                {DIMENSIONES.map((d) => (
                  <option key={d} value={d}>
                    {NOMBRE_DIMENSION[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vista-hijo">Y dentro de cada uno</label>
              <select id="vista-hijo" value={hijo} onChange={(e) => setHijo(e.target.value as DimensionTabla | '')}>
                <option value="">Nada más</option>
                {DIMENSIONES.filter((d) => d !== principal).map((d) => (
                  <option key={d} value={d}>
                    {NOMBRE_DIMENSION[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Solo de</label>
            <div className="vista-dialogo-filtros">
              <FiltroMulti etiqueta="Zona" opciones={zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))} value={zonasSel} onChange={setZonasSel} />
              <FiltroMulti
                etiqueta="Concesionario"
                opciones={concesionariosOfrecidos.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre }))}
                value={concSel}
                onChange={setConcSel}
              />
              {!zonasSel.length && !concSel.length && <span className="flow-meta">Toda la red</span>}
            </div>
          </div>

          <fieldset className="vista-dialogo-columnas">
            <legend>Columnas</legend>
            {FASES_ACTIVAS.map((f) => (
              <label key={f}>
                <input type="checkbox" checked={fases.includes(f)} onChange={() => alternarFase(f)} />
                {FaseLabel[f]}
              </label>
            ))}
            <label>
              <input type="checkbox" checked={perdidos} onChange={(e) => setPerdidos(e.target.checked)} />
              Perdido
            </label>
          </fieldset>
        </div>

        <div className="vista-dialogo-pie">
          {onBorrar && (
            <button type="button" className="btn-link vista-dialogo-borrar" onClick={onBorrar}>
              Borrar vista
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={!valida} onClick={guardar}>
            Guardar vista
          </button>
        </div>
      </div>
    </div>
  )
}
