<#
  Funciones genericas para crear tablas y columnas de Dataverse via Web API,
  dentro de la solucion "CRMFlotasB2B". Idempotentes: si la tabla/columna ya
  existe, se omite en vez de fallar. (Adaptado del mismo helper de PeopleFlow.)
#>

. "$PSScriptRoot\auth.ps1"

$ErrorActionPreference = "Stop"

$script:SolutionUniqueName = "CRMFlotasB2B"
$script:LangCode = 3082  # idioma base real de este entorno (espanol - Espana)

function Get-DvHeaders([switch]$WithSolution) {
    Get-DataverseHeaders -WithSolution:$WithSolution -SolutionUniqueName $script:SolutionUniqueName
}

function DvLabel([string]$Text) {
    return @{
        "@odata.type"    = "Microsoft.Dynamics.CRM.Label"
        LocalizedLabels  = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $Text; LanguageCode = $script:LangCode })
    }
}

function Test-DvTableExists([string]$LogicalName) {
    try {
        Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$LogicalName')?`$select=LogicalName" -Headers (Get-DvHeaders) -Method Get -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Test-DvColumnExists([string]$EntityLogicalName, [string]$ColumnLogicalName) {
    try {
        Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$EntityLogicalName')/Attributes(LogicalName='$ColumnLogicalName')?`$select=LogicalName" -Headers (Get-DvHeaders) -Method Get -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function New-DvTable {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$DisplayName,
        [Parameter(Mandatory)][string]$DisplayCollectionName,
        [string]$PrimaryColumnName = "$Name" + "_titulo",
        [string]$PrimaryColumnLabel = "Titulo",
        [string]$Ownership = "UserOwned",
        [switch]$AutoNumber,
        [string]$AutoNumberFormat
    )
    if (Test-DvTableExists $Name) {
        Write-Host "  [=] Tabla $Name ya existe"
        return
    }
    $primaryAttr = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName    = $PrimaryColumnName
        DisplayName   = DvLabel $PrimaryColumnLabel
        RequiredLevel = @{ Value = "None"; CanBeChanged = $true }
        MaxLength     = 200
        FormatName    = @{ Value = "Text" }
        IsPrimaryName = $true
    }
    if ($AutoNumber) {
        $primaryAttr["AutoNumberFormat"] = $AutoNumberFormat
    }
    $body = @{
        "@odata.type"          = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName             = $Name
        DisplayName            = DvLabel $DisplayName
        DisplayCollectionName  = DvLabel $DisplayCollectionName
        OwnershipType          = $Ownership
        IsActivity             = $false
        HasNotes               = $false
        HasActivities          = $false
        Attributes             = @($primaryAttr)
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "  [+] Tabla $Name creada"
}

function Add-DvStringColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [int]$MaxLength = 200, [string]$Required = "None", [switch]$MultiLine, [string]$AutoNumberFormat)
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        MaxLength     = $MaxLength
        FormatName    = @{ Value = "Text" }
    }
    if ($AutoNumberFormat) { $body["AutoNumberFormat"] = $AutoNumberFormat }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (texto)"
}

function Add-DvMemoColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [int]$MaxLength = 4000, [string]$Required = "None")
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        MaxLength     = $MaxLength
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (texto largo)"
}

function Add-DvIntColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [string]$Required = "None", [int]$Min = -2147483648, [int]$Max = 2147483647)
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        MinValue      = $Min
        MaxValue      = $Max
        Format        = "None"
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (numero)"
}

function Add-DvDecimalColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [string]$Required = "None", [int]$Precision = 2)
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.DecimalAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        Precision     = $Precision
        MinValue      = -100000000000
        MaxValue      = 100000000000
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (decimal)"
}

function Add-DvMoneyColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [string]$Required = "None")
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.MoneyAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        PrecisionSource = 2
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (moneda)"
}

