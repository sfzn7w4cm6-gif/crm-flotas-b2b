<#
  Genera leads de ejemplo repartidos entre las 5 ubicaciones, en distintas
  fases (incluyendo algunos "Perdido" y algunos estancados), con su
  historico de fase realista, para poder ver los dashboards poblados.
  No es idempotente por clave de negocio (cada ejecucion añade leads nuevos);
  pensado para ejecutarse una sola vez sobre datos de demo.
#>
. "$PSScriptRoot\lib.ps1"

# ---------- Catalogos de datos de ejemplo ----------
$EMPRESA_PREFIJOS = @("Transportes","Logística","Distribuciones","Construcciones","Talleres","Grupo","Servicios","Suministros","Comercial","Industrias","Hostelería","Agroalimentaria")
$EMPRESA_SUFIJOS = @("del Norte","Ibérica","Peninsular","Hermanos García","del Ebro","Mediterráneo","Atlántico","del Centro","del Sur","Aragón","de Levante","Castilla","Pirineos","Duero","del Valle")
$SECTORES = @("Transporte","Construcción","Distribución","Servicios","Sanidad","Hostelería","Tecnología","Inmobiliario","Industria","Comercio minorista","Agroalimentario","Logística")
$MARCAS = @("Ford","Mercedes","Renault","Volkswagen","Varias marcas","Peugeot","Fiat","Citroën")
$MODELOS = @("furgonetas medianas","SUV compactos","berlinas ejecutivas","furgones de carga","turismos compactos","vehículos mixtos")
$REQUISITOS = @("Etiqueta ECO obligatoria","Flota 100% eléctrica a medio plazo","Sin requisitos especiales","Preferencia por bajo consumo","Política de renovación cada 4 años","Necesitan GPS de flota integrado")
$COMPETIDORES = @("Ninguno detectado","Ford","Renault","Volkswagen","Competencia local","Leaseplan","Arval")
$NOMBRES = @("Javier","María","Carlos","Ana","Luis","Sara","Roberto","Elena","Pedro","Marta","Antonio","Laura","Manuel","Cristina","Alejandro","Isabel")
$APELLIDOS = @("García","Pérez","López","Fernández","Martínez","Sánchez","Gómez","Ruiz","Díaz","Moreno","Álvarez","Romero","Navarro","Torres","Vidal")
$ACCIONES = @("Llamada de seguimiento","Visita de diagnóstico","Enviar propuesta actualizada","Reunión de condiciones","Prueba de vehículo","Firma de pedido","Coordinar entrega","Revisión anual de flota","Enviar documentación financiera")
$NOTAS = @("Cliente muy interesado, decide rápido.","A la espera de aprobación interna del cliente.","Comparando con otra oferta de renting.","Flota en plena renovación por crecimiento.","Relación de confianza desde hace años.","Primera toma de contacto, aún explorando opciones.")

function Rand($arr) { $arr[(Get-Random -Minimum 0 -Maximum $arr.Count)] }
function RandInt($min, $max) { Get-Random -Minimum $min -Maximum ($max + 1) }

$FIN_VALUES = @(101000000,101000001,101000002,101000003,101000004) # Renting,Leasing,CompraFinanciada,CompraContado,Otro
$PLAZO_VALUES = @(101000000,101000001,101000002,101000003)
$FASE_VALUES = @(101000000,101000001,101000002,101000003,101000004,101000005,101000006,101000007) # 1..8 activas
$FASE_PERDIDO = 101000008
$FASE_LABELS = @{
    101000000="Prospección"; 101000001="Primer Contacto"; 101000002="Cualificación"; 101000003="Propuesta"
    101000004="Negociación"; 101000005="Cierre"; 101000006="Entrega"; 101000007="Fidelización"; 101000008="Perdido"
}

# ---------- Ubicaciones y sus usuarios de demo (creadopor) ----------
$ubiSet = Get-DvEntitySet "fl_ubicacion"
$nombresUbicacion = @("M Automocion Barcelona","M Automocion Madrid","Norte Motor Bilbao","Norte Motor Valencia","Auto Zaragoza")
$ubicaciones = @()
foreach ($nombre in $nombresUbicacion) {
    $r = Invoke-RestMethod -Uri "$($script:DvOrgUrl)/api/data/v9.2/${ubiSet}?`$filter=fl_nombre eq '$nombre'&`$select=fl_ubicacionid,_fl_concesionario_value" -Headers (Get-DvHeaders)
    if ($r.value.Count -eq 0) { throw "No se encontro la ubicacion $nombre" }
    $ubicaciones += [pscustomobject]@{ Nombre = $nombre; Id = $r.value[0].fl_ubicacionid; ConcesionarioId = $r.value[0]._fl_concesionario_value }
}

