<#
  Importa los objetivos mensuales por sede desde la plantilla de EBRO ("Plantilla para importar
  objetivos.xlsx", hoja PLANTILLA: DEALER = sede, EBRO RENTING = oportunidades al mes).

  Antes de escribir compara las dos listas y avisa de:
  - sedes del Excel que no existen en la app (no se importan);
  - sedes de la app que no estan en el Excel (se quedan como estaban).

  Crea o actualiza el fl_objetivo de cada sede (igual que la pantalla de Configuracion).
  Idempotente.

  Uso: .\33-importar-objetivos.ps1 -Excel "ruta.xlsx" [-Simular]
#>
param(
    [Parameter(Mandatory)][string]$Excel,
    [switch]$Simular
)
. "$PSScriptRoot\lib.ps1"

$api = "$($script:DvOrgUrl)/api/data/v9.2"
function Q($path) { (Invoke-RestMethod -Uri "$api/$path" -Headers (Get-DvHeaders)).value }
function Norm([string]$s) { ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace '[^A-Za-z0-9]', '').ToLowerInvariant() }

# ---------------------------------------------------------------- Excel -> filas
$tmp = Join-Path $env:TEMP "objetivos-$([guid]::NewGuid()).json"
$proyecto = Split-Path (Split-Path $PSScriptRoot)
Push-Location $proyecto
node -e @"
const ExcelJS=require('exceljs');const fs=require('fs');
(async()=>{const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(process.argv[1]);
const ws=wb.worksheets.find(h=>h.name.trim().toUpperCase()==='PLANTILLA')||wb.worksheets[0];
const val=v=>v&&typeof v==='object'?(v.result!==undefined?v.result:(v.text!==undefined?v.text:'')):v;const filas=[];
ws.eachRow((r,i)=>{if(i===1)return;const n=String(val(r.getCell(1).value)??'').trim();const o=val(r.getCell(2).value);
if(!n||/^total/i.test(n)||o===null||o===undefined||o==='')return;filas.push({sede:n,objetivo:Number(o)})});
fs.writeFileSync(process.argv[2],JSON.stringify(filas))})()
"@ $Excel $tmp
Pop-Location
$filas = @(Get-Content $tmp -Raw -Encoding UTF8 | ConvertFrom-Json)
Remove-Item $tmp

# ---------------------------------------------------------------- comparar con la app
$concs = Q "fl_concesionarios?`$select=fl_concesionarioid,fl_nombre"
$sinConc = ($concs | Where-Object { (Norm $_.fl_nombre) -eq 'sinconcesionario' }).fl_concesionarioid
$sedes = @(Q "fl_ubicacions?`$select=fl_ubicacionid,fl_nombre,_fl_concesionario_value" | Where-Object { $_._fl_concesionario_value -ne $sinConc })
$sedePorNorm = @{}; foreach ($s in $sedes) { $sedePorNorm[(Norm $s.fl_nombre)] = $s }
$objetivos = Q "fl_objetivos?`$select=fl_objetivoid,fl_leadsmes,_fl_ubicacion_value"

$enExcel = @{}
$noEnApp = @()
foreach ($f in $filas) {
    $s = $sedePorNorm[(Norm $f.sede)]
    if ($s) { $enExcel[$s.fl_ubicacionid] = $f } else { $noEnApp += $f }
}
$noEnExcel = @($sedes | Where-Object { -not $enExcel.ContainsKey($_.fl_ubicacionid) })

Write-Host "Sedes en el Excel: $($filas.Count) | en la app: $($sedes.Count) | coinciden: $($enExcel.Count)"
Write-Host ""
Write-Host "En el Excel pero NO en la app (no se importan): $($noEnApp.Count)"
$noEnApp | ForEach-Object { Write-Host "   - $($_.sede) (objetivo $($_.objetivo))" }
Write-Host "En la app pero NO en el Excel (se quedan como estaban): $($noEnExcel.Count)"
$noEnExcel | ForEach-Object { Write-Host "   - $($_.fl_nombre)" }
Write-Host ""
if ($Simular) { Write-Host "(simulacion: no se ha escrito nada)"; return }

# ---------------------------------------------------------------- escribir
$creados = 0; $actualizados = 0; $iguales = 0
foreach ($id in $enExcel.Keys) {
    $f = $enExcel[$id]; $s = $sedes | Where-Object fl_ubicacionid -eq $id
    $actual = $objetivos | Where-Object { $_._fl_ubicacion_value -eq $id } | Select-Object -First 1
    if ($actual) {
        if ($actual.fl_leadsmes -eq $f.objetivo) { $iguales++; continue }
        Invoke-RestMethod -Uri "$api/fl_objetivos($($actual.fl_objetivoid))" -Headers (Get-DvHeaders) -Method Patch -Body (@{ fl_leadsmes = [int]$f.objetivo } | ConvertTo-Json) | Out-Null
        $actualizados++
    } else {
        New-DvRecord "fl_objetivo" @{
            fl_nombre = $s.fl_nombre
            fl_leadsmes = [int]$f.objetivo
            "fl_concesionario@odata.bind" = "/fl_concesionarios($($s._fl_concesionario_value))"
            "fl_ubicacion@odata.bind" = "/fl_ubicacions($id)"
        } | Out-Null
        $creados++
    }
}
Write-Host "Objetivos creados: $creados | actualizados: $actualizados | ya estaban igual: $iguales"