function Add-DvBoolColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [bool]$Default = $false, [string]$TrueLabel = "Si", [string]$FalseLabel = "No")
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = "None"; CanBeChanged = $true }
        DefaultValue  = $Default
        OptionSet     = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"
            TrueOption    = @{ Value = 1; Label = DvLabel $TrueLabel }
            FalseOption   = @{ Value = 0; Label = DvLabel $FalseLabel }
        }
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (si/no)"
}

function Add-DvDateColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [string]$Required = "None", [string]$Behavior = "UserLocal", [string]$Format = "DateAndTime")
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type"  = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
        SchemaName     = $Name
        DisplayName    = DvLabel $Label
        RequiredLevel  = @{ Value = $Required; CanBeChanged = $true }
        Format         = $Format
        DateTimeBehavior = @{ Value = $Behavior }
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (fecha)"
}

function Add-DvChoiceColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [string[]]$Options, [string]$Required = "None", [int]$DefaultValue = -1)
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $optionMetas = @()
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $optionMetas += @{ Value = 101000000 + $i; Label = DvLabel $Options[$i] }
    }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        OptionSet     = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.OptionSetMetadata"
            IsGlobal      = $false
            OptionSetType = "Picklist"
            Options       = $optionMetas
        }
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (opcion: $($Options -join ', '))"
}

function Add-DvFileColumn {
    param([string]$Entity, [string]$Name, [string]$Label, [int]$MaxSizeKB = 10240)
    if (Test-DvColumnExists $Entity $Name) { Write-Host "    [=] $Name ya existe"; return }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.FileAttributeMetadata"
        SchemaName    = $Name
        DisplayName   = DvLabel $Label
        RequiredLevel = @{ Value = "None"; CanBeChanged = $true }
        MaxSizeInKB   = $MaxSizeKB
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Entity')/Attributes" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $Name (archivo)"
}

# Business Unit raiz de cada entorno (los roles de la app se crean y se buscan en ella).
$script:DvRootBusinessUnitId = if ($env:DV_ENTORNO -eq "prod") { "7851e1e5-78d5-f111-a05b-7ced8d5944d2" } else { "23eb3196-6334-f111-88b4-7ced8d74baf1" }
$script:DvPrivilegeIdCache = @{}

function New-DvRole {
    param([Parameter(Mandatory)][string]$Name)
    $existing = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/roles?`$filter=name eq '$Name' and _businessunitid_value eq $($script:DvRootBusinessUnitId)&`$select=roleid" -Headers (Get-DvHeaders)
    if ($existing.value.Count -gt 0) {
        Write-Host "  [=] Rol $Name ya existe"
        return $existing.value[0].roleid
    }
    $body = @{
        name = $Name
        "businessunitid@odata.bind" = "/businessunits($($script:DvRootBusinessUnitId))"
    } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$($script:DvOrgUrl)/api/data/v9.2/roles" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $body -UseBasicParsing
    $roleId = ($resp.Headers["OData-EntityId"] -replace ".*roles\(([0-9a-fA-F-]+)\).*", '$1')
    Write-Host "  [+] Rol $Name creado"
    return $roleId
}

function Get-DvPrivilegeId([string]$Action, [string]$Table) {
    $key = "$Action$Table"
    if ($script:DvPrivilegeIdCache.ContainsKey($key)) { return $script:DvPrivilegeIdCache[$key] }
    $name = "prv$Action$Table"
    $r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/privileges?`$filter=name eq '$name'&`$select=privilegeid" -Headers (Get-DvHeaders)
    if ($r.value.Count -eq 0) { throw "No se encontro el privilegio $name" }
    $privId = $r.value[0].privilegeid
    $script:DvPrivilegeIdCache[$key] = $privId
    return $privId
}