Write-Host "--- Perfiles de concesionario de demo (uno por ubicacion) ---"
$creadorPorUbicacion = @{}
foreach ($ubi in $ubicaciones) {
    $nombreComercial = "$(Rand $NOMBRES) $(Rand $APELLIDOS)"
    $correo = "demo." + ($ubi.Nombre -replace ' ','.').ToLower() + "@example.com"
    $usrId = Ensure-DvRecord -Table "fl_usuarioapp" -KeyField "fl_correo" -KeyValue $correo -Fields @{
        fl_nombre = $nombreComercial
        fl_rol = 101000000  # Concesionario
        fl_activo = $true
        "fl_ubicacion@odata.bind" = (DvLookupBind "fl_ubicacion" "fl_ubicacion" $ubi.Id)
    }
    $creadorPorUbicacion[$ubi.Nombre] = [pscustomobject]@{ Id = $usrId; Nombre = $nombreComercial }
}

# ---------- Generacion de leads ----------
# distribucion aproximada tipo embudo + unos cuantos perdidos
$planFases = @()
$planFases += @(101000000) * 8   # Prospeccion
$planFases += @(101000001) * 6   # Primer Contacto
$planFases += @(101000002) * 6   # Cualificacion
$planFases += @(101000003) * 5   # Propuesta
$planFases += @(101000004) * 4   # Negociacion
$planFases += @(101000005) * 4   # Cierre
$planFases += @(101000006) * 3   # Entrega
$planFases += @(101000007) * 2   # Fidelizacion
$planFases += @($FASE_PERDIDO) * 4

$idxEstancados = @(0,1,2,5,8,11) # posiciones (dentro de planFases) que se marcan como estancadas

