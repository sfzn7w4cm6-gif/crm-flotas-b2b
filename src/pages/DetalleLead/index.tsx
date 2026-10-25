import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { FaseBadge, FaseSelect } from '../../components/StatusBadge'
import { getRecord, Tables } from '../../lib/dataverseClient'
import { actualizarLead, cambiarFaseLead, fetchHistoricoDeFase, fetchLead, type ActualizarLeadInput } from '../../lib/leadsService'
import { Fase, ModoFinanciacionLabel, PlazoDecisionLabel } from '../../lib/types'
import type { Concesionario, FaseHistorico, Lead, Ubicacion } from '../../lib/types'
import { RolApp } from '../../lib/types'
import './DetalleLead.css'

export function DetalleLead() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { effectiveRol } = useAuth()
  const soloLectura = effectiveRol === RolApp.EquipoVentas

  const [lead, setLead] = useState<Lead | null>(null)
  const [historico, setHistorico] = useState<FaseHistorico[]>([])
  const [concesionario, setConcesionario] = useState<Concesionario | null>(null)
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<ActualizarLeadInput>({})
  const [guardando, setGuardando] = useState(false)
  const [cambiandoFase, setCambiandoFase] = useState(false)
  const [nuevaFase, setNuevaFase] = useState<Fase | ''>('')
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    if (!id) return
    setCargando(true)
    Promise.all([fetchLead(id), fetchHistoricoDeFase(id)])
      .then(([l, h]) => {
        setLead(l)
        setHistorico(h)
        if (l) {
          getRecord<Concesionario>(Tables.Concesionario, l._fl_concesionario_value, 'fl_concesionarioid,fl_nombre').then(setConcesionario)
          getRecord<Ubicacion>(Tables.Ubicacion, l._fl_ubicacion_value, 'fl_ubicacionid,fl_nombre,fl_areamanager').then(setUbicacion)
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [id])

  if (cargando) return <p className="wizard-loading">Cargando…</p>
  if (!lead) return <p className="wizard-error">No se encontró el lead.</p>

  const iniciarEdicion = () => {
    setForm({
      nombreResponsable: lead.fl_nombreresponsable,
      telefonoCorporativo: lead.fl_telefonocorporativo,
      emailCorporativo: lead.fl_emailcorporativo,
      numVehiculosActuales: lead.fl_numvehiculosactuales,
      marcasActuales: lead.fl_marcasactuales,
      actividadEconomica: lead.fl_actividadeconomica,
      modoFinanciacionActual: lead.fl_modofinanciacionactual,
      vencimientoContratosActuales: lead.fl_vencimientocontratosactuales?.slice(0, 10),
      cuotasObjetivo: lead.fl_cuotasobjetivo,
      modelosInteres: lead.fl_modelosinteres,
      numVehiculosRenovarAmpliar: lead.fl_numvehiculosrenovarampliar,
      plazoEstimadoDecision: lead.fl_plazoestimadodecision,
      competidoresDetectados: lead.fl_competidoresdetectados,
      requisitos: lead.fl_requisitos,
      kmTiempo: lead.fl_kmtiempo,
      ultimaAccionRealizada: lead.fl_ultimaaccionrealizada,
      proximaAccion: lead.fl_proximaaccion,
      fechaProximaAccion: lead.fl_fechaproximaaccion?.slice(0, 10),
      observaciones: lead.fl_observaciones,
      ofertaCondiciones: lead.fl_ofertacondiciones,
    })
    setEditando(true)
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await actualizarLead(lead.fl_leadid, form)
      setEditando(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const aplicarCambioFase = async () => {
    if (nuevaFase === '' || !lead) return
    if (nuevaFase === Fase.Perdido && !motivoPerdida.trim()) {
      setError('Indica el motivo de la pérdida.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await cambiarFaseLead(lead.fl_leadid, lead.fl_numero, nuevaFase, nuevaFase === Fase.Perdido ? motivoPerdida : undefined)
      setCambiandoFase(false)
      setNuevaFase('')
      setMotivoPerdida('')
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la fase.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="detalle-lead">
      <button type="button" className="btn-link" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div className="page-header">
        <div>
          <h1>{lead.fl_razonsocial}</h1>
          <p className="flow-meta">{lead.fl_numero}</p>
        </div>
        <div className="detalle-fase-actions">
          <FaseBadge fase={lead.fl_faseactual} />
          {!soloLectura && lead.fl_faseactual !== Fase.Perdido && (
            <button type="button" className="btn-secondary" onClick={() => setCambiandoFase((v) => !v)}>
              Cambiar fase
            </button>
          )}
        </div>
      </div>

      {cambiandoFase && (
        <div className="wizard-card" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Nueva fase</label>
            <FaseSelect value={nuevaFase} onChange={setNuevaFase} placeholder="Selecciona una fase" />
          </div>
          {nuevaFase === Fase.Perdido && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Motivo de la pérdida *</label>
              <textarea rows={3} value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value)} />
            </div>
          )}
          {error && <p className="wizard-error">{error}</p>}
          <div className="wizard-actions">
            <button type="button" className="btn-secondary" onClick={() => setCambiandoFase(false)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" disabled={guardando || nuevaFase === ''} onClick={aplicarCambioFase}>
              {guardando ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      <div className="detalle-grid">
        <div className="detalle-col">
          <Seccion titulo="Datos de la empresa">
            <Fila label="Razón Social" valor={lead.fl_razonsocial} />
            <Fila label="CIF / NIF" valor={lead.fl_cif} />
            <Fila label="Concesionario" valor={concesionario?.fl_nombre ?? '—'} />
            <Fila label="Instalación" valor={ubicacion?.fl_nombre ?? '—'} />
            <Fila label="Comercial responsable" valor={lead.fl_comercialresponsable} />
            <Fila label="Area Manager EBRO (Zona)" valor={ubicacion?.fl_areamanager || '—'} />
          </Seccion>

          <Seccion titulo="Contactos clave">
            <Fila label="Responsable" valor={lead.fl_nombreresponsable} />
            <Fila label="Teléfono" valor={lead.fl_telefonocorporativo} />
            <Fila label="E-mail" valor={lead.fl_emailcorporativo} />
          </Seccion>

          <Seccion
            titulo="Situación actual de flota"
            accion={!soloLectura && !editando ? <button className="btn-link" onClick={iniciarEdicion}>Editar</button> : undefined}
          >
            {!editando ? (
              <>
                <Fila label="Nº vehículos actuales" valor={lead.fl_numvehiculosactuales} />
                <Fila label="Marcas actuales" valor={lead.fl_marcasactuales} />
                <Fila label="Actividad económica" valor={lead.fl_actividadeconomica} />
                <Fila label="Modo financiación actual" valor={ModoFinanciacionLabel[lead.fl_modofinanciacionactual]} />
                <Fila label="Vencimiento contratos" valor={lead.fl_vencimientocontratosactuales} />
              </>
            ) : (
              <EdicionCompleta form={form} setForm={setForm} />
            )}
          </Seccion>

          {!editando && (
            <>
              <Seccion titulo="Necesidad y oportunidad">
                <Fila label="Modelos de interés" valor={lead.fl_modelosinteres} />
                <Fila label="Cuotas objetivo" valor={`${lead.fl_cuotasobjetivo} €`} />
                <Fila label="Nº vehículos a renovar/ampliar" valor={lead.fl_numvehiculosrenovarampliar} />
                <Fila label="Plazo estimado de decisión" valor={PlazoDecisionLabel[lead.fl_plazoestimadodecision]} />
                <Fila label="Competidores detectados" valor={lead.fl_competidoresdetectados} />
                <Fila label="Requisitos" valor={lead.fl_requisitos} />
                <Fila label="Km / tiempo" valor={lead.fl_kmtiempo} />
              </Seccion>

              <Seccion titulo="Histórico y seguimiento">
                <Fila label="Fecha primer contacto" valor={lead.fl_fechaprimercontacto} />
                <Fila label="Última acción realizada" valor={lead.fl_ultimaaccionrealizada} />
                <Fila label="Próxima acción" valor={lead.fl_proximaaccion} />
                <Fila label="Fecha próxima acción" valor={lead.fl_fechaproximaaccion} />
                <Fila label="Observaciones" valor={lead.fl_observaciones} />
                <Fila label="Oferta (Descuento/Condiciones)" valor={lead.fl_ofertacondiciones || '—'} />
                {lead.fl_motivoperdida && <Fila label="Motivo de pérdida" valor={lead.fl_motivoperdida} />}
              </Seccion>
            </>
          )}

          {editando && (
            <>
              {error && <p className="wizard-error">{error}</p>}
              <div className="wizard-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditando(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn-primary" disabled={guardando} onClick={guardar}>
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="detalle-col detalle-col-timeline">
          <h2 className="timeline-title">
            <Icon name="clock" size={16} /> Historial de fases
          </h2>
          <ul className="fase-timeline">
            {historico.map((h) => (
              <li key={h.fl_fasehistoricoid}>
                <FaseBadge fase={h.fl_fase} size="sm" />
                <div className="fase-timeline-meta">
                  <span>{new Date(h.fl_fechainicio).toLocaleDateString('es-ES')}</span>
                  {h.fl_diasenfase !== undefined && <span>{h.fl_diasenfase} días</span>}
                  {h.fl_esactual && <span className="fase-timeline-actual">En curso</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="detalle-seccion">
      <div className="detalle-seccion-header">
        <h2>{titulo}</h2>
        {accion}
      </div>
      <div className="detalle-seccion-body">{children}</div>
    </section>
  )
}

function Fila({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="resumen-fila">
      <span className="resumen-label">{label}</span>
      <span className="resumen-valor">{valor}</span>
    </div>
  )
}

function EdicionCompleta({
  form,
  setForm,
}: {
  form: ActualizarLeadInput
  setForm: (updater: (f: ActualizarLeadInput) => ActualizarLeadInput) => void
}) {
  const set = <K extends keyof ActualizarLeadInput>(key: K, value: ActualizarLeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="wizard-form">
      <div className="field">
        <label>Nº vehículos actuales</label>
        <input type="number" value={form.numVehiculosActuales ?? ''} onChange={(e) => set('numVehiculosActuales', Number(e.target.value))} />
      </div>
      <div className="field">
        <label>Marcas actuales</label>
        <input value={form.marcasActuales ?? ''} onChange={(e) => set('marcasActuales', e.target.value)} />
      </div>
      <div className="field">
        <label>Actividad económica (sector)</label>
        <input value={form.actividadEconomica ?? ''} onChange={(e) => set('actividadEconomica', e.target.value)} />
      </div>
      <div className="field">
        <label>Modo financiación actual</label>
        <select value={form.modoFinanciacionActual ?? ''} onChange={(e) => set('modoFinanciacionActual', Number(e.target.value))}>
          {Object.entries(ModoFinanciacionLabel).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Vencimiento contratos actuales</label>
        <input type="date" value={form.vencimientoContratosActuales ?? ''} onChange={(e) => set('vencimientoContratosActuales', e.target.value)} />
      </div>
      <div className="field">
        <label>Modelos de interés</label>
        <input value={form.modelosInteres ?? ''} onChange={(e) => set('modelosInteres', e.target.value)} />
      </div>
      <div className="field">
        <label>Cuotas objetivo (€)</label>
        <input type="number" value={form.cuotasObjetivo ?? ''} onChange={(e) => set('cuotasObjetivo', Number(e.target.value))} />
      </div>
      <div className="field">
        <label>Nº vehículos a renovar / ampliar</label>
        <input
          type="number"
          value={form.numVehiculosRenovarAmpliar ?? ''}
          onChange={(e) => set('numVehiculosRenovarAmpliar', Number(e.target.value))}
        />
      </div>
      <div className="field">
        <label>Plazo estimado de decisión</label>
        <select value={form.plazoEstimadoDecision ?? ''} onChange={(e) => set('plazoEstimadoDecision', Number(e.target.value))}>
          {Object.entries(PlazoDecisionLabel).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Competidores detectados</label>
        <input value={form.competidoresDetectados ?? ''} onChange={(e) => set('competidoresDetectados', e.target.value)} />
      </div>
      <div className="field">
        <label>Requisitos (etiquetas, tecnología, política de flotas)</label>
        <textarea rows={2} value={form.requisitos ?? ''} onChange={(e) => set('requisitos', e.target.value)} />
      </div>
      <div className="field">
        <label>Km / tiempo</label>
        <input value={form.kmTiempo ?? ''} onChange={(e) => set('kmTiempo', e.target.value)} />
      </div>
      <div className="field">
        <label>Última acción realizada</label>
        <textarea rows={2} value={form.ultimaAccionRealizada ?? ''} onChange={(e) => set('ultimaAccionRealizada', e.target.value)} />
      </div>
      <div className="field">
        <label>Próxima acción</label>
        <input value={form.proximaAccion ?? ''} onChange={(e) => set('proximaAccion', e.target.value)} />
      </div>
      <div className="field">
        <label>Fecha próxima acción</label>
        <input type="date" value={form.fechaProximaAccion ?? ''} onChange={(e) => set('fechaProximaAccion', e.target.value)} />
      </div>
      <div className="field">
        <label>Observaciones</label>
        <textarea rows={3} value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} />
      </div>
      <div className="field">
        <label>Oferta (Descuento/Condiciones)</label>
        <textarea rows={3} value={form.ofertaCondiciones ?? ''} onChange={(e) => set('ofertaCondiciones', e.target.value)} />
      </div>
    </div>
  )
}
