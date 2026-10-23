<#
  Asigna una ubicacion al perfil del administrador, para que "Ver como
  Concesionario" pueda probar el alta de leads de principio a fin (si no,
  crearLeadBase falla porque el perfil no tiene ubicacion asignada).
#>
. "$PSScriptRoot\lib.ps1"

$ubiSet = Get-DvEntitySet "fl_ubicacion"
$ubi = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${ubiSet}?`$filter=fl_nombre eq 'M Automocion Barcelona'&`$select=fl_ubicacionid" -Headers (Get-DvHeaders)
if ($ubi.value.Count -eq 0) { throw "No se encontro la ubicacion de prueba" }
$ubiId = $ubi.value[0].fl_ubicacionid

$usrSet = Get-DvEntitySet "fl_usuarioapp"
$usr = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${usrSet}?`$filter=fl_correo eq 'allanos@ebroauto.com'&`$select=fl_usuarioappid" -Headers (Get-DvHeaders)
$usrId = $usr.value[0].fl_usuarioappid

$body = @{ "fl_ubicacion@odata.bind" = (DvLookupBind "fl_ubicacion" "fl_ubicacion" $ubiId) } | ConvertTo-Json
Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${usrSet}($usrId)" -Headers (Get-DvHeaders -WithSolution) -Method Patch -Body $body | Out-Null
Write-Host "[+] Ubicacion de prueba asignada al perfil admin (M Automocion Barcelona)"
