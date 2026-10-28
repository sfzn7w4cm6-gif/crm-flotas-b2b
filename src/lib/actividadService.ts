import { listRecords, Tables } from './dataverseClient'
import { Fase } from './types'
import type { FaseHistorico, Lead } from './types'

// Calculos de la pantalla de inicio del concesionario (Mi actividad).

const FASES_DESDE_CONTACTO: Fase[] = [
  Fase.PrimerContacto,
  Fase.Cualificacion,
  Fase.Propuesta,
  Fase.Negociacion,
  Fase.Cierre,
  Fase.Entrega,
  Fase.Fidelizacion,
]
const FASES_DESDE_CIERRE: Fase[] = [Fase.Cierre, Fase.Entrega, Fase.Fidelizacion]

export async function fetchMiHistorico(): Promise<FaseHistorico[]> {
  return listRecords<FaseHistorico>(Tables.FaseHistorico, {
    select: 'fl_fasehistoricoid,fl_fase,fl_fechainicio,_fl_lead_value',
  })
}

export interface HitosLead {
  /** Primera vez que paso de Prospeccion a Primer Contacto o mas alla. */
  activado: Date | null
  /** Primera vez que llego a Cierre (o Entrega/Fidelizacion). */
  cerrado: Date | null
}

export function calcularHitos(leads: Lead[], historico: FaseHistorico[]): Map<string, HitosLead> {
  const primera = (filas: FaseHistorico[], fases: Fase[]) => {
    const fechas = filas.filter((h) => fases.includes(h.fl_fase)).map((h) => new Date(h.fl_fechainicio).getTime())
    return fechas.length ? new Date(Math.min(...fechas)) : null
  }
  const porLead = new Map<string, FaseHistorico[]>()
  for (const h of historico) {
    const lista = porLead.get(h._fl_lead_value) ?? []
    lista.push(h)
    porLead.set(h._fl_lead_value, lista)
  }
  const res = new Map<string, HitosLead>()
  for (const l of leads) {
    const filas = porLead.get(l.fl_leadid) ?? []
    let activado = primera(filas, FASES_DESDE_CONTACTO)
    let cerrado = primera(filas, FASES_DESDE_CIERRE)
    // Lead sin historico (datos antiguos): se usa la fecha de primer contacto.
    if (filas.length === 0 && l.fl_fechaprimercontacto) {
      const f = new Date(l.fl_fechaprimercontacto)
      if (FASES_DESDE_CONTACTO.includes(l.fl_faseactual)) activado = f
      if (FASES_DESDE_CIERRE.includes(l.fl_faseactual)) cerrado = f
    }
    res.set(l.fl_leadid, { activado, cerrado })
  }
  return res
}

export type Periodo = { tipo: 'mes'; anio: number; mes: number } | { tipo: 'anio'; anio: number }

export function periodoActual(hoy = new Date()): Periodo {
  return { tipo: 'mes', anio: hoy.getFullYear(), mes: hoy.getMonth() }
}

export function mismoPeriodo(a: Periodo, b: Periodo): boolean {
  if (a.tipo === 'anio' || b.tipo === 'anio') return a.tipo === b.tipo && a.anio === b.anio
  return a.anio === b.anio && a.mes === b.mes
}

export function nombrePeriodo(p: Periodo): string {
  if (p.tipo === 'anio') return String(p.anio)
  return new Date(p.anio, p.mes, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

/** Inicio y fin (exclusivo) del periodo. El año en curso termina hoy. */
export function rangoPeriodo(p: Periodo, hoy = new Date()): { desde: Date; hasta: Date; meses: number } {
  if (p.tipo === 'mes') return { desde: new Date(p.anio, p.mes, 1), hasta: new Date(p.anio, p.mes + 1, 1), meses: 1 }
  const enCurso = p.anio === hoy.getFullYear()
  return {
    desde: new Date(p.anio, 0, 1),
    hasta: enCurso ? new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1) : new Date(p.anio + 1, 0, 1),
    meses: enCurso ? hoy.getMonth() + 1 : 12,
  }
}

export interface ResumenPeriodo {
  valor: number
  /** Valor con el que se compara la cifra principal (flecha arriba/abajo). */
  comparado: number
  comparadoEtiqueta: string
  pie: { etiqueta: string; valor: number }[]
}

/** Suma `valor` de los eventos del periodo y prepara las cifras de contexto:
 *  - mes: comparado con la media de los 12 meses anteriores; total del año hasta ese mes.
 *  - año: comparado con el mismo tramo del año anterior; media mensual y total del año anterior. */
export function resumenPeriodo(eventos: { fecha: Date; valor: number }[], p: Periodo, hoy = new Date()): ResumenPeriodo {
  const suma = (desde: Date, hasta: Date) =>
    eventos.reduce((acc, e) => (e.fecha >= desde && e.fecha < hasta ? acc + e.valor : acc), 0)
  const { desde, hasta, meses } = rangoPeriodo(p, hoy)
  const valor = suma(desde, hasta)
  if (p.tipo === 'mes') {
    const media12 = suma(new Date(p.anio, p.mes - 12, 1), desde) / 12
    const nombreMes = desde.toLocaleDateString('es-ES', { month: 'long' })
    return {
      valor,
      comparado: media12,
      comparadoEtiqueta: 'vs. media de los 12 meses anteriores',
      pie: [
        { etiqueta: 'Media mensual (12 meses previos)', valor: media12 },
        { etiqueta: `Total ${p.anio} hasta ${nombreMes}`, valor: suma(new Date(p.anio, 0, 1), hasta) },
      ],
    }
  }
  const finTramoAnterior = new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate())
  return {
    valor,
    comparado: suma(new Date(p.anio - 1, 0, 1), finTramoAnterior),
    comparadoEtiqueta: `vs. mismo periodo de ${p.anio - 1}`,
    pie: [
      { etiqueta: `Media mensual ${p.anio}`, valor: valor / meses },
      { etiqueta: `Total ${p.anio - 1}`, valor: suma(new Date(p.anio - 1, 0, 1), new Date(p.anio, 0, 1)) },
    ],
  }
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const formatoEuros = (n: number) => EUR.format(n)
