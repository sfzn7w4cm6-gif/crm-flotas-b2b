import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { crearLeadBase, type NuevoLeadInput } from '../../lib/leadsService'
import { ModoFinanciacionLabel, PlazoDecisionLabel } from '../../lib/types'
import './NuevoLead.css'

const PASOS = ['Datos de la empresa', 'Contactos clave', 'Situación de flota', 'Necesidad', 'Histórico y seguimiento']

type Form = Partial<NuevoLeadInput>

export function NuevoLead() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState<Form>({})
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ numero: string } | null>(null)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const faltanPaso = useMemo(() => {
    switch (paso) {
      case 0:
        return !form.razonSocial || !form.cif
      case 1:
        return !form.nombreResponsable || !form.telefonoCorporativo || !form.emailCorporativo
      case 2:
        return (
          form.numVehiculosActuales === undefined ||
          !form.marcasActuales ||
          !form.actividadEconomica ||
          form.modoFinanciacionActual === undefined ||
          !form.vencimientoContratosActuales
        )
      case 3:
        return (
          form.cuotasObjetivo === undefined ||
          !form.modelosInteres ||
          form.numVehiculosRenovarAmpliar === undefined ||
          form.plazoEstimadoDecision === undefined ||
          !form.competidoresDetectados ||
          !form.requisitos ||
          !form.kmTiempo
        )
      case 4:
        return !form.proximaAccion || !form.fechaProximaAccion || !form.observaciones
      default:
        return false
    }
  }, [paso, form])

  const enviar = async () => {
    if (!usuario || faltanPaso) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const { numero } = await crearLeadBase(form as NuevoLeadInput, usuario)
      setResultado({ numero })
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No se pudo crear el lead.')
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    return (
      <div className="wizard-done">
        <div className="wizard-done-icon">
          <Icon name="check" size={28} />
        </div>
        <h1>Lead creado</h1>
        <p>
          El lead <strong>{resultado.numero}</strong> se creó correctamente en fase <strong>1. Prospección</strong>.
        </p>
        <div className="wizard-done-actions">
          <button type="button" className="btn-primary" onClick={() => navigate('/mis-leads')}>
            Ver mis leads
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
            Crear otro lead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      <h1 className="wizard-title">Nuevo lead</h1>

      <ol className="wizard-steps">
        {PASOS.map((p, i) => (
          <li key={p} className={i === paso ? 'is-active' : i < paso ? 'is-done' : ''}>
            <span className="wizard-step-num">{i < paso ? <Icon name="check" size={13} /> : i + 1}</span>
            <span className="wizard-step-label">{p}</span>
          </li>
        ))}
      </ol>

      <div className="wizard-card">
        {paso === 0 && (
          <div className="wizard-form">
            <Field label="Razón Social / Nombre comercial">
              <input value={form.razonSocial ?? ''} onChange={(e) => set('razonSocial', e.target.value)} />
            </Field>
            <Field label="CIF / NIF">
              <input value={form.cif ?? ''} onChange={(e) => set('cif', e.target.value)} />
            </Field>
          </div>
        )}

        {paso === 1 && (
          <div className="wizard-form">
            <Field label="Nombre responsable empresa">
              <input value={form.nombreResponsable ?? ''} onChange={(e) => set('nombreResponsable', e.target.value)} />
            </Field>
            <Field label="Teléfono corporativo">
              <input value={form.telefonoCorporativo ?? ''} onChange={(e) => set('telefonoCorporativo', e.target.value)} />
            </Field>
            <Field label="E-mail corporativo">
              <input type="email" value={form.emailCorporativo ?? ''} onChange={(e) => set('emailCorporativo', e.target.value)} />
            </Field>
          </div>
        )}

        {paso === 2 && (
          <div className="wizard-form">
            <Field label="Nº vehículos actuales">
              <input
                type="number"
                min={0}
                value={form.numVehiculosActuales ?? ''}
                onChange={(e) => set('numVehiculosActuales', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Field>
            <Field label="Marcas actuales">
              <input value={form.marcasActuales ?? ''} onChange={(e) => set('marcasActuales', e.target.value)} />
            </Field>
            <Field label="Actividad económica (sector)">
              <input value={form.actividadEconomica ?? ''} onChange={(e) => set('actividadEconomica', e.target.value)} />
            </Field>
            <Field label="Modo de financiación actual">
              <select
                value={form.modoFinanciacionActual ?? ''}
                onChange={(e) => set('modoFinanciacionActual', e.target.value === '' ? undefined : Number(e.target.value))}
              >
                <option value="">Selecciona una opción</option>
                {Object.entries(ModoFinanciacionLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vencimiento contratos actuales">
              <input
                type="date"
                value={form.vencimientoContratosActuales ?? ''}
                onChange={(e) => set('vencimientoContratosActuales', e.target.value)}
              />
            </Field>
          </div>
        )}

        {paso === 3 && (
          <div className="wizard-form">
            <Field label="Modelos de interés">
              <input value={form.modelosInteres ?? ''} onChange={(e) => set('modelosInteres', e.target.value)} />
            </Field>
            <Field label="Cuotas objetivo (€)">
              <input
                type="number"
                min={0}
                value={form.cuotasObjetivo ?? ''}
                onChange={(e) => set('cuotasObjetivo', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Field>
            <Field label="Nº vehículos a renovar / ampliar">
              <input
                type="number"
                min={0}
                value={form.numVehiculosRenovarAmpliar ?? ''}
                onChange={(e) => set('numVehiculosRenovarAmpliar', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Field>
            <Field label="Plazo estimado de decisión">
              <select
                value={form.plazoEstimadoDecision ?? ''}
                onChange={(e) => set('plazoEstimadoDecision', e.target.value === '' ? undefined : Number(e.target.value))}
              >
                <option value="">Selecciona una opción</option>
                {Object.entries(PlazoDecisionLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Competidores detectados">
              <input value={form.competidoresDetectados ?? ''} onChange={(e) => set('competidoresDetectados', e.target.value)} />
            </Field>
            <Field label="Requisitos (etiquetas, tecnología, política de flotas)">
              <textarea rows={3} value={form.requisitos ?? ''} onChange={(e) => set('requisitos', e.target.value)} />
            </Field>
            <Field label="Km / tiempo">
              <input value={form.kmTiempo ?? ''} onChange={(e) => set('kmTiempo', e.target.value)} />
            </Field>
          </div>
        )}

        {paso === 4 && (
          <div className="wizard-form">
            <Field label="Fase actual">
              <div className="fase-inicial-chip">1. Prospección</div>
            </Field>
            <Field label="Próxima acción">
              <input value={form.proximaAccion ?? ''} onChange={(e) => set('proximaAccion', e.target.value)} />
            </Field>
            <Field label="Fecha próxima acción">
              <input type="date" value={form.fechaProximaAccion ?? ''} onChange={(e) => set('fechaProximaAccion', e.target.value)} />
            </Field>
            <Field label="Observaciones / notas clave">
              <textarea rows={4} value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} />
            </Field>
            <Field label="Oferta (Descuento/Condiciones)" opcional>
              <textarea rows={3} value={form.ofertaCondiciones ?? ''} onChange={(e) => set('ofertaCondiciones', e.target.value)} />
            </Field>
            {errorEnvio && <p className="wizard-error">{errorEnvio}</p>}
          </div>
        )}
      </div>

      <div className="wizard-actions">
        <button type="button" className="btn-secondary" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
          Atrás
        </button>
        {paso < 4 && (
          <button type="button" className="btn-primary" disabled={faltanPaso} onClick={() => setPaso((p) => p + 1)}>
            Siguiente
          </button>
        )}
        {paso === 4 && (
          <button type="button" className="btn-primary" disabled={faltanPaso || enviando} onClick={enviar}>
            {enviando ? 'Guardando…' : 'Crear lead'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, opcional }: { label: string; children: ReactNode; opcional?: boolean }) {
  return (
    <div className="field">
      <label>{label} {opcional ? '' : '*'}</label>
      {children}
    </div>
  )
}
