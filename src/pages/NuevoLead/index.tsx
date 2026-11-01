import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { crearOportunidad, fetchLead, OportunidadDuplicadaError } from '../../lib/leadsService'
import { buscarEmpresaPorCif, numeroOportunidadAbierta } from '../../lib/empresasService'
import { fetchComercialesDeSede } from '../../lib/asignacionesService'
import { EstadoEmpresa, EstadoEmpresaLabel } from '../../lib/types'
import type { Empresa, UsuarioApp } from '../../lib/types'
import { cifNifValido, emailValido, telefonoValido } from '../../lib/validators'
import './NuevoLead.css'

// En el alta solo se piden las secciones 1 y 2 de la ficha; el resto se completa después desde el detalle del lead.
const PASOS = ['Datos de la empresa', 'Contactos clave']
const ULTIMO_PASO = PASOS.length - 1

interface Form {
  razonSocial?: string
  cif?: string
  nombreResponsable?: string
  telefonoCorporativo?: string
  emailCorporativo?: string
}

// Resultado de buscar el CIF en el concesionario antes de dejar continuar.
type Busqueda =
  | { estado: 'buscando' }
  | { estado: 'nueva' }
  | { estado: 'existe'; empresa: Empresa }
  // puedeVerla: la oportunidad en curso es del usuario (o es admin) y puede abrirla.
  | { estado: 'duplicada'; empresa: Empresa; leadId: string; numero?: string; puedeVerla: boolean }
  | { estado: 'error'; mensaje: string }

