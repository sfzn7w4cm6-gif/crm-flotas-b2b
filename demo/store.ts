// Base de datos en memoria del modo demo (grabación del vídeo manual). Imita lo justo de la
// Web API de Dataverse que usa la app: filtros OData sencillos, orden, top, lookups
// "@odata.bind", "_x_value" y sus valores con formato. Nunca se usa en la app publicada.
import { crearSemilla } from './seed'

type Fila = Record<string, unknown>
type Tablas = Record<string, Fila[]>

const CLAVE = 'ebro-demo-db-v1'
const NOMBRE_PRINCIPAL = ['fl_numero', 'fl_nombre', 'fl_razonsocial', 'fl_titulo', 'fullname', 'name', 'subject']

function cargar(): Tablas {
  const reset = new URLSearchParams(location.search).has('reset')
  if (!reset) {
    try {
      const guardado = localStorage.getItem(CLAVE)
      if (guardado) return JSON.parse(guardado) as Tablas
    } catch {
      /* sin almacenamiento: semilla nueva */
    }
  }
  const semilla = crearSemilla()
  guardar(semilla)
  return semilla
}

function guardar(t: Tablas) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(t))
  } catch {
    /* solo memoria */
  }
}

const tablas: Tablas = cargar()

let secuencia = 0
export function nuevoId(): string {
  secuencia += 1
  const aleatorio = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${aleatorio}-${Date.now().toString(16).slice(-4)}-4${(secuencia % 4096).toString(16).padStart(3, '0')}-8000-${Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0').slice(0, 12)}`
}

function pkDe(tabla: string, pks: Record<string, string>): string {
  return pks[tabla] ?? `${tabla.replace(/s$/, '')}id`
}

function buscarPorId(id: unknown): Fila | undefined {
  if (typeof id !== 'string') return undefined
  const idl = id.toLowerCase()
  for (const filas of Object.values(tablas)) {
    for (const f of filas) {
      for (const [k, v] of Object.entries(f)) if (k.endsWith('id') && !k.startsWith('_') && typeof v === 'string' && v.toLowerCase() === idl) return f
    }
  }
  return undefined
}

function conFormato(f: Fila): Fila {
  const r: Fila = { ...f }
  for (const [k, v] of Object.entries(f)) {
    if (!k.startsWith('_') || !k.endsWith('_value') || !v) continue
    const ref = buscarPorId(v)
    const nombre = ref && NOMBRE_PRINCIPAL.map((c) => ref[c]).find((x) => typeof x === 'string' && x)
    if (nombre) r[`${k}@OData.Community.Display.V1.FormattedValue`] = nombre
  }
  return r
}

function aplicarCambios(fila: Fila, cambios: Fila) {
  for (const [k, v] of Object.entries(cambios)) {
    if (k.endsWith('@odata.bind')) {
      let nav = k.slice(0, -'@odata.bind'.length).toLowerCase()
      if (nav.startsWith('objectid_')) nav = 'objectid'
      const m = typeof v === 'string' ? /\(([^)]+)\)/.exec(v) : null
      fila[`_${nav}_value`] = m ? m[1] : null
    } else {
      fila[k] = v
    }
  }
}

// ------------------------------------------------------------------ filtros OData

type Token = { t: 'id' | 'str' | 'num' | 'guid' | 'op' | '(' | ')' | ','; v: string }
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function tokens(s: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === '(' || c === ')' || c === ',') { out.push({ t: c, v: c }); i++; continue }
    if (c === "'") {
      let v = ''
      i++
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue }
        if (s[i] === "'") { i++; break }
        v += s[i++]
      }
      out.push({ t: 'str', v })
      continue
    }
    const g = GUID.exec(s.slice(i))
    if (g) { out.push({ t: 'guid', v: g[0].toLowerCase() }); i += g[0].length; continue }
    const n = /^-?\d+(\.\d+)?/.exec(s.slice(i))
    if (n) { out.push({ t: 'num', v: n[0] }); i += n[0].length; continue }
    const w = /^[A-Za-z_][\w.]*/.exec(s.slice(i))
    if (w) {
      const lw = w[0].toLowerCase()
      out.push({ t: ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'and', 'or', 'not'].includes(lw) ? 'op' : 'id', v: w[0] })
      i += w[0].length
      continue
    }
    throw new Error(`Filtro demo no soportado cerca de: ${s.slice(i, i + 20)}`)
  }
  return out
}

type Expr = (f: Fila) => boolean
type Valor = (f: Fila) => unknown

