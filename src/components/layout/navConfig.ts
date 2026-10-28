import { RolApp } from '../../lib/types'

export interface NavItem {
  to: string
  label: string
  icon: string
  roles?: RolApp[] // si se omite, visible para todos los roles
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/mi-actividad', label: 'Inicio', icon: 'home', roles: [RolApp.Concesionario] },
  { to: '/mis-leads', label: 'Mis Leads', icon: 'list', roles: [RolApp.Concesionario] },
  { to: '/nuevo-lead', label: 'Nuevo Lead', icon: 'add', roles: [RolApp.Concesionario] },
  { to: '/seguimiento', label: 'Seguimiento de Leads', icon: 'list', roles: [RolApp.EquipoVentas] },
  { to: '/panel-kpi', label: 'Panel KPI', icon: 'dashboard', roles: [RolApp.EquipoVentas] },
  { to: '/info', label: 'Info', icon: 'building', roles: [RolApp.EquipoVentas] },
]
