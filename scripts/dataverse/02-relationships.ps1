<#
  Crea las relaciones (lookups) entre las tablas de CRM Flotas B2B.
  Se ejecuta despues de 01-tables.ps1, cuando todas las tablas ya existen.
  Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- fl_ubicacion ---"
New-DvLookup -ReferencingEntity "fl_ubicacion" -SchemaName "fl_concesionario" -ReferencedEntity "fl_concesionario" -Label "Concesionario" -Required "ApplicationRequired"

Write-Host "--- fl_usuarioapp ---"
New-DvLookup -ReferencingEntity "fl_usuarioapp" -SchemaName "fl_ubicacion" -ReferencedEntity "fl_ubicacion" -Label "Ubicacion"
New-DvLookup -ReferencingEntity "fl_usuarioapp" -SchemaName "fl_systemuserid" -ReferencedEntity "systemuser" -Label "Usuario de sistema (Dataverse)"

Write-Host "--- fl_lead ---"
New-DvLookup -ReferencingEntity "fl_lead" -SchemaName "fl_ubicacion" -ReferencedEntity "fl_ubicacion" -Label "Ubicacion" -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_lead" -SchemaName "fl_concesionario" -ReferencedEntity "fl_concesionario" -Label "Concesionario" -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_lead" -SchemaName "fl_creadopor" -ReferencedEntity "fl_usuarioapp" -Label "Creado por" -Required "ApplicationRequired"

Write-Host "--- fl_fasehistorico ---"
New-DvLookup -ReferencingEntity "fl_fasehistorico" -SchemaName "fl_lead" -ReferencedEntity "fl_lead" -Label "Lead" -Required "ApplicationRequired"

Write-Host "=== Listo ==="
