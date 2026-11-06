import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { FaseSelect } from '../../components/StatusBadge'
import { CAMPOS, camposDelDialogo, type CampoFase } from '../../lib/camposFase'
import { actualizarLead, cambiarFaseLead, type ActualizarLeadInput } from '../../lib/leadsService'
import { fetchLineas } from '../../lib/lineasService'
import { Fase, FaseLabel, ModoFinanciacionLabel, PlazoDecisionLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'
import { LineasOportunidad } from './LineasOportunidad'

/**
 * Ventana para cambiar de fase pidiendo los datos de la fase destino, o (sin cambiar de fase)
 * para completar lo que falta de la fase actual. Ningún campo impide guardar: si faltan los
 * necesarios para la fase, se avisa en amarillo y se puede seguir igualmente. Los modelos se guardan en cuanto se añaden, como en la ficha.
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
  const [fase, setFase] = useState<Fase | ''>(soloCompletar ? lead.fl_faseactual : (faseInicial ?? ''))
  const [valores, setValores] = useState<Partial<Record<CampoFase, string>>>(() => valoresIniciales(lead))
  const [motivoPerdida, setMotivoPerdida] = useState('')
  // Las líneas al abrir deciden qué campos se muestran; las actuales, si se cumple el obligatorio.
  const [lineasIniciales, setLineasIniciales] = useState<number | null>(null)
  const [numLineas, setNumLineas] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLineas(lead.fl_leadid)
      .then((l) => {
        setLineasIniciales(l.length)
        setNumLineas(l.length)
      })
      .catch(() => setLineasIniciales(0))
  }, [lead.fl_leadid])

  const campos = useMemo(
    () => (fase === '' || lineasIniciales === null ? [] : camposDelDialogo(fase, { lead, numLineas: lineasIniciales })),
    [fase, lead, lineasIniciales],
  )

  const relleno = (campo: CampoFase) =>
    campo === 'modelos' ? numLineas > 0 || !!lead.fl_modelosinteres : (valores[campo] ?? '').trim() !== ''
  const faltan = campos.filter((c) => c.obligatorio && !relleno(c.campo))
  const faltaMotivo = fase === Fase.Perdido && motivoPerdida.trim() === ''
  const puedeGuardar = fase !== '' && !guardando

  const set = (campo: CampoFase, v: string) => setValores((x) => ({ ...x, [campo]: v }))

  const guardar = async () => {
    if (fase === '' || !puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      const iniciales = valoresIniciales(lead)
      const cambios: Record<string, unknown> = {}
      for (const { campo } of campos) {
        if (campo === 'modelos') continue
        const v = (valores[campo] ?? '').trim()
        if (v === '' || v === iniciales[campo]) continue
        const tipo = CAMPOS[campo]?.tipo
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
              Los campos con * son necesarios para {soloCompletar ? 'esta fase' : 'pasar a esta fase'}. El resto puedes dejarlo para más tarde.
            </p>
          )}

          {secciones.map((s) => {
            const esOferta = s.titulo === 'Oferta'
            return (
              <div key={s.titulo} className={esOferta ? 'fase-dialog-seccion fase-dialog-seccion-oferta' : 'fase-dialog-seccion'}>
                <h3>{s.titulo}</h3>
                <div className={esOferta ? 'datos-form-grid' : 'wizard-form'}>
                  {s.campos.map(({ campo, obligatorio }) => {
                    const def = CAMPOS[campo]!
                    return (
                      <div key={campo} className={esOferta && def.tipo === 'textoLargo' ? 'field is-ancho' : 'field'}>
                        <label>
                          {def.label} {obligatorio ? '*' : ''}
                        </label>
                        <CampoInput campo={campo} tipo={def.tipo} valor={valores[campo] ?? ''} onChange={(v) => set(campo, v)} lead={lead} onLineas={setNumLineas} />
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
          <div className="fase-dialog-aviso" role="status">
            <Icon name="warning" size={15} />
            <span>
              Debes rellenar {faltaMotivo && faltan.length === 0 ? 'el motivo de la pérdida' : `los datos marcados con * (faltan ${faltan.length + (faltaMotivo ? 1 : 0)})`}. Puedes
              guardar igualmente y completarlos más tarde.
            </span>
          </div>
        )}

        <div className="fase-dialog-footer">
          <button type="button" className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={!puedeGuardar} onClick={guardar}>
            {guardando ? 'Guardando…' : soloCompletar || fase === lead.fl_faseactual ? 'Guardar' : 'Guardar y cambiar fase'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CampoInput({
  campo,
  tipo,
  valor,
  onChange,
  lead,
  onLineas,
}: {
  campo: CampoFase
  tipo: string
  valor: string
  onChange: (v: string) => void
  lead: Lead
  onLineas: (n: number) => void
}) {
  switch (tipo) {
    case 'modelos':
      return <LineasOportunidad leadId={lead.fl_leadid} textoAnterior={lead.fl_modelosinteres} soloLectura={false} onLineas={onLineas} />
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
