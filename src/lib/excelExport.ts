/** Exporta filas a un .csv compatible con Excel (BOM UTF-8 + separador ';',
 *  que es el que usa Excel en español al abrir un CSV por defecto). Se evita
 *  la libreria 'xlsx' (SheetJS): su version publicada en npm tiene
 *  vulnerabilidades de seguridad sin parche, y un CSV cubre de sobra la
 *  necesidad real (poder abrir estos datos en Excel) sin depender de codigo
 *  de terceros. */
function celdaCsv(valor: string | number | undefined): string {
  const texto = String(valor ?? '')
  if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

export function descargarExcel(nombreArchivo: string, headers: string[], rows: (string | number | undefined)[][]) {
  const lineas = [headers.map(celdaCsv).join(';'), ...rows.map((r) => r.map(celdaCsv).join(';'))]
  const contenido = '﻿' + lineas.join('\r\n')
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