export function NuevoLead() {
  const { usuario, ubicacion, sedes, concesionarios } = useAuth()
  const navigate = useNavigate()
  // Desde la ficha de una empresa se llega con su CIF ya puesto.
  const cifInicial = (useLocation().state as { cif?: string } | null)?.cif

  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState<Form>({ cif: cifInicial })
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null)
  const [comerciales, setComerciales] = useState<UsuarioApp[]>([])
  const [comercialId, setComercialId] = useState<string>('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ leadId: string; numero: string; asignadaA?: string } | null>(null)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Quien lleva varias sedes elige en cuál da de alta (por defecto, su sede principal). El
  // concesionario y el area manager salen de esa sede.
  const [sedeId, setSedeId] = useState(ubicacion?.fl_ubicacionid ?? '')
  const sede = sedes.find((s) => s.fl_ubicacionid === sedeId) ?? ubicacion
  const concesionario = concesionarios.find((c) => c.fl_concesionarioid === sede?._fl_concesionario_value) ?? null
  const variosConcesionarios = concesionarios.length > 1

  // El comercial es el propio usuario; puede elegir a otro que lleve la misma sede.
  useEffect(() => {
    if (!sede || !usuario) return
    fetchComercialesDeSede(sede.fl_ubicacionid, sede._fl_concesionario_value)
      .then((lista) => {
        const conUsuario = lista.some((u) => u.fl_usuarioappid === usuario.fl_usuarioappid) ? lista : [usuario, ...lista]
        setComerciales(conUsuario)
      })
      .catch(() => setComerciales([usuario]))
    setComercialId(usuario.fl_usuarioappid)
  }, [sede, usuario])

  const comercial = comerciales.find((c) => c.fl_usuarioappid === comercialId) ?? usuario ?? undefined

  // Al escribir un CIF válido se busca la empresa en el concesionario.
  const cif = form.cif ?? ''
  useEffect(() => {
    setBusqueda(null)
    if (!concesionario || !cifNifValido(cif)) return
    let cancelado = false
    const t = setTimeout(async () => {
      setBusqueda({ estado: 'buscando' })
      try {
        const empresa = await buscarEmpresaPorCif(concesionario.fl_concesionarioid, cif)
        if (cancelado) return
        if (!empresa) {
          setBusqueda({ estado: 'nueva' })
        } else if (empresa._fl_oportunidadabierta_value) {
          const leadId = empresa._fl_oportunidadabierta_value
          const visible = await fetchLead(leadId).catch(() => null)
          if (cancelado) return
          setBusqueda({ estado: 'duplicada', empresa, leadId, numero: numeroOportunidadAbierta(empresa), puedeVerla: !!visible })
        } else {
          setBusqueda({ estado: 'existe', empresa })
          setForm((f) => ({
            ...f,
            razonSocial: empresa.fl_razonsocial,
            nombreResponsable: empresa.fl_nombreresponsable ?? f.nombreResponsable,
            telefonoCorporativo: empresa.fl_telefonocorporativo ?? f.telefonoCorporativo,
            emailCorporativo: empresa.fl_emailcorporativo ?? f.emailCorporativo,
          }))
        }
      } catch (e) {
        if (!cancelado) setBusqueda({ estado: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo comprobar el CIF.' })
      }
    }, 400)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [cif, concesionario])

  const faltanPaso = useMemo(() => {
    switch (paso) {
      case 0:
        return (
          !cifNifValido(cif) ||
          (busqueda?.estado !== 'nueva' && busqueda?.estado !== 'existe') ||
          !form.razonSocial?.trim() ||
          !comercial ||
          !sede
        )
      case 1:
        return !form.nombreResponsable || !telefonoValido(form.telefonoCorporativo ?? '') || !emailValido(form.emailCorporativo ?? '')
      default:
        return false
    }
  }, [paso, form, cif, busqueda, comercial, sede])

  const enviar = async () => {
    if (!usuario || !comercial || !sede || faltanPaso) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const r = await crearOportunidad(
        {
          razonSocial: form.razonSocial!.trim(),
          cif,
          nombreResponsable: form.nombreResponsable!,
          telefonoCorporativo: form.telefonoCorporativo!,
          emailCorporativo: form.emailCorporativo!,
          comercial,
        },
        usuario,
        sede,
        concesionario?._fl_equipo_value,
      )
      setResultado(r)
    } catch (e) {
      if (e instanceof OportunidadDuplicadaError) {
        // Otro comercial la ha dado de alta mientras se rellenaba el formulario.
        const visible = await fetchLead(e.leadId).catch(() => null)
        setBusqueda({ estado: 'duplicada', empresa: { fl_razonsocial: form.razonSocial } as Empresa, leadId: e.leadId, numero: e.numero, puedeVerla: !!visible })
        setPaso(0)
      } else {
        setErrorEnvio(e instanceof Error ? e.message : 'No se pudo crear la oportunidad.')
      }
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
        <h1>Oportunidad creada</h1>
        <p>
          El lead <strong>{resultado.numero}</strong> se creó correctamente en fase <strong>1. Prospección</strong>.
        </p>
        {resultado.asignadaA && (
          <p>
            Se ha asignado a <strong>{resultado.asignadaA}</strong>: aparecerá en sus oportunidades, no en las tuyas.
          </p>
        )}
        <div className="wizard-done-actions">
          {resultado.asignadaA ? (
            <button type="button" className="btn-primary" onClick={() => navigate('/mis-leads')}>
              Ver mis leads
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => navigate(`/lead/${resultado.leadId}`)}>
              Abrir el lead
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
            Crear otro lead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      <h1 className="wizard-title">Nueva oportunidad</h1>

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
            {sedes.length > 1 && (
              <Field label="Instalación" ayuda="Lo buscas y lo das de alta en la sede que elijas">
                <select value={sede?.fl_ubicacionid ?? ''} onChange={(e) => setSedeId(e.target.value)}>
                  {variosConcesionarios
                    ? concesionarios.map((c) => (
                        <optgroup key={c.fl_concesionarioid} label={c.fl_nombre}>
                          {sedes
                            .filter((s) => s._fl_concesionario_value === c.fl_concesionarioid)
                            .map((s) => (
                              <option key={s.fl_ubicacionid} value={s.fl_ubicacionid}>
                                {s.fl_nombre}
                              </option>
                            ))}
                        </optgroup>
                      ))
                    : sedes.map((s) => (
                        <option key={s.fl_ubicacionid} value={s.fl_ubicacionid}>
                          {s.fl_nombre}
                        </option>
                      ))}
                </select>
              </Field>
            )}
            <Field label="CIF / NIF">
              <input value={cif} onChange={(e) => set('cif', e.target.value)} placeholder="B12345678" autoFocus />
              {cif && !cifNifValido(cif) && <span className="field-error">Formato de CIF/NIF/NIE no válido.</span>}
              {busqueda?.estado === 'buscando' && <span className="field-help">Comprobando si la empresa ya existe…</span>}
            </Field>

            {busqueda?.estado === 'duplicada' && (
              <div className="aviso aviso-error">
                <strong>{busqueda.empresa.fl_razonsocial} ya tiene una oportunidad en curso{busqueda.numero ? ` (${busqueda.numero})` : ''}.</strong>
                <span>
                  {busqueda.puedeVerla
                    ? 'No se puede abrir otra mientras esta siga abierta. Continúa la que ya existe.'
                    : 'La lleva otro comercial de tu concesionario. Coordínate con quien la lleva antes de contactar con la empresa.'}
                </span>
                {busqueda.puedeVerla && (
                  <button type="button" className="btn-secondary" onClick={() => navigate(`/lead/${busqueda.leadId}`)}>
                    Abrir la oportunidad
                  </button>
                )}
              </div>
            )}
            {busqueda?.estado === 'existe' && (
              <div className="aviso">
                <strong>Empresa ya registrada · {EstadoEmpresaLabel[busqueda.empresa.fl_estado ?? EstadoEmpresa.ClientePotencial]}</strong>
                <span>Se creará una nueva oportunidad para ella con sus datos actuales, que puedes revisar.</span>
              </div>
            )}
            {busqueda?.estado === 'error' && <p className="wizard-error">{busqueda.mensaje}</p>}

            {(busqueda?.estado === 'nueva' || busqueda?.estado === 'existe') && (
              <>
                <Field label="Empresa" ayuda="Nombre fiscal (razón social), como aparece en el CIF">
                  <input value={form.razonSocial ?? ''} onChange={(e) => set('razonSocial', e.target.value)} />
                </Field>
                <Field label="Concesionario" auto>
                  <input value={concesionario?.fl_nombre ?? '—'} readOnly />
                </Field>
                {sedes.length <= 1 && (
                  <Field label="Instalación" auto>
                    <input value={sede?.fl_nombre ?? '—'} readOnly />
                  </Field>
                )}
                <Field label="Comercial responsable" auto={comerciales.length <= 1}>
                  {comerciales.length > 1 ? (
                    <select value={comercialId} onChange={(e) => setComercialId(e.target.value)}>
                      {comerciales.map((c) => (
                        <option key={c.fl_usuarioappid} value={c.fl_usuarioappid}>
                          {c.fl_nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={comercial?.fl_nombre ?? ''} readOnly />
                  )}
                  {comercial && comercial.fl_usuarioappid !== usuario?.fl_usuarioappid && !comercial._fl_systemuserid_value && (
                    <span className="field-help">
                      {comercial.fl_nombre} aún no tiene acceso a la app: el lead quedará a tu nombre hasta que lo tenga.
                    </span>
                  )}
                </Field>
                <Field label="Area Manager EBRO (Zona)" auto>
                  <input value={sede?.fl_areamanager || '—'} readOnly />
                </Field>
              </>
            )}
          </div>
        )}

        {paso === 1 && (
          <div className="wizard-form">
            <Field label="Nombre responsable empresa">
              <input value={form.nombreResponsable ?? ''} onChange={(e) => set('nombreResponsable', e.target.value)} />
            </Field>
            <Field label="Teléfono corporativo">
              <input value={form.telefonoCorporativo ?? ''} onChange={(e) => set('telefonoCorporativo', e.target.value)} placeholder="600 000 000" />
              {form.telefonoCorporativo && !telefonoValido(form.telefonoCorporativo) && (
                <span className="field-error">Debe ser un teléfono español válido (9 dígitos).</span>
              )}
            </Field>
            <Field label="E-mail corporativo">
              <input type="email" value={form.emailCorporativo ?? ''} onChange={(e) => set('emailCorporativo', e.target.value)} placeholder="nombre@empresa.com" />
              {form.emailCorporativo && !emailValido(form.emailCorporativo) && <span className="field-error">Formato de e-mail no válido.</span>}
            </Field>
            {errorEnvio && <p className="wizard-error">{errorEnvio}</p>}
          </div>
        )}
      </div>

      <div className="wizard-actions">
        <button type="button" className="btn-secondary" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
          Atrás
        </button>
        {paso < ULTIMO_PASO && (
          <button type="button" className="btn-primary" disabled={faltanPaso} onClick={() => setPaso((p) => p + 1)}>
            Siguiente
          </button>
        )}
        {paso === ULTIMO_PASO && (
          <button type="button" className="btn-primary" disabled={faltanPaso || enviando} onClick={enviar}>
            {enviando ? 'Guardando…' : 'Crear oportunidad'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  opcional,
  auto,
  ayuda,
}: {
  label: string
  children: ReactNode
  opcional?: boolean
  auto?: boolean
  /** Aclaración bajo el campo. */
  ayuda?: string
}) {
  return (
    <div className={auto ? 'field field-auto' : 'field'}>
      <label>{label} {opcional || auto ? '' : '*'}</label>
      {children}
      {ayuda && <span className="field-ayuda">{ayuda}</span>}
    </div>
  )
}
