<#
  Pasa los leads existentes al modelo Empresa / Oportunidad (ver 17-empresa-oportunidad.ps1).
  Solo rellena columnas nuevas; no toca los datos que ya tenia cada lead. Idempotente:
  los leads que ya tienen empresa se saltan.

  - Una empresa por (concesionario, CIF normalizado). Sus datos salen del lead mas reciente.
  - Estado: Fidelizacion si algun lead esta en esa fase, Cliente si alguno llego a
    Cierre o Entrega, si no Cliente potencial.
  - Oportunidad abierta: el lead mas reciente que siga entre Prospeccion y Negociacion.
  - Comercial: quien creo el lead (fl_creadopor).
  - Las lineas de modelo no se migran: "Modelos de interes" era texto libre con
    familias (S700...) y no se puede saber el modelo exacto. Ese texto se sigue mostrando.
#>
. "$PSScriptRoot\lib.ps1"

$base = "$($script:DvOrgUrl)/api/data/v9.2"
$h = Get-DvHeaders

$FASE_NEGOCIACION = 101000004
$FASE_CIERRE = 101000005
$FASE_ENTREGA = 101000006
$FASE_FIDELIZACION = 101000007
# Ojo: PowerShell no distingue mayusculas; no llamar $estado a ninguna otra variable.
$ESTADOS = @{ Potencial = 101000000; Cliente = 101000001; Fidelizacion = 101000002 }

function Normalize-Cif([string]$Cif) { return ($Cif -replace '[\s\-\.]', '').ToUpperInvariant() }

$select = "fl_leadid,fl_numero,fl_razonsocial,fl_cif,fl_actividadeconomica,fl_nombreresponsable,fl_telefonocorporativo," +
    "fl_emailcorporativo,fl_numvehiculosactuales,fl_marcasactuales,fl_modofinanciacionactual,fl_vencimientocontratosactuales," +
    "fl_faseactual,createdon,_fl_concesionario_value,_fl_creadopor_value,_fl_empresa_value"
$leads = (Invoke-RestMethod -Uri "$base/fl_leads?`$select=$select&`$filter=_fl_empresa_value eq null&`$orderby=createdon desc" -Headers $h).value
Write-Host "Leads sin empresa: $($leads.Count)"

foreach ($grupo in ($leads | Group-Object { "$($_._fl_concesionario_value)|$(Normalize-Cif $_.fl_cif)" })) {
    $reciente = $grupo.Group[0]
    $concesionarioId = $reciente._fl_concesionario_value
    $cif = Normalize-Cif $reciente.fl_cif
    $fases = $grupo.Group | ForEach-Object { $_.fl_faseactual }

    $estado = $ESTADOS.Potencial
    if ($fases -contains $FASE_FIDELIZACION) { $estado = $ESTADOS.Fidelizacion }
    elseif (($fases -contains $FASE_CIERRE) -or ($fases -contains $FASE_ENTREGA)) { $estado = $ESTADOS.Cliente }

    $existente = (Invoke-RestMethod -Uri "$base/fl_empresas?`$select=fl_empresaid&`$filter=fl_cif eq '$cif' and _fl_concesionario_value eq $concesionarioId" -Headers $h).value
    if ($existente.Count -gt 0) {
        $empresaId = $existente[0].fl_empresaid
        Write-Host "  [=] Empresa $cif ya existe"
    } else {
        $fields = @{
            fl_razonsocial                  = $reciente.fl_razonsocial
            fl_cif                          = $cif
            fl_actividadeconomica           = $reciente.fl_actividadeconomica
            fl_nombreresponsable            = $reciente.fl_nombreresponsable
            fl_telefonocorporativo          = $reciente.fl_telefonocorporativo
            fl_emailcorporativo             = $reciente.fl_emailcorporativo
            fl_numvehiculosactuales         = $reciente.fl_numvehiculosactuales
            fl_marcasactuales               = $reciente.fl_marcasactuales
            fl_modofinanciacionactual       = $reciente.fl_modofinanciacionactual
            fl_estado                       = $estado
            "fl_concesionario@odata.bind"   = "/fl_concesionarios($concesionarioId)"
        }
        if ($reciente.fl_vencimientocontratosactuales) {
            $fields.fl_vencimientocontratosactuales = ([datetime]$reciente.fl_vencimientocontratosactuales).ToString("yyyy-MM-dd")
        }
        $empresaId = New-DvRecord -Table "fl_empresa" -Fields $fields
        Write-Host "  [+] Empresa $cif ($($reciente.fl_razonsocial))"
    }

    foreach ($l in $grupo.Group) {
        $body = @{ "fl_empresa@odata.bind" = "/fl_empresas($empresaId)" }
        if ($l._fl_creadopor_value) { $body["fl_comercial@odata.bind"] = "/fl_usuarioapps($($l._fl_creadopor_value))" }
        Invoke-RestMethod -Uri "$base/fl_leads($($l.fl_leadid))" -Headers $h -Method Patch -Body ($body | ConvertTo-Json) | Out-Null
    }

    $abierta = $grupo.Group | Where-Object { $_.fl_faseactual -le $FASE_NEGOCIACION } | Select-Object -First 1
    if ($abierta) {
        $body = @{ "fl_oportunidadabierta@odata.bind" = "/fl_leads($($abierta.fl_leadid))" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/fl_empresas($empresaId)" -Headers $h -Method Patch -Body $body | Out-Null
    }
}

Write-Host "=== Listo ==="
