<#
  Quita la fase "8. Fidelizacion" (decidido el 28/10/2026): la ultima fase pasa a ser
  "7. Entrega". Idempotente; se puede relanzar tras publicar por si la app anterior
  dejo algun lead en Fidelizacion.

  - Leads en Fidelizacion -> Entrega. Se borra su fila de historico de Fidelizacion y
    se reabre la ultima de Entrega (si no la hay, la de Fidelizacion pasa a Entrega).
  - La opcion se deja en la columna de Dataverse (no se borra) pero la app ya no la ofrece.
  - Recalcula el estado de cada empresa: Cliente si alguna oportunidad esta en Cierre
    o Entrega, si no Cliente potencial. Corrige de paso el estado vacio que dejo
    18-migrar-empresas.ps1 en su primera ejecucion.
#>
. "$PSScriptRoot\lib.ps1"

$base = "$($script:DvOrgUrl)/api/data/v9.2"
$h = Get-DvHeaders

$FASE_CIERRE = 101000005
$FASE_ENTREGA = 101000006
$FASE_FIDELIZACION = 101000007
$ESTADO_POTENCIAL = 101000000
$ESTADO_CLIENTE = 101000001

$leads = (Invoke-RestMethod -Uri "$base/fl_leads?`$select=fl_leadid,fl_numero&`$filter=fl_faseactual eq $FASE_FIDELIZACION" -Headers $h).value
Write-Host "Leads en Fidelizacion: $($leads.Count)"
foreach ($l in $leads) {
    $hist = (Invoke-RestMethod -Uri "$base/fl_fasehistoricos?`$select=fl_fasehistoricoid,fl_fase&`$filter=_fl_lead_value eq $($l.fl_leadid)&`$orderby=fl_fechainicio desc" -Headers $h).value
    $fidel = @($hist | Where-Object { $_.fl_fase -eq $FASE_FIDELIZACION })
    $entrega = $hist | Where-Object { $_.fl_fase -eq $FASE_ENTREGA } | Select-Object -First 1
    if ($entrega) {
        foreach ($f in $fidel) { Invoke-RestMethod -Uri "$base/fl_fasehistoricos($($f.fl_fasehistoricoid))" -Headers $h -Method Delete | Out-Null }
        $body = @{ fl_fechafin = $null; fl_esactual = $true; fl_diasenfase = $null } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/fl_fasehistoricos($($entrega.fl_fasehistoricoid))" -Headers $h -Method Patch -Body $body | Out-Null
    } else {
        foreach ($f in $fidel) {
            $body = @{ fl_fase = $FASE_ENTREGA; fl_titulo = "$($l.fl_numero) — Entrega" } | ConvertTo-Json
            Invoke-RestMethod -Uri "$base/fl_fasehistoricos($($f.fl_fasehistoricoid))" -Headers $h -Method Patch -Body $body | Out-Null
        }
    }
    Invoke-RestMethod -Uri "$base/fl_leads($($l.fl_leadid))" -Headers $h -Method Patch -Body (@{ fl_faseactual = $FASE_ENTREGA } | ConvertTo-Json) | Out-Null
    Write-Host "  [+] $($l.fl_numero) -> Entrega"
}

Write-Host "--- Estado de las empresas ---"
$conVenta = (Invoke-RestMethod -Uri "$base/fl_leads?`$select=_fl_empresa_value&`$filter=fl_faseactual eq $FASE_CIERRE or fl_faseactual eq $FASE_ENTREGA" -Headers $h).value |
    ForEach-Object { $_._fl_empresa_value } | Where-Object { $_ } | Sort-Object -Unique
$empresas = (Invoke-RestMethod -Uri "$base/fl_empresas?`$select=fl_empresaid,fl_estado" -Headers $h).value
foreach ($e in $empresas) {
    $estado = if ($conVenta -contains $e.fl_empresaid) { $ESTADO_CLIENTE } else { $ESTADO_POTENCIAL }
    if ($e.fl_estado -eq $estado) { continue }
    Invoke-RestMethod -Uri "$base/fl_empresas($($e.fl_empresaid))" -Headers $h -Method Patch -Body (@{ fl_estado = $estado } | ConvertTo-Json) | Out-Null
}
$clientes = @($empresas | Where-Object { $conVenta -contains $_.fl_empresaid }).Count
Write-Host "  Clientes: $clientes · Clientes potenciales: $($empresas.Count - $clientes)"

Write-Host "=== Listo ==="
