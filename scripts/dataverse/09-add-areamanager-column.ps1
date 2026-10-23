<#
  Añade "Area Manager EBRO (Zona)" a fl_ubicacion. En la plantilla nueva este
  dato vive en la Seccion 1 de la Ficha Cliente junto a Concesionario/
  Instalacion, pero es un atributo estable de la instalacion (asignado por
  EBRO), no algo que el dealer deba escribir en cada lead — por eso se guarda
  en fl_ubicacion y se muestra de forma derivada en el detalle del lead.
  Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

Add-DvStringColumn -Entity "fl_ubicacion" -Name "fl_areamanager" -Label "Area Manager EBRO (Zona)" -MaxLength 200

Write-Host "=== Listo ==="
