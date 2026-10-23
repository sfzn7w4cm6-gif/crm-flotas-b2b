<#
  Asigna los roles de entorno "Environment Maker" y "System Customizer" a
  ext.allanos@ebroauto.com, para que pueda usar Power Apps Studio / pac CLI
  y publicar ella misma Code Apps en este entorno. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

$userId = "c1e31c92-6eab-f111-aaac-000d3a675a2e"  # ext.allanos@ebroauto.com (ext.Alhida Llanos)
$correo = "ext.allanos@ebroauto.com"
$nombresRol = @("Environment Maker", "System Customizer")

foreach ($nombreRol in $nombresRol) {
    $role = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/roles?`$filter=name eq '$nombreRol'&`$select=roleid" -Headers (Get-DvHeaders)
    if ($role.value.Count -eq 0) { Write-Host "[!] Rol no encontrado: $nombreRol"; continue }
    $roleId = $role.value[0].roleid

    $existing = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers($userId)/systemuserroles_association?`$filter=roleid eq $roleId&`$select=roleid" -Headers (Get-DvHeaders)
    if ($existing.value.Count -gt 0) {
        Write-Host "[=] $correo ya tenia el rol '$nombreRol'"
    } else {
        $body = @{ "@odata.id" = "$($script:DvOrgUrl)/api/data/v9.2/roles($roleId)" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers($userId)/systemuserroles_association/`$ref" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null
        Write-Host "[+] Rol '$nombreRol' asignado a $correo"
    }
}

Write-Host "=== Listo ==="