function Grant-DvTablePrivileges {
    param(
        [Parameter(Mandatory)][string]$RoleId,
        [Parameter(Mandatory)][string]$Table,
        [Parameter(Mandatory)][string[]]$Actions,
        [Parameter(Mandatory)][ValidateSet("Basic","Local","Deep","Global")][string]$Depth
    )
    $privs = @()
    foreach ($a in $Actions) {
        $privId = Get-DvPrivilegeId -Action $a -Table $Table
        $privs += @{ PrivilegeId = $privId; Depth = $Depth }
    }
    $body = @{ Privileges = $privs } | ConvertTo-Json -Depth 6
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/roles($RoleId)/Microsoft.Dynamics.CRM.AddPrivilegesRole" -Headers (Get-DvHeaders) -Method Post -Body $body | Out-Null
    Write-Host "    [+] $Table -> $($Actions -join ',') @ $Depth"
}

$script:DvEntitySetCache = @{}

function Get-DvEntitySet([string]$Table) {
    if ($script:DvEntitySetCache.ContainsKey($Table)) { return $script:DvEntitySetCache[$Table] }
    $e = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/EntityDefinitions(LogicalName='$Table')?`$select=EntitySetName" -Headers (Get-DvHeaders)
    $script:DvEntitySetCache[$Table] = $e.EntitySetName
    return $e.EntitySetName
}

function New-DvRecord([string]$Table, [hashtable]$Fields) {
    $set = Get-DvEntitySet $Table
    $json = $Fields | ConvertTo-Json -Depth 8
    $resp = Invoke-WebRequest -Uri "$($script:DvOrgUrl)/api/data/v9.2/$set" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json -UseBasicParsing
    $id = ($resp.Headers["OData-EntityId"] -replace ".*\(([0-9a-fA-F-]+)\).*", '$1')
    return $id
}

function DvLookupBind([string]$LookupSchemaName, [string]$TargetTable, [string]$TargetId) {
    $set = Get-DvEntitySet $TargetTable
    return "/$set($TargetId)"
}

function Ensure-DvRecord([string]$Table, [string]$KeyField, [string]$KeyValue, [hashtable]$Fields, [string]$IdField) {
    $set = Get-DvEntitySet $Table
    if (-not $IdField) { $IdField = "$($Table)id" }
    $escaped = $KeyValue -replace "'", "''"
    $r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${set}?`$filter=$KeyField eq '$escaped'&`$select=$IdField" -Headers (Get-DvHeaders)
    if ($r.value.Count -gt 0) {
        return $r.value[0].$IdField
    }
    $allFields = $Fields.Clone()
    $allFields[$KeyField] = $KeyValue
    $id = New-DvRecord -Table $Table -Fields $allFields
    Write-Host "  [+] $Table : $KeyValue"
    return $id
}

function New-DvLookup {
    param(
        [Parameter(Mandatory)][string]$SchemaName,
        [Parameter(Mandatory)][string]$ReferencingEntity,
        [Parameter(Mandatory)][string]$ReferencedEntity,
        [Parameter(Mandatory)][string]$Label,
        [string]$Required = "None",
        [string]$RelationshipSchemaName
    )
    if (Test-DvColumnExists $ReferencingEntity $SchemaName) { Write-Host "    [=] $SchemaName (lookup) ya existe"; return }
    if (-not $RelationshipSchemaName) { $RelationshipSchemaName = "$($ReferencingEntity)_$($SchemaName)" }
    $body = @{
        "@odata.type"         = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
        SchemaName            = $RelationshipSchemaName
        ReferencedEntity      = $ReferencedEntity
        ReferencingEntity     = $ReferencingEntity
        Lookup                = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
            SchemaName    = $SchemaName
            DisplayName   = DvLabel $Label
            RequiredLevel = @{ Value = $Required; CanBeChanged = $true }
        }
        AssociatedMenuConfiguration = @{ Behavior = "DoNotDisplay" }
    }
    $json = $body | ConvertTo-Json -Depth 12
    Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/RelationshipDefinitions" -Headers (Get-DvHeaders -WithSolution) -Method Post -Body $json | Out-Null
    Write-Host "    [+] $SchemaName (lookup -> $ReferencedEntity)"
}
