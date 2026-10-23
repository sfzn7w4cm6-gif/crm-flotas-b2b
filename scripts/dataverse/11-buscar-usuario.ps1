<#
  Busca un systemuser por correo, para verificar que existe en el entorno
  antes de darle acceso a la app. Solo lectura.
#>
. "$PSScriptRoot\lib.ps1"

$correo = $args[0]
if (-not $correo) { throw "Uso: .\11-buscar-usuario.ps1 correo@ebroauto.com" }

$escaped = $correo -replace "'", "''"
$r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers?`$filter=internalemailaddress eq '$escaped'&`$select=systemuserid,fullname,internalemailaddress,isdisabled,accessmode" -Headers (Get-DvHeaders)
if ($r.value.Count -eq 0) {
    Write-Host "No encontrado: $correo"
} else {
    $r.value | ForEach-Object { Write-Host "systemuserid=$($_.systemuserid) fullname=$($_.fullname) disabled=$($_.isdisabled) accessmode=$($_.accessmode)" }
}
