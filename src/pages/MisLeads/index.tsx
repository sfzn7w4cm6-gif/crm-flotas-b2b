import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FaseBadge } from '../../components/StatusBadge'
import { fetchMisLeads } from '../../lib/leadsService'
import type { Lead } from '../../lib/types'

type SortKey = 'numero' | 'empresa' | 'fase' | 'vehiculos' | 'fechaLimite'
type SortDir = 'asc' | 'desc'

export function MisLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [sortBy, setSortBy] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    fetchMisLeads()
      .then(setLeads)
      .finally(() => setCargando(false))
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return leads
    return leads.filter((l) => l.fl_razonsocial.toLowerCase().includes(q))
  }, [leads, busqueda])

  const valorOrden = (l: Lead, key: SortKey): string | number => {
    switch (key) {
      case 'numero':
        return l.fl_numero
      case 'empresa':
        return l.fl_razonsocial.toLowerCase()
      case 'fase':
        return l.fl_faseactual
      case 'vehiculos':
        return l.fl_numvehiculosrenovarampliar
      case 'fechaLimite':
        return l.fl_fechaproximaaccion
    }
  }

  const ordenados = useMemo(() => {
    if (!sortBy) return filtrados
    const copia = [...filtrados]
    copia.sort((a, b) => {
      const va = valorOrden(a, sortBy)
      const vb = valorOrden(b, sortBy)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copia
  }, [filtrados, sortBy, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const Th = ({ label, sortKey }: { label: string; sortKey?: SortKey }) => {
    if (!sortKey) return <th>{label}</th>
    const activo = sortBy === sortKey
    return (
      <th>
        <button
          type="button"
          className={`th-sort ${activo ? 'is-active' : ''} ${activo && sortDir === 'desc' ? 'is-desc' : ''}`}
          onClick={() => toggleSort(sortKey)}
        >
          {label}
          <span className="th-sort-icon">
            <Icon name="chevronDown" size={12} />
          </span>
        </button>
      </th>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Mis leads</h1>
        <Link to="/nuevo-lead" className="btn-primary">
          <Icon name="add" size={16} />
          Nuevo lead
        </Link>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input placeholder="Buscar por empresa…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      {cargando && <p className="wizard-loading">Cargando…</p>}

      {!cargando && ordenados.length === 0 && (
        <div className="empty-state">
          <Icon name="car" size={28} />
          <p>Todavía no tienes leads{busqueda ? ' que coincidan con la búsqueda' : ''}.</p>
          {!busqueda && (
            <Link to="/nuevo-lead" className="btn-primary">
              Crear el primero
            </Link>
          )}
        </div>
      )}

      {!cargando && ordenados.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <Th label="Nº" sortKey="numero" />
                <Th label="Empresa" sortKey="empresa" />
                <Th label="Fase" sortKey="fase" />
                <Th label="Nº vehículos" sortKey="vehiculos" />
                <th>Próxima acción</th>
                <Th label="Fecha límite" sortKey="fechaLimite" />
              </tr>
            </thead>
            <tbody>
              {ordenados.map((l) => (
                <tr key={l.fl_leadid} className="row-clickable" onClick={() => (window.location.hash = `#/lead/${l.fl_leadid}`)}>
                  <td className="cell-strong">{l.fl_numero}</td>
                  <td>{l.fl_razonsocial}</td>
                  <td>
                    <FaseBadge fase={l.fl_faseactual} size="sm" />
                  </td>
                  <td>{l.fl_numvehiculosrenovarampliar}</td>
                  <td>{l.fl_proximaaccion}</td>
                  <td>{l.fl_fechaproximaaccion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
