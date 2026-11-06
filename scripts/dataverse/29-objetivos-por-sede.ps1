<#
  fl_objetivo ahora tambien puede ser por sede (fl_ubicacion), no solo por
  concesionario: una sede con su propia fila usa ese numero; si no tiene,
  hereda el de su concesionario; si el concesionario tampoco tiene, el general.
  Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- fl_objetivo: columna de sede ---"
New-DvLookup -ReferencingEntity "fl_objetivo" -SchemaName "fl_ubicacion" -ReferencedEntity "fl_ubicacion" -Label "Sede (vacio = todo el concesionario)"

Write-Host "Listo."
