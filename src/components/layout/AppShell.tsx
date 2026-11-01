import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '../Icon'
import { NAV_ITEMS } from './navConfig'
import { useAuth } from '../../context/AuthContext'
import { RolApp, RolAppLabel } from '../../lib/types'
import ebroLogo from '../../assets/ebro-logo.png'
import './AppShell.css'

const SIDEBAR_HIDDEN_KEY = 'crmflotas.sidebarHidden'

export function AppShell() {
  const { usuario, concesionario, ubicacion, sedes, concesionarios, effectiveRol, isAdmin, viewAsRole, setViewAsRole } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem(SIDEBAR_HIDDEN_KEY) === '1')

  const toggleSidebar = () => {
    setSidebarHidden((v) => {
      const next = !v
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, next ? '1' : '0')
      return next
    })
  }

  // El Administrador real ve siempre todas las pantallas. Al simular "Ver como
  // rol" se respeta el menu restringido de ese rol, que es justo el punto de
  // esa funcion de prueba (igual que en PeopleFlow).
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (isAdmin && viewAsRole === null) || (effectiveRol !== null && item.roles.includes(effectiveRol)),
  )

  const initials = (usuario?.fl_nombre || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Lo que lleva el usuario: su sede, o cuántas si lleva varias.
  const subtitulo =
    concesionarios.length > 1
      ? `${concesionarios.length} concesionarios · ${sedes.length} sedes`
      : concesionario && sedes.length > 1
        ? `${concesionario.fl_nombre} · ${sedes.length} sedes`
        : concesionario
          ? `${concesionario.fl_nombre}${ubicacion ? ` · ${ubicacion.fl_ciudad ?? ubicacion.fl_nombre}` : ''}`
          : effectiveRol !== null
            ? RolAppLabel[effectiveRol]
            : '—'

  return (
    <div className={`shell ${sidebarHidden ? 'is-sidebar-hidden' : ''}`}>
      <button
        type="button"
        className="shell-menu-btn"
        aria-label="Abrir menú de navegación"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <Icon name={mobileOpen ? 'close' : 'menu'} />
      </button>

      <button
        type="button"
        className="shell-collapse-btn"
        aria-label={sidebarHidden ? 'Mostrar panel lateral' : 'Ocultar panel lateral'}
        title={sidebarHidden ? 'Mostrar panel lateral' : 'Ocultar panel lateral'}
        onClick={toggleSidebar}
      >
        <Icon name={sidebarHidden ? 'chevronRight' : 'chevronLeft'} size={14} />
      </button>

      <nav className={`shell-sidebar ${mobileOpen ? 'is-open' : ''} ${sidebarHidden ? 'is-hidden' : ''}`} aria-label="Navegación principal">
        <div className="shell-brand">
          <img src={ebroLogo} alt="EBRO" className="shell-brand-logo" />
          <span className="shell-brand-divider" />
          <span className="shell-brand-label">Business</span>
        </div>

        <ul className="shell-navlist">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `shell-navlink ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon name={item.icon as never} />
                <span>{isAdmin && viewAsRole === null && item.etiquetaAdmin ? item.etiquetaAdmin : item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="shell-footer">
          {isAdmin && (
            <label className="shell-viewas">
              <span>Ver como</span>
              <select
                value={viewAsRole ?? ''}
                onChange={(e) => setViewAsRole(e.target.value ? (Number(e.target.value) as RolApp) : null)}
                aria-label="Ver la aplicación como otro rol"
              >
                <option value="">Administrador (yo)</option>
                <option value={RolApp.Concesionario}>Concesionario</option>
                <option value={RolApp.EquipoVentas}>Equipo de Ventas</option>
              </select>
            </label>
          )}
          <div className="shell-user" title={usuario?.fl_correo}>
            <span className="shell-avatar">{initials}</span>
            <div className="shell-user-info">
              <span className="shell-user-name">{usuario?.fl_nombre}</span>
              <span className="shell-user-role">{subtitulo}</span>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <button type="button" className="shell-scrim" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />
      )}

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
