import { RolApp } from '../../lib/types'

export interface NavItem {
  to: string
  label: string
  icon: string
  roles?: RolApp[] // si se omite, visible para todos los roles
  /** Nombre para el administrador, que ve todas las pantallas a la vez (hay dos "Inicio"). */
  etiquetaAdmin?: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/mi-actividad', label: 'Inicio', icon: 'home', roles: [RolApp.Concesionario] },
  // Inicio del equipo de ventas: las cifras de toda la red y el análisis del pipeline.
  { to: '/panel-kpi', label: 'Inicio', etiquetaAdmin: 'Inicio de la red', icon: 'dashboard', roles: [RolApp.EquipoVentas] },
  { to: '/mis-leads', label: 'Mis Leads', icon: 'list', roles: [RolApp.Concesionario] },
  { to: '/nuevo-lead', label: 'Nuevo Lead', icon: 'add', roles: [RolApp.Concesionario] },
  { to: '/empresas', label: 'Empresas', icon: 'building', roles: [RolApp.Concesionario, RolApp.EquipoVentas] },
  { to: '/seguimiento', label: 'Seguimiento de Leads', icon: 'list', roles: [RolApp.EquipoVentas] },
  { to: '/info', label: 'Info', icon: 'building', roles: [RolApp.EquipoVentas] },
  { to: '/configuracion', label: 'Configuración', icon: 'settings', roles: [RolApp.EquipoVentas] },
]
