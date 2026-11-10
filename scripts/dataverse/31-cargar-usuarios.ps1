<#
  Carga masiva de usuarios concesionario desde el Excel de responsables (hoja
  "RESPONSABLE EBRO BUSINESS": concesionario, exposicion/sede, nombre, mail, telefono)
  mas usuarios sueltos asignados a "Sin concesionario". Hace lo mismo que guardar un
  usuario en "Usuarios y accesos": perfil, asignaciones, equipo del concesionario y rol
  de seguridad (estos dos ultimos solo si ya tiene cuenta en el entorno).

  Quien aparece en todas las sedes de su concesionario lleva el concesionario entero;
  si no, solo esas sedes. A un usuario que ya existe no se le cambia el rol ni se le
  quitan accesos: solo se le anade lo que falte. Idempotente.

  Uso: .\31-cargar-usuarios.ps1 -Excel "ruta.xlsx" [-SinConcesionario "a@x.com","b@x.com"] [-Simular]
#>
param(
    [Parameter(Mandatory)][string]$Excel,
    [string[]]$SinConcesionario = @(),
    [switch]$Simular
)
. "$PSScriptRoot\lib.ps1"

$api = "$($script:DvOrgUrl)/api/data/v9.2"
function Q($path) { (Invoke-RestMethod -Uri "$api/$path" -Headers (Get-DvHeaders)).value }
function Norm([string]$s) { ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace '[^A-Za-z0-9]', '').ToLowerInvariant() }
function Relacionar($origen, $id, $relacion, $destino) {
    $body = @{ "@odata.id" = "$api/$destino" } | ConvertTo-Json
    try { Invoke-RestMethod -Uri "$api/$origen($id)/$relacion/`$ref" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null; return 'ok' }
    catch { if ($_.ErrorDetails.Message -match 'duplicate|already|ya existe|0x80040237') { return 'ya' } else { return "ERROR $($_.ErrorDetails.Message)" } }
}

# ---------------------------------------------------------------- Excel -> filas
$tmp = Join-Path $env:TEMP "usuarios-$([guid]::NewGuid()).json"
$proyecto = Split-Path (Split-Path $PSScriptRoot)
Push-Location $proyecto
node -e @"
const ExcelJS=require('exceljs');const fs=require('fs');
(async()=>{const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(process.argv[1]);
const ws=wb.getWorksheet('RESPONSABLE EBRO BUSINESS');const val=v=>v&&v.text?v.text:(v&&v.result!==undefined?v.result:v);const filas=[];
ws.eachRow((r,i)=>{if(i===1)return;const v=r.values.slice(1).map(val);const sede=String(v[3]??'').trim();const mail=String(v[5]??'').trim().toLowerCase();
if(!sede||/^total/i.test(sede)||!mail.includes('@'))return;filas.push({conc:String(v[2]??'').trim(),sede,nombre:String(v[4]??'').trim(),mail,tel:String(v[6]??'').trim()})});
fs.writeFileSync(process.argv[2],JSON.stringify(filas))})()
"@ $Excel $tmp
Pop-Location
$filas = Get-Content $tmp -Raw -Encoding UTF8 | ConvertFrom-Json
Remove-Item $tmp

# ---------------------------------------------------------------- catalogo y estado actual
$concs = Q "fl_concesionarios?`$select=fl_concesionarioid,fl_nombre,_fl_equipo_value"
$sedes = Q "fl_ubicacions?`$select=fl_ubicacionid,fl_nombre,_fl_concesionario_value"
$concPorNorm = @{}; foreach ($c in $concs) { $concPorNorm[(Norm $c.fl_nombre)] = $c }
$sedePorNorm = @{}; foreach ($s in $sedes) { $sedePorNorm[(Norm $s.fl_nombre)] = $s }
$roles = Q "roles?`$select=roleid,name&`$filter=name eq 'CRM Flotas B2B - Concesionario' and _businessunitid_value eq $($script:DvRootBusinessUnitId)"
$rolConcesionario = $roles[0].roleid

# ---------------------------------------------------------------- plan por persona
$personas = [ordered]@{}
foreach ($f in $filas) {
    $c = $concPorNorm[(Norm $f.conc)]; $s = $sedePorNorm[(Norm $f.sede)]
    if (-not $c -or -not $s) { Write-Warning "No cuadra con la app: '$($f.conc)' / '$($f.sede)' ($($f.mail))"; continue }
    if (-not $personas.Contains($f.mail)) { $personas[$f.mail] = @{ nombre = $f.nombre; tel = $f.tel; sedes = @{} } }
    $personas[$f.mail].sedes[$s.fl_ubicacionid] = $s
}
$sinConc = $concPorNorm[(Norm 'Sin concesionario')]
$sinSede = $sedePorNorm[(Norm 'Sin sede')]
foreach ($m in $SinConcesionario) {
    $m = $m.Trim().ToLowerInvariant()
    $su = Q "systemusers?`$select=fullname&`$filter=internalemailaddress eq '$m' or domainname eq '$m'"
    $nombre = if ($su) { $su[0].fullname } else { $m.Split('@')[0] }
    $personas[$m] = @{ nombre = $nombre; tel = ''; sedes = @{ $sinSede.fl_ubicacionid = $sinSede } }
}

