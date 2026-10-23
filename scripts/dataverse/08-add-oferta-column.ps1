<#
  Añade la columna "Oferta (Descuento/Condiciones)" a fl_lead, que es el
  unico campo realmente nuevo en la plantilla "Plantilla Cliente - FORMS -
  Nueva.xlsx" (seccion 5) frente a la version anterior. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Add-DvMemoColumn -Entity "fl_lead" -Name "fl_ofertacondiciones" -Label "Oferta (Descuento/Condiciones)" -MaxLength 2000

Write-Host "=== Listo ==="
