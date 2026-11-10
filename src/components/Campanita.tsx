import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { descuentoPendiente } from '../lib/descuento'
import { fetchEmpresas } from '../lib/empresasService'
import { condicionesPorRevisar, fetchTodosLosLeads } from '../lib/leadsService'
import {
  empresasDuplicadas,
  enlaceNotificacion,
  eliminarNotificacion,
  fetchNotificaciones,
  notificacionPendiente,
  sincronizarNotificaciones,
} from '../lib/notificacionesService'
import { fetchConcesionarios } from '../lib/usuariosService'
import { TipoNotificacion } from '../lib/types'
import type { Notificacion } from '../lib/types'
import './Campanita.css'

const ETIQUETA_TIPO: Record<number, string> = {
  [TipoNotificacion.DescuentoPendiente]: 'Pendiente de % de marca',
  [TipoNotificacion.EmpresaDuplicada]: 'Empresa duplicada',
  [TipoNotificacion.CondicionesPorRevisar]: 'Condiciones por revisar',
}

const formatoFecha =(iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '')

export function Campanita() {
  const [abierta, setAbierta] = useState(false)
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [leadIdsPendientes, setLeadIdsPendientes] = useState<Set<string>>(new Set())
  const [cifsDuplicados, setCifsDuplicados] = useState<Set<string>>(new Set())
  const [leadIdsCondiciones, setLeadIdsCondiciones] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const cargar = async () => {
    const [leads, empresas, concesionarios, existentes] = await Promise.all([
      fetchTodosLosLeads(),
      fetchEmpresas(),
      fetchConcesionarios(),
      fetchNotificaciones(),
    ])
    const nombreConcesionario = new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre]))
    const huboNuevas = await sincronizarNotificaciones(leads, empresas, existentes, nombreConcesionario).catch(() => false)
    setLeadIdsPendientes(new Set(leads.filter(descuentoPendiente).map((l) => l.fl_leadid)))
    setLeadIdsCondiciones(new Set(leads.filter(condicionesPorRevisar).map((l) => l.fl_leadid)))
    setCifsDuplicados(new Set(empresasDuplicadas(empresas).map((g) => g.cif)))
    setNotifs(huboNuevas ? await fetchNotificaciones() : existentes)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierta(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierta])

  const ordenadas = useMemo(() => {
    const copia = [...notifs]
    copia.sort((a, b) => {
      const pa = notificacionPendiente(a, leadIdsPendientes, cifsDuplicados, leadIdsCondiciones) ? 1 : 0
      const pb = notificacionPendiente(b, leadIdsPendientes, cifsDuplicados, leadIdsCondiciones) ? 1 : 0
      if (pa !== pb) return pb - pa
      return (b.createdon ?? '').localeCompare(a.createdon ?? '')
    })
    return copia
  }, [notifs, leadIdsPendientes, cifsDuplicados, leadIdsCondiciones])

  const pendientesCount = useMemo(
    () => notifs.filter((n) => notificacionPendiente(n, leadIdsPendientes, cifsDuplicados, leadIdsCondiciones)).length,
    [notifs, leadIdsPendientes, cifsDuplicados, leadIdsCondiciones],
  )

  const quitar = async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.fl_notificacionid !== id))
    try {
      await eliminarNotificacion(id)
    } catch {
      cargar()
    }
  }

  const ir = (n: Notificacion) => {
    const enlace = enlaceNotificacion(n)
    if (enlace) window.location.hash = enlace
    setAbierta(false)
  }

  return (
    <div className="campanita" ref={ref}>
      <button type="button" className="campanita-btn" aria-label="Notificaciones" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}>
        <Icon name="bell" size={18} />
        {pendientesCount > 0 && <span className="campanita-badge">{pendientesCount}</span>}
      </button>

      {abierta && (
        <div className="campanita-pop" role="dialog" aria-label="Notificaciones">
          <div className="campanita-pop-header">Notificaciones</div>
          {cargando ? (
            <p className="campanita-vacio">Cargando…</p>
          ) : ordenadas.length === 0 ? (
            <p className="campanita-vacio">No hay notificaciones.</p>
          ) : (
            <ul className="campanita-lista">
              {ordenadas.map((n) => {
                const pendiente = notificacionPendiente(n, leadIdsPendientes, cifsDuplicados, leadIdsCondiciones)
                return (
                  <li key={n.fl_notificacionid} className={`campanita-item${pendiente ? ' is-pendiente' : ''}`}>
                    <button type="button" className="campanita-item-texto" onClick={() => ir(n)}>
                      <span className={`campanita-punto${pendiente ? ' is-pendiente' : ''}`} aria-hidden="true" />
                      <span>
                        <span className="campanita-titulo">{n.fl_titulo}</span>
                        <span className="campanita-meta">
                          {ETIQUETA_TIPO[n.fl_tipo] ?? 'Aviso'} · {formatoFecha(n.createdon)}
                          {!pendiente && ' · Resuelta'}
                        </span>
                      </span>
                    </button>
                    <button type="button" className="campanita-quitar" aria-label="Quitar notificación" title="Quitar" onClick={() => quitar(n.fl_notificacionid)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
