import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { DescuentoPendienteBadge } from '../../components/StatusBadge'
import { descuentoPendiente } from '../../lib/descuento'
import { numeroOportunidadAbierta } from '../../lib/empresasService'
import type { ActualizarLeadInput } from '../../lib/leadsService'
import type { CambioLinea } from '../../lib/lineasService'
import type { Empresa, Lead, LineaOportunidad, Modelo } from '../../lib/types'
import { Dato } from './DatosLead'
import { borradorInicial, cambiosDelBorrador, TablaModelos, type Borrador } from './TablaModelos'

// Bloque "Oferta" de la ficha: por cada modelo, el descuento del concesionario (lo pone el
// comercial), el de marca (lo pone ventas) y su suma; debajo, las condiciones. Cada uno edita
// lo suyo; el administrador y la gente de "Sin concesionario", todo.

export function OfertaLead({
  lead,
  lineas,
  modelos,
  editaConcesionario,
  editaVentas,
  onGuardar,
  onGuardarLineas,
  otraEmpresa,
  otroConcesionarioNombre,
}: {
  lead: Lead
  /** Modelos de la oportunidad; null mientras cargan. */
  lineas: LineaOportunidad[] | null
  modelos: Modelo[]
  /** Puede cambiar el descuento del concesionario y las condiciones. */
  editaConcesionario: boolean
  /** Puede cambiar el descuento de marca. */
  editaVentas: boolean
  onGuardar: (cambios: ActualizarLeadInput) => Promise<void>
  onGuardarLineas: (cambios: CambioLinea[]) => Promise<void>
  /** La misma empresa (por CIF), ya contactada por otro concesionario, si la hay. */
  otraEmpresa?: Empresa | null
  otroConcesionarioNombre?: string | null
}) {
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [condiciones, setCondiciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendiente = descuentoPendiente(lead)
  const hayModelos = !!lineas && lineas.length > 0
  const permisos = { cantidad: false, concesionario: editaConcesionario, ventas: editaVentas }

  const editar = () => {
    setBorrador(borradorInicial(lineas ?? []))
    setCondiciones(lead.fl_ofertacondiciones ?? '')
    setError(null)
  }

  const guardar = async () => {
    if (!borrador || !lineas) return
    const { cambios, error: err } = cambiosDelBorrador(lineas, borrador, permisos)
    if (err) {
      setError(err)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      if (cambios.length) await onGuardarLineas(cambios)
      if (editaConcesionario && condiciones.trim() !== (lead.fl_ofertacondiciones ?? '').trim()) await onGuardar({ ofertaCondiciones: condiciones.trim() })
      setBorrador(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // Aviso al comercial: si cambia su descuento, ventas tendrá que poner el suyo de nuevo.
  const borraraVentas =
    !!borrador && !editaVentas && (lineas ?? []).some((l) => l.fl_descuentoventas != null && (borrador[l.fl_lineaoportunidadid]?.concesionario ?? '') !== String(l.fl_descuentoconcesionario ?? ''))

  return (
    <section className={`bloque-datos${borrador ? ' is-editando' : ''}${pendiente ? ' is-pendiente-descuento' : ''}`}>
      <header className="bloque-datos-cabecera">
        <h2>Oferta</h2>
        <div className="bloque-datos-cabecera-derecha">
          {pendiente && <DescuentoPendienteBadge />}
          {(editaConcesionario || editaVentas) && !borrador && hayModelos && (
            <button type="button" className="bloque-datos-editar" onClick={editar} aria-label="Editar oferta" title="Editar">
              <Icon name="pencil" size={14} />
            </button>
          )}
        </div>
      </header>
      {otraEmpresa && (
        <div className="oferta-aviso-duplicado">
          <Icon name="warning" size={15} />
          <p className="oferta-aviso-duplicado-texto">
            Esta empresa ya está siendo trabajada por <strong>{otroConcesionarioNombre ?? 'otro concesionario'}</strong>. Alinead el % de marca para ofrecer las mismas condiciones.
          </p>
          {otraEmpresa._fl_oportunidadabierta_value && (
            <button
              type="button"
              className="oferta-aviso-duplicado-enlace"
              onClick={() => (window.location.hash = `#/lead/${otraEmpresa._fl_oportunidadabierta_value}`)}
            >
              Ver oportunidad{numeroOportunidadAbierta(otraEmpresa) ? ` ${numeroOportunidadAbierta(otraEmpresa)}` : ''}
              <Icon name="arrowRight" size={14} />
            </button>
          )}
        </div>
      )}

      {lineas === null ? (
        <p className="flow-meta">Cargando…</p>
      ) : !hayModelos ? (
        <p className="flow-meta oferta-sin-modelos">
          El descuento se pone por modelo. Añade primero los modelos de interés en «Necesidad y oportunidad» para poder preparar la oferta.
        </p>
      ) : (
        <TablaModelos lineas={lineas} modelos={modelos} borrador={borrador} permisos={permisos} onChange={setBorrador} pendienteMarca="Pendiente" />
      )}

      {borrador ? (
        <div className="bloque-datos-form">
          {editaConcesionario && (
            <div className="field is-ancho">
              <label htmlFor="oferta-condiciones">Condiciones de la oferta</label>
              <textarea id="oferta-condiciones" rows={3} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
            </div>
          )}
          {borraraVentas && <p className="field-ayuda oferta-aviso">Al modificar el descuento de un modelo, el descuento de marca de ese modelo deberá revisarse de nuevo.</p>}
          {error && <p className="wizard-error">{error}</p>}
          <div className="bloque-datos-acciones">
            <button type="button" className="btn-link" onClick={() => setBorrador(null)} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <dl className="datos-grid">
          <Dato label="Condiciones" valor={lead.fl_ofertacondiciones} ancho />
        </dl>
      )}
    </section>
  )
}
