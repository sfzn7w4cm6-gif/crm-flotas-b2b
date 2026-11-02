import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { FaseBadge } from '../../components/StatusBadge'
import { NuevaTareaForm } from '../../components/tareas/Tareas'
import { getRecord, Tables } from '../../lib/dataverseClient'
import { actualizarLead, cambiarComercial, cifEnOtraEmpresa, fetchHistoricoDeFase, fetchLead, type ActualizarLeadInput } from '../../lib/leadsService'
import { fetchAdjuntos, subirAdjuntos } from '../../lib/adjuntosService'
import { borrarNota, crearNotaConAdjuntos, fetchNotas } from '../../lib/notasService'
import { cambiarEstadoTarea, crearTarea, fetchImportesVenta, fetchTareasDeLead, tareaAbierta } from '../../lib/tareasService'
import { fetchComercialesDeSede } from '../../lib/asignacionesService'
import { fechaLarga } from '../../lib/formato'
import { faltantes, requisitosHasta } from '../../lib/camposFase'
import { Fase, RolApp } from '../../lib/types'
import type { Adjunto, Concesionario, EstadoTarea, FaseHistorico, Lead, Nota, Tarea, Ubicacion, UsuarioApp } from '../../lib/types'
import { BloqueDatos, Dato, type DefDato } from './DatosLead'
import { HistorialTareas } from './HistorialTareas'
import { NotasLead } from './NotasLead'
import { LineasOportunidad } from './LineasOportunidad'
import { CambioFaseDialog } from './CambioFaseDialog'
import { AvisoFase } from './AvisoFase'
import { OfertaLead } from './OfertaLead'
import './DetalleLead.css'

const EMPRESA: DefDato[] = [
  { clave: 'razonSocial', label: 'Empresa', tipo: 'texto', ancho: true, ayuda: 'Nombre fiscal (razón social), como aparece en el CIF' },
  { clave: 'cif', label: 'CIF / NIF', tipo: 'cif' },
  { clave: 'nombreResponsable', label: 'Responsable', tipo: 'texto' },
  { clave: 'telefonoCorporativo', label: 'Teléfono', tipo: 'telefono' },
  { clave: 'emailCorporativo', label: 'E-mail', tipo: 'email' },
]
const FLOTA: DefDato[] = [
  { clave: 'numVehiculosActuales', label: 'Vehículos actuales', tipo: 'numero' },
  { clave: 'marcasActuales', label: 'Marcas actuales', tipo: 'texto' },
  { clave: 'actividadEconomica', label: 'Actividad económica', tipo: 'texto' },
  { clave: 'modoFinanciacionActual', label: 'Financiación actual', tipo: 'financiacion' },
  { clave: 'vencimientoContratosActuales', label: 'Vencimiento contratos', tipo: 'fecha' },
]
const NECESIDAD: DefDato[] = [
  { clave: 'cuotasObjetivo', label: 'Cuotas objetivo', tipo: 'euros' },
  { clave: 'plazoEstimadoDecision', label: 'Plazo de decisión', tipo: 'plazo' },
  { clave: 'competidoresDetectados', label: 'Competidores', tipo: 'texto' },
  { clave: 'kmTiempo', label: 'Km / tiempo', tipo: 'texto' },
  { clave: 'requisitos', label: 'Requisitos', tipo: 'textoLargo', ancho: true },
]
const SEGUIMIENTO: DefDato[] = [
  { clave: 'proximaAccion', label: 'Próxima acción', tipo: 'texto' },
  { clave: 'fechaProximaAccion', label: 'Fecha próxima acción', tipo: 'fecha' },
  { clave: 'ultimaAccionRealizada', label: 'Última acción realizada', tipo: 'textoLargo', ancho: true },
  { clave: 'observaciones', label: 'Observaciones', tipo: 'textoLargo', ancho: true },
]

