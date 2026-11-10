import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { FaseSelect } from '../../components/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { CAMPOS, camposDelDialogo, type CampoFase } from '../../lib/camposFase'
import { esSinConcesionario } from '../../lib/descuento'
import { actualizarLead, cambiarFaseLead, type ActualizarLeadInput } from '../../lib/leadsService'
import { fetchLineas, guardarCambiosLineas } from '../../lib/lineasService'
import { Fase, FaseLabel, ModoFinanciacionLabel, PlazoDecisionLabel, RolApp } from '../../lib/types'
import type { Lead, LineaOportunidad, Modelo } from '../../lib/types'
import { LineasOportunidad } from './LineasOportunidad'
import { borradorInicial, cambiosDelBorrador, lineasConBorrador, TablaModelos, type Borrador } from './TablaModelos'

/**
 * Ventana para cambiar de fase pidiendo los datos de la fase destino, o (sin cambiar de fase)
 * para completar lo que falta de la fase actual. Para cambiar de fase hay que rellenar antes
 * los campos obligatorios (*); al solo completar datos se puede guardar lo que se tenga.
 * Los modelos se guardan en cuanto se añaden, como en la ficha.
 */
export function CambioFaseDialog({
  lead,
  soloCompletar,
  faseInicial,
  onCerrar,
  onHecho,
}: {
  lead: Lead
  /** true: completar la fase actual, sin elegir otra. */
  soloCompletar: boolean
  /** Fase destino ya elegida (al arrastrar la tarjeta en el pipeline). */
  faseInicial?: Fase
  onCerrar: () => void
  onHecho: () => void
}) {
  const { effectiveRol, isAdmin, viewAsRole } = useAuth()
  // Descuento de marca: ventas, el administrador y la gente de "Sin concesionario".
  const editaVentas = effectiveRol === RolApp.EquipoVentas || (isAdmin && viewAsRole === null) || esSinConcesionario(lead._fl_concesionario_value)

  const [fase, setFase] = useState<Fase | ''>(soloCompletar ? lead.fl_faseactual : (faseInicial ?? ''))
  const [valores, setValores] = useState<Partial<Record<CampoFase, string>>>(() => valoresIniciales(lead))
  const [motivoPerdida, setMotivoPerdida] = useState('')
  // Las líneas al abrir deciden qué campos se muestran; las actuales, si se cumple el obligatorio.
  const [lineasIniciales, setLineasIniciales] = useState<LineaOportunidad[] | null>(null)
  const [lineas, setLineas] = useState<LineaOportunidad[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [borrador, setBorrador] = useState<Borrador>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLineas(lead.fl_leadid)
      .then((l) => {
        setLineasIniciales(l)
        setLineas(l)
        setBorrador(borradorInicial(l))
      })
      .catch(() => setLineasIniciales([]))
  }, [lead.fl_leadid])

  // Al añadir o quitar modelos, el borrador de descuentos sigue a las líneas sin perder lo escrito.
  const alCambiarLineas = (nuevas: LineaOportunidad[], m: Modelo[]) => {
    setLineas(nuevas)
    if (m.length) setModelos(m)
    setBorrador((b) => ({ ...borradorInicial(nuevas), ...Object.fromEntries(Object.entries(b).filter(([id]) => nuevas.some((l) => l.fl_lineaoportunidadid === id))) }))
  }

  const campos = useMemo(
    () => (fase === '' || lineasIniciales === null ? [] : camposDelDialogo(fase, { lead, numLineas: lineasIniciales.length, lineas: lineasIniciales })),
    [fase, lead, lineasIniciales],
  )
  const conCierre = campos.some((c) => c.campo === 'cierre')
  const permisosTabla = { cantidad: conCierre, concesionario: true, ventas: editaVentas }

  const relleno = (campo: CampoFase) => {
    if (campo === 'modelos') return lineas.length > 0 || !!lead.fl_modelosinteres
    if (campo === 'descuentos' || campo === 'cierre') {
      const vistas = lineasConBorrador(lineas, borrador)
      return vistas.length > 0 && vistas.every((l) => l.fl_descuentoconcesionario != null && !Number.isNaN(l.fl_descuentoconcesionario))
    }
    return (valores[campo] ?? '').trim() !== ''
  }
  const faltan = campos.filter((c) => c.obligatorio && !relleno(c.campo))
  const faltaMotivo = fase === Fase.Perdido && motivoPerdida.trim() === ''
  const cambiaFase = !soloCompletar && fase !== '' && fase !== lead.fl_faseactual
  // Para cambiar de fase, todo lo obligatorio tiene que estar relleno.
  const bloqueado = cambiaFase && (faltan.length > 0 || faltaMotivo)
  const puedeGuardar = fase !== '' && !guardando && lineasIniciales !== null && !bloqueado

  const set = (campo: CampoFase, v: string) => setValores((x) => ({ ...x, [campo]: v }))

  const guardar = async () => {
    if (fase === '' || !puedeGuardar) return
    const hayTabla = campos.some((c) => c.campo === 'descuentos' || c.campo === 'cierre')
    const tabla = hayTabla ? cambiosDelBorrador(lineas, borrador, permisosTabla) : { cambios: [] }
    if (tabla.error) {
      setError(tabla.error)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      if (tabla.cambios.length) await guardarCambiosLineas(lead.fl_leadid, tabla.cambios, modelos, { borrarMarcaSiCambia: !editaVentas })
      const iniciales = valoresIniciales(lead)
      const cambios: Record<string, unknown> = {}
      for (const { campo } of campos) {
        const tipo = CAMPOS[campo]?.tipo
        if (tipo === 'modelos' || tipo === 'descuentos' || tipo === 'cierre') continue
        const v = (valores[campo] ?? '').trim()
        if (v === '' || v === iniciales[campo]) continue
        cambios[campo] = tipo === 'numero' || tipo === 'euros' || tipo === 'porcentaje' || tipo === 'financiacion' || tipo === 'plazo' ? Number(v) : v
      }
      await actualizarLead(lead.fl_leadid, cambios as ActualizarLeadInput, lead._fl_empresa_value)
      if (fase !== lead.fl_faseactual) {
        await cambiarFaseLead(lead.fl_leadid, lead.fl_numero, fase, fase === Fase.Perdido ? motivoPerdida.trim() || undefined : undefined, lead._fl_empresa_value)
      }
      onHecho()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // Agrupados por sección, en el orden de la ficha.
  const secciones: { titulo: string; campos: typeof campos }[] = []
  for (const c of campos) {
    const titulo = CAMPOS[c.campo]?.seccion ?? ''
    const s = secciones.find((x) => x.titulo === titulo)
    if (s) s.campos.push(c)
    else secciones.push({ titulo, campos: [c] })
  }

  const tablaModelos = (
    <>
      {lineas.length === 0 ? (
        <p className="flow-meta">Añade primero los modelos de interés: el descuento se pone por modelo.</p>
      ) : (
        <TablaModelos lineas={lineas} modelos={modelos} borrador={borrador} permisos={permisosTabla} onChange={setBorrador} />
      )}
    </>
  )

  return (
    <div className="table-modal-backdrop" onClick={onCerrar}>
      <div className="table-modal fase-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="table-modal-header">
          <h2>{soloCompletar ? `Completar datos · ${FaseLabel[lead.fl_faseactual]}` : 'Cambiar fase'}</h2>
          <button type="button" className="table-modal-close" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="table-modal-body fase-dialog-body">
          {!soloCompletar && (
            <div className="field">
              <label>Nueva fase</label>
              <FaseSelect value={fase} onChange={setFase} placeholder="Selecciona una fase" />
            </div>
          )}

          {fase === Fase.Perdido && (
            <div className="field">
              <label>Motivo de la pérdida *</label>
              <textarea rows={3} value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value)} />
            </div>
          )}

          {fase !== '' && lineasIniciales === null && <p className="flow-meta">Cargando…</p>}

          {secciones.length > 0 && (
            <p className="flow-meta">
              {soloCompletar
                ? 'Los campos con * son necesarios para esta fase. El resto puedes dejarlo para más tarde.'
                : 'Rellena los campos con * para poder pasar a esta fase. El resto puedes dejarlo para más tarde.'}
            </p>
          )}

          {secciones.map((s) => {
            const ancha = s.titulo === 'Oferta' || s.titulo === 'Cierre de la operación'
            return (
              <div key={s.titulo} className={ancha ? 'fase-dialog-seccion fase-dialog-seccion-oferta' : 'fase-dialog-seccion'}>
                <h3>{s.titulo}</h3>
                <div className={ancha ? 'datos-form-grid' : 'wizard-form'}>
                  {s.campos.map(({ campo, obligatorio }) => {
                    const def = CAMPOS[campo]!
                    const vacio = obligatorio && !relleno(campo)
                    return (
                      <div key={campo} className={`field${ancha ? ' is-ancho' : ''}${vacio && cambiaFase ? ' is-falta' : ''}`}>
                        <label>
                          {def.label} {obligatorio ? '*' : ''}
                        </label>
                        {def.tipo === 'modelos' ? (
                          <LineasOportunidad leadId={lead.fl_leadid} textoAnterior={lead.fl_modelosinteres} soloLectura={false} onLineas={alCambiarLineas} />
                        ) : def.tipo === 'descuentos' ? (
                          tablaModelos
                        ) : def.tipo === 'cierre' ? (
                          <>
                            <LineasOportunidad leadId={lead.fl_leadid} textoAnterior={lead.fl_modelosinteres} soloLectura={false} onLineas={alCambiarLineas} />
                            {tablaModelos}
                          </>
                        ) : (
                          <CampoInput campo={campo} tipo={def.tipo} valor={valores[campo] ?? ''} onChange={(v) => set(campo, v)} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {error && <p className="wizard-error">{error}</p>}
        </div>

        {(faltan.length > 0 || faltaMotivo) && (
          <div className={`fase-dialog-aviso${bloqueado ? ' is-bloqueo' : ''}`} role="status">
            <Icon name="warning" size={15} />
            <span>
              {faltaMotivo && faltan.length === 0 ? 'Falta el motivo de la pérdida' : `Faltan ${faltan.length + (faltaMotivo ? 1 : 0)} datos obligatorios (*)`}.{' '}
              {bloqueado ? 'Complétalos para poder cambiar de fase.' : 'Puedes guardar igualmente y completarlos más tarde.'}
            </span>
          </div>
        )}

        <div className="fase-dialog-footer">
          <button type="button" className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={!puedeGuardar} onClick={guardar} title={bloqueado ? 'Rellena los campos obligatorios (*)' : undefined}>
            {guardando ? 'Guardando…' : cambiaFase ? 'Guardar y cambiar fase' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CampoInput({ campo, tipo, valor, onChange }: { campo: CampoFase; tipo: string; valor: string; onChange: (v: string) => void }) {
  switch (tipo) {
    case 'textoLargo':
      return <textarea rows={2} value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'numero':
    case 'euros':
      return <input type="number" min={0} value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'porcentaje':
      return <input type="number" min={0} max={100} step={0.01} value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'fecha':
      return <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'financiacion':
    case 'plazo': {
      const opciones = tipo === 'financiacion' ? ModoFinanciacionLabel : PlazoDecisionLabel
      return (
        <select value={valor} onChange={(e) => onChange(e.target.value)} aria-label={campo}>
          <option value="">Selecciona una opción</option>
          {Object.entries(opciones).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      )
    }
    default:
      return <input value={valor} onChange={(e) => onChange(e.target.value)} />
  }
}

/** Valores actuales del lead como texto, que es como los manejan los campos del formulario. */
function valoresIniciales(lead: Lead): Partial<Record<CampoFase, string>> {
  const r: Partial<Record<CampoFase, string>> = {}
  for (const [campo, def] of Object.entries(CAMPOS) as [CampoFase, NonNullable<(typeof CAMPOS)[CampoFase]>][]) {
    if (!def.leadField) continue
    const v = lead[def.leadField]
    if (v === null || v === undefined || v === '') continue
    r[campo] = def.tipo === 'fecha' ? String(v).slice(0, 10) : String(v)
  }
  return r
}
