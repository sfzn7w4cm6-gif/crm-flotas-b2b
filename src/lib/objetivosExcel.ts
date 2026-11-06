import ExcelJS from 'exceljs'

// Exportar/importar en Excel de verdad (.xlsx), no el truco de tabla HTML que usa
// excelExport.ts para las descargas de solo-lectura: aquí hace falta poder volver a leer
// el archivo que la persona edita en Excel y reimporta, así que se necesita un lector real
// de .xlsx. Se usa exceljs (con su build de navegador) en vez de la librería 'xlsx'
// (SheetJS) que ya se descartó en este proyecto por tener vulnerabilidades sin parchear.

export interface FilaExportObjetivo {
  /** "__general__" o el id de la sede — se guarda oculto para poder reimportar sin ambigüedad. */
  id: string
  /** "General (por defecto)" o "Concesionario - Sede" (ej. "M Automoción - Barcelona"). */
  nombre: string
  valorActual: number | undefined
  esGeneral: boolean
}

const NOMBRE_HOJA = 'Objetivos'
const COL_NOMBRE = 1
const COL_ACTUAL = 2
const COL_NUEVO = 3
const COL_ID = 4

export async function exportarObjetivosExcel(filas: FilaExportObjetivo[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CRM Flotas B2B'
  wb.created = new Date()
  const hoja = wb.addWorksheet(NOMBRE_HOJA, { views: [{ state: 'frozen', ySplit: 1 }] })

  hoja.columns = [
    { header: 'Concesionario / Sede', key: 'nombre', width: 42 },
    { header: 'Objetivo actual (leads/mes)', key: 'actual', width: 24 },
    { header: 'Nuevo objetivo (leads/mes)', key: 'nuevo', width: 24 },
    { header: 'id', key: 'id', width: 10 },
  ]
  hoja.getColumn(COL_ID).hidden = true

  hoja.getRow(1).eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D1D1B' } }
    celda.alignment = { vertical: 'middle' }
  })

  for (const f of filas) {
    const fila = hoja.addRow({ nombre: f.nombre, actual: f.valorActual ?? null, nuevo: null, id: f.id })
    if (f.esGeneral) fila.getCell(COL_NOMBRE).font = { bold: true }
    fila.getCell(COL_ACTUAL).alignment = { horizontal: 'center' }
    fila.getCell(COL_ACTUAL).numFmt = '0'
    const celdaNuevo = fila.getCell(COL_NUEVO)
    celdaNuevo.alignment = { horizontal: 'center' }
    celdaNuevo.numFmt = '0'
    celdaNuevo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6DD' } }
    celdaNuevo.border = { top: { style: 'thin', color: { argb: 'FFC1B6A3' } }, bottom: { style: 'thin', color: { argb: 'FFC1B6A3' } }, left: { style: 'thin', color: { argb: 'FFC1B6A3' } }, right: { style: 'thin', color: { argb: 'FFC1B6A3' } } }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `objetivos-crm-flotas-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface CambioObjetivoImportado {
  /** Vacío si la columna oculta "id" se borró o no se encuentra: se resuelve por nombre en el llamante. */
  id: string
  nombre: string
  nuevo: number
}

/** Lee la plantilla reimportada: solo recoge las filas donde se rellenó "Nuevo objetivo". */
export async function importarObjetivosExcel(file: File): Promise<CambioObjetivoImportado[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const hoja = wb.getWorksheet(NOMBRE_HOJA) ?? wb.worksheets[0]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja con datos.')

  const cambios: CambioObjetivoImportado[] = []
  hoja.eachRow((fila, numFila) => {
    if (numFila === 1) return
    const nombre = String(fila.getCell(COL_NOMBRE).value ?? '').trim()
    const id = String(fila.getCell(COL_ID).value ?? '').trim()
    const nuevoRaw = fila.getCell(COL_NUEVO).value
    if (!nombre || nuevoRaw === null || nuevoRaw === undefined || nuevoRaw === '') return
    const nuevo = typeof nuevoRaw === 'object' && nuevoRaw && 'result' in nuevoRaw ? Number((nuevoRaw as { result?: unknown }).result) : Number(nuevoRaw)
    if (!Number.isFinite(nuevo) || nuevo < 0) throw new Error(`"${nombre}": el nuevo objetivo debe ser un número de 0 o más (fila ${numFila}).`)
    cambios.push({ id, nombre, nuevo: Math.round(nuevo) })
  })
  return cambios
}
