<#
  Crea las 5 tablas de CRM Flotas B2B con sus columnas propias (sin lookups;
  las relaciones se crean en 02-relationships.ps1). Idempotente.
#>
. "$PSScriptRoot\lib.ps1"

# Las 8 fases activas del pipeline + "Perdido" (estado terminal, alcanzable desde
# cualquier fase). Se usa el mismo set de opciones en fl_lead.fl_faseactual y en
# fl_fasehistorico.fl_fase para poder comparar valores directamente.
$FASES = @(
    "1. Prospeccion","2. Primer Contacto","3. Cualificacion","4. Propuesta",
    "5. Negociacion","6. Cierre","7. Entrega","8. Fidelizacion","Perdido"
)

Write-Host "--- 1. fl_concesionario ---"
New-DvTable -Name "fl_concesionario" -DisplayName "Concesionario" -DisplayCollectionName "Concesionarios" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
Add-DvStringColumn -Entity "fl_concesionario" -Name "fl_cif" -Label "CIF" -MaxLength 20
Add-DvBoolColumn -Entity "fl_concesionario" -Name "fl_activo" -Label "Activo" -Default $true

Write-Host "--- 2. fl_ubicacion ---"
New-DvTable -Name "fl_ubicacion" -DisplayName "Ubicacion" -DisplayCollectionName "Ubicaciones" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
Add-DvStringColumn -Entity "fl_ubicacion" -Name "fl_ciudad" -Label "Ciudad" -MaxLength 100
Add-DvStringColumn -Entity "fl_ubicacion" -Name "fl_direccion" -Label "Direccion" -MaxLength 300
Add-DvBoolColumn -Entity "fl_ubicacion" -Name "fl_activo" -Label "Activo" -Default $true

Write-Host "--- 3. fl_usuarioapp ---"
New-DvTable -Name "fl_usuarioapp" -DisplayName "Usuario de la app" -DisplayCollectionName "Usuarios de la app" -PrimaryColumnName "fl_nombre" -PrimaryColumnLabel "Nombre"
Add-DvStringColumn -Entity "fl_usuarioapp" -Name "fl_correo" -Label "Correo" -MaxLength 200 -Required "ApplicationRequired"
Add-DvChoiceColumn -Entity "fl_usuarioapp" -Name "fl_rol" -Label "Rol" -Options @("Concesionario","Equipo de Ventas","Administrador") -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_usuarioapp" -Name "fl_telefono" -Label "Telefono" -MaxLength 30
Add-DvBoolColumn -Entity "fl_usuarioapp" -Name "fl_activo" -Label "Activo" -Default $true

