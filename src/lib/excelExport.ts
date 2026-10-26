/** Genera un archivo que Excel abre como hoja de calculo real (una tabla
 *  HTML con extension .xls), en vez de un .csv.
 *
 *  Se cambio de un .csv a esto porque un CSV depende del separador de lista
 *  configurado en Windows (',' o ';'): si no coincide con el que usa el
 *  equipo de quien lo abre, Excel mete toda la fila en una sola columna en
 *  vez de repartirla en celdas -- eso es justo lo que le paso a la usuaria.
 *  Una tabla HTML no depende de ningun separador: Excel la interpreta
 *  directamente como celdas, siempre bien, sin importar la configuracion
 *  regional de quien la abra.
 *
 *  Excel muestra un aviso al abrirlo ("el formato y la extension del
 *  archivo no coinciden...") porque el contenido es HTML y no el binario
 *  XLS real; hay que pulsar "Si" y se abre perfectamente, con las celdas ya
 *  separadas. Se evito la libreria 'xlsx' (SheetJS) porque su version en
 *  npm tiene vulnerabilidades de seguridad sin parche (ver commit que la
 *  retiro). */
function escaparHtml(valor: string | number | undefined): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function descargarExcel(nombreArchivo: string, headers: string[], rows: (string | number | undefined)[][]) {
  const cabecera = headers.map((h) => `<th>${escaparHtml(h)}</th>`).join('')
  const filas = rows.map((r) => `<tr>${r.map((c) => `<td>${escaparHtml(c)}</td>`).join('')}</tr>`).join('')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escaparHtml(nombreArchivo)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1"><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table></body>
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
