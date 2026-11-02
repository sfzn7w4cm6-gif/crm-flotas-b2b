<#
  El descuento de la oferta pasa a ser dos porcentajes que se suman: primero el del concesionario
  (lo pone el comercial) y luego el de ventas. Mientras falta el de ventas, la oportunidad sale en
  naranja y ventas la ve como pendiente.

  - fl_lead: fl_descuentoconcesionario y fl_descuentoventas (decimal, 2 decimales).
  - Equipo de Ventas: Write Global sobre fl_lead (antes solo leia las de los demas) para poder
    guardar su porcentaje. La app solo le deja tocar ese campo.

  Solo anade, no quita nada. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- Columnas de descuento en fl_lead ---"
Add-DvDecimalColumn -Entity "fl_lead" -Name "fl_descuentoconcesionario" -Label "Descuento del concesionario (%)"
Add-DvDecimalColumn -Entity "fl_lead" -Name "fl_descuentoventas" -Label "Descuento de ventas (%)"

Write-Host "--- Privilegios: Equipo de Ventas escribe en fl_lead ---"
$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_lead" -Actions @("Write") -Depth "Global"

Write-Host "=== Listo ==="
