import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FASE_COLORS } from '../../components/StatusBadge'
import { fechaCorta, parseFecha } from '../../lib/formato'
import { FASES_ACTIVAS, Fase, FaseLabel, PlazoDecisionLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'
import { CAMPOS_TARJETA, CAMPOS_TARJETA_POR_DEFECTO, type CampoTarjeta } from './camposTarjeta'

const COLUMNAS: Fase[] = [...FASES_ACTIVAS, Fase.Perdido]
const RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** "hace 3 días", "hace 2 semanas"... */
function haceCuanto(fecha: Date, ahora: number): string {
  const dias = Math.round((fecha.getTime() - ahora) / 86400000)
  if (Math.abs(dias) < 7) return RELATIVO.format(dias, 'day')
  if (Math.abs(dias) < 60) return RELATIVO.format(Math.round(dias / 7), 'week')
  return RELATIVO.format(Math.round(dias / 30), 'month')
}

/**
 * Vista por columnas de fase. Con `onMover`, las tarjetas se arrastran a otra columna y quien
 * llama abre la ventana de cambio de fase (que pide los datos de la fase destino).
 */
export function VistaPipeline({
  leads,
  enFaseDesde,
  ahora,
  soloFases,
  campos = CAMPOS_TARJETA_POR_DEFECTO,
  nombreConcesionario,
  onMover,
}: {
  leads: Lead[]
  /** Fecha de entrada en la fase actual, por lead (de fl_fasehistorico). */
  enFaseDesde: Map<string, Date>
  ahora: number
  /** Si hay filtro de fase, solo esas columnas. */
  soloFases?: Fase[]
  campos?: CampoTarjeta[]
  nombreConcesionario?: (l: Lead) => string
  onMover?: (lead: Lead, fase: Fase) => void
}) {
  const [arrastrado, setArrastrado] = useState<Lead | null>(null)
  const [sobre, setSobre] = useState<Fase | null>(null)
  const columnas = soloFases && soloFases.length ? COLUMNAS.filter((f) => soloFases.includes(f)) : COLUMNAS
  const ver = new Set(campos)

  const soltar = (fase: Fase) => {
    if (arrastrado && arrastrado.fl_faseactual !== fase) onMover?.(arrastrado, fase)
    setArrastrado(null)
    setSobre(null)
  }

  return (
    <div className={`pipeline${arrastrado ? ' is-arrastrando' : ''}`}>
      {columnas.map((fase) => {
        const enColumna = leads.filter((l) => l.fl_faseactual === fase)
        const vehiculos = enColumna.reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0)
        const destino = arrastrado !== null && arrastrado.fl_faseactual !== fase
        return (
          <section
            key={fase}
            className={`pipeline-col${fase === Fase.Perdido ? ' is-perdido' : ''}${destino && sobre === fase ? ' is-destino' : ''}`}
            style={{ '--fase-color': FASE_COLORS[fase].dot } as CSSProperties}
            onDragOver={
              onMover
                ? (e) => {
                    if (!destino) return
                    e.preventDefault()
                    if (sobre !== fase) setSobre(fase)
                  }
                : undefined
            }
            onDragLeave={onMover ? (e) => !e.currentTarget.contains(e.relatedTarget as Node) && setSobre(null) : undefined}
            onDrop={onMover ? () => soltar(fase) : undefined}
          >
            <header className="pipeline-col-cabecera">
              <span className="pipeline-col-punto" />
              <span className="pipeline-col-nombre">{FaseLabel[fase]}</span>
              <span className="pipeline-col-cuenta">{enColumna.length}</span>
              {vehiculos > 0 && <span className="pipeline-col-resumen">{vehiculos} veh.</span>}
            </header>
            <div className="pipeline-tarjetas">
              {enColumna.length === 0 ? (
                <p className="pipeline-vacio">{destino ? 'Suelta aquí' : 'Sin leads'}</p>
              ) : (
                enColumna.map((l) => {
                  const desde = enFaseDesde.get(l.fl_leadid) ?? parseFecha(l.fl_fechaprimercontacto || l.createdon) ?? new Date(ahora)
                  const accion = parseFecha(l.fl_fechaproximaaccion)
                  const abierta = fase !== Fase.Perdido && fase !== Fase.Entrega
                  const vencida = accion !== null && abierta && accion.getTime() < ahora - 86400000
                  const lineas: ReactNode[] = []
                  const fila = (k: string, contenido: ReactNode, clase = 'pipeline-meta') => lineas.push(<span key={k} className={clase}>{contenido}</span>)
                  const detalle = [ver.has('modelos') ? l.fl_modelosinteres : '', ver.has('vehiculos') && l.fl_numvehiculosrenovarampliar > 0 ? `${l.fl_numvehiculosrenovarampliar} veh.` : '']
                    .filter(Boolean)
                    .join(' · ')
                  if (ver.has('contacto') && l.fl_nombreresponsable) fila('contacto', l.fl_nombreresponsable)
                  if (detalle) fila('detalle', detalle)
                  if (ver.has('sector') && l.fl_actividadeconomica) fila('sector', l.fl_actividadeconomica)
                  if (ver.has('plazo') && l.fl_plazoestimadodecision != null) fila('plazo', `Decide en ${PlazoDecisionLabel[l.fl_plazoestimadodecision]?.toLowerCase()}`)
                  if (ver.has('comercial') && l.fl_comercialresponsable) fila('comercial', l.fl_comercialresponsable)
                  if (ver.has('concesionario') && nombreConcesionario) fila('concesionario', nombreConcesionario(l))
                  if (ver.has('fechaAlta') && l.fl_fechaprimercontacto) fila('alta', `Primer contacto ${fechaCorta(l.fl_fechaprimercontacto)}`)
                  const conAccion = ver.has('proximaAccion') && accion !== null && abierta
                  const conTiempo = ver.has('tiempoEnFase')

                  return (
                    <Link
                      key={l.fl_leadid}
                      to={`/lead/${l.fl_leadid}`}
                      className={`pipeline-tarjeta${arrastrado?.fl_leadid === l.fl_leadid ? ' is-arrastrada' : ''}`}
                      draggable={!!onMover}
                      onDragStart={
                        onMover
                          ? (e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', l.fl_leadid)
                              setArrastrado(l)
                            }
                          : undefined
                      }
                      onDragEnd={() => {
                        setArrastrado(null)
                        setSobre(null)
                      }}
                    >
                      <span className="pipeline-tarjeta-cabecera">
                        <span className="pipeline-empresa">{l.fl_razonsocial}</span>
                        {ver.has('numero') && <span className="pipeline-numero">{l.fl_numero}</span>}
                      </span>
                      {lineas}
                      {(conAccion || conTiempo) && (
                        <span className="pipeline-pie">
                          <span className={`pipeline-accion${vencida ? ' is-vencida' : ''}`}>
                            {conAccion && (
                              <>
                                <Icon name="calendar" size={11} />
                                {l.fl_proximaaccion || 'Próxima acción'} · {fechaCorta(l.fl_fechaproximaaccion).replace(/ \d{4}$/, '')}
                              </>
                            )}
                          </span>
                          {conTiempo && (
                            <span className="pipeline-tiempo" title="Tiempo en esta fase">
                              {haceCuanto(desde, ahora)}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Botón y panel para elegir qué campos salen en las tarjetas. */
export function ConfigTarjetas({
  campos,
  onChange,
  conConcesionario,
}: {
  campos: CampoTarjeta[]
  onChange: (c: CampoTarjeta[]) => void
  conConcesionario?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const opciones = (Object.keys(CAMPOS_TARJETA) as CampoTarjeta[]).filter((c) => conConcesionario || c !== 'concesionario')
  return (
    <div className="view-editor">
      <button type="button" className="btn-mini" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <Icon name="sliders" size={14} />
        Campos de tarjeta
      </button>
      {abierto && (
        <>
          <button type="button" className="view-editor-backdrop" aria-label="Cerrar" onClick={() => setAbierto(false)} />
          <div className="view-editor-panel">
            <p className="view-editor-title">Qué se ve en cada tarjeta</p>
            {opciones.map((c) => (
              <label key={c} className="view-editor-item">
                <input
                  type="checkbox"
                  checked={campos.includes(c)}
                  onChange={() => onChange(campos.includes(c) ? campos.filter((x) => x !== c) : opciones.filter((o) => o === c || campos.includes(o)))}
                />
                {CAMPOS_TARJETA[c]}
              </label>
            ))}
            <button type="button" className="filtro-limpiar" onClick={() => onChange(CAMPOS_TARJETA_POR_DEFECTO)}>
              Volver a los de por defecto
            </button>
          </div>
        </>
      )}
    </div>
  )
}
