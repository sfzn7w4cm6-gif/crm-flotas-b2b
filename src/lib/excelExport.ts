/** Genera un archivo que Excel abre como hoja de calculo real (una tabla
 *  HTML con extension .xls), en vez de un .csv.
 *
 *  Se cambio de un .csv a esto porque un CSV depende del separador de lista
 *  configurado en Windows (',' o ';'): si no coincide con el que usa el
 *  equipo de quien lo abre, Excel mete toda la fila en una sola columna en
 *  vez de repartirla en celdas. Una tabla HTML no depende de ningun
 *  separador: Excel la interpreta directamente como celdas, siempre bien,
 *  sin importar la configuracion regional de quien la abra. Ademas permite
 *  dar ancho a cada columna y color a la cabecera, cosa que un CSV no
 *  puede llevar.
 *
 *  Excel muestra un aviso al abrirlo ("el formato y la extension del
 *  archivo no coinciden...") porque el contenido es HTML y no el binario
 *  XLS real; hay que pulsar "Si" y se abre perfectamente. Se evito la
 *  libreria 'xlsx' (SheetJS) porque su version en npm tiene
 *  vulnerabilidades de seguridad sin parche (ver commit que la retiro). */
function escaparHtml(valor: string | number | undefined): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Ancho de columna en pixeles, estimado a partir del contenido mas largo
 *  (cabecera o alguna celda), para que no quede todo apretado a 'auto'. */
function anchoColumna(header: string, valores: (string | number | undefined)[]): number {
  const masLargo = Math.max(header.length, ...valores.map((v) => String(v ?? '').length), 4)
  return Math.min(340, Math.max(70, masLargo * 7 + 26))
}

export function descargarExcel(nombreArchivo: string, headers: string[], rows: (string | number | undefined)[][]) {
  const anchos = headers.map((h, i) => anchoColumna(h, rows.map((r) => r[i])))
  const colgroup = anchos.map((w) => `<col style="width:${w}px">`).join('')

  const estiloTh =
    'background:#1d1d1b;color:#ffffff;font-family:Calibri,Segoe UI,sans-serif;font-size:12px;font-weight:bold;' +
    'text-align:left;padding:7px 10px;border:1px solid #1d1d1b;white-space:nowrap;'
  const estiloTd = (par: boolean) =>
    `font-family:Calibri,Segoe UI,sans-serif;font-size:12px;padding:6px 10px;border:1px solid #d9d7d0;` +
    `background:${par ? '#f7f6f4' : '#ffffff'};vertical-align:top;`

  const cabecera = headers.map((h) => `<th style="${estiloTh}">${escaparHtml(h)}</th>`).join('')
  const filas = rows
    .map(
      (r, i) =>
        `<tr>${r.map((c) => `<td style="${estiloTd(i % 2 === 1)}">${escaparHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escaparHtml(nombreArchivo).slice(0, 31)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>1</x:SplitHorizontal><x:TopRowBottomPane>1</x:TopRowBottomPane></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="0" cellspacing="0" style="border-collapse:collapse"><colgroup>${colgroup}</colgroup><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table></body>
</html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
