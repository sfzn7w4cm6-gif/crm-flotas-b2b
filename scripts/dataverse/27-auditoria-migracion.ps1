<#
  Solo lectura. Comprueba, contra el entorno real, que la solucion
  CRMFlotasB2B contiene de verdad todas las tablas fl_* que existen en el
  entorno (no solo lo que dice la documentacion) — para la auditoria de
  "lista para migrar a otro entorno" del 03/11/2026.
#>
. "$PSScriptRoot\lib.ps1"

$h = Get-DvHeaders
$base = $script:DvOrgUrl + "/api/data/v9.2"

$sol = (Invoke-RestMethod -Uri "$base/solutions?`$filter=uniquename eq 'CRMFlotasB2B'&`$select=solutionid,friendlyname,version" -Headers $h).value
if ($sol.Count -eq 0) { throw "No se encontro la solucion CRMFlotasB2B" }
$solutionId = $sol[0].solutionid
Write-Host "Solucion: $($sol[0].friendlyname) v$($sol[0].version) ($solutionId)"

$componentes = (Invoke-RestMethod -Uri "$base/solutioncomponents?`$filter=_solutionid_value eq $solutionId&`$select=componenttype,objectid" -Headers $h).value
Write-Host "Total de componentes en la solucion: $($componentes.Count)"
$porTipo = $componentes | Group-Object componenttype | Sort-Object Name
foreach ($g in $porTipo) { Write-Host "  tipo $($g.Name): $($g.Count)" }

$entidadesEnSolucion = @($componentes | Where-Object { $_.componenttype -eq 1 } | ForEach-Object { $_.objectid })

$todasLasEntidades = (Invoke-RestMethod -Uri "$base/EntityDefinitions?`$select=LogicalName,MetadataId" -Headers $h).value
$todasFl = @($todasLasEntidades | Where-Object { $_.LogicalName -like 'fl_*' })
Write-Host "`nTablas fl_* que existen en el entorno: $($todasFl.Count)"
$faltan = @()
foreach ($e in $todasFl) {
    $dentro = $entidadesEnSolucion -contains $e.MetadataId
    $marca = if ($dentro) { "[OK]" } else { "[FALTA]"; $faltan += $e.LogicalName }
    Write-Host "  $marca $($e.LogicalName)"
}

$roles = (Invoke-RestMethod -Uri "$base/roles?`$filter=startswith(name,'CRM Flotas B2B')&`$select=name" -Headers $h).value
Write-Host "`nRoles 'CRM Flotas B2B - *' en el entorno: $($roles.Count)"
foreach ($r in $roles) { Write-Host "  $($r.name)" }

$apps = (Invoke-RestMethod -Uri "$base/canvasapps?`$filter=name eq 'crda2_crmflotasb2b_19a41'&`$select=name,displayname" -Headers $h).value
Write-Host "`nRegistro de la app (canvasapp) presente: $($apps.Count -gt 0)"

if ($faltan.Count -gt 0) {
    Write-Host "`n=== ATENCION: estas tablas NO estan en la solucion CRMFlotasB2B: $($faltan -join ', ') ==="
} else {
    Write-Host "`n=== Todas las tablas fl_* estan en la solucion. ==="
}
