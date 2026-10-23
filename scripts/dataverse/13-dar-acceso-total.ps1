<#
  Da acceso total (rol Administrador) en CRM Flotas B2B a ext.Alhida Llanos
  (ext.allanos@ebroauto.com), tanto el rol de seguridad de Dataverse (CRUD
  global en todas las tablas fl_*) como su perfil fl_usuarioapp. Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

$userId = "c1e31c92-6eab-f111-aaac-000d3a675a2e"  # ext.allanos@ebroauto.com (ext.Alhida Llanos)
$correo = "ext.allanos@ebroauto.com"

Write-Host "--- Rol de seguridad Dataverse ---"
$role = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/roles?`$filter=name eq 'CRM Flotas B2B - Administrador'&`$select=roleid" -Headers (Get-DvHeaders)
$roleId = $role.value[0].roleid

$existing = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers($userId)/systemuserroles_association?`$filter=roleid eq $roleId&`$select=roleid" -Headers (Get-DvHeaders)
if ($existing.value.Count -gt 0) {
    Write-Host "[=] Ya tenia el rol Administrador"
} else {
    $body = @{ "@odata.id" = "$($script:DvOrgUrl)/api/data/v9.2/roles($roleId)" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/systemusers($userId)/systemuserroles_association/`$ref" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null
    Write-Host "[+] Rol Administrador asignado a $correo"
}

Write-Host "--- Perfil fl_usuarioapp ---"
Ensure-DvRecord -Table "fl_usuarioapp" -KeyField "fl_correo" -KeyValue $correo -Fields @{
    fl_nombre = "Alhida Llanos"
    fl_rol = 101000002
    fl_activo = $true
    "fl_systemuserid@odata.bind" = "/systemusers($userId)"
}

Write-Host "=== Listo ==="
