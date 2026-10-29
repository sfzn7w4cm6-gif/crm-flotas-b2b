// Campos que se pueden mostrar en las tarjetas del pipeline. Cada comercial elige los suyos
// (se guardan en su navegador). La empresa sale siempre, es el título de la tarjeta.

export const CAMPOS_TARJETA = {
  numero: 'Nº de oportunidad',
  contacto: 'Responsable',
  modelos: 'Modelos de interés',
  vehiculos: 'Vehículos de interés',
  proximaAccion: 'Próxima acción',
  tiempoEnFase: 'Tiempo en la fase actual',
  plazo: 'Plazo de decisión',
  sector: 'Actividad económica',
  comercial: 'Comercial',
  concesionario: 'Concesionario',
  fechaAlta: 'Fecha de primer contacto',
} as const
export type CampoTarjeta = keyof typeof CAMPOS_TARJETA

// Lo mínimo para decidir qué hacer con la oportunidad sin abrirla: quién es, qué quiere,
// cuánto volumen, qué toca hacer y si lleva demasiado tiempo parada.
export const CAMPOS_TARJETA_POR_DEFECTO: CampoTarjeta[] = ['numero', 'modelos', 'vehiculos', 'proximaAccion', 'tiempoEnFase']

const CLAVE = 'crmflotas.pipeline.campos'

export function leerCamposTarjeta(): CampoTarjeta[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as string[] | null
    if (Array.isArray(v)) return v.filter((c): c is CampoTarjeta => c in CAMPOS_TARJETA)
  } catch {
    /* sin almacenamiento o valor roto: los de por defecto */
  }
  return CAMPOS_TARJETA_POR_DEFECTO
}

export function guardarCamposTarjeta(campos: CampoTarjeta[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(campos))
  } catch {
    /* sin almacenamiento: solo dura esta sesion */
  }
}
