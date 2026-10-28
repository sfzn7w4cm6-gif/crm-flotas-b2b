// Enums de columnas de opcion (Picklist) de Dataverse. Los valores numericos
// deben coincidir EXACTAMENTE con el orden de creacion en
// scripts/dataverse/01-tables.ps1 (Dataverse asigna 101000000 + indice).

// Nota: se usa el patron "const object + typeof" (no `enum`) porque el
// tsconfig de este proyecto tiene erasableSyntaxOnly activado, igual que
// PeopleFlow (ver src/lib/types.ts de ese proyecto, RolNombre).
export const RolApp = {
  Concesionario: 101000000,
  EquipoVentas: 101000001,
  Administrador: 101000002,
} as const
export type RolApp = (typeof RolApp)[keyof typeof RolApp]

export const RolAppLabel: Record<RolApp, string> = {
  [RolApp.Concesionario]: 'Concesionario',
  [RolApp.EquipoVentas]: 'Equipo de Ventas',
  [RolApp.Administrador]: 'Administrador',
}

export const ModoFinanciacion = {
  Renting: 101000000,
  Leasing: 101000001,
  CompraFinanciada: 101000002,
  CompraContado: 101000003,
  Otro: 101000004,
} as const
export type ModoFinanciacion = (typeof ModoFinanciacion)[keyof typeof ModoFinanciacion]

export const ModoFinanciacionLabel: Record<ModoFinanciacion, string> = {
  [ModoFinanciacion.Renting]: 'Renting',
  [ModoFinanciacion.Leasing]: 'Leasing',
  [ModoFinanciacion.CompraFinanciada]: 'Compra financiada',
  [ModoFinanciacion.CompraContado]: 'Compra al contado',
  [ModoFinanciacion.Otro]: 'Otro',
}

export const PlazoDecision = {
  MenosDeUnMes: 101000000,
  UnoATresMeses: 101000001,
  TresASeisMeses: 101000002,
  MasDeSeisMeses: 101000003,
} as const
export type PlazoDecision = (typeof PlazoDecision)[keyof typeof PlazoDecision]

export const PlazoDecisionLabel: Record<PlazoDecision, string> = {
  [PlazoDecision.MenosDeUnMes]: 'Menos de 1 mes',
  [PlazoDecision.UnoATresMeses]: '1-3 meses',
  [PlazoDecision.TresASeisMeses]: '3-6 meses',
  [PlazoDecision.MasDeSeisMeses]: 'Más de 6 meses',
}

// Las 8 fases activas del pipeline, en orden, mas el estado terminal "Perdido".
export const Fase = {
  Prospeccion: 101000000,
  PrimerContacto: 101000001,
  Cualificacion: 101000002,
  Propuesta: 101000003,
  Negociacion: 101000004,
  Cierre: 101000005,
  Entrega: 101000006,
  Fidelizacion: 101000007,
  Perdido: 101000008,
} as const
export type Fase = (typeof Fase)[keyof typeof Fase]

export const FaseLabel: Record<Fase, string> = {
  [Fase.Prospeccion]: '1. Prospección',
  [Fase.PrimerContacto]: '2. Primer Contacto',
  [Fase.Cualificacion]: '3. Cualificación',
  [Fase.Propuesta]: '4. Propuesta',
  [Fase.Negociacion]: '5. Negociación',
  [Fase.Cierre]: '6. Cierre',
  [Fase.Entrega]: '7. Entrega',
  [Fase.Fidelizacion]: '8. Fidelización',
  [Fase.Perdido]: 'Perdido',
}

// Las 8 fases activas, en orden — excluye "Perdido" (estado terminal, no es
// un paso mas del embudo). Usar esta lista para graficos ordinales.
export const FASES_ACTIVAS: Fase[] = [
  Fase.Prospeccion,
  Fase.PrimerContacto,
  Fase.Cualificacion,
  Fase.Propuesta,
  Fase.Negociacion,
  Fase.Cierre,
  Fase.Entrega,
  Fase.Fidelizacion,
]

// ---------------------------------------------------------------- filas Dataverse

export interface Concesionario {
  fl_concesionarioid: string
  fl_nombre: string
  fl_cif?: string
  fl_activo: boolean
}

export interface Ubicacion {
  fl_ubicacionid: string
  fl_nombre: string
  fl_ciudad?: string
  fl_direccion?: string
  fl_areamanager?: string
  fl_activo: boolean
  _fl_concesionario_value: string
  _fl_zona_value?: string
}

