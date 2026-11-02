import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { DescuentoPendienteBadge } from '../../components/StatusBadge'
import { descuentoPendiente, descuentoTotal, formatoPorcentaje } from '../../lib/descuento'
import type { ActualizarLeadInput } from '../../lib/leadsService'
import type { Lead } from '../../lib/types'
import { Dato } from './DatosLead'

// Bloque "Oferta" de la ficha: el descuento del concesionario (lo pone el comercial), el de
// ventas (lo pone el equipo de ventas), su suma y las condiciones. Cada uno edita lo suyo; el
// administrador, todo.

type Clave = 'descuentoConcesionario' | 'descuentoVentas' | 'ofertaCondiciones'

const texto = (n: number | null | undefined) => (n == null ? '' : String(n))

export function OfertaLead({
  lead,
  editaConcesionario,
  editaVentas,
  onGuardar,
}: {
  lead: Lead
  /** Puede cambiar el descuento del concesionario y las condiciones. */
  editaConcesionario: boolean
  /** Puede cambiar el descuento de ventas. */
  editaVentas: boolean
  onGuardar: (cambios: ActualizarLeadInput) => Promise<void>
}) {
  const [valores, setValores] = useState<Record<Clave, string> | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendiente = descuentoPendiente(lead)

  const iniciales = (): Record<Clave, string> => ({
    descuentoConcesionario: texto(lead.fl_descuentoconcesionario),
    descuentoVentas: texto(lead.fl_descuentoventas),
    ofertaCondiciones: lead.fl_ofertacondiciones ?? '',
  })
  const set = (k: Clave, v: string) => setValores((x) => (x ? { ...x, [k]: v } : x))

  const guardar = async () => {
    if (!valores) return
    const ini = iniciales()
    const pct = (k: 'descuentoConcesionario' | 'descuentoVentas') => (valores[k].trim() === '' ? null : Number(valores[k]))
    for (const k of ['descuentoConcesionario', 'descuentoVentas'] as const) {
      const n = pct(k)
      if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) {
        setError('Los descuentos deben estar entre 0 y 100 %.')
        return
      }
    }
    if ((pct('descuentoConcesionario') ?? 0) + (pct('descuentoVentas') ?? 0) > 100) {
      setError('Entre los dos descuentos no pueden pasar del 100 %.')
      return
    }
    const cambios: ActualizarLeadInput = {}
    if (editaConcesionario && valores.descuentoConcesionario.trim() !== ini.descuentoConcesionario) cambios.descuentoConcesionario = pct('descuentoConcesionario')
    if (editaVentas && valores.descuentoVentas.trim() !== ini.descuentoVentas) cambios.descuentoVentas = pct('descuentoVentas')
    if (editaConcesionario && valores.ofertaCondiciones.trim() !== ini.ofertaCondiciones.trim()) cambios.ofertaCondiciones = valores.ofertaCondiciones.trim()
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(cambios)
      setValores(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // Aviso al comercial: si cambia su descuento, ventas tendrá que poner el suyo de nuevo.
  const borraraVentas =
    !!valores && !editaVentas && lead.fl_descuentoventas != null && valores.descuentoConcesionario.trim() !== texto(lead.fl_descuentoconcesionario)

  return (
    <section className={`bloque-datos${valores ? ' is-editando' : ''}${pendiente ? ' is-pendiente-descuento' : ''}`}>
      <header className="bloque-datos-cabecera">
        <h2>Oferta</h2>
        <div className="bloque-datos-cabecera-derecha">
          {pendiente && <DescuentoPendienteBadge />}
          {(editaConcesionario || editaVentas) && !valores && (
            <button
              type="button"
              className="bloque-datos-editar"
              onClick={() => {
                setValores(iniciales())
                setError(null)
              }}
              aria-label="Editar oferta"
              title="Editar"
            >
              <Icon name="pencil" size={14} />
            </button>
          )}
        </div>
      </header>
      {valores ? (
        <div className="bloque-datos-form">
          <div className="datos-form-grid">
            <div className="field">
              <label htmlFor="dto-concesionario">Descuento del concesionario (%)</label>
              <input
                id="dto-concesionario"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={valores.descuentoConcesionario}
                disabled={!editaConcesionario}
                onChange={(e) => set('descuentoConcesionario', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="dto-ventas">Descuento de ventas (%)</label>
              <input
                id="dto-ventas"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={valores.descuentoVentas}
                disabled={!editaVentas}
                placeholder={editaVentas ? '' : 'Lo pone el equipo de ventas'}
                onChange={(e) => set('descuentoVentas', e.target.value)}
              />
            </div>
            {editaConcesionario && (
              <div className="field is-ancho">
                <label htmlFor="oferta-condiciones">Condiciones de la oferta</label>
                <textarea id="oferta-condiciones" rows={3} value={valores.ofertaCondiciones} onChange={(e) => set('ofertaCondiciones', e.target.value)} />
              </div>
            )}
          </div>
          {borraraVentas && <p className="field-ayuda oferta-aviso">Al cambiar tu descuento, el equipo de ventas tendrá que volver a poner el suyo.</p>}
          {error && <p className="wizard-error">{error}</p>}
          <div className="bloque-datos-acciones">
            <button type="button" className="btn-link" onClick={() => setValores(null)} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <dl className="datos-grid">
          <Dato label="Descuento del concesionario" valor={formatoPorcentaje(lead.fl_descuentoconcesionario)} />
          <Dato label="Descuento de ventas" valor={pendiente ? <span className="oferta-pendiente">Pendiente</span> : formatoPorcentaje(lead.fl_descuentoventas)} />
          <Dato label="Descuento total" valor={descuentoTotal(lead) == null ? '' : <strong>{formatoPorcentaje(descuentoTotal(lead))}</strong>} />
          <Dato label="Condiciones" valor={lead.fl_ofertacondiciones} ancho />
        </dl>
      )}
    </section>
  )
}
