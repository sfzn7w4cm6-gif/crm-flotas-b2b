<#
  Usuarios con varias sedes o concesionarios enteros, objetivo por asignacion y
  proteccion real de las empresas (30/10/2026). Idempotente.

  - fl_asignacion: que sedes lleva cada usuario. Una fila por (usuario, concesionario,
    sede). Sin sede = el concesionario entero, incluidas las sedes que se abran despues.
    fl_objetivoleadsmes es el objetivo de leads al mes de ese usuario en esa asignacion
    (vacio = el objetivo general). fl_usuarioapp.fl_ubicacion sigue siendo la sede
    principal (la que sale por defecto al dar de alta).
  - Un equipo propietario por concesionario ("CRM Flotas - <nombre>", guardado en
    fl_concesionario.fl_equipo) con el rol Concesionario. Es el dueño de las empresas de
    ese concesionario y sus miembros son los comerciales con alguna sede en el.
  - El rol Concesionario pasa de ver todas las empresas (Global) a ver solo las suyas y
    las de sus equipos (Basic): un comercial ya no puede leer empresas de otro
    concesionario aunque las pida directamente. Sus oportunidades siguen siendo solo
    las suyas (Basic, sin cambios).
  - Migracion: una asignacion por cada usuario que tenga sede, las empresas pasan al
    equipo de su concesionario y los usuarios con cuenta entran en sus equipos.