Write-Host "--- 4. fl_lead ---"
New-DvTable -Name "fl_lead" -DisplayName "Lead" -DisplayCollectionName "Leads" -PrimaryColumnName "fl_numero" -PrimaryColumnLabel "Numero" -AutoNumber -AutoNumberFormat "LEAD-{SEQNUM:5}"
# Seccion 1 - Datos de la empresa
Add-DvStringColumn -Entity "fl_lead" -Name "fl_razonsocial" -Label "Razon Social / Nombre comercial" -MaxLength 200 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_cif" -Label "CIF / NIF" -MaxLength 20 -Required "ApplicationRequired"
# Seccion 2 - Contactos clave
Add-DvStringColumn -Entity "fl_lead" -Name "fl_nombreresponsable" -Label "Nombre responsable empresa" -MaxLength 200 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_telefonocorporativo" -Label "Telefono corporativo" -MaxLength 30 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_emailcorporativo" -Label "E-mail corporativo" -MaxLength 200 -Required "ApplicationRequired"
# Seccion 3 - Situacion actual de flota
Add-DvIntColumn -Entity "fl_lead" -Name "fl_numvehiculosactuales" -Label "Nº vehiculos actuales" -Required "ApplicationRequired" -Min 0 -Max 100000
Add-DvStringColumn -Entity "fl_lead" -Name "fl_marcasactuales" -Label "Marcas actuales" -MaxLength 300 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_actividadeconomica" -Label "Actividad economica (Sector CNAE)" -MaxLength 150 -Required "ApplicationRequired"
Add-DvChoiceColumn -Entity "fl_lead" -Name "fl_modofinanciacionactual" -Label "Modo de financiacion actual" -Options @("Renting","Leasing","Compra financiada","Compra al contado","Otro") -Required "ApplicationRequired"
Add-DvDateColumn -Entity "fl_lead" -Name "fl_vencimientocontratosactuales" -Label "Vencimiento contratos actuales" -Required "ApplicationRequired" -Format "DateOnly"
# Seccion 4 - Necesidades y oportunidad
Add-DvMoneyColumn -Entity "fl_lead" -Name "fl_cuotasobjetivo" -Label "Cuotas objetivo" -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_modelosinteres" -Label "Modelos de interes" -MaxLength 300 -Required "ApplicationRequired"
Add-DvIntColumn -Entity "fl_lead" -Name "fl_numvehiculosrenovarampliar" -Label "Nº vehiculos a renovar/ampliar" -Required "ApplicationRequired" -Min 0 -Max 100000
Add-DvChoiceColumn -Entity "fl_lead" -Name "fl_plazoestimadodecision" -Label "Plazo estimado de decision" -Options @("Menos de 1 mes","1-3 meses","3-6 meses","Mas de 6 meses") -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_competidoresdetectados" -Label "Competidores detectados" -MaxLength 300 -Required "ApplicationRequired"
Add-DvMemoColumn -Entity "fl_lead" -Name "fl_requisitos" -Label "Requisitos (etiquetas, tecnologia, politica de flotas)" -MaxLength 2000 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_kmtiempo" -Label "Km / tiempo" -MaxLength 100 -Required "ApplicationRequired"
# Seccion 5 - Historico y seguimiento
Add-DvDateColumn -Entity "fl_lead" -Name "fl_fechaprimercontacto" -Label "Fecha primer contacto" -Required "ApplicationRequired" -Format "DateOnly"
Add-DvChoiceColumn -Entity "fl_lead" -Name "fl_faseactual" -Label "Fase actual" -Options $FASES -Required "ApplicationRequired"
Add-DvMemoColumn -Entity "fl_lead" -Name "fl_ultimaaccionrealizada" -Label "Ultima accion realizada" -MaxLength 2000 -Required "ApplicationRequired"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_proximaaccion" -Label "Proxima accion" -MaxLength 300 -Required "ApplicationRequired"
Add-DvDateColumn -Entity "fl_lead" -Name "fl_fechaproximaaccion" -Label "Fecha proxima accion" -Required "ApplicationRequired" -Format "DateOnly"
Add-DvStringColumn -Entity "fl_lead" -Name "fl_comercialresponsable" -Label "Comercial responsable" -MaxLength 200 -Required "ApplicationRequired"
Add-DvMemoColumn -Entity "fl_lead" -Name "fl_observaciones" -Label "Observaciones / notas clave" -MaxLength 4000 -Required "ApplicationRequired"
Add-DvMemoColumn -Entity "fl_lead" -Name "fl_motivoperdida" -Label "Motivo de perdida" -MaxLength 2000

Write-Host "--- 5. fl_fasehistorico ---"
New-DvTable -Name "fl_fasehistorico" -DisplayName "Historico de fase" -DisplayCollectionName "Historicos de fase" -PrimaryColumnName "fl_titulo" -PrimaryColumnLabel "Titulo"
Add-DvChoiceColumn -Entity "fl_fasehistorico" -Name "fl_fase" -Label "Fase" -Options $FASES -Required "ApplicationRequired"
Add-DvDateColumn -Entity "fl_fasehistorico" -Name "fl_fechainicio" -Label "Fecha inicio" -Required "ApplicationRequired"
Add-DvDateColumn -Entity "fl_fasehistorico" -Name "fl_fechafin" -Label "Fecha fin"
Add-DvBoolColumn -Entity "fl_fasehistorico" -Name "fl_esactual" -Label "Es actual" -Default $true
Add-DvIntColumn -Entity "fl_fasehistorico" -Name "fl_diasenfase" -Label "Dias en fase" -Min 0 -Max 100000

Write-Host "=== Listo ==="