Write-Host "--- Creando $($planFases.Count) leads de ejemplo ---"
$leadCount = 0
for ($i = 0; $i -lt $planFases.Count; $i++) {
    $targetFase = $planFases[$i]
    $ubi = $ubicaciones[$i % $ubicaciones.Count]
    $creador = $creadorPorUbicacion[$ubi.Nombre]

    $empresa = "$(Rand $EMPRESA_PREFIJOS) $(Rand $EMPRESA_SUFIJOS) S.L."
    $cif = "B" + (RandInt 10000000 99999999)
    $sector = Rand $SECTORES
    $responsable = "$(Rand $NOMBRES) $(Rand $APELLIDOS)"
    $telefono = "6" + (RandInt 10000000 99999999)
    $email = ($responsable -replace ' ','.').ToLower() + "@example.com"
    $numVehActuales = RandInt 3 40
    $numVehRenovar = RandInt 2 25
    $marcas = Rand $MARCAS
    $financiacion = Rand $FIN_VALUES
    $plazo = Rand $PLAZO_VALUES
    $cuotas = RandInt 150 900
    $modelos = Rand $MODELOS
    $competidores = Rand $COMPETIDORES
    $requisitos = Rand $REQUISITOS
    $km = "$(RandInt 15 60).000 km/año aprox."
    $accion = Rand $ACCIONES
    $notas = Rand $NOTAS

    $esPerdido = ($targetFase -eq $FASE_PERDIDO)
    $esEstancado = $idxEstancados -contains $i

    # ---- construir el camino de fases (duraciones aleatorias por fase) ----
    if ($esPerdido) {
        $faseFinalReal = $FASE_VALUES[(RandInt 0 5)]   # se pierde en algun punto entre Prospeccion y Cierre
    } else {
        $faseFinalReal = $targetFase
    }
    $idxFinal = [array]::IndexOf($FASE_VALUES, $faseFinalReal)
    $duraciones = @()
    for ($f = 0; $f -le $idxFinal; $f++) { $duraciones += (RandInt 3 14) }
    $elapsedActual = if ($esEstancado) { RandInt 25 48 } else { RandInt 1 18 }

    $totalDiasAtras = ($duraciones | Measure-Object -Sum).Sum + $elapsedActual
    $fechaPrimerContacto = (Get-Date).AddDays(-$totalDiasAtras)

    $leadFields = @{
        fl_razonsocial = $empresa
        fl_cif = $cif
        fl_nombreresponsable = $responsable
        fl_telefonocorporativo = $telefono
        fl_emailcorporativo = $email
        fl_numvehiculosactuales = $numVehActuales
        fl_marcasactuales = $marcas
        fl_actividadeconomica = $sector
        fl_modofinanciacionactual = $financiacion
        fl_vencimientocontratosactuales = (Get-Date).AddMonths((RandInt 1 18)).ToString("yyyy-MM-dd")
        fl_cuotasobjetivo = $cuotas
        fl_modelosinteres = $modelos
        fl_numvehiculosrenovarampliar = $numVehRenovar
        fl_plazoestimadodecision = $plazo
        fl_competidoresdetectados = $competidores
        fl_requisitos = $requisitos
        fl_kmtiempo = $km
        fl_fechaprimercontacto = $fechaPrimerContacto.ToString("yyyy-MM-dd")
        fl_faseactual = if ($esPerdido) { $FASE_PERDIDO } else { $targetFase }
        fl_ultimaaccionrealizada = $accion
        fl_proximaaccion = Rand $ACCIONES
        fl_fechaproximaaccion = (Get-Date).AddDays((RandInt -3 10)).ToString("yyyy-MM-dd")
        fl_comercialresponsable = $creador.Nombre
        fl_observaciones = $notas
        "fl_ubicacion@odata.bind" = (DvLookupBind "fl_ubicacion" "fl_ubicacion" $ubi.Id)
        "fl_concesionario@odata.bind" = (DvLookupBind "fl_concesionario" "fl_concesionario" $ubi.ConcesionarioId)
        "fl_creadopor@odata.bind" = (DvLookupBind "fl_creadopor" "fl_usuarioapp" $creador.Id)
    }
    if ($esPerdido) {
        $leadFields["fl_motivoperdida"] = Rand @("Se decantaron por la competencia","Presupuesto no aprobado internamente","Proyecto de flota pospuesto","Dejaron de responder tras la propuesta","Optaron por mantener su proveedor actual")
    }

    $leadId = New-DvRecord -Table "fl_lead" -Fields $leadFields

    # ---- historico de fase: cerradas hasta idxFinal-1, abierta la ultima ----
    $cursor = $fechaPrimerContacto
    for ($f = 0; $f -le $idxFinal; $f++) {
        $faseVal = $FASE_VALUES[$f]
        $dias = $duraciones[$f]
        $inicio = $cursor
        $esUltimaAbierta = ($f -eq $idxFinal) -and (-not $esPerdido)
        if ($esUltimaAbierta) {
            $fin = $null
            $diasEnFase = $null
            $esActual = $true
        } else {
            $fin = $cursor.AddDays($dias)
            $diasEnFase = $dias
            $esActual = $false
        }
        $histFields = @{
            fl_titulo = "$empresa — $($FASE_LABELS[$faseVal])"
            fl_fase = $faseVal
            fl_fechainicio = $inicio.ToUniversalTime().ToString("o")
            fl_esactual = $esActual
            "fl_lead@odata.bind" = (DvLookupBind "fl_lead" "fl_lead" $leadId)
        }
        if ($fin) { $histFields["fl_fechafin"] = $fin.ToUniversalTime().ToString("o") }
        if ($diasEnFase -ne $null) { $histFields["fl_diasenfase"] = $diasEnFase }
        New-DvRecord -Table "fl_fasehistorico" -Fields $histFields | Out-Null
        $cursor = $cursor.AddDays($dias)
    }

    if ($esPerdido) {
        $histFields = @{
            fl_titulo = "$empresa — Perdido"
            fl_fase = $FASE_PERDIDO
            fl_fechainicio = (Get-Date).AddDays(-$elapsedActual).ToUniversalTime().ToString("o")
            fl_esactual = $true
            "fl_lead@odata.bind" = (DvLookupBind "fl_lead" "fl_lead" $leadId)
        }
        New-DvRecord -Table "fl_fasehistorico" -Fields $histFields | Out-Null
    }

    $leadCount++
    Write-Host "  [+] ($leadCount/$($planFases.Count)) $empresa — $($ubi.Nombre) — $($FASE_LABELS[$leadFields.fl_faseactual])$(if($esEstancado){' [ESTANCADO]'})"
}

Write-Host "=== Listo: $leadCount leads de ejemplo creados ==="
