<#
  Busca systemusers cuyo correo o nombre contenga un texto parcial. Solo lectura.
#>
. "$PSScriptRoot\lib.ps1"

$texto = $args[0]
if (-not $texto) { throw "Uso: .\11b-buscar-usuario-contains.ps1 texto" }

$r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers?`$filter=contains(internalemailaddress,'$texto') or contains(fullname,'$texto')&`$select=systemuserid,fullname,internalemailaddress,isdisabled,accessmode" -Headers (Get-DvHeaders)
if ($r.value.Count -eq 0) {
    Write-Host "Sin coincidencias para: $texto"
} else {
    $r.value | ForEach-Object { Write-Host "systemuserid=$($_.systemuserid) fullname=$($_.fullname) correo=$($_.internalemailaddress) disabled=$($_.isdisabled) accessmode=$($_.accessmode)" }
}
