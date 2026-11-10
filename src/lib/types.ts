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

export const TipoNotificacion = {
  DescuentoPendiente: 101000000,
  EmpresaDuplicada: 101000001,
  CondicionesPorRevisar: 101000002,
} as const
export type TipoNotificacion = (typeof TipoNotificacion)[keyof typeof TipoNotificacion]

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

// Las 7 fases activas del pipeline, en orden, mas el estado terminal "Perdido".
// "8. Fidelizacion" (101000007) se quito el 28/10/2026: la opcion sigue en Dataverse
// pero ya no se usa (ver scripts/dataverse/19-quitar-fase-fidelizacion.ps1).
export const Fase = {
  Prospeccion: 101000000,
  PrimerContacto: 101000001,
  Cualificacion: 101000002,
  Propuesta: 101000003,
  Negociacion: 101000004,
  Cierre: 101000005,
  Entrega: 101000006,
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
  [Fase.Perdido]: 'Perdido',
}

// Las 7 fases activas, en orden — excluye "Perdido" (estado terminal, no es
// un paso mas del embudo). Usar esta lista para graficos ordinales.
export const FASES_ACTIVAS: Fase[] = [
  Fase.Prospeccion,
  Fase.PrimerContacto,
  Fase.Cualificacion,
  Fase.Propuesta,
  Fase.Negociacion,
  Fase.Cierre,
  Fase.Entrega,
]

// ---------------------------------------------------------------- filas Dataverse

export interface Concesionario {
  fl_concesionarioid: string
  fl_nombre: string
  fl_activo: boolean
  /** Equipo propietario de sus empresas; sus miembros son los comerciales con alguna sede en él. */
  _fl_equipo_value?: string
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

// El lead es la Oportunidad: cada intento de venta a una Empresa. Los datos de
// empresa y contactos (secciones 1 y 2) viven en fl_empresa; esos campos del lead
// se rellenan con los de su empresa al leerlo (ver conDatosDeEmpresa en
// leadsService.ts) para que listas, KPIs y exportaciones sigan funcionando igual.
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
  fl_modelosinteres: string
  fl_numvehiculosrenovarampliar: number
  fl_plazoestimadodecision: PlazoDecision
  fl_competidoresdetectados: string
  fl_requisitos: string
  // seccion 5
  fl_fechaprimercontacto: string
  fl_faseactual: Fase
  fl_ofertacondiciones?: string
  // Descuento de la oferta en %: el del concesionario y el de ventas se suman (lib/descuento.ts).
  // Se ponen por modelo (fl_lineaoportunidad); estos dos son su resumen ponderado por unidades.
  fl_descuentoconcesionario?: number | null
  fl_descuentoventas?: number | null
  /** Cuándo cambió el concesionario las condiciones; y si ventas ya las ha visto desde entonces. */
  fl_fechacondiciones?: string | null
  fl_condicionesrevisadas?: boolean | null
  fl_ultimaaccionrealizada: string
  fl_proximaaccion: string
  fl_fechaproximaaccion: string
  fl_comercialresponsable: string
  fl_observaciones: string
  fl_motivoperdida?: string
  // estructurales
  _fl_empresa_value?: string
  _fl_comercial_value?: string
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
  /** Texto antiguo de "cómo fue"; las notas nuevas de la tarea van en fl_nota (fl_tarea). */
  fl_resultado?: string
  /** Enlace de la llamada o reunión (Teams, Meet...). */
  fl_enlace?: string
  createdon: string
  _fl_lead_value: string
}

/**
 * Qué lleva cada usuario: un concesionario entero (sin sede, incluidas las sedes que se abran
 * después) o una sede concreta. Creado en scripts/dataverse/24-asignaciones-y-equipos.ps1.
 */
export interface Asignacion {
  fl_asignacionid: string
  fl_nombre: string
  _fl_usuarioapp_value: string
  _fl_concesionario_value: string
  _fl_ubicacion_value?: string
}

export interface Objetivo {
  fl_objetivoid: string
  fl_nombre: string
  fl_leadsmes: number
  _fl_concesionario_value?: string
  /** Si tiene sede, el objetivo es solo de esa sede (no del concesionario entero). */
  _fl_ubicacion_value?: string
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

// ---------------------------------------------------------------- empresa y lineas
// Creados en scripts/dataverse/17-empresa-oportunidad.ps1.

// Automatico, nadie lo edita: Cliente en cuanto una oportunidad llega a Cierre.
// La opcion "Fidelizacion" (101000002) sigue en Dataverse pero no se usa.
export const EstadoEmpresa = {
  ClientePotencial: 101000000,
  Cliente: 101000001,
} as const
export type EstadoEmpresa = (typeof EstadoEmpresa)[keyof typeof EstadoEmpresa]

export const EstadoEmpresaLabel: Record<EstadoEmpresa, string> = {
  [EstadoEmpresa.ClientePotencial]: 'Cliente potencial',
  [EstadoEmpresa.Cliente]: 'Cliente',
}

/** El cliente: una por CIF dentro de cada concesionario. */
export interface Empresa {
  fl_empresaid: string
  fl_razonsocial: string
  fl_cif: string
  fl_actividadeconomica?: string
  fl_nombreresponsable?: string
  fl_telefonocorporativo?: string
  fl_emailcorporativo?: string
  fl_numvehiculosactuales?: number
  fl_marcasactuales?: string
  fl_modofinanciacionactual?: ModoFinanciacion
  fl_vencimientocontratosactuales?: string
  fl_estado?: EstadoEmpresa
  _fl_concesionario_value: string
  /** La oportunidad en curso (Prospección a Negociación); vacía si no hay ninguna. */
  _fl_oportunidadabierta_value?: string
  '_fl_oportunidadabierta_value@OData.Community.Display.V1.FormattedValue'?: string
}

/** Aviso de la campanita del equipo de ventas. No se borra sola (histórico);
 *  solo desaparece si alguien pulsa "Quitar". */
export interface Notificacion {
  fl_notificacionid: string
  fl_titulo: string
  fl_tipo: TipoNotificacion
  fl_cif?: string
  _fl_lead_value?: string
  _fl_empresa_value?: string
  createdon?: string
}

/** Modelo del catálogo y cantidad dentro de una oportunidad. */
export interface LineaOportunidad {
  fl_lineaoportunidadid: string
  fl_titulo: string
  fl_cantidad: number
  /** Descuentos de la oferta para este modelo, en %. */
  fl_descuentoconcesionario?: number | null
  fl_descuentoventas?: number | null
  _fl_lead_value: string
  _fl_modelo_value: string
}

// ---------------------------------------------------------------- notas
// Creadas en scripts/dataverse/21-notas-y-resultado-tareas.ps1.

/** Nota libre sobre una oportunidad. La fecha es createdon. */
export interface Nota {
  fl_notaid: string
  fl_texto: string
  createdon: string
  _fl_lead_value: string
  /** Si tiene tarea, es una nota de esa tarea; si no, una nota general de la oportunidad. */
  _fl_tarea_value?: string
  _fl_autor_value?: string
  '_fl_autor_value@OData.Community.Display.V1.FormattedValue'?: string
}

// ---------------------------------------------------------------- adjuntos
// Notas nativas de Dataverse (annotation) colgadas de fl_tarea o fl_nota; ver
// scripts/dataverse/22-adjuntos-enlace-notas-tarea.ps1. El contenido solo se pide al descargar.

export interface Adjunto {
  annotationid: string
  filename: string
  filesize: number
  mimetype: string
  createdon: string
  _objectid_value: string
  _ownerid_value: string
}