export function DetalleLead() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { effectiveRol, usuario, isAdmin, viewAsRole } = useAuth()
  const soloLectura = effectiveRol === RolApp.EquipoVentas
  // En la oferta, ventas sí pone su parte del descuento (y el administrador, las dos).
  const editaDescuentoVentas = effectiveRol === RolApp.EquipoVentas || (isAdmin && viewAsRole === null)

  const [lead, setLead] = useState<Lead | null>(null)
  const [historico, setHistorico] = useState<FaseHistorico[]>([])
  const [concesionario, setConcesionario] = useState<Concesionario | null>(null)
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [cargando, setCargando] = useState(true)
  // Ventana de cambio de fase, o de completar los datos de la fase actual.
  const [dialogo, setDialogo] = useState<'fase' | 'completar' | null>(null)
  // null hasta que cargan las líneas de modelo (para no avisar de que faltan antes de saberlo).
  const [numLineas, setNumLineas] = useState<number | null>(null)
  // null = la tabla de tareas aun no existe en el entorno
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [notas, setNotas] = useState<Nota[] | null>([])
  const [adjuntos, setAdjuntos] = useState<Map<string, Adjunto[]>>(new Map())
  const [creandoTarea, setCreandoTarea] = useState(false)
  // undefined = la columna de importe aun no existe; null = sin rellenar
  const [importe, setImporte] = useState<number | null | undefined>(undefined)

  const cargarActividad = async (leadId: string) => {
    const [t, n] = await Promise.all([fetchTareasDeLead(leadId).catch(() => null), fetchNotas(leadId).catch(() => null)])
    setTareas(t)
    setNotas(n)
    const ids = [...(t ?? []).map((x) => x.fl_tareaid), ...(n ?? []).map((x) => x.fl_notaid)]
    setAdjuntos(ids.length ? await fetchAdjuntos(ids).catch(() => new Map()) : new Map())
  }

  const cargar = () => {
    if (!id) return
    Promise.all([fetchLead(id), fetchHistoricoDeFase(id), fetchImportesVenta(id)])
      .then(([l, h, imp]) => {
        setLead(l)
        setHistorico(h)
        setImporte(imp ? (imp.get(id) ?? null) : undefined)
        if (l) {
          getRecord<Concesionario>(Tables.Concesionario, l._fl_concesionario_value, 'fl_concesionarioid,fl_nombre').then(setConcesionario)
          getRecord<Ubicacion>(Tables.Ubicacion, l._fl_ubicacion_value, 'fl_ubicacionid,fl_nombre,fl_areamanager').then(setUbicacion)
        }
      })
      .finally(() => setCargando(false))
    cargarActividad(id)
  }

  useEffect(cargar, [id])

  if (cargando) return <p className="wizard-loading">Cargando…</p>
  if (!lead) return <p className="wizard-error">No se encontró la oportunidad.</p>

  const guardarDatos = async (cambios: ActualizarLeadInput) => {
    if (Object.keys(cambios).length === 0) return
    if (cambios.cif) {
      const otra = await cifEnOtraEmpresa(lead._fl_concesionario_value, cambios.cif, lead._fl_empresa_value)
      if (otra) throw new Error(`Ese CIF ya es de otra empresa del concesionario: ${otra.fl_razonsocial}.`)
    }
    await actualizarLead(lead.fl_leadid, cambios, lead._fl_empresa_value)
    cargar()
  }

  const notasGenerales = (notas ?? []).filter((n) => !n._fl_tarea_value)
  const notasPorTarea = new Map<string, Nota[]>()
  for (const n of notas ?? []) if (n._fl_tarea_value) notasPorTarea.set(n._fl_tarea_value, [...(notasPorTarea.get(n._fl_tarea_value) ?? []), n])

  const guardarNota = async (texto: string, archivos: File[], tareaId?: string) => {
    if (!usuario) throw new Error('No se pudo identificar tu usuario.')
    await crearNotaConAdjuntos(lead.fl_leadid, texto, archivos, usuario, tareaId)
    await cargarActividad(lead.fl_leadid)
  }
  const eliminarNota = async (n: Nota) => {
    if (!window.confirm('¿Eliminar esta nota?')) return
    await borrarNota(n.fl_notaid)
    await cargarActividad(lead.fl_leadid)
  }
  const quitarAdjunto = (a: Adjunto) =>
    setAdjuntos((m) => new Map([...m].map(([k, lista]) => [k, lista.filter((x) => x.annotationid !== a.annotationid)])))

  const falta = numLineas === null ? null : faltantes(lead.fl_faseactual, { lead, numLineas, importe })
  const tareasAbiertas = (tareas ?? []).filter(tareaAbierta).length

  return (
    <div className="detalle-lead">
      <button type="button" className="btn-link detalle-volver" onClick={() => navigate(-1)}>
        <Icon name="chevronLeft" size={14} /> Volver
      </button>

      <header className="detalle-cabecera">
        <div className="detalle-cabecera-texto">
          <h1>{lead.fl_razonsocial}</h1>
          <p className="detalle-cabecera-meta">
            <span className="detalle-numero">{lead.fl_numero}</span>
            {concesionario && <span>{concesionario.fl_nombre}</span>}
            {ubicacion && <span>{ubicacion.fl_nombre}</span>}
            {lead._fl_empresa_value && (
              <button type="button" className="detalle-enlace" onClick={() => navigate(`/empresa/${lead._fl_empresa_value}`)}>
                Ver empresa y sus oportunidades
              </button>
            )}
          </p>
        </div>
        <div className="detalle-fase-actions">
          <FaseBadge fase={lead.fl_faseactual} conPunto />
          {!soloLectura && lead.fl_faseactual !== Fase.Perdido && (
            <button type="button" className="btn-secondary btn-compacto" onClick={() => setDialogo('fase')}>
              Cambiar fase
            </button>
          )}
        </div>
      </header>

      {!soloLectura && falta && lead.fl_faseactual !== Fase.Perdido && falta.obligatorios.length + falta.opcionales.length > 0 && (
        <AvisoFase
          fase={lead.fl_faseactual}
          obligatorios={falta.obligatorios}
          opcionales={falta.opcionales}
          total={requisitosHasta(lead.fl_faseactual).length}
          onCompletar={() => setDialogo('completar')}
        />
      )}

      {dialogo && (
        <CambioFaseDialog
          lead={lead}
          importe={importe}
          soloCompletar={dialogo === 'completar'}
          onCerrar={() => {
            // Los modelos se guardan al añadirlos, aunque se cancele: se recarga para verlos.
            setDialogo(null)
            cargar()
          }}
          onHecho={() => {
            setDialogo(null)
            cargar()
          }}
        />
      )}

      <div className="detalle-grid">
        <div className="detalle-datos">
          <BloqueDatos
            titulo="Empresa y contacto"
            defs={EMPRESA}
            lead={lead}
            soloLectura={soloLectura}
            onGuardar={guardarDatos}
            despues={
              <>
                <Comercial lead={lead} usuario={usuario} soloLectura={soloLectura} onCambiado={(salgo) => (salgo ? navigate('/mis-leads') : cargar())} />
                <Dato label="Area manager EBRO" valor={ubicacion?.fl_areamanager} />
              </>
            }
          />
          <BloqueDatos titulo="Situación de la flota" defs={FLOTA} lead={lead} soloLectura={soloLectura} onGuardar={guardarDatos} />
          <BloqueDatos
            titulo="Necesidad y oportunidad"
            defs={NECESIDAD}
            lead={lead}
            soloLectura={soloLectura}
            onGuardar={guardarDatos}
            antes={<LineasOportunidad leadId={lead.fl_leadid} textoAnterior={lead.fl_modelosinteres} soloLectura={soloLectura} onLineas={setNumLineas} />}
          />
          <OfertaLead lead={lead} editaConcesionario={!soloLectura} editaVentas={editaDescuentoVentas} onGuardar={guardarDatos} />
          <BloqueDatos
            titulo="Seguimiento"
            defs={[
              ...SEGUIMIENTO,
              ...(importe !== undefined ? [{ clave: 'importeVenta', label: 'Importe de la venta', tipo: 'euros' } as DefDato] : []),
              ...(lead.fl_faseactual === Fase.Perdido ? [{ clave: 'motivoPerdida', label: 'Motivo de la pérdida', tipo: 'textoLargo', ancho: true } as DefDato] : []),
            ]}
            lead={lead}
            importe={importe}
            soloLectura={soloLectura}
            onGuardar={guardarDatos}
            antes={
              <dl className="datos-grid datos-grid-fijo">
                <Dato label="Fecha de primer contacto" valor={fechaLarga(lead.fl_fechaprimercontacto)} />
                <Dato label="Fase actual" valor={<FaseBadge fase={lead.fl_faseactual} size="sm" conPunto />} />
              </dl>
            }
          />
        </div>

        <div className="detalle-actividad">
          <section className="panel-actividad">
            <header className="panel-actividad-cabecera">
              <h2>Historial y tareas</h2>
              {tareas !== null && tareasAbiertas > 0 && <span className="panel-actividad-nota">{tareasAbiertas} abiertas</span>}
              {!soloLectura && tareas !== null && !creandoTarea && (
                <button type="button" className="btn-mini panel-actividad-accion" onClick={() => setCreandoTarea(true)}>
                  <Icon name="add" size={14} /> Nueva tarea
                </button>
              )}
            </header>
            {creandoTarea && (
              <NuevaTareaForm
                onCancelar={() => setCreandoTarea(false)}
                onGuardar={async ({ adjuntos: archivos, ...input }) => {
                  const tareaId = await crearTarea(lead.fl_leadid, input)
                  if (archivos?.length) await subirAdjuntos({ tipo: 'tarea', id: tareaId }, archivos)
                  setCreandoTarea(false)
                  await cargarActividad(lead.fl_leadid)
                }}
              />
            )}
            {tareas === null && <p className="flow-meta">Las tareas aún no están activadas en la base de datos.</p>}
            <HistorialTareas
              historico={historico}
              tareas={tareas ?? []}
              notasPorTarea={notasPorTarea}
              adjuntos={adjuntos}
              usuarioId={usuario?.fl_usuarioappid}
              soloLectura={soloLectura}
              onCambiarEstado={async (t: Tarea, estado: EstadoTarea) => {
                await cambiarEstadoTarea(t.fl_tareaid, estado)
                setTareas((ts) => (ts ?? []).map((x) => (x.fl_tareaid === t.fl_tareaid ? { ...x, fl_estado: estado } : x)))
              }}
              onGuardarNota={(t, texto, archivos) => guardarNota(texto, archivos, t.fl_tareaid)}
              onBorrarNota={eliminarNota}
              onAdjuntoBorrado={quitarAdjunto}
            />
          </section>

          <section className="panel-actividad">
            <header className="panel-actividad-cabecera">
              <h2>Notas</h2>
              {notasGenerales.length > 0 && <span className="panel-actividad-nota">{notasGenerales.length}</span>}
            </header>
            <NotasLead
              notas={notas === null ? null : notasGenerales}
              adjuntos={adjuntos}
              usuarioId={usuario?.fl_usuarioappid}
              soloLectura={soloLectura}
              onGuardar={(texto, archivos) => guardarNota(texto, archivos)}
              onBorrar={eliminarNota}
              onAdjuntoBorrado={quitarAdjunto}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * Comercial responsable: se cambia entre los usuarios de la misma sede. Si el elegido tiene usuario
 * vinculado, la oportunidad pasa a ser suya y quien la cede deja de verla (se avisa antes).
 */
function Comercial({
  lead,
  usuario,
  soloLectura,
  onCambiado,
}: {
  lead: Lead
  usuario: UsuarioApp | null
  soloLectura: boolean
  onCambiado: (dejoDeVerla: boolean) => void
}) {
  const [opciones, setOpciones] = useState<UsuarioApp[] | null>(null)
  const [elegido, setElegido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abrir = async () => {
    setError(null)
    try {
      const lista = await fetchComercialesDeSede(lead._fl_ubicacion_value, lead._fl_concesionario_value)
      setOpciones(lista)
      setElegido(lead._fl_comercial_value ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los comerciales.')
    }
  }
  const guardar = async () => {
    const c = opciones?.find((o) => o.fl_usuarioappid === elegido)
    if (!c || c.fl_usuarioappid === lead._fl_comercial_value) {
      setOpciones(null)
      return
    }
    const cedo = !!c._fl_systemuserid_value && c.fl_usuarioappid !== usuario?.fl_usuarioappid
    if (cedo && !window.confirm(`La oportunidad pasará a ${c.fl_nombre}, con sus tareas y notas. Si no eres administrador, dejarás de verla. ¿Continuar?`)) return
    setGuardando(true)
    try {
      const { reasignada } = await cambiarComercial(lead, c)
      setOpciones(null)
      onCambiado(reasignada && c.fl_usuarioappid !== usuario?.fl_usuarioappid)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el comercial.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="dato">
      <dt>Comercial</dt>
      {opciones ? (
        <dd className="dato-edicion">
          <select value={elegido} onChange={(e) => setElegido(e.target.value)} disabled={guardando}>
            {opciones.map((o) => (
              <option key={o.fl_usuarioappid} value={o.fl_usuarioappid}>
                {o.fl_nombre}
              </option>
            ))}
          </select>
          <button type="button" className="btn-link" onClick={() => setOpciones(null)} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="btn-link" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </dd>
      ) : (
        <dd className={lead.fl_comercialresponsable ? undefined : 'is-vacio'}>
          {lead.fl_comercialresponsable || '—'}
          {!soloLectura && (
            <button type="button" className="dato-cambiar" onClick={abrir}>
              Cambiar
            </button>
          )}
        </dd>
      )}
      {error && <p className="wizard-error">{error}</p>}
    </div>
  )
}