#>
. "$PSScriptRoot\lib.ps1"
$api = "$($script:DvOrgUrl)/api/data/v9.2"
function Q($u) { (Invoke-RestMethod -Uri "$api/$u" -Headers (Get-DvHeaders)).value }
function Relacionar($set, $id, $rel, $destino) {
    $body = @{ "@odata.id" = "$api/$destino" } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$api/$set($id)/$rel/`$ref" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null
    } catch {
        # Ya relacionados: Dataverse responde con error de clave duplicada
        if ("$_" -notmatch "duplicate|already|ya existe|0x80040237") { throw }
    }
}

Write-Host "--- fl_asignacion ---"
New-DvTable -Name "fl_asignacion" -DisplayName "Asignacion" -DisplayCollectionName "Asignaciones" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
New-DvLookup -ReferencingEntity "fl_asignacion" -SchemaName "fl_usuarioapp" -ReferencedEntity "fl_usuarioapp" -Label "Usuario" -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_asignacion" -SchemaName "fl_concesionario" -ReferencedEntity "fl_concesionario" -Label "Concesionario" -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_asignacion" -SchemaName "fl_ubicacion" -ReferencedEntity "fl_ubicacion" -Label "Sede (vacio = concesionario entero)"
Add-DvIntColumn -Entity "fl_asignacion" -Name "fl_objetivoleadsmes" -Label "Objetivo de leads al mes" -Min 0 -Max 100000

Write-Host "--- fl_concesionario.fl_equipo ---"
New-DvLookup -ReferencingEntity "fl_concesionario" -SchemaName "fl_equipo" -ReferencedEntity "team" -Label "Equipo propietario"

Write-Host "--- Publicar ---"
$xml = "<importexportxml><entities><entity>fl_asignacion</entity><entity>fl_concesionario</entity></entities></importexportxml>"
Invoke-RestMethod -Uri "$api/PublishXml" -Headers (Get-DvHeaders) -Method Post -Body (@{ ParameterXml = $xml } | ConvertTo-Json) | Out-Null
Write-Host "    [+] publicado"

Write-Host "--- Privilegios ---"
$APPEND = @("Append","AppendTo")
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")
$rConcesionario = New-DvRole -Name "CRM Flotas B2B - Concesionario"
$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"

foreach ($r in @($rConcesionario, $rVentas)) {
    Grant-DvTablePrivileges -RoleId $r -Table "fl_asignacion" -Actions @("Read") -Depth "Global"
    Grant-DvTablePrivileges -RoleId $r -Table "fl_asignacion" -Actions $APPEND -Depth "Global"
}
Grant-DvTablePrivileges -RoleId $rAdmin -Table "fl_asignacion" -Actions $FULL -Depth "Global"
# Para dar de alta empresas a nombre del equipo del concesionario
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "Team" -Actions @("Read") -Depth "Global"

# Empresas: de Global a Basic. AddPrivilegesRole no baja la profundidad de un privilegio
# que ya existe, asi que primero se quita y luego se vuelve a dar.
foreach ($a in @("Create","Read","Write")) {
    $priv = Get-DvPrivilegeId -Action $a -Table "fl_empresa"
    try {
        Invoke-RestMethod -Uri "$api/roles($rConcesionario)/Microsoft.Dynamics.CRM.RemovePrivilegeRole" -Headers (Get-DvHeaders) -Method Post -Body (@{ PrivilegeId = $priv } | ConvertTo-Json) | Out-Null
    } catch { }
}
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "fl_empresa" -Actions @("Create","Read","Write","Assign") -Depth "Basic"

Write-Host "--- Equipos por concesionario ---"
$yo = (Invoke-RestMethod -Uri "$api/WhoAmI" -Headers (Get-DvHeaders)).UserId
$concesionarios = Q "fl_concesionarios?`$select=fl_concesionarioid,fl_nombre,_fl_equipo_value"
$equipoDe = @{}
foreach ($c in $concesionarios) {
    $nombre = "CRM Flotas - $($c.fl_nombre)"
    $teamId = $c._fl_equipo_value
    if (-not $teamId) {
        $esc = $nombre -replace "'", "''"
        $existente = Q "teams?`$select=teamid&`$filter=name eq '$esc' and teamtype eq 0"
        if ($existente.Count -gt 0) {
            $teamId = $existente[0].teamid
        } else {
            $body = @{
                name = $nombre
                teamtype = 0
                description = "Propietario de las empresas de $($c.fl_nombre) en CRM Flotas B2B"
                "businessunitid@odata.bind" = "/businessunits($($script:DvRootBusinessUnitId))"
                "administratorid@odata.bind" = "/systemusers($yo)"
            } | ConvertTo-Json
            $resp = Invoke-WebRequest -Uri "$api/teams" -Headers (Get-DvHeaders) -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing
            $teamId = ($resp.Headers["OData-EntityId"] -replace ".*teams\(([0-9a-fA-F-]+)\).*", '$1')
            Write-Host "    [+] $nombre"
        }
        Relacionar "teams" $teamId "teamroles_association" "roles($rConcesionario)"
        $body = @{ "fl_equipo@odata.bind" = "/teams($teamId)" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$api/fl_concesionarios($($c.fl_concesionarioid))" -Headers (Get-DvHeaders) -Method Patch -Body $body | Out-Null
    }
    $equipoDe[$c.fl_concesionarioid] = $teamId
}
Write-Host "    [=] $($equipoDe.Count) equipos"

Write-Host "--- Empresas al equipo de su concesionario ---"
$n = 0
foreach ($e in (Q "fl_empresas?`$select=fl_empresaid,_fl_concesionario_value,_ownerid_value")) {
    $teamId = $equipoDe[$e._fl_concesionario_value]
    if (-not $teamId -or $e._ownerid_value -eq $teamId) { continue }
    $body = @{ "ownerid@odata.bind" = "/teams($teamId)" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$api/fl_empresas($($e.fl_empresaid))" -Headers (Get-DvHeaders) -Method Patch -Body $body | Out-Null
    $n++
}
Write-Host "    [+] $n empresas reasignadas"

Write-Host "--- Asignaciones desde la sede actual de cada usuario ---"
$sedes = @{}
foreach ($s in (Q "fl_ubicacions?`$select=fl_ubicacionid,fl_nombre,_fl_concesionario_value")) { $sedes[$s.fl_ubicacionid] = $s }
$nombreConc = @{}
foreach ($c in $concesionarios) { $nombreConc[$c.fl_concesionarioid] = $c.fl_nombre }
$asignadas = @{}
foreach ($a in (Q "fl_asignacions?`$select=_fl_usuarioapp_value")) { $asignadas[$a._fl_usuarioapp_value] = $true }
foreach ($u in (Q "fl_usuarioapps?`$select=fl_usuarioappid,fl_nombre,_fl_ubicacion_value,_fl_systemuserid_value")) {
    if (-not $u._fl_ubicacion_value) { continue }
    $s = $sedes[$u._fl_ubicacion_value]
    if (-not $s) { continue }
    if (-not $asignadas[$u.fl_usuarioappid]) {
        $body = @{
            fl_nombre = "$($u.fl_nombre) - $($nombreConc[$s._fl_concesionario_value]) - $($s.fl_nombre)"
            "fl_usuarioapp@odata.bind" = "/fl_usuarioapps($($u.fl_usuarioappid))"
            "fl_concesionario@odata.bind" = "/fl_concesionarios($($s._fl_concesionario_value))"
            "fl_ubicacion@odata.bind" = "/fl_ubicacions($($s.fl_ubicacionid))"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$api/fl_asignacions" -Headers (Get-DvHeaders) -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
        Write-Host "    [+] $($u.fl_nombre) -> $($s.fl_nombre)"
    }
    if ($u._fl_systemuserid_value) {
        Relacionar "teams" $equipoDe[$s._fl_concesionario_value] "teammembership_association" "systemusers($($u._fl_systemuserid_value))"
    }
}

Write-Host "=== Listo ==="
