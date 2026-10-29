<#
  Cambia el formato del numero de lead de "LEAD-01047" a "L01047" (28/10/2026).
  Idempotente.

  - fl_lead.fl_numero: AutoNumberFormat "LEAD-{SEQNUM:5}" -> "L{SEQNUM:5}". La secuencia
    sigue donde iba; solo afecta a los leads nuevos.
  - Renombra los numeros ya asignados y el prefijo de los titulos de fl_fasehistorico
    ("LEAD-01047 — Cierre" -> "L01047 — Cierre"). La anotacion del lookup
    fl_empresa.fl_oportunidadabierta se actualiza sola (sale del nombre del lead).
#>
. "$PSScriptRoot\lib.ps1"

$base = "$($script:DvOrgUrl)/api/data/v9.2"
$h = Get-DvHeaders
$FORMATO = "L{SEQNUM:5}"

$uri = "$base/EntityDefinitions(LogicalName='fl_lead')/Attributes(LogicalName='fl_numero')/Microsoft.Dynamics.CRM.StringAttributeMetadata"
$attr = Invoke-RestMethod -Uri $uri -Headers $h
if ($attr.AutoNumberFormat -ne $FORMATO) {
    $attr.AutoNumberFormat = $FORMATO
    $attr.PSObject.Properties.Remove("@odata.context")
    $attr | Add-Member -NotePropertyName "@odata.type" -NotePropertyValue "Microsoft.Dynamics.CRM.StringAttributeMetadata" -Force
    $headers = Get-DvHeaders -WithSolution
    $headers["MSCRM.MergeLabels"] = "true"
    Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='fl_lead')/Attributes($($attr.MetadataId))" -Headers $headers -Method Put -Body ($attr | ConvertTo-Json -Depth 12) | Out-Null
    Write-Host "  [+] Formato del numero: $FORMATO"
} else {
    Write-Host "  [=] El formato ya es $FORMATO"
}

$leads = (Invoke-RestMethod -Uri "$base/fl_leads?`$select=fl_leadid,fl_numero&`$filter=startswith(fl_numero,'LEAD-')" -Headers $h).value
foreach ($l in $leads) {
    $nuevo = $l.fl_numero -replace '^LEAD-', 'L'
    Invoke-RestMethod -Uri "$base/fl_leads($($l.fl_leadid))" -Headers $h -Method Patch -Body (@{ fl_numero = $nuevo } | ConvertTo-Json) | Out-Null
}
Write-Host "  [+] Leads renombrados: $($leads.Count)"

$hist = (Invoke-RestMethod -Uri "$base/fl_fasehistoricos?`$select=fl_fasehistoricoid,fl_titulo&`$filter=startswith(fl_titulo,'LEAD-')" -Headers $h).value
foreach ($f in $hist) {
    $nuevo = $f.fl_titulo -replace '^LEAD-', 'L'
    Invoke-RestMethod -Uri "$base/fl_fasehistoricos($($f.fl_fasehistoricoid))" -Headers $h -Method Patch -Body (@{ fl_titulo = $nuevo } | ConvertTo-Json) | Out-Null
}
Write-Host "  [+] Titulos de historico renombrados: $($hist.Count)"

Write-Host "=== Listo ==="