$resumen = @{ creados = 0; existentes = 0; asignaciones = 0; conCuenta = 0; sinCuenta = @() }
foreach ($mail in $personas.Keys) {
    $p = $personas[$mail]
    $suyas = @($p.sedes.Values)
    # Accesos: concesionario entero si lleva todas sus sedes; si no, sede a sede.
    $accesos = @()
    foreach ($grupo in ($suyas | Group-Object _fl_concesionario_value)) {
        $todas = @($sedes | Where-Object { $_._fl_concesionario_value -eq $grupo.Name })
        if ($grupo.Count -eq $todas.Count) { $accesos += @{ conc = $grupo.Name; sede = $null } }
        else { foreach ($s in $grupo.Group) { $accesos += @{ conc = $grupo.Name; sede = $s.fl_ubicacionid } } }
    }
    $descripcion = ($accesos | ForEach-Object { $cn = ($concs | Where-Object fl_concesionarioid -eq $_.conc).fl_nombre; if ($_.sede) { "$cn / $(($sedes | Where-Object fl_ubicacionid -eq $_.sede).fl_nombre)" } else { "$cn (entero)" } }) -join '; '
    Write-Host ("{0,-28} {1,-38} {2}" -f $p.nombre, $mail, $descripcion)
    if ($Simular) { continue }

    $esc = $mail -replace "'", "''"
    $cuenta = Q "systemusers?`$select=systemuserid&`$filter=isdisabled eq false and (internalemailaddress eq '$esc' or domainname eq '$esc')"
    $systemUserId = if ($cuenta) { $cuenta[0].systemuserid } else { $null }
    $existente = Q "fl_usuarioapps?`$select=fl_usuarioappid,_fl_systemuserid_value&`$filter=fl_correo eq '$esc'"
    if ($existente) {
        $usuarioId = $existente[0].fl_usuarioappid
        $resumen.existentes++
        if ($systemUserId -and -not $existente[0]._fl_systemuserid_value) {
            Invoke-RestMethod -Uri "$api/fl_usuarioapps($usuarioId)" -Headers (Get-DvHeaders) -Method Patch -Body (@{ "fl_systemuserid@odata.bind" = "/systemusers($systemUserId)" } | ConvertTo-Json) | Out-Null
        }
    } else {
        $campos = @{ fl_nombre = $p.nombre; fl_correo = $mail; fl_rol = 101000000; fl_activo = $true; "fl_ubicacion@odata.bind" = "/fl_ubicacions($($suyas[0].fl_ubicacionid))" }
        if ($p.tel) { $campos.fl_telefono = $p.tel }
        if ($systemUserId) { $campos."fl_systemuserid@odata.bind" = "/systemusers($systemUserId)" }
        $usuarioId = New-DvRecord "fl_usuarioapp" $campos
        $resumen.creados++
    }

    $actuales = Q "fl_asignacions?`$select=_fl_concesionario_value,_fl_ubicacion_value&`$filter=_fl_usuarioapp_value eq $usuarioId"
    foreach ($a in $accesos) {
        $ya = $actuales | Where-Object { $_._fl_concesionario_value -eq $a.conc -and $_._fl_ubicacion_value -eq $a.sede }
        if ($ya) { continue }
        $cn = ($concs | Where-Object fl_concesionarioid -eq $a.conc).fl_nombre
        $sn = if ($a.sede) { ($sedes | Where-Object fl_ubicacionid -eq $a.sede).fl_nombre } else { 'Concesionario entero' }
        $campos = @{ fl_nombre = "$($p.nombre) - $cn - $sn"; "fl_usuarioapp@odata.bind" = "/fl_usuarioapps($usuarioId)"; "fl_concesionario@odata.bind" = "/fl_concesionarios($($a.conc))" }
        if ($a.sede) { $campos."fl_ubicacion@odata.bind" = "/fl_ubicacions($($a.sede))" }
        New-DvRecord "fl_asignacion" $campos | Out-Null
        $resumen.asignaciones++
    }

    if ($systemUserId) {
        $resumen.conCuenta++
        foreach ($cid in ($accesos.conc | Sort-Object -Unique)) {
            $equipo = ($concs | Where-Object fl_concesionarioid -eq $cid)._fl_equipo_value
            if ($equipo) { $r = Relacionar 'teams' $equipo 'teammembership_association' "systemusers($systemUserId)"; if ($r -like 'ERROR*') { Write-Warning "  equipo: $r" } }
        }
        $r = Relacionar 'systemusers' $systemUserId 'systemuserroles_association' "roles($rolConcesionario)"
        if ($r -like 'ERROR*') { Write-Warning "  rol: $r" }
    } else {
        $resumen.sinCuenta += $mail
    }
}

Write-Host ""
Write-Host "Personas: $($personas.Count) | perfiles nuevos: $($resumen.creados) | ya existian: $($resumen.existentes) | asignaciones nuevas: $($resumen.asignaciones)"
Write-Host "Con cuenta en el entorno (vinculados, equipo y rol): $($resumen.conCuenta) | sin cuenta todavia: $($resumen.sinCuenta.Count)"
