// Formato de fechas y texto comun a todas las pantallas.

/**
 * Las columnas de solo fecha llegan de Dataverse como "2026-10-28T00:00:00Z": se toma el dia
 * tal cual (sin pasar por la zona horaria, que lo movería al día anterior).
 */
export function parseFecha(valor: string | null | undefined): Date | null {
  if (!valor) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "28 oct 2026" */
export function fechaCorta(valor: string | null | undefined): string {
  const d = parseFecha(valor)
  return d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : ''
}

/** "28 de octubre de 2026" */
export function fechaLarga(valor: string | null | undefined): string {
  const d = parseFecha(valor)
  return d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

/** Minúsculas y sin tildes, para que "entrega" encuentre "Entrega" y "prospeccion" encuentre "Prospección". */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

const RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** "hace 5 minutos", "ayer"... y la fecha completa a partir de una semana. */
export function haceCuanto(iso: string): string {
  const d = new Date(iso)
  const min = Math.round((d.getTime() - Date.now()) / 60000)
  if (Math.abs(min) < 1) return 'ahora'
  if (Math.abs(min) < 60) return RELATIVO.format(min, 'minute')
  if (Math.abs(min) < 60 * 24) return RELATIVO.format(Math.round(min / 60), 'hour')
  if (Math.abs(min) < 60 * 24 * 7) return RELATIVO.format(Math.round(min / 1440), 'day')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