function parsear(filtro: string): Expr {
  const tk = tokens(filtro)
  let p = 0
  const ver = () => tk[p]
  const tomar = () => tk[p++]

  const valor = (): Valor => {
    const t = tomar()
    if (!t) throw new Error('Filtro demo incompleto')
    if (t.t === 'str' || t.t === 'guid') return () => t.v
    if (t.t === 'num') return () => Number(t.v)
    if (t.t === 'id') {
      const lw = t.v.toLowerCase()
      if (lw === 'null') return () => null
      if (lw === 'true') return () => true
      if (lw === 'false') return () => false
      return (f) => f[t.v]
    }
    throw new Error(`Valor inesperado en filtro demo: ${t.v}`)
  }

  const normal = (x: unknown) => (typeof x === 'string' && GUID.test(x) ? x.toLowerCase() : x ?? null)

  const primario = (): Expr => {
    const t = ver()
    if (t?.t === '(') {
      tomar()
      const e = o()
      tomar() // )
      return e
    }
    if (t?.t === 'op' && t.v.toLowerCase() === 'not') {
      tomar()
      const e = primario()
      return (f) => !e(f)
    }
    if (t?.t === 'id' && tk[p + 1]?.t === '(' && ['contains', 'startswith', 'endswith'].includes(t.v.toLowerCase())) {
      const fn = tomar().v.toLowerCase()
      tomar() // (
      const a = valor()
      tomar() // ,
      const b = valor()
      tomar() // )
      return (f) => {
        const x = String(a(f) ?? '').toLowerCase()
        const y = String(b(f) ?? '').toLowerCase()
        return fn === 'contains' ? x.includes(y) : fn === 'startswith' ? x.startsWith(y) : x.endsWith(y)
      }
    }
    const izq = valor()
    const op = ver()
    if (!op || op.t !== 'op' || ['and', 'or'].includes(op.v.toLowerCase())) {
      return (f) => Boolean(izq(f))
    }
    tomar()
    const der = valor()
    const o2 = op.v.toLowerCase()
    return (f) => {
      const a = normal(izq(f))
      const b = normal(der(f))
      switch (o2) {
        case 'eq': return a === b
        case 'ne': return a !== b
        case 'gt': return (a as number) > (b as number)
        case 'ge': return (a as number) >= (b as number)
        case 'lt': return (a as number) < (b as number)
        default: return (a as number) <= (b as number)
      }
    }
  }
  const y = (): Expr => {
    let e = primario()
    while (ver()?.t === 'op' && ver().v.toLowerCase() === 'and') {
      tomar()
      const a = e
      const b = primario()
      e = (f) => a(f) && b(f)
    }
    return e
  }
  const o = (): Expr => {
    let e = y()
    while (ver()?.t === 'op' && ver().v.toLowerCase() === 'or') {
      tomar()
      const a = e
      const b = y()
      e = (f) => a(f) || b(f)
    }
    return e
  }
  return o()
}

// ------------------------------------------------------------------ operaciones

export interface OpcionesLista {
  filter?: string
  orderBy?: string[]
  top?: number
}

export function listar(tabla: string, op: OpcionesLista = {}): Fila[] {
  let filas = [...(tablas[tabla] ?? [])]
  if (op.filter) {
    const e = parsear(op.filter)
    filas = filas.filter(e)
  }
  for (const o of [...(op.orderBy ?? [])].reverse()) {
    const [campo, dir] = o.trim().split(/\s+/)
    const signo = dir?.toLowerCase() === 'desc' ? -1 : 1
    filas.sort((a, b) => {
      const x = a[campo] as string | number | null
      const z = b[campo] as string | number | null
      if (x == null && z == null) return 0
      if (x == null) return 1
      if (z == null) return -1
      return (x < z ? -1 : x > z ? 1 : 0) * signo
    })
  }
  if (op.top) filas = filas.slice(0, op.top)
  return filas.map(conFormato)
}

export function obtener(tabla: string, id: string, pks: Record<string, string>): Fila | null {
  const pk = pkDe(tabla, pks)
  const f = (tablas[tabla] ?? []).find((x) => String(x[pk]).toLowerCase() === id.toLowerCase())
  return f ? conFormato(f) : null
}

export function crear(tabla: string, item: Fila, pks: Record<string, string>): Fila {
  const pk = pkDe(tabla, pks)
  const ahora = new Date().toISOString()
  const fila: Fila = { [pk]: nuevoId(), createdon: ahora, modifiedon: ahora, _ownerid_value: DEMO_SYSTEMUSER }
  aplicarCambios(fila, item)
  if (tabla === 'fl_leads' && !fila.fl_numero) {
    const max = Math.max(100, ...(tablas.fl_leads ?? []).map((l) => Number(String(l.fl_numero ?? '').replace(/\D/g, '')) || 0))
    fila.fl_numero = `L${String(max + 1).padStart(5, '0')}`
  }
  if (tabla === 'annotations') {
    const cuerpo = typeof fila.documentbody === 'string' ? fila.documentbody : ''
    fila.isdocument = cuerpo.length > 0
    fila.filesize = Math.round((cuerpo.length * 3) / 4)
  }
  ;(tablas[tabla] ??= []).push(fila)
  guardar(tablas)
  return conFormato(fila)
}

export function actualizar(tabla: string, id: string, cambios: Fila, pks: Record<string, string>): Fila | null {
  const pk = pkDe(tabla, pks)
  const f = (tablas[tabla] ?? []).find((x) => String(x[pk]).toLowerCase() === id.toLowerCase())
  if (!f) return null
  aplicarCambios(f, cambios)
  f.modifiedon = new Date().toISOString()
  guardar(tablas)
  return conFormato(f)
}

export function borrar(tabla: string, id: string, pks: Record<string, string>): boolean {
  const pk = pkDe(tabla, pks)
  const lista = tablas[tabla] ?? []
  const i = lista.findIndex((x) => String(x[pk]).toLowerCase() === id.toLowerCase())
  if (i < 0) return false
  lista.splice(i, 1)
  guardar(tablas)
  return true
}

export const DEMO_SYSTEMUSER = '0000d3e0-0000-4000-8000-000000000001'
