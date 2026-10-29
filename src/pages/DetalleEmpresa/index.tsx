import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FaseBadge } from '../../components/StatusBadge'
import { fetchEmpresa, numeroOportunidadAbierta } from '../../lib/empresasService'
import { fetchOportunidadesDeEmpresa } from '../../lib/leadsService'
import { EstadoEmpresa, EstadoEmpresaLabel, RolApp } from '../../lib/types'
import type { Empresa, Lead } from '../../lib/types'
import '../NuevoLead/NuevoLead.css'
import '../DetalleLead/DetalleLead.css'

/** Ficha del cliente: sus datos y todas las oportunidades que se le han abierto. */
export function DetalleEmpresa() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { effectiveRol } = useAuth()
  const soloLectura = effectiveRol === RolApp.EquipoVentas

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [oportunidades, setOportunidades] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setCargando(true)
    Promise.all([fetchEmpresa(id), fetchOportunidadesDeEmpresa(id)])
      .then(([e, o]) => {
        setEmpresa(e)
        setOportunidades(o)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la empresa.'))
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) return <p className="wizard-loading">Cargando…</p>
  if (!empresa) return <p className="wizard-error">{error ?? 'No se encontró la empresa.'}</p>

  const abierta = empresa._fl_oportunidadabierta_value
  // Con seguridad por comercial, puede haber oportunidades de compañeros que no aparecen en la lista.
  const abiertaOculta = abierta && !oportunidades.some((o) => o.fl_leadid === abierta)

  return (
    <div className="detalle-lead">
      <button type="button" className="btn-link" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div className="page-header">
        <div>
          <h1>{empresa.fl_razonsocial}</h1>
          <p className="flow-meta">CIF {empresa.fl_cif}</p>
        </div>
        <div className="detalle-fase-actions">
          <span className="fase-inicial-chip" title="Pasa a Cliente sola cuando una oportunidad llega a Cierre">
            {EstadoEmpresaLabel[empresa.fl_estado ?? EstadoEmpresa.ClientePotencial]}
          </span>
          {!soloLectura && !abierta && (
            <button type="button" className="btn-primary" onClick={() => navigate('/nuevo-lead', { state: { cif: empresa.fl_cif } })}>
              Nueva oportunidad
            </button>
          )}
        </div>
      </div>
      {error && <p className="wizard-error">{error}</p>}

      <div className="detalle-grid">
        <div className="detalle-col">
          <Seccion titulo="Contactos clave">
            <Fila label="Responsable" valor={empresa.fl_nombreresponsable} />
            <Fila label="Teléfono" valor={empresa.fl_telefonocorporativo} />
            <Fila label="E-mail" valor={empresa.fl_emailcorporativo} />
          </Seccion>
          <p className="flow-meta">Los contactos se editan desde cualquiera de sus oportunidades. La situación de flota, la necesidad y el seguimiento son de cada oportunidad.</p>
        </div>

        <div className="detalle-col">
          <Seccion titulo="Oportunidades">
            {abiertaOculta && (
              <p className="flow-meta">
                Tiene una oportunidad en curso{numeroOportunidadAbierta(empresa) ? ` (${numeroOportunidadAbierta(empresa)})` : ''} que lleva
                otro comercial de tu concesionario.
              </p>
            )}
            {oportunidades.length === 0 ? (
              !abiertaOculta && <p className="flow-meta">Sin oportunidades.</p>
            ) : (
              <ul className="oportunidades-lista">
                {oportunidades.map((o) => (
                  <li key={o.fl_leadid}>
                    <button type="button" className="oportunidad-fila" onClick={() => navigate(`/lead/${o.fl_leadid}`)}>
                      <span className="oportunidad-numero">{o.fl_numero}</span>
                      <FaseBadge fase={o.fl_faseactual} size="sm" />
                      <span className="flow-meta">
                        {o.fl_comercialresponsable} · {new Date(o.fl_fechaprimercontacto || o.createdon).toLocaleDateString('es-ES')}
                      </span>
                      {o.fl_modelosinteres && <span className="flow-meta">{o.fl_modelosinteres}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="detalle-seccion">
      <div className="detalle-seccion-header">
        <h2>{titulo}</h2>
      </div>
      <div className="detalle-seccion-body">{children}</div>
    </section>
  )
}

function Fila({ label, valor }: { label: string; valor: string | number | null | undefined }) {
  return (
    <div className="resumen-fila">
      <span className="resumen-label">{label}</span>
      <span className="resumen-valor">{valor === null || valor === undefined || valor === '' ? '—' : valor}</span>
    </div>
  )
}
