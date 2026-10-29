<#
  Reestructuracion Empresa / Oportunidad (acordada el 28/10/2026). Solo añade,
  no borra ni cambia columnas existentes. Idempotente.

  - fl_empresa: el cliente, una por CIF dentro de cada concesionario. Guarda los
    datos que no cambian de una venta a otra (razon social, sector, contactos,
    flota actual). Los concesionarios la leen y editan a nivel Global porque los
    leads son de cada comercial (Basic) y la empresa la comparten los
    comerciales del mismo concesionario; la app filtra por concesionario.
  - fl_lead pasa a ser la Oportunidad: se le añade la empresa y el comercial
    (lookup a fl_usuarioapp, antes solo texto).
  - fl_empresa.fl_oportunidadabierta: la oportunidad en curso de esa empresa.
    Sirve para avisar de duplicados aunque la oportunidad sea de otro
    comercial (que no se puede leer con seguridad Basic).
  - fl_lineaoportunidad: modelo del catalogo + cantidad por oportunidad.
  - Cascada de asignacion: al reasignar una oportunidad a otro comercial, su
    historico de fases, sus tareas y sus lineas pasan con ella.
#>
. "$PSScriptRoot\lib.ps1"

Write-Host "--- fl_empresa ---"
New-DvTable -Name "fl_empresa" -DisplayName "Empresa" -DisplayCollectionName "Empresas" -PrimaryColumnName "fl_razonsocial" -PrimaryColumnLabel "Razon Social / Nombre comercial"
Add-DvStringColumn -Entity "fl_empresa" -Name "fl_cif" -Label "CIF / NIF" -MaxLength 20 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_empresa" -Name "fl_actividadeconomica" -Label "Actividad economica (Sector CNAE)" -MaxLength 150
Add-DvStringColumn -Entity "fl_empresa" -Name "fl_nombreresponsable" -Label "Nombre responsable empresa" -MaxLength 200
Add-DvStringColumn -Entity "fl_empresa" -Name "fl_telefonocorporativo" -Label "Telefono corporativo" -MaxLength 30
Add-DvStringColumn -Entity "fl_empresa" -Name "fl_emailcorporativo" -Label "E-mail corporativo" -MaxLength 200
Add-DvIntColumn -Entity "fl_empresa" -Name "fl_numvehiculosactuales" -Label "Nº vehiculos actuales" -Min 0 -Max 100000
Add-DvStringColumn -Entity "fl_empresa" -Name "fl_marcasactuales" -Label "Marcas actuales" -MaxLength 300
# Mismas opciones y mismo orden que fl_lead.fl_modofinanciacionactual, para que los valores coincidan.
Add-DvChoiceColumn -Entity "fl_empresa" -Name "fl_modofinanciacionactual" -Label "Modo de financiacion actual" -Options @("Renting","Leasing","Compra financiada","Compra al contado","Otro")
Add-DvDateColumn -Entity "fl_empresa" -Name "fl_vencimientocontratosactuales" -Label "Vencimiento contratos actuales" -Format "DateOnly"
Add-DvChoiceColumn -Entity "fl_empresa" -Name "fl_estado" -Label "Estado" -Options @("Cliente potencial","Cliente","Fidelizacion")
New-DvLookup -ReferencingEntity "fl_empresa" -SchemaName "fl_concesionario" -ReferencedEntity "fl_concesionario" -Label "Concesionario" -Required "ApplicationRequired"

Write-Host "--- fl_lead (oportunidad) ---"
New-DvLookup -ReferencingEntity "fl_lead" -SchemaName "fl_empresa" -ReferencedEntity "fl_empresa" -Label "Empresa"
New-DvLookup -ReferencingEntity "fl_lead" -SchemaName "fl_comercial" -ReferencedEntity "fl_usuarioapp" -Label "Comercial"
New-DvLookup -ReferencingEntity "fl_empresa" -SchemaName "fl_oportunidadabierta" -ReferencedEntity "fl_lead" -Label "Oportunidad abierta"

