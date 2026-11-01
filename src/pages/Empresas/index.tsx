import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { FaseDot } from '../../components/StatusBadge'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import { coincideBusqueda, textoBusqueda } from '../../lib/filtrosLeads'
import { normalizarTexto } from '../../lib/formato'
import { fetchEmpresas, numeroOportunidadAbierta } from '../../lib/empresasService'
import { fetchMisLeads, fetchTodosLosLeads } from '../../lib/leadsService'
import { fetchConcesionarios } from '../../lib/usuariosService'
import { EstadoEmpresa, EstadoEmpresaLabel, Fase, FaseLabel, RolApp } from '../../lib/types'
import type { Concesionario, Empresa, Lead } from '../../lib/types'

interface FilaEmpresa {
  empresa: Empresa
  oportunidades: Lead[]
  /** La oportunidad en curso si el usuario puede verla (si es de un compañero, solo se sabe su número). */
  enCurso?: Lead
  ventas: number
  ultimaOportunidad?: Date
}

/**
 * Clientes del concesionario (o de toda la red para el equipo de ventas), con su estado y
 * sus oportunidades. Con seguridad por comercial, el recuento solo incluye las que ve el usuario.
 */
export function Empresas() {
  const navigate = useNavigate()
  const { effectiveRol, concesionarios: misConcesionarios } = useAuth()
  const vistaRed = effectiveRol !== RolApp.Concesionario
  // Columna y filtro de concesionario: en la red, y para quien lleva más de uno.
  const conConcesionario = vistaRed || misConcesionarios.length > 1

  const [filas, setFilas] = useState<FilaEmpresa[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [estados, setEstados] = useState<EstadoEmpresa[]>([])
  const [soloEnCurso, setSoloEnCurso] = useState(false)
  const [concesionariosSel, setConcesionariosSel] = useState<string[]>([])

  useEffect(() => {
    if (!vistaRed && !misConcesionarios.length) return
    setCargando(true)
    Promise.all([
      fetchEmpresas(vistaRed ? undefined : misConcesionarios.map((c) => c.fl_concesionarioid)),
      vistaRed ? fetchTodosLosLeads() : fetchMisLeads(),
      vistaRed ? fetchConcesionarios() : Promise.resolve(misConcesionarios),
    ])
      .then(([empresas, leads, cs]) => {
        setConcesionarios(cs)
        const porEmpresa = new Map<string, Lead[]>()
        for (const l of leads) {
          if (!l._fl_empresa_value) continue
          porEmpresa.set(l._fl_empresa_value, [...(porEmpresa.get(l._fl_empresa_value) ?? []), l])
        }
        setFilas(
          empresas.map((e) => {
            const ops = porEmpresa.get(e.fl_empresaid) ?? []
            const fechas = ops.map((o) => new Date(o.fl_fechaprimercontacto || o.createdon).getTime())
            return {
              empresa: e,
              oportunidades: ops,
              enCurso: ops.find((o) => o.fl_leadid === e._fl_oportunidadabierta_value),
              ventas: ops.filter((o) => o.fl_faseactual === Fase.Cierre || o.fl_faseactual === Fase.Entrega).length,
              ultimaOportunidad: fechas.length ? new Date(Math.max(...fechas)) : undefined,
            }
          }),
        )
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las empresas.'))
      .finally(() => setCargando(false))
  }, [vistaRed, misConcesionarios])

  const nombreConcesionario = useMemo(() => new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])), [concesionarios])

  // Busca en los datos de la empresa y en todo lo de sus oportunidades (fase, modelos, notas de seguimiento...).
  const indice = useMemo(
    () =>
      new Map(
        filas.map(({ empresa: e, oportunidades }) => [
          e.fl_empresaid,
          [
            normalizarTexto(
              [e.fl_razonsocial, e.fl_cif, e.fl_nombreresponsable, e.fl_telefonocorporativo, e.fl_emailcorporativo, e.fl_actividadeconomica,
                EstadoEmpresaLabel[e.fl_estado ?? EstadoEmpresa.ClientePotencial], nombreConcesionario.get(e._fl_concesionario_value)]
                .filter(Boolean)
                .join(' · '),
            ),
            ...oportunidades.map((o) => textoBusqueda(o)),
          ].join(' · '),
        ]),
      ),
    [filas, nombreConcesionario],
  )

  const filtradas = useMemo(() => {
    return filas.filter(({ empresa: e }) => {
      if (busqueda.trim() && !coincideBusqueda(indice.get(e.fl_empresaid) ?? '', busqueda)) return false
      if (estados.length && !estados.includes(e.fl_estado ?? EstadoEmpresa.ClientePotencial)) return false
      if (soloEnCurso && !e._fl_oportunidadabierta_value) return false
      if (concesionariosSel.length && !concesionariosSel.includes(e._fl_concesionario_value)) return false
      return true
    })
  }, [filas, indice, busqueda, estados, soloEnCurso, concesionariosSel])

  const hayFiltros = busqueda.trim() !== '' || estados.length > 0 || soloEnCurso || concesionariosSel.length > 0

  return (
    <div>
      <div className="page-header">
        <h1>Empresas</h1>
      </div>

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} />
          <FiltroMulti
            etiqueta="Estado"
            opciones={Object.entries(EstadoEmpresaLabel).map(([v, l]) => ({ value: Number(v) as EstadoEmpresa, label: l }))}
            value={estados}
            onChange={setEstados}
          />
          {conConcesionario && (
            <FiltroMulti
              etiqueta="Concesionario"
              opciones={concesionarios.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre }))}
              value={concesionariosSel}
              onChange={setConcesionariosSel}
            />
          )}
          <button type="button" className={`filtro-chip${soloEnCurso ? ' is-activo' : ''}`} aria-pressed={soloEnCurso} onClick={() => setSoloEnCurso((v) => !v)}>
            Con oportunidad en curso
          </button>
          {hayFiltros && (
            <button
              type="button"
              className="lista-limpiar"
              onClick={() => {
                setBusqueda('')
                setEstados([])
                setSoloEnCurso(false)
                setConcesionariosSel([])
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="lista-acciones">
          <span className="lista-cuenta">{hayFiltros ? `${filtradas.length} de ${filas.length} empresas` : `${filas.length} empresas`}</span>
        </div>
      </div>

      {cargando && <p className="wizard-loading">Cargando…</p>}
      {error && <p className="wizard-error">{error}</p>}

      {!cargando && filtradas.length === 0 && (
        <div className="empty-state">
          <Icon name="building" size={28} />
          <p>{hayFiltros ? 'Ninguna empresa coincide con los filtros.' : 'Todavía no hay empresas. Se crean al dar de alta una oportunidad.'}</p>
        </div>
      )}

      {!cargando && filtradas.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CIF</th>
                {conConcesionario && <th>Concesionario</th>}
                <th>Estado</th>
                <th>Oportunidad en curso</th>
                <th>Oportunidades</th>
                <th>Ventas</th>
                <th>Última oportunidad</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => {
                const numeroEnCurso = numeroOportunidadAbierta(f.empresa)
                return (
                  <tr key={f.empresa.fl_empresaid} className="row-clickable" onClick={() => navigate(`/empresa/${f.empresa.fl_empresaid}`)}>
                    <td className="cell-strong">{f.empresa.fl_razonsocial}</td>
                    <td>{f.empresa.fl_cif}</td>
                    {conConcesionario && <td>{nombreConcesionario.get(f.empresa._fl_concesionario_value) ?? '—'}</td>}
                    <td>{EstadoEmpresaLabel[f.empresa.fl_estado ?? EstadoEmpresa.ClientePotencial]}</td>
                    <td>
                      {f.enCurso ? (
                        <span className="celda-en-curso">
                          <FaseDot fase={f.enCurso.fl_faseactual} size={8} />
                          <span className="celda-en-curso-fase">{FaseLabel[f.enCurso.fl_faseactual].replace(/^\d+\.\s*/, '')}</span>
                          <span className="celda-en-curso-numero">{f.enCurso.fl_numero}</span>
                        </span>
                      ) : numeroEnCurso ? (
                        <span className="celda-en-curso" title="La lleva otro comercial de tu concesionario">
                          <span className="celda-en-curso-otro" />
                          <span className="celda-en-curso-fase is-muted">Otro comercial</span>
                          <span className="celda-en-curso-numero">{numeroEnCurso}</span>
                        </span>
                      ) : (
                        <span className="celda-vacia">—</span>
                      )}
                    </td>
                    <td>{f.oportunidades.length}</td>
                    <td>{f.ventas}</td>
                    <td>{f.ultimaOportunidad ? f.ultimaOportunidad.toLocaleDateString('es-ES') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
