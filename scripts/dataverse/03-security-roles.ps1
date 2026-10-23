<#
  Crea los 3 roles de seguridad de CRM Flotas B2B con privilegios reales por tabla.
  Idempotente (AddPrivilegesRole es aditivo/actualiza si ya existe).
#>
. "$PSScriptRoot\lib.ps1"

$ALL_TABLES = @("fl_concesionario","fl_ubicacion","fl_usuarioapp","fl_lead","fl_fasehistorico")
$CATALOGS = @("fl_concesionario","fl_ubicacion","fl_usuarioapp")
$FULL = @("Create","Read","Write","Delete","Append","AppendTo","Assign","Share")

# Append/AppendTo son necesarios para vincular registros via @odata.bind
# (ej. un lead con su ubicacion/concesionario/creador, un historico de fase
# con su lead). Se concede en todas las tablas a los roles no administradores,
# igual que en PeopleFlow.
$APPEND_ALL = ($ALL_TABLES | ForEach-Object { @{ Table=$_; Actions=@("Append","AppendTo"); Depth="Global" } })

function Grant-Role([string]$RoleId, [hashtable[]]$Grants) {
    foreach ($g in $Grants) {
        Grant-DvTablePrivileges -RoleId $RoleId -Table $g.Table -Actions $g.Actions -Depth $g.Depth
    }
}

Write-Host "--- Concesionario ---"
$rConcesionario = New-DvRole -Name "CRM Flotas B2B - Concesionario"
Grant-Role $rConcesionario (
    @(
        @{ Table="fl_lead"; Actions=@("Create","Read","Write"); Depth="Basic" }
        @{ Table="fl_fasehistorico"; Actions=@("Create","Read","Write"); Depth="Basic" }
    ) + ($CATALOGS | ForEach-Object { @{ Table=$_; Actions=@("Read"); Depth="Global" } }) + $APPEND_ALL
)

Write-Host "--- Equipo de Ventas ---"
$rVentas = New-DvRole -Name "CRM Flotas B2B - Equipo de Ventas"
Grant-Role $rVentas (
    @(
        @{ Table="fl_lead"; Actions=@("Read"); Depth="Global" }
        @{ Table="fl_fasehistorico"; Actions=@("Read"); Depth="Global" }
    ) + ($CATALOGS | ForEach-Object { @{ Table=$_; Actions=@("Read"); Depth="Global" } }) + $APPEND_ALL
)

Write-Host "--- Administrador ---"
$rAdmin = New-DvRole -Name "CRM Flotas B2B - Administrador"
Grant-Role $rAdmin ($ALL_TABLES | ForEach-Object { @{ Table=$_; Actions=$FULL; Depth="Global" } })

Write-Host "=== Listo ==="
Write-Host "Concesionario=$rConcesionario Ventas=$rVentas Administrador=$rAdmin"
