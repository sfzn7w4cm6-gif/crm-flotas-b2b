<#
  Compila la app y la publica en DESARROLLO o en PRODUCCION.

  power.config.json siempre apunta a desarrollo (es lo que se guarda en GitHub). Para producción,
  este script cambia temporalmente los tres valores que difieren (appId, appDisplayName y
  environmentId), publica y deja el archivo exactamente como estaba, aunque falle la publicación.

  La misma compilación sirve para los dos entornos: las tablas de la app son orígenes nativos de
  Dataverse ("default.cds"), que van siempre al Dataverse del entorno donde está publicada la app.

  Uso (desde la raíz del proyecto):
    .\scripts\publicar.ps1 -Entorno dev
    .\scripts\publicar.ps1 -Entorno prod      # pide confirmación
    .\scripts\publicar.ps1 -Entorno prod -SinCompilar   # reutiliza el dist/ ya compilado

  Requisitos: pac CLI autenticado (pac auth list) y, en la red de EBRO, el certificado del proxy.
#>
param(
    [Parameter(Mandatory)][ValidateSet("dev", "prod")][string]$Entorno,
    [switch]$SinCompilar
)
$ErrorActionPreference = "Stop"

$ENTORNOS = @{
    dev  = @{ appId = "033039d0-63b6-4df9-91a1-14fec80dffba"; nombre = "Ebro Business";     environmentId = "192d0a93-f34e-e64a-a9c3-6558e2f66156" }
    prod = @{ appId = "b9bfcd40-fbb7-4e29-88a8-7275312e769f"; nombre = "Ebro Business App"; environmentId = "6adf3534-66c7-e4a1-95c7-045d1b228f44" }
}

$raiz = Split-Path $PSScriptRoot
$config = Join-Path $raiz "power.config.json"
$pac = "$env:LOCALAPPDATA\Microsoft\PowerAppsCLI\Microsoft.PowerApps.CLI.2.11.2\tools\pac.exe"
if (-not (Test-Path $pac)) { $pac = "pac" }
$certificado = "$env:USERPROFILE\.pac-certs\corporate-ca-bundle.pem"
if (Test-Path $certificado) { $env:NODE_EXTRA_CA_CERTS = $certificado }

$destino = $ENTORNOS[$Entorno]
if ($Entorno -eq "prod") {
    $ok = Read-Host "Vas a publicar en PRODUCCION ('$($destino.nombre)'). Escribe SI para continuar"
    if ($ok -ne "SI") { Write-Host "Cancelado."; return }
}

Push-Location $raiz
$original = [IO.File]::ReadAllText($config)
try {
    if (-not $SinCompilar) {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "La compilación ha fallado: no se publica nada." }
    }

    $dev = $ENTORNOS.dev
    $texto = $original.Replace($dev.appId, $destino.appId).Replace($dev.environmentId, $destino.environmentId).Replace("`"appDisplayName`": `"$($dev.nombre)`"", "`"appDisplayName`": `"$($destino.nombre)`"")
    if ($Entorno -eq "prod" -and $texto -eq $original) { throw "power.config.json no tiene los valores de desarrollo esperados; revísalo antes de publicar." }
    [IO.File]::WriteAllText($config, $texto, (New-Object Text.UTF8Encoding $false))

    & $pac code push --environment $destino.environmentId
    if ($LASTEXITCODE -ne 0) { throw "pac code push ha fallado." }
    Write-Host "Publicado en $Entorno ($($destino.nombre))." -ForegroundColor Green
} finally {
    [IO.File]::WriteAllText($config, $original, (New-Object Text.UTF8Encoding $false))
    Pop-Location
}
