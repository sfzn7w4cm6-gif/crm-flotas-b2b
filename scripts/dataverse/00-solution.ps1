<#
  Crea el publisher y la solucion "CRMFlotasB2B" que albergaran todas las
  tablas y roles de la app. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

$publisherUniqueName = "crmflotasb2b"
$prefix = "fl"

$existing = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/publishers?`$filter=uniquename eq '$publisherUniqueName'&`$select=publisherid" -Headers (Get-DvHeaders)
if ($existing.value.Count -gt 0) {
    $publisherId = $existing.value[0].publisherid
    Write-Host "[=] Publisher ya existe: $publisherId"
} else {
    $body = @{
        uniquename = $publisherUniqueName
        friendlyname = "CRM Flotas B2B"
        description = "Publisher de la app CRM Flotas B2B (leads de venta de flotas a empresas), creada con Claude Code"
        customizationprefix = $prefix
        customizationoptionvalueprefix = 79500
    } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$($script:DvOrgUrl)/api/data/v9.2/publishers" -Headers (Get-DvHeaders) -Method Post -Body $body -UseBasicParsing
    $publisherId = ($resp.Headers["OData-EntityId"] -replace ".*publishers\(([0-9a-fA-F-]+)\).*", '$1')
    Write-Host "[+] Publisher creado: $publisherId"
}

$existingSol = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/solutions?`$filter=uniquename eq 'CRMFlotasB2B'&`$select=solutionid" -Headers (Get-DvHeaders)
if ($existingSol.value.Count -gt 0) {
    Write-Host "[=] Solucion CRMFlotasB2B ya existe: $($existingSol.value[0].solutionid)"
} else {
    $body = @{
        uniquename = "CRMFlotasB2B"
        friendlyname = "CRM Flotas B2B"
        description = "CRM de leads B2B para la red de concesionarios EBRO: alta y seguimiento de oportunidades de venta de flotas."
        version = "1.0.0.0"
        "publisherid@odata.bind" = "/publishers($publisherId)"
    } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$($script:DvOrgUrl)/api/data/v9.2/solutions" -Headers (Get-DvHeaders) -Method Post -Body $body -UseBasicParsing
    $solutionId = ($resp.Headers["OData-EntityId"] -replace ".*solutions\(([0-9a-fA-F-]+)\).*", '$1')
    Write-Host "[+] Solucion CRMFlotasB2B creada: $solutionId"
}
