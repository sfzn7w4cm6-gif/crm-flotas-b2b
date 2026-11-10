// Datos ficticios del modo demo: un concesionario inventado con oportunidades en todas las
// fases. Las fechas se calculan desde hoy para que los indicadores del Inicio tengan sentido.
import { EstadoEmpresa, EstadoTarea, Fase, ModoFinanciacion, PlazoDecision, RolApp, TipoTarea } from '../src/lib/types'

type Fila = Record<string, unknown>

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`

export const DEMO = {
  zona: id(1),
  concesionario: id(2),
  sede: id(3),
  usuario: id(4),
  areaManager: id(5),
  equipo: id(6),
  systemUser: '0000d3e0-0000-4000-8000-000000000001',
}

const MODELOS: [string, string, string, string][] = [
  ['S400 HEV PREMIUM', 'S400', 'HEV', 'Premium'],
  ['S400 HEV EXCELLENCE', 'S400', 'HEV', 'Excellence'],
  ['S400 HEV PLUS', 'S400', 'HEV', 'Plus'],
  ['S700 ICE COMFORT', 'S700', 'ICE', 'Comfort'],
  ['S700 ICE LUXURY', 'S700', 'ICE', 'Luxury'],
  ['S700 HEV COMFORT', 'S700', 'HEV', 'Comfort'],
  ['S700 HEV LUXURY', 'S700', 'HEV', 'Luxury'],
  ['S700 PHEV COMFORT', 'S700', 'PHEV', 'Comfort'],
  ['S700 PHEV LUXURY', 'S700', 'PHEV', 'Luxury'],
  ['S800 ICE PREMIUM', 'S800', 'ICE', 'Premium'],
  ['S800 ICE LUXURY', 'S800', 'ICE', 'Luxury'],
  ['S800 PHEV PREMIUM', 'S800', 'PHEV', 'Premium'],
  ['S800 PHEV LUXURY', 'S800', 'PHEV', 'Luxury'],
  ['S900 PHEV LUXURY', 'S900', 'PHEV', 'Luxury'],
]
const modeloId = (nombre: string) => id(100 + MODELOS.findIndex((m) => m[0] === nombre))

function hace(dias: number, hora = 10, minuto = 0): Date {
  const d = new Date()
  d.setHours(hora, minuto, 0, 0)
  d.setDate(d.getDate() - dias)
  return d
}
const iso = (d: Date) => d.toISOString()
const fecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dentroDe = (dias: number) => hace(-dias)

interface Spec {
  razon: string
  cif: string
  actividad: string
  responsable: string
  telefono: string
  email: string
  /** Fase y hace cuántos días empezó, en orden. */
  fases: [Fase, number][]
  lead?: Fila
  lineas?: [string, number][]
}

const BASE_CUALIFICACION = (n: number, marcas: string, fin: ModoFinanciacion, plazo: PlazoDecision, vence: number): Fila => ({
  fl_numvehiculosactuales: n,
  fl_marcasactuales: marcas,
  fl_modofinanciacionactual: fin,
  fl_vencimientocontratosactuales: fecha(dentroDe(vence)),
  fl_plazoestimadodecision: plazo,
  fl_competidoresdetectados: 'Toyota, Hyundai',
  fl_requisitos: 'Rotulación corporativa y puntos de carga en sus instalaciones.',
  fl_observaciones: 'Buena relación con el responsable de flota.',
})

const OPORTUNIDADES: Spec[] = [
  {
    razon: 'Transportes Garrido S.L.', cif: 'B46219874', actividad: 'Transporte de mercancías', responsable: 'Javier Garrido',
    telefono: '963 412 870', email: 'jgarrido@transportesgarrido.es',
    fases: [[Fase.Prospeccion, 80], [Fase.PrimerContacto, 76], [Fase.Cualificacion, 68], [Fase.Propuesta, 55], [Fase.Negociacion, 45], [Fase.Cierre, 36], [Fase.Entrega, 19]],
    lead: { ...BASE_CUALIFICACION(14, 'Renault, Peugeot', ModoFinanciacion.Renting, PlazoDecision.UnoATresMeses, 20), fl_numvehiculosrenovarampliar: 6, fl_descuentoconcesionario: 5, fl_descuentoventas: 3, fl_ofertacondiciones: 'Renting 48 meses, 30.000 km/año, mantenimiento incluido.' },
    lineas: [['S700 PHEV COMFORT', 6]],
  },
  {
    razon: 'Clínicas Dentales Sonrisa S.L.', cif: 'B98765432', actividad: 'Servicios sanitarios', responsable: 'Elena Navarro',
    telefono: '961 223 540', email: 'enavarro@clinicassonrisa.es',
    fases: [[Fase.Prospeccion, 54], [Fase.PrimerContacto, 50], [Fase.Cualificacion, 40], [Fase.Propuesta, 28], [Fase.Negociacion, 15], [Fase.Cierre, 5]],
    lead: { ...BASE_CUALIFICACION(5, 'Toyota', ModoFinanciacion.Leasing, PlazoDecision.UnoATresMeses, 45), fl_numvehiculosrenovarampliar: 3, fl_descuentoconcesionario: 4, fl_descuentoventas: 2 },
    lineas: [['S400 HEV PLUS', 3]],
  },
  {
    razon: 'Constructora Levantina S.A.', cif: 'A46332190', actividad: 'Construcción', responsable: 'Miguel Ferrer',
    telefono: '960 118 302', email: 'mferrer@constructoralevantina.com',
    fases: [[Fase.Prospeccion, 38], [Fase.PrimerContacto, 35], [Fase.Cualificacion, 27], [Fase.Propuesta, 18], [Fase.Negociacion, 9], [Fase.Cierre, 2]],
    lead: { ...BASE_CUALIFICACION(22, 'Ford, Nissan', ModoFinanciacion.Renting, PlazoDecision.MenosDeUnMes, 30), fl_numvehiculosrenovarampliar: 4, fl_descuentoconcesionario: 6, fl_descuentoventas: 2 },
    lineas: [['S800 PHEV PREMIUM', 4]],
  },
  {
    razon: 'Grupo Hostelero Albufera S.A.', cif: 'A96541237', actividad: 'Hostelería', responsable: 'Lucía Peris',
    telefono: '963 774 120', email: 'lperis@grupoalbufera.com',
    fases: [[Fase.Prospeccion, 42], [Fase.PrimerContacto, 39], [Fase.Cualificacion, 30], [Fase.Propuesta, 19], [Fase.Negociacion, 6]],
    lead: { ...BASE_CUALIFICACION(9, 'Volkswagen, Seat', ModoFinanciacion.CompraFinanciada, PlazoDecision.UnoATresMeses, 60), fl_numvehiculosrenovarampliar: 5, fl_descuentoconcesionario: 5, fl_proximaaccion: 'Reunión con gerencia para cerrar condiciones', fl_fechaproximaaccion: fecha(dentroDe(2)) },
    lineas: [['S700 HEV LUXURY', 3], ['S400 HEV EXCELLENCE', 2]],
  },
  {
    razon: 'Instalaciones Eléctricas Turia S.L.', cif: 'B97234561', actividad: 'Instalaciones eléctricas', responsable: 'Andrés Llorens',
    telefono: '962 556 781', email: 'allorens@electricasturia.es',
    fases: [[Fase.Prospeccion, 33], [Fase.PrimerContacto, 30], [Fase.Cualificacion, 21], [Fase.Propuesta, 8]],
    lead: { ...BASE_CUALIFICACION(11, 'Citroën', ModoFinanciacion.Renting, PlazoDecision.UnoATresMeses, 75), fl_numvehiculosrenovarampliar: 4, fl_descuentoconcesionario: 4, fl_ofertacondiciones: 'Renting 36 meses con rotulación incluida.', fl_proximaaccion: 'Enviar oferta revisada', fl_fechaproximaaccion: fecha(dentroDe(1)) },
    lineas: [['S700 ICE COMFORT', 4]],
  },
  {
    razon: 'Distribuciones Alimentarias Saler S.L.', cif: 'B46887123', actividad: 'Distribución alimentaria', responsable: 'Rosa Martí',
    telefono: '961 908 334', email: 'rmarti@distribucionessaler.es',
    fases: [[Fase.Prospeccion, 30], [Fase.PrimerContacto, 27], [Fase.Cualificacion, 17], [Fase.Propuesta, 4]],
    lead: { ...BASE_CUALIFICACION(16, 'Iveco, Renault', ModoFinanciacion.Leasing, PlazoDecision.TresASeisMeses, 120), fl_numvehiculosrenovarampliar: 6, fl_descuentoconcesionario: 3 },
    lineas: [['S700 ICE LUXURY', 6]],
  },
  {
    razon: 'Logística Puerto Valencia S.L.', cif: 'B98112345', actividad: 'Logística', responsable: 'David Sanchis',
    telefono: '963 205 619', email: 'dsanchis@logisticapuerto.es',
    fases: [[Fase.Prospeccion, 26], [Fase.PrimerContacto, 22], [Fase.Cualificacion, 10]],
    lead: { ...BASE_CUALIFICACION(30, 'Mercedes-Benz, Renault', ModoFinanciacion.Renting, PlazoDecision.TresASeisMeses, 150), fl_competidoresdetectados: null, fl_requisitos: null, fl_numvehiculosrenovarampliar: 8, fl_proximaaccion: 'Prueba de vehículo con el jefe de flota', fl_fechaproximaaccion: fecha(dentroDe(4)) },
    lineas: [['S800 ICE PREMIUM', 5], ['S700 PHEV LUXURY', 3]],
  },
  {
    razon: 'Agroexport Huerta S.Coop.', cif: 'F46551230', actividad: 'Agricultura y exportación', responsable: 'Pilar Esteve',
    telefono: '962 441 905', email: 'pesteve@agroexporthuerta.es',
    fases: [[Fase.Prospeccion, 12], [Fase.PrimerContacto, 6]],
    lead: { fl_proximaaccion: 'Visita a las instalaciones', fl_fechaproximaaccion: fecha(dentroDe(3)) },
  },
  {
    razon: 'Seguridad Integral Mediterránea S.L.', cif: 'B97665432', actividad: 'Seguridad privada', responsable: 'Raúl Cervera',
    telefono: '960 334 812', email: 'rcervera@seguridadmediterranea.es',
    fases: [[Fase.Prospeccion, 7], [Fase.PrimerContacto, 4]],
    lead: { fl_proximaaccion: 'Llamada para conocer necesidades', fl_fechaproximaaccion: fecha(dentroDe(0)) },
  },
  {
    razon: 'Viveros El Palmar S.L.', cif: 'B46990871', actividad: 'Viveros y jardinería', responsable: 'Teresa Climent',
    telefono: '961 620 447', email: 'tcliment@viveroselpalmar.es',
    fases: [[Fase.Prospeccion, 6], [Fase.PrimerContacto, 3]],
  },
  {
    razon: 'Inmobiliaria Malvarrosa S.L.', cif: 'B98443216', actividad: 'Inmobiliaria', responsable: 'Sergio Bosch',
    telefono: '963 557 210', email: 'sbosch@inmomalvarrosa.es',
    fases: [[Fase.Prospeccion, 5], [Fase.PrimerContacto, 2]],
  },
  {
    razon: 'Farmacias Ruzafa C.B.', cif: 'E46778120', actividad: 'Farmacia', responsable: 'Carmen Ruiz',
    telefono: '963 118 904', email: 'cruiz@farmaciasruzafa.es',
    fases: [[Fase.Prospeccion, 4]],
  },
  {
    razon: 'Asesoría Fiscal Marqués S.L.P.', cif: 'B97001239', actividad: 'Asesoría', responsable: 'Pablo Marqués',
    telefono: '960 771 336', email: 'pmarques@asesoriamarques.es',
    fases: [[Fase.Prospeccion, 2]],
  },
  {
    razon: 'Talleres Benimaclet S.L.', cif: 'B46123987', actividad: 'Reparación de vehículos', responsable: 'Joaquín Soler',
    telefono: '963 662 018', email: 'jsoler@talleresbenimaclet.es',
    fases: [[Fase.Prospeccion, 64], [Fase.PrimerContacto, 60], [Fase.Cualificacion, 50], [Fase.Perdido, 37]],
    lead: { ...BASE_CUALIFICACION(6, 'Dacia', ModoFinanciacion.CompraContado, PlazoDecision.MasDeSeisMeses, 200), fl_numvehiculosrenovarampliar: 2, fl_motivoperdida: 'Ha renovado con su proveedor actual por precio.' },
    lineas: [['S400 HEV PREMIUM', 2]],
  },
]

// Un año de oportunidades ya cerradas o perdidas, para que las comparaciones con meses
// anteriores del Inicio den cifras realistas.
const HISTORICAS: [string, string, string][] = [
  ['Frutas Albalat S.L.', 'B46301122', 'Distribución alimentaria'], ['Mudanzas Campanar S.L.', 'B97112093', 'Mudanzas'],
  ['Cerámicas Manises S.A.', 'A46210987', 'Industria cerámica'], ['Gestoría Benicalap S.L.', 'B98002314', 'Asesoría'],
  ['Limpiezas Patraix S.L.', 'B46557810', 'Limpieza industrial'], ['Muebles Alfafar S.L.', 'B97340561', 'Mobiliario'],
  ['Clínica Veterinaria Ayora S.L.', 'B98761203', 'Veterinaria'], ['Electrodomésticos Mislata S.L.', 'B46098341', 'Comercio'],
  ['Catering Russafa S.L.', 'B97890125', 'Hostelería'], ['Ópticas Torrent S.L.', 'B46672019', 'Óptica'],
  ['Fontanería Paterna S.L.', 'B98320457', 'Fontanería'], ['Imprenta Burjassot S.L.', 'B46775310', 'Artes gráficas'],
  ['Autoescuela Quart S.L.', 'B97230984', 'Formación vial'], ['Panaderías Xirivella S.L.', 'B46119027', 'Alimentación'],
  ['Ingeniería Sedaví S.L.', 'B98554106', 'Ingeniería'], ['Seguros Catarroja S.L.', 'B46883201', 'Seguros'],
  ['Climatización Aldaia S.L.', 'B97665210', 'Climatización'], ['Papelería Alboraia S.L.', 'B46220193', 'Comercio'],
  ['Laboratorios Picassent S.A.', 'A98110236', 'Laboratorio'], ['Reformas Moncada S.L.', 'B46997102', 'Construcción'],
  ['Hoteles Cullera S.A.', 'A46330218', 'Hostelería'], ['Textil Ontinyent S.L.', 'B97001845', 'Textil'],
  ['Jardines Godella S.L.', 'B46540127', 'Jardinería'], ['Consultora Silla S.L.', 'B98227410', 'Consultoría'],
]
const MODELOS_HISTORICOS = ['S700 HEV COMFORT', 'S400 HEV PREMIUM', 'S800 ICE PREMIUM', 'S700 PHEV LUXURY', 'S400 HEV EXCELLENCE', 'S700 ICE COMFORT']

HISTORICAS.forEach(([razon, cif, actividad], k) => {
  const inicio = 360 - k * 13
  const perdida = k % 3 === 2
  const camino: [Fase, number][] = [[Fase.Prospeccion, inicio], [Fase.PrimerContacto, inicio - 4], [Fase.Cualificacion, inicio - 11], [Fase.Propuesta, inicio - 20]]
  if (perdida) camino.push([Fase.Perdido, inicio - 28])
  else camino.push([Fase.Negociacion, inicio - 27], [Fase.Cierre, inicio - 34], [Fase.Entrega, inicio - 48])
  const responsable = ['Ana Gil', 'Jorge Vidal', 'Marta Roig', 'Iván Sanz', 'Nuria Pons', 'Óscar Mira'][k % 6]
  const vehiculos = 2 + (k % 5)
  OPORTUNIDADES.push({
    razon, cif, actividad, responsable,
    telefono: `96${(k % 3) + 1} ${String(200 + k * 7).padStart(3, '0')} ${String(100 + k * 11).slice(-3)}`,
    email: `${responsable.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}@${razon.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}.es`,
    fases: camino,
    lead: {
      ...BASE_CUALIFICACION(vehiculos * 3, 'Renault, Peugeot', ModoFinanciacion.Renting, PlazoDecision.UnoATresMeses, -inicio + 120),
      fl_numvehiculosrenovarampliar: vehiculos, fl_descuentoconcesionario: 4,
      ...(perdida ? { fl_motivoperdida: 'El cliente ha decidido aplazar la renovación de su flota.' } : { fl_descuentoventas: 2 }),
    },
    lineas: [[MODELOS_HISTORICOS[k % MODELOS_HISTORICOS.length], vehiculos]],
  })
})

const ULTIMA_ACCION: Partial<Record<Fase, string>> = {
  [Fase.Prospeccion]: 'Alta de la oportunidad',
  [Fase.PrimerContacto]: 'Primera llamada con el responsable de flota',
  [Fase.Cualificacion]: 'Reunión para conocer la flota actual',
  [Fase.Propuesta]: 'Envío de propuesta económica',
  [Fase.Negociacion]: 'Revisión de condiciones con el cliente',
  [Fase.Cierre]: 'Firma del contrato',
  [Fase.Entrega]: 'Entrega de los vehículos',
  [Fase.Perdido]: 'El cliente comunica que no sigue adelante',
}
const TITULO_FASE: Record<Fase, string> = {
  [Fase.Prospeccion]: 'Prospección', [Fase.PrimerContacto]: 'Primer Contacto', [Fase.Cualificacion]: 'Cualificación',
  [Fase.Propuesta]: 'Propuesta', [Fase.Negociacion]: 'Negociación', [Fase.Cierre]: 'Cierre', [Fase.Entrega]: 'Entrega', [Fase.Perdido]: 'Perdido',
}

export function crearSemilla(): Record<string, Fila[]> {
  const t: Record<string, Fila[]> = {
    fl_zonas: [{ fl_zonaid: DEMO.zona, fl_nombre: 'Zona 4', fl_numero: 4, fl_areamanager: 'Laura Gómez' }],
    fl_concesionarios: [{ fl_concesionarioid: DEMO.concesionario, fl_nombre: 'Automóviles Mediterráneo', fl_activo: true, _fl_equipo_value: DEMO.equipo }],
    fl_ubicacions: [{
      fl_ubicacionid: DEMO.sede, fl_nombre: 'Automóviles Mediterráneo Valencia', fl_ciudad: 'Valencia', fl_direccion: 'Av. del Puerto, 120',
      fl_areamanager: 'Laura Gómez', fl_activo: true, _fl_concesionario_value: DEMO.concesionario, _fl_zona_value: DEMO.zona,
    }],
    fl_usuarioapps: [
      { fl_usuarioappid: DEMO.usuario, fl_nombre: 'Carlos Martín', fl_correo: 'carlos.martin@automovilesmediterraneo.es', fl_rol: RolApp.Concesionario, fl_activo: true, _fl_ubicacion_value: DEMO.sede, _fl_systemuserid_value: DEMO.systemUser },
      { fl_usuarioappid: DEMO.areaManager, fl_nombre: 'Laura Gómez', fl_correo: 'laura.gomez@ebro.example', fl_rol: RolApp.EquipoVentas, fl_activo: true },
    ],
    fl_asignacions: [{ fl_asignacionid: id(7), fl_nombre: 'Carlos Martín · Automóviles Mediterráneo', _fl_usuarioapp_value: DEMO.usuario, _fl_concesionario_value: DEMO.concesionario }],
    fl_objetivos: [
      { fl_objetivoid: id(8), fl_nombre: 'Objetivo general', fl_leadsmes: 6 },
      { fl_objetivoid: id(9), fl_nombre: 'Automóviles Mediterráneo - Valencia', fl_leadsmes: 8, _fl_concesionario_value: DEMO.concesionario, _fl_ubicacion_value: DEMO.sede },
    ],
    fl_modelos: MODELOS.map(([nombre, familia, motor, acabado], i) => ({
      fl_modeloid: modeloId(nombre), fl_nombre: nombre, fl_familia: familia, fl_motorizacion: motor, fl_acabado: acabado, fl_orden: (i + 1) * 10, fl_activo: true,
    })),
    fl_empresas: [], fl_leads: [], fl_fasehistoricos: [], fl_lineaoportunidads: [], fl_tareas: [], fl_notas: [], annotations: [], fl_notificacions: [],
  }

  let n = 1000
  const leadIds: string[] = []
  const ordenAlta = OPORTUNIDADES.map((_, i) => i).sort((a, b) => OPORTUNIDADES[b].fases[0][1] - OPORTUNIDADES[a].fases[0][1])
  OPORTUNIDADES.forEach((s, i) => {
    const empresaId = id(n++)
    const leadId = id(n++)
    leadIds.push(leadId)
    const numero = `L${String(1001 + ordenAlta.indexOf(i)).padStart(5, '0')}`
    const alta = hace(s.fases[0][1], 9, 30)
    const actual = s.fases[s.fases.length - 1][0]
    const abierta = actual !== Fase.Perdido && actual <= Fase.Negociacion
    const cliente = actual === Fase.Cierre || actual === Fase.Entrega
    const lead = s.lead ?? {}

    t.fl_empresas.push({
      fl_empresaid: empresaId, fl_razonsocial: s.razon, fl_cif: s.cif, fl_actividadeconomica: s.actividad,
      fl_nombreresponsable: s.responsable, fl_telefonocorporativo: s.telefono, fl_emailcorporativo: s.email,
      fl_numvehiculosactuales: lead.fl_numvehiculosactuales, fl_marcasactuales: lead.fl_marcasactuales,
      fl_modofinanciacionactual: lead.fl_modofinanciacionactual, fl_vencimientocontratosactuales: lead.fl_vencimientocontratosactuales,
      fl_estado: cliente ? EstadoEmpresa.Cliente : EstadoEmpresa.ClientePotencial,
      _fl_concesionario_value: DEMO.concesionario, _fl_oportunidadabierta_value: abierta ? leadId : null,
      createdon: iso(alta), _ownerid_value: DEMO.systemUser,
    })

    const lineas = s.lineas ?? []
    t.fl_leads.push({
      fl_leadid: leadId, fl_numero: numero, fl_razonsocial: s.razon, fl_cif: s.cif,
      fl_nombreresponsable: s.responsable, fl_telefonocorporativo: s.telefono, fl_emailcorporativo: s.email,
      fl_actividadeconomica: s.actividad, fl_fechaprimercontacto: fecha(alta), fl_faseactual: actual,
      fl_ultimaaccionrealizada: ULTIMA_ACCION[actual], fl_comercialresponsable: 'Carlos Martín',
      fl_modelosinteres: lineas.map(([m]) => m).join(', ') || null,
      ...lead,
      _fl_empresa_value: empresaId, _fl_comercial_value: DEMO.usuario, _fl_ubicacion_value: DEMO.sede,
      _fl_concesionario_value: DEMO.concesionario, _fl_creadopor_value: DEMO.usuario, _ownerid_value: DEMO.systemUser,
      createdon: iso(alta),
    })

    s.fases.forEach(([fase, dias], j) => {
      const inicio = hace(dias, 10 + (j % 6), 15)
      const siguiente = s.fases[j + 1]
      const fin = siguiente ? hace(siguiente[1], 10 + ((j + 1) % 6), 15) : null
      t.fl_fasehistoricos.push({
        fl_fasehistoricoid: id(n++), fl_titulo: `${numero} — ${TITULO_FASE[fase]}`, fl_fase: fase,
        fl_fechainicio: iso(inicio), fl_fechafin: fin ? iso(fin) : null, fl_esactual: !siguiente,
        fl_diasenfase: fin ? Math.round((fin.getTime() - inicio.getTime()) / 86400000) : null,
        _fl_lead_value: leadId, createdon: iso(inicio),
      })
    })

    for (const [modelo, cantidad] of lineas) {
      t.fl_lineaoportunidads.push({
        fl_lineaoportunidadid: id(n++), fl_titulo: modelo, fl_cantidad: cantidad,
        _fl_lead_value: leadId, _fl_modelo_value: modeloId(modelo), createdon: iso(alta),
      })
    }
  })

  const lead = (razon: string) => leadIds[OPORTUNIDADES.findIndex((s) => s.razon === razon)]
  const tarea = (titulo: string, tipo: number, cuando: Date, razon: string, estado: number = EstadoTarea.Pendiente, notas?: string) =>
    t.fl_tareas.push({ fl_tareaid: id(n++), fl_titulo: titulo, fl_tipo: tipo, fl_fecha: iso(cuando), fl_estado: estado, fl_notas: notas, _fl_lead_value: lead(razon), createdon: iso(hace(3)) })

  const enUnasHoras = new Date()
  if (enUnasHoras.getHours() < 15) enUnasHoras.setHours(17, 30, 0, 0)
  else (enUnasHoras.setDate(enUnasHoras.getDate() + 1), enUnasHoras.setHours(9, 30, 0, 0))
  tarea('Llamar a Raúl Cervera para conocer necesidades', TipoTarea.Llamada, enUnasHoras, 'Seguridad Integral Mediterránea S.L.')
  tarea('Enviar oferta revisada con rotulación', TipoTarea.Correo, hace(1, 9, 0), 'Instalaciones Eléctricas Turia S.L.')
  tarea('Reunión con gerencia para cerrar condiciones', TipoTarea.Reunion, dentroDe(2), 'Grupo Hostelero Albufera S.A.')
  tarea('Visita a las instalaciones', TipoTarea.Visita, dentroDe(3), 'Agroexport Huerta S.Coop.')
  tarea('Prueba de vehículo con el jefe de flota', TipoTarea.Visita, dentroDe(4), 'Logística Puerto Valencia S.L.')
  tarea('Preparar documentación de entrega', TipoTarea.Otro, dentroDe(6), 'Clínicas Dentales Sonrisa S.L.')

  const nota = (razon: string, texto: string, dias: number, autor = DEMO.usuario) => {
    const notaId = id(n++)
    t.fl_notas.push({ fl_notaid: notaId, fl_texto: texto, _fl_lead_value: lead(razon), _fl_autor_value: autor, createdon: iso(hace(dias, 12, 40)) })
    return notaId
  }
  nota('Grupo Hostelero Albufera S.A.', 'Interesados en electrificar la flota de los tres restaurantes. Piden plazo de entrega antes de primavera.', 18)
  nota('Grupo Hostelero Albufera S.A.', 'Estamos revisando el porcentaje de marca para esta operación. Os lo confirmo esta semana.', 7, DEMO.areaManager)
  const notaOferta = nota('Instalaciones Eléctricas Turia S.L.', 'Adjunto la propuesta enviada al cliente.', 8)
  t.annotations.push({
    annotationid: id(n++), subject: 'Propuesta Instalaciones Turia.pdf', filename: 'Propuesta Instalaciones Turia.pdf', mimetype: 'application/pdf',
    documentbody: PDF_DEMO, isdocument: true, filesize: 48213, _objectid_value: notaOferta, _ownerid_value: DEMO.systemUser, createdon: iso(hace(8, 12, 41)),
  })

  return t
}

// PDF mínimo de una página, solo para que el adjunto de demo se pueda descargar.
const PDF_DEMO =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXT4+CmVuZG9iagp0cmFpbGVyCjw8L1Jvb3QgMSAwIFI+PgolJUVPRgo='
