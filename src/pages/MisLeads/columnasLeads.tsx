import type { ReactNode } from 'react'
import { EnlaceEmpresa } from '../../components/EnlaceEmpresa'
import { DescuentoPendienteBadge, FaseBadge } from '../../components/StatusBadge'
import { descuentoPendiente, descuentoTotal, formatoPorcentaje } from '../../lib/descuento'
import { formatoEuros } from '../../lib/actividadService'
import { fechaCorta } from '../../lib/formato'
import { FaseLabel, ModoFinanciacionLabel, PlazoDecisionLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'

// Columnas de las tablas de Mis leads y Seguimiento. Cada una es un campo de la ficha de la
// oportunidad, con el mismo nombre y en el mismo orden que allí (y que en el formulario original).

export interface CtxColumnas {
  nombreConcesionario: Map<string, string>
  nombreUbicacion: Map<string, string>
}

export type ColKey =
  | 'numero'
  | 'empresa'
  | 'cif'
  | 'responsable'
  | 'telefono'
  | 'email'
  | 'comercial'
  | 'concesionario'
  | 'fase'
  | 'vehiculosActuales'
  | 'marcas'
  | 'actividad'
  | 'financiacion'
  | 'vencimiento'
  | 'modelos'
  | 'vehiculos'
  | 'cuotas'
  | 'plazo'
  | 'competidores'
  | 'kmTiempo'
  | 'requisitos'
  | 'fechaPrimerContacto'
  | 'ultimaAccion'
  | 'proximaAccion'
  | 'fechaProximaAccion'
  | 'observaciones'
  | 'descuento'
  | 'oferta'

export interface ColumnDef {
  key: ColKey
  label: string
  sortable: boolean
  render: (l: Lead, ctx: CtxColumnas) => ReactNode
  /** Clave de orden. */
  valor: (l: Lead, ctx: CtxColumnas) => string | number
  /** Texto para exportar a Excel: a diferencia de 'valor' (clave de orden,
   *  a veces en minusculas), conserva mayusculas/formato de visualizacion. */
  exportar: (l: Lead, ctx: CtxColumnas) => string | number
}

/** Columna de texto sencilla: se ve, se ordena y se exporta igual. */
function texto(key: ColKey, label: string, campo: (l: Lead) => string | undefined, sortable = false): ColumnDef {
  return {
    key,
    label,
    sortable,
    render: (l) => campo(l) ?? '',
    valor: (l) => (campo(l) ?? '').toLowerCase(),
    exportar: (l) => campo(l) ?? '',
  }
}
function numero(key: ColKey, label: string, campo: (l: Lead) => number | undefined, formato?: (n: number) => string): ColumnDef {
  return {
    key,
    label,
    sortable: true,
    render: (l) => (campo(l) == null ? '' : formato ? formato(campo(l)!) : campo(l)),
    valor: (l) => campo(l) ?? -1,
    exportar: (l) => campo(l) ?? '',
  }
}
function fecha(key: ColKey, label: string, campo: (l: Lead) => string | undefined): ColumnDef {
  return {
    key,
    label,
    sortable: true,
    render: (l) => fechaCorta(campo(l)),
    valor: (l) => campo(l) ?? '',
    exportar: (l) => fechaCorta(campo(l)),
  }
}
const sede = (l: Lead, ctx: CtxColumnas) =>
  [ctx.nombreConcesionario.get(l._fl_concesionario_value), ctx.nombreUbicacion.get(l._fl_ubicacion_value)].filter(Boolean).join(' · ')

export const COLUMNAS: ColumnDef[] = [
  texto('numero', 'Nº', (l) => l.fl_numero, true),
  // Empresa y contacto
  {
    key: 'empresa',
    label: 'Empresa',
    sortable: true,
    render: (l) => <EnlaceEmpresa lead={l} />,
    valor: (l) => l.fl_razonsocial.toLowerCase(),
    exportar: (l) => l.fl_razonsocial,
  },
  texto('cif', 'CIF / NIF', (l) => l.fl_cif),
  texto('responsable', 'Responsable', (l) => l.fl_nombreresponsable, true),
  texto('telefono', 'Teléfono', (l) => l.fl_telefonocorporativo),
  texto('email', 'E-mail', (l) => l.fl_emailcorporativo),
  texto('comercial', 'Comercial', (l) => l.fl_comercialresponsable, true),
  { key: 'concesionario', label: 'Concesionario', sortable: true, render: sede, valor: (l, ctx) => sede(l, ctx).toLowerCase(), exportar: sede },
  {
    key: 'fase',
    label: 'Fase actual',
    sortable: true,
    render: (l) => <FaseBadge fase={l.fl_faseactual} size="sm" />,
    valor: (l) => l.fl_faseactual,
    exportar: (l) => FaseLabel[l.fl_faseactual],
  },
  // Situación de la flota
  numero('vehiculosActuales', 'Vehículos actuales', (l) => l.fl_numvehiculosactuales),
  texto('marcas', 'Marcas actuales', (l) => l.fl_marcasactuales),
  texto('actividad', 'Actividad económica', (l) => l.fl_actividadeconomica, true),
  texto('financiacion', 'Financiación actual', (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual], true),
  fecha('vencimiento', 'Vencimiento contratos', (l) => l.fl_vencimientocontratosactuales),
  // Necesidad y oportunidad
  texto('modelos', 'Modelos de interés', (l) => l.fl_modelosinteres),
  numero('vehiculos', 'Vehículos de interés', (l) => l.fl_numvehiculosrenovarampliar),
  numero('cuotas', 'Cuotas objetivo', (l) => l.fl_cuotasobjetivo, formatoEuros),
  texto('plazo', 'Plazo de decisión', (l) => PlazoDecisionLabel[l.fl_plazoestimadodecision]),
  texto('competidores', 'Competidores', (l) => l.fl_competidoresdetectados),
  texto('kmTiempo', 'Km / tiempo', (l) => l.fl_kmtiempo),
  texto('requisitos', 'Requisitos', (l) => l.fl_requisitos),
  // Seguimiento
  fecha('fechaPrimerContacto', 'Fecha de primer contacto', (l) => l.fl_fechaprimercontacto),
  texto('ultimaAccion', 'Última acción realizada', (l) => l.fl_ultimaaccionrealizada),
  texto('proximaAccion', 'Próxima acción', (l) => l.fl_proximaaccion),
  fecha('fechaProximaAccion', 'Fecha próxima acción', (l) => l.fl_fechaproximaaccion),
  texto('observaciones', 'Observaciones', (l) => l.fl_observaciones),
  // Oferta
  {
    key: 'descuento',
    label: 'Descuento',
    sortable: true,
    render: (l) => (
      <span className="celda-descuento">
        {formatoPorcentaje(descuentoTotal(l))}
        {descuentoPendiente(l) && <DescuentoPendienteBadge corto />}
      </span>
    ),
    valor: (l) => descuentoTotal(l) ?? -1,
    exportar: (l) => `${formatoPorcentaje(descuentoTotal(l))}${descuentoPendiente(l) ? ' (pendiente de marca)' : ''}`,
  },
  texto('oferta', 'Condiciones de la oferta', (l) => l.fl_ofertacondiciones),
]
