<#
  Asigna el rol de seguridad "CRM Flotas B2B - Administrador" al usuario real
  conectado (allanos@ebroauto.com), para poder usar y probar la app.
#>
. "$PSScriptRoot\lib.ps1"

$userId = "1df23196-6334-f111-88b4-7ced8d74baf1"  # allanos@ebroauto.com (mismo systemuserid que en PeopleFlow)

$role = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/roles?`$filter=name eq 'CRM Flotas B2B - Administrador'&`$select=roleid" -Headers (Get-DvHeaders)
$roleId = $role.value[0].roleid

$existing = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers($userId)/systemuserroles_association?`$filter=roleid eq $roleId&`$select=roleid" -Headers (Get-DvHeaders)
if ($existing.value.Count -gt 0) {
    Write-Host "[=] Ya asignado"
} else {
    $body = @{ "@odata.id" = "$($script:DvOrgUrl)/api/data/v9.2/roles($roleId)" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers($userId)/systemuserroles_association/`$ref" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null
    Write-Host "[+] Rol Administrador asignado a allanos@ebroauto.com"
}
