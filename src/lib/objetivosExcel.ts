import ExcelJS from 'exceljs'

// Exportar/importar en Excel de verdad (.xlsx), no el truco de tabla HTML que usa
// excelExport.ts para las descargas de solo-lectura: aquí hace falta poder volver a leer
// el archivo que la persona edita en Excel y reimporta, así que se necesita un lector real
// de .xlsx. Se usa exceljs (con su build de navegador) en vez de la librería 'xlsx'
// (SheetJS) que ya se descartó en este proyecto por tener vulnerabilidades sin parchear.
//
// Formato: el de "Plantilla para importar objetivos.xlsx" de EBRO. Una hoja "PLANTILLA" con
// dos columnas: DEALER (la sede, p. ej. "Syrsa-Huelva", que ya lleva el nombre del grupo) y
// OBJETIVO (oportunidades al mes; la plantilla original la llamaba EBRO RENTING, también vale:
// se lee la columna de al lado de DEALER). Las filas TOTAL y las vacías se ignoran.

export interface FilaExportObjetivo {
  /** Nombre de la sede tal y como está en la app (p. ej. "M Automoción-Barcelona"). */
  nombre: string
  valorActual: number | undefined
}

const NOMBRE_HOJA = 'PLANTILLA'
const CABECERA_NOMBRE = 'DEALER'
const CABECERA_OBJETIVO = 'OBJETIVO'

export async function exportarObjetivosExcel(filas: FilaExportObjetivo[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Ebro Business'
  wb.created = new Date()
  const hoja = wb.addWorksheet(NOMBRE_HOJA, { views: [{ state: 'frozen', ySplit: 1 }] })
  hoja.columns = [
    { header: CABECERA_NOMBRE, key: 'nombre', width: 40 },
    { header: CABECERA_OBJETIVO, key: 'objetivo', width: 16 },
  ]
  hoja.getRow(1).eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D1D1B' } }
    celda.alignment = { vertical: 'middle' }
  })
  for (const f of filas) {
    const fila = hoja.addRow({ nombre: f.nombre, objetivo: f.valorActual ?? null })
    const celda = fila.getCell(2)
    celda.alignment = { horizontal: 'center' }
    celda.numFmt = '0'
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `objetivos-ebro-business-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface CambioObjetivoImportado {
  nombre: string
  nuevo: number
}

const textoCelda = (v: ExcelJS.CellValue): string => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('result' in v) return String(v.result ?? '')
    if ('text' in v) return String(v.text ?? '')
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
  }
  return String(v)
}

/** Lee la plantilla: cada fila con sede y objetivo. */
export async function importarObjetivosExcel(file: File): Promise<CambioObjetivoImportado[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const hoja =
    wb.worksheets.find((h) => h.name.trim().toUpperCase() === NOMBRE_HOJA) ??
    wb.worksheets.find((h) => textoCelda(h.getCell(1, 1).value).trim().toUpperCase() === CABECERA_NOMBRE) ??
    wb.worksheets[0]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja con datos.')

  // Columna de la sede: la de cabecera DEALER (o la primera); el objetivo, la siguiente.
  let colNombre = 1
  hoja.getRow(1).eachCell((celda, col) => {
    if (textoCelda(celda.value).trim().toUpperCase() === CABECERA_NOMBRE) colNombre = col
  })
  const colObjetivo = colNombre + 1

  const cambios: CambioObjetivoImportado[] = []
  hoja.eachRow((fila, numFila) => {
    if (numFila === 1) return
    const nombre = textoCelda(fila.getCell(colNombre).value).trim()
    const bruto = textoCelda(fila.getCell(colObjetivo).value).trim()
    if (!nombre || /^total/i.test(nombre) || bruto === '') return
    const nuevo = Number(bruto.replace(',', '.'))
    if (!Number.isFinite(nuevo) || nuevo < 0) throw new Error(`"${nombre}": el objetivo debe ser un número de 0 o más (fila ${numFila}).`)
    cambios.push({ nombre, nuevo: Math.round(nuevo) })
  })
  return cambios
}
