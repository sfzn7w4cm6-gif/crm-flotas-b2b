import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { formatoEuros } from '../../lib/actividadService'
import { fechaCorta } from '../../lib/formato'
import { cifNifValido, emailValido, telefonoValido } from '../../lib/validators'
import type { ActualizarLeadInput } from '../../lib/leadsService'
import { ModoFinanciacionLabel, PlazoDecisionLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'

// Bloques de datos de la ficha: se leen en dos columnas compactas y cada bloque se edita en su
// sitio con el lápiz, sea cual sea la fase. Lo único que no se edita es la fecha de primer
// contacto (la pone el alta) y lo que viene de la sede (concesionario, instalación, area manager).

export type TipoDato = 'texto' | 'textoLargo' | 'numero' | 'euros' | 'fecha' | 'financiacion' | 'plazo' | 'email' | 'telefono' | 'cif'
export type ClaveDato = keyof ActualizarLeadInput

export interface DefDato {
  clave: ClaveDato
  label: string
  tipo: TipoDato
  /** Ocupa las dos columnas (textos largos). */
  ancho?: boolean
  /** Aclaración bajo el campo al editarlo. */
  ayuda?: string
}

type Valores = Partial<Record<ClaveDato, string>>

function valorDe(lead: Lead, clave: ClaveDato): string {
  const campo: Record<string, keyof Lead> = {
    razonSocial: 'fl_razonsocial',
    cif: 'fl_cif',
    nombreResponsable: 'fl_nombreresponsable',
    telefonoCorporativo: 'fl_telefonocorporativo',
    emailCorporativo: 'fl_emailcorporativo',
    numVehiculosActuales: 'fl_numvehiculosactuales',
    marcasActuales: 'fl_marcasactuales',
    actividadEconomica: 'fl_actividadeconomica',
    modoFinanciacionActual: 'fl_modofinanciacionactual',
    vencimientoContratosActuales: 'fl_vencimientocontratosactuales',
    plazoEstimadoDecision: 'fl_plazoestimadodecision',
    competidoresDetectados: 'fl_competidoresdetectados',
    requisitos: 'fl_requisitos',
    ultimaAccionRealizada: 'fl_ultimaaccionrealizada',
    proximaAccion: 'fl_proximaaccion',
    fechaProximaAccion: 'fl_fechaproximaaccion',
    observaciones: 'fl_observaciones',
    ofertaCondiciones: 'fl_ofertacondiciones',
    motivoPerdida: 'fl_motivoperdida',
  }
  const v = lead[campo[clave]]
  if (v === null || v === undefined) return ''
  return String(v)
}

function mostrar(def: DefDato, v: string): string {
  if (v === '') return ''
  switch (def.tipo) {
    case 'fecha':
      return fechaCorta(v)
    case 'euros':
      return formatoEuros(Number(v))
    case 'financiacion':
      return ModoFinanciacionLabel[Number(v) as keyof typeof ModoFinanciacionLabel] ?? ''
    case 'plazo':
      return PlazoDecisionLabel[Number(v) as keyof typeof PlazoDecisionLabel] ?? ''
    default:
      return v
  }
}

function errorDe(def: DefDato, v: string): string | null {
  if (!v.trim()) return def.clave === 'razonSocial' || def.clave === 'cif' ? `${def.label}: es obligatorio.` : null
  if (def.tipo === 'email' && !emailValido(v)) return 'El e-mail no tiene un formato válido.'
  if (def.tipo === 'telefono' && !telefonoValido(v)) return 'El teléfono debe tener 9 cifras (con +34 opcional).'
  if (def.tipo === 'cif' && !cifNifValido(v)) return 'El CIF / NIF no tiene un formato válido.'
  return null
}

/** Pasa los valores del formulario (texto) al tipo que espera actualizarLead. Solo lo que ha cambiado. */
function cambiosDe(defs: DefDato[], valores: Valores, iniciales: Valores): ActualizarLeadInput {
  const r: Record<string, unknown> = {}
  for (const d of defs) {
    const v = (valores[d.clave] ?? '').trim()
    if (v === (iniciales[d.clave] ?? '').trim()) continue
    const numerico = d.tipo === 'numero' || d.tipo === 'euros' || d.tipo === 'financiacion' || d.tipo === 'plazo'
    r[d.clave] = v === '' ? null : numerico ? Number(v) : v
  }
  return r as ActualizarLeadInput
}

/** Un dato de solo lectura, con el mismo aspecto que los editables. */
export function Dato({ label, valor, ancho }: { label: string; valor: ReactNode; ancho?: boolean }) {
  const vacio = valor === null || valor === undefined || valor === ''
  return (
    <div className={`dato${ancho ? ' is-ancho' : ''}`}>
      <dt>{label}</dt>
      <dd className={vacio ? 'is-vacio' : undefined}>{vacio ? '—' : valor}</dd>
    </div>
  )
}

export function BloqueDatos({
  titulo,
  defs,
  lead,
  soloLectura,
  antes,
  despues,
  onGuardar,
}: {
  titulo: string
  defs: DefDato[]
  lead: Lead
  soloLectura: boolean
  /** Contenido fijo al principio del bloque (p. ej. los modelos, que se editan aparte). */
  antes?: ReactNode
  /** Datos de solo lectura al final del bloque. */
  despues?: ReactNode
  onGuardar: (cambios: ActualizarLeadInput) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState<Valores>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iniciales = (): Valores => Object.fromEntries(defs.map((d) => [d.clave, valorDe(lead, d.clave).slice(0, d.tipo === 'fecha' ? 10 : undefined)]))

  const empezar = () => {
    setValores(iniciales())
    setError(null)
    setEditando(true)
  }
  const guardar = async () => {
    const fallo = defs.map((d) => errorDe(d, valores[d.clave] ?? '')).find(Boolean)
    if (fallo) {
      setError(fallo)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(cambiosDe(defs, valores, iniciales()))
      setEditando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={`bloque-datos${editando ? ' is-editando' : ''}`}>
      <header className="bloque-datos-cabecera">
        <h2>{titulo}</h2>
        {!soloLectura && !editando && (
          <button type="button" className="bloque-datos-editar" onClick={empezar} aria-label={`Editar ${titulo.toLowerCase()}`} title="Editar">
            <Icon name="pencil" size={14} />
          </button>
        )}
      </header>
      {antes}
      {editando ? (
        <div className="bloque-datos-form">
          <div className="datos-form-grid">
            {defs.map((d) => (
              <div key={d.clave} className={`field${d.ancho ? ' is-ancho' : ''}`}>
                <label>{d.label}</label>
                <Entrada def={d} valor={valores[d.clave] ?? ''} onChange={(v) => setValores((x) => ({ ...x, [d.clave]: v }))} />
                {d.ayuda && <span className="field-ayuda">{d.ayuda}</span>}
              </div>
            ))}
          </div>
          {error && <p className="wizard-error">{error}</p>}
          <div className="bloque-datos-acciones">
            <button type="button" className="btn-link" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <dl className="datos-grid">
          {defs.map((d) => (
            <Dato key={d.clave} label={d.label} valor={mostrar(d, valorDe(lead, d.clave))} ancho={d.ancho} />
          ))}
          {despues}
        </dl>
      )}
    </section>
  )
}

function Entrada({ def, valor, onChange }: { def: DefDato; valor: string; onChange: (v: string) => void }) {
  switch (def.tipo) {
    case 'textoLargo':
      return <textarea rows={3} value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'numero':
    case 'euros':
      return <input type="number" min={0} value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'fecha':
      return <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'email':
      return <input type="email" value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'telefono':
      return <input type="tel" value={valor} onChange={(e) => onChange(e.target.value)} />
    case 'financiacion':
    case 'plazo': {
      const opciones = def.tipo === 'financiacion' ? ModoFinanciacionLabel : PlazoDecisionLabel
      return (
        <select value={valor} onChange={(e) => onChange(e.target.value)}>
          <option value="">Sin indicar</option>
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