Write-Host "--- fl_lineaoportunidad ---"
New-DvTable -Name "fl_lineaoportunidad" -DisplayName "Linea de oportunidad" -DisplayCollectionName "Lineas de oportunidad" -PrimaryColumnName "fl_titulo" -PrimaryColumnLabel "Titulo"
Add-DvIntColumn -Entity "fl_lineaoportunidad" -Name "fl_cantidad" -Label "Cantidad" -Required "ApplicationRequired" -Min 1 -Max 100000
New-DvLookup -ReferencingEntity "fl_lineaoportunidad" -SchemaName "fl_lead" -ReferencedEntity "fl_lead" -Label "Oportunidad" -Required "ApplicationRequired"
New-DvLookup -ReferencingEntity "fl_lineaoportunidad" -SchemaName "fl_modelo" -ReferencedEntity "fl_modelo" -Label "Modelo" -Required "ApplicationRequired"

Write-Host "--- Cascada de asignacion desde fl_lead ---"
foreach ($rel in @("fl_fasehistorico_fl_lead", "fl_tarea_fl_lead", "fl_lineaoportunidad_fl_lead")) {
    $uri = "$($script:DvOrgUrl)/api/data/v9.2/RelationshipDefinitions(SchemaName='$rel')/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
    $meta = Invoke-RestMethod -Uri $uri -Headers (Get-DvHeaders)
    if ($meta.CascadeConfiguration.Assign -eq "Cascade") { Write-Host "    [=] $rel ya cascadea la asignacion"; continue }
    $meta.CascadeConfiguration.Assign = "Cascade"
    $meta.CascadeConfiguration.Share = "Cascade"
    $meta.CascadeConfiguration.Unshare = "Cascade"
    $meta.PSObject.Properties.Remove("@odata.context")
    $meta | Add-Member -NotePropertyName "@odata.type" -NotePropertyValue "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata" -Force
    $headers = Get-DvHeaders -WithSolution
    $headers["MSCRM.MergeLabels"] = "true"
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/RelationshipDefinitions($($meta.MetadataId))" -Headers $headers -Method Put -Body ($meta | ConvertTo-Json -Depth 12) | Out-Null
    Write-Host "    [+] $rel -> asignacion en cascada"
}

Write-Host "--- Privilegios ---"
$APPEND = @("Append","AppendTo")
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")

$rConcesionario = New-DvRole -Name "CRM Flotas B2B - Concesionario"
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "fl_empresa" -Actions @("Create","Read","Write") -Depth "Global"
Grant-DvTablePrivileges -RoleId $rConcesionario -Table "fl_lineaoportunidad" -Actions @("Create","Read","Write","Delete") -Depth "Basic"
# Para pasar la oportunidad (y en cascada lo que cuelga de ella) al comercial elegido.
foreach ($t in @("fl_lead","fl_fasehistorico","fl_tarea","fl_lineaoportunidad")) {
    Grant-DvTablePrivileges -RoleId $rConcesionario -Table $t -Actions @("Assign") -Depth "Basic"
}

$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_empresa" -Actions @("Read") -Depth "Global"
Grant-DvTablePrivileges -RoleId $rVentas -Table "fl_lineaoportunidad" -Actions @("Read") -Depth "Global"

foreach ($r in @($rConcesionario, $rVentas)) {
    foreach ($t in @("fl_empresa","fl_lineaoportunidad")) {
        Grant-DvTablePrivileges -RoleId $r -Table $t -Actions $APPEND -Depth "Global"
    }
}

$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
foreach ($t in @("fl_empresa","fl_lineaoportunidad")) {
    Grant-DvTablePrivileges -RoleId $rAdmin -Table $t -Actions $FULL -Depth "Global"
}

Write-Host "=== Listo ==="