export interface UsuarioApp {
  fl_usuarioappid: string
  fl_nombre: string
  fl_correo: string
  fl_rol: RolApp
  fl_telefono?: string
  fl_activo: boolean
  _fl_ubicacion_value?: string
  _fl_systemuserid_value?: string
}

export interface Lead {
  fl_leadid: string
  fl_numero: string
  // seccion 1
  fl_razonsocial: string
  fl_cif: string
  // seccion 2
  fl_nombreresponsable: string
  fl_telefonocorporativo: string
  fl_emailcorporativo: string
  // seccion 3
  fl_numvehiculosactuales: number
  fl_marcasactuales: string
  fl_actividadeconomica: string
  fl_modofinanciacionactual: ModoFinanciacion
  fl_vencimientocontratosactuales: string
  // seccion 4
  fl_cuotasobjetivo: number
  fl_modelosinteres: string
  fl_numvehiculosrenovarampliar: number
  fl_plazoestimadodecision: PlazoDecision
  fl_competidoresdetectados: string
  fl_requisitos: string
  fl_kmtiempo: string
  // seccion 5
  fl_fechaprimercontacto: string
  fl_faseactual: Fase
  fl_ofertacondiciones?: string
  fl_ultimaaccionrealizada: string
  fl_proximaaccion: string
  fl_fechaproximaaccion: string
  fl_comercialresponsable: string
  fl_observaciones: string
  fl_motivoperdida?: string
  // estructurales
  _fl_ubicacion_value: string
  _fl_concesionario_value: string
  _fl_creadopor_value: string
  _ownerid_value: string
  createdon: string
}

export interface FaseHistorico {
  fl_fasehistoricoid: string
  fl_titulo: string
  fl_fase: Fase
  fl_fechainicio: string
  fl_fechafin?: string
  fl_esactual: boolean
  fl_diasenfase?: number
  _fl_lead_value: string
}

// ---------------------------------------------------------------- tareas y objetivos
// Creados en scripts/dataverse/15-tareas-objetivos.ps1.

export const TipoTarea = {
  Llamada: 101000000,
  Correo: 101000001,
  Reunion: 101000002,
  Visita: 101000003,
  Otro: 101000004,
} as const
export type TipoTarea = (typeof TipoTarea)[keyof typeof TipoTarea]

export const TipoTareaLabel: Record<TipoTarea, string> = {
  [TipoTarea.Llamada]: 'Llamada',
  [TipoTarea.Correo]: 'Correo',
  [TipoTarea.Reunion]: 'Reunión',
  [TipoTarea.Visita]: 'Visita',
  [TipoTarea.Otro]: 'Otro',
}

export const EstadoTarea = {
  Pendiente: 101000000,
  EnCurso: 101000001,
  Completada: 101000002,
  Cancelada: 101000003,
} as const
export type EstadoTarea = (typeof EstadoTarea)[keyof typeof EstadoTarea]

export const EstadoTareaLabel: Record<EstadoTarea, string> = {
  [EstadoTarea.Pendiente]: 'Pendiente',
  [EstadoTarea.EnCurso]: 'En curso',
  [EstadoTarea.Completada]: 'Completada',
  [EstadoTarea.Cancelada]: 'Cancelada',
}

export interface Tarea {
  fl_tareaid: string
  fl_titulo: string
  fl_tipo: TipoTarea
  fl_fecha: string
  fl_estado: EstadoTarea
  fl_notas?: string
  _fl_lead_value: string
}

export interface Objetivo {
  fl_objetivoid: string
  fl_nombre: string
  fl_leadsmes: number
  _fl_concesionario_value?: string
}

// ---------------------------------------------------------------- red comercial y catalogo
// Creados en scripts/dataverse/16-red-ebro-y-modelos.ps1. La zona va en la sede
// (fl_ubicacion.fl_zona), no en el concesionario: un concesionario puede tener
// sedes en zonas distintas.

export interface Zona {
  fl_zonaid: string
  fl_nombre: string
  fl_numero: number
  fl_areamanager?: string
}

export interface Modelo {
  fl_modeloid: string
  fl_nombre: string
  fl_familia: string
  fl_motorizacion: string
  fl_acabado: string
  fl_orden: number
  fl_activo: boolean
}
