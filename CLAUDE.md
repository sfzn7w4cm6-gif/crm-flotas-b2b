# CRM Flotas B2B — "Ebro Business"

> **Para cualquier persona o IA que abra este proyecto: lee este archivo entero antes de
> cambiar nada.** Explica cómo está montada la app, a qué Dataverse se conecta cada entorno,
> cómo se publica y los errores que ya costaron días resolver. Si cambias algo importante,
> actualiza también este archivo en el mismo commit.
>
> Última revisión completa: 11/11/2026.

## Índice

1. Qué es
2. Reglas que no se deben romper (resumen)
3. Entornos: desarrollo y producción
4. Cómo trabajar en local
5. Cómo publicar la app
6. Cómo cambiar el esquema de Dataverse (scripts)
7. Arquitectura del código
8. Conexión a Dataverse: orígenes nativos frente al conector
9. Inicio de sesión, roles y "Ver como rol"
10. Modelo de datos
11. Seguridad (roles de Dataverse)
12. Pantallas
13. Reglas de negocio
14. Usuarios: alta, licencias e invitados externos
15. Problemas ya resueltos (no repetirlos)
16. Diseño
17. Pendientes conocidos

---

## 1. Qué es

App interna de EBRO para la red de concesionarios. Sustituye el Excel `Plantilla Cliente -
FORMS.xlsx` con el que se seguían las oportunidades de venta de **flotas a empresas (B2B)**.

- Los **concesionarios** (usuarios externos, invitados B2B) dan de alta oportunidades y las
  llevan por las fases del pipeline.
- El **Equipo de Ventas** de EBRO ve toda la red, pone el descuento de marca, gestiona
  usuarios y objetivos, y tiene paneles de KPIs.

Es un **Power Apps Code App**: una web propia en React 19 + TypeScript + Vite que se publica
dentro de Power Apps con `pac code push` y usa **Dataverse** como base de datos. No es una
Canvas App ni una Model-Driven App: toda la interfaz es código de este repositorio.

**Nombres.** En pantalla la app se llama **"Ebro Business"** (en producción, "Ebro Business
App"). El repositorio, la solución de Dataverse (`CRMFlotasB2B`), los roles y el código siguen
llamándose CRM Flotas B2B. **En pantalla se dice "oportunidad", nunca "lead"**, pero en el
código, las tablas y las rutas sigue siendo `lead` (`fl_lead`, `/mis-leads`, `/nuevo-lead`).

- **GitHub**: https://github.com/sfzn7w4cm6-gif/crm-flotas-b2b (privado), rama única `main`.
- **Idioma**: todo en español (interfaz, comentarios, commits, documentación).

## 2. Reglas que no se deben romper (resumen)

1. **`power.config.json` apunta siempre a DESARROLLO** en el repositorio. Para publicar en
   producción usa `scripts/publicar.ps1 -Entorno prod`, que lo cambia y lo restaura solo.
   Nunca hagas commit con los valores de producción.
2. **Primero desarrollo, después producción.** Todo cambio (código o esquema) se publica y se
   prueba en desarrollo. A producción solo con el visto bueno explícito de la responsable
   (Ariadna).
3. **Toda tabla que use la app debe ser un origen nativo de Dataverse**
   (`pac code add-data-source -a dataverse -t <tabla>`). Si se lee por el conector, los
   **invitados externos (todos los concesionarios) no pueden entrar** (error `0x80072560`).
   Ver sección 15.1.
4. **Los cambios de esquema se hacen con scripts** en `scripts/dataverse/`, numerados,
   idempotentes y dentro de la solución `CRMFlotasB2B`. Nunca a mano en make.powerapps.com
   sin dejar el script.
5. **No tocar otras apps del entorno de desarrollo**: PeopleFlow (tablas `hr_*`) y Tracking
   Vehículos son proyectos aparte.
6. **No se borran oportunidades**: se marcan como "Perdido".
7. **Nada de `enum` de TypeScript** (`erasableSyntaxOnly`): usa `const X = {...} as const`.
8. **No subir datos personales reales** (Excel de usuarios, correos de concesionarios) al
   repositorio. Los datos de `demo/` son ficticios.
9. **`pac code push` reemplaza la app entera.** Si dos personas publican desde versiones
   distintas, la última pisa a la otra. Haz siempre `git pull` antes de publicar.

## 3. Entornos: desarrollo y producción

Los dos están en el mismo tenant de EBRO (`030a22ff-38fa-4ef1-8820-3d5e0ff18dcb`,
`ebroauto.onmicrosoft.com`).

| | **Desarrollo** | **Producción** |
|---|---|---|
| Entorno Power Platform | "Ariadna Llanos" (tipo Developer) | "Entorno - Equipo de Ventas" |
| `environmentId` | `192d0a93-f34e-e64a-a9c3-6558e2f66156` | `6adf3534-66c7-e4a1-95c7-045d1b228f44` |
| Dataverse (org URL) | `https://org642a1b00.crm4.dynamics.com` | `https://org9d11094c.crm4.dynamics.com` |
| App (`appDisplayName`) | "Ebro Business" | "Ebro Business App" |
| `appId` | `033039d0-63b6-4df9-91a1-14fec80dffba` | `b9bfcd40-fbb7-4e29-88a8-7275312e769f` |
| Business Unit raíz | `23eb3196-6334-f111-88b4-7ced8d74baf1` | `7851e1e5-78d5-f111-a05b-7ced8d5944d2` |
| Solución `CRMFlotasB2B` | No administrada (aquí se desarrolla) | Importada como administrada el 03/11/2026; los cambios posteriores se aplican con los scripts (sección 6) |
| Datos | Datos de demo + red real | Solo datos reales (sin demo) |
| Enlace | `https://apps.powerapps.com/play/e/192d0a93-f34e-e64a-a9c3-6558e2f66156/app/033039d0-63b6-4df9-91a1-14fec80dffba` | `https://apps.powerapps.com/play/e/6adf3534-66c7-e4a1-95c7-045d1b228f44/app/b9bfcd40-fbb7-4e29-88a8-7275312e769f` |

**¿Cómo sabe la app a qué Dataverse ir?**

- Las tablas de la app son **orígenes nativos** (`databaseReferences."default.cds"` en
  `power.config.json`): van siempre al Dataverse **del entorno donde está publicada la app**.
  Por eso la misma compilación sirve para los dos entornos.
- Las pocas llamadas que siguen por el **conector** (pantalla Usuarios y accesos: cuentas,
  equipos y roles) necesitan la URL del org. `src/lib/dataverseClient.ts` la saca de
  `getContext().app.dataverseOrgUrl` y, si viene vacía, de `ORGANIZACION_POR_ENTORNO` (tabla
  `environmentId → org URL`). **Si se crea un entorno nuevo hay que añadirlo a esa tabla.**

**Por qué la app de producción tiene otro nombre y otro `appId`.** Un `appId` queda atado a
su entorno: `pac code push` con el `appId` de desarrollo contra producción falla con
`InvalidEnvironmentName`. Además, al importar la solución en producción viajó una "ficha vacía"
de la app con el nombre "Ebro Business", que impide crear otra con el mismo nombre
(`ApplicationDisplayNameIsInUse`). Por eso la de producción se llama "Ebro Business App".

**Otras apps del entorno de desarrollo (no tocar):** PeopleFlow (RRHH, tablas `hr_*`, carpeta
`Nueva carpeta` del escritorio) y Tracking Vehículos (logística, conectado a
`ebro360.crm16.dynamics.com`). Comparten entorno pero no datos.

## 4. Cómo trabajar en local

Requisitos: Node 20+, Power Platform CLI (`pac`), acceso al entorno de desarrollo con rol de
personalizador (System Customizer o superior).

```powershell
git clone https://github.com/sfzn7w4cm6-gif/crm-flotas-b2b.git
cd crm-flotas-b2b
npm install
pac auth create --environment 192d0a93-f34e-e64a-a9c3-6558e2f66156
```

- **Red corporativa de EBRO**: el proxy intercepta TLS. Antes de usar `pac` o `npm` contra
  Power Platform:
  `$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.pac-certs\corporate-ca-bundle.pem"`.
  Sin esto `pac code push` y `pac code run` fallan con errores de certificado.
- `pac` está instalado en
  `%LOCALAPPDATA%\Microsoft\PowerAppsCLI\Microsoft.PowerApps.CLI.2.11.2\tools\pac.exe` (no
  siempre está en el PATH).

| Comando | Qué hace |
|---|---|
| `npm run dev` + `pac code run` | App en `http://localhost:3000` conectada a los **datos reales de desarrollo** (no es un sandbox: lo que guardes queda guardado). |
| `npm run demo` | App en `http://localhost:3100` con un usuario y datos **ficticios en memoria** (`demo/`), sin Power Apps ni Dataverse. Sirve para enseñar la app o grabar vídeos. |
| `npm run build` | Compila (`tsc -b && vite build`) a `dist/`. Debe acabar sin errores antes de publicar. |
| `npm run lint` | oxlint. |

## 5. Cómo publicar la app

```powershell
.\scripts\publicar.ps1 -Entorno dev     # compila y publica en desarrollo
.\scripts\publicar.ps1 -Entorno prod    # compila y publica en producción (pide escribir SI)
```

El script compila, cambia temporalmente `appId`, `appDisplayName` y `environmentId` en
`power.config.json` si es producción, ejecuta `pac code push --environment <id>` y **restaura
el archivo siempre**, aunque falle. Comprueba después con `git status` que
`power.config.json` no aparece modificado.

Orden obligatorio: commit en `main` → publicar en dev → probar → publicar en prod con el visto
bueno → comprobar en prod.

> El procedimiento antiguo (compilar con `VITE_DATAVERSE_ORG` en una carpeta aparte con otro
> `pac code init`) **ya no se usa**. Desde el 06/11/2026 la app resuelve el Dataverse sola.

## 6. Cómo cambiar el esquema de Dataverse (scripts)

No existe un comando `pac` para crear tablas o columnas. Se hace con scripts PowerShell que
llaman a la Web API de Dataverse: `scripts/dataverse/NN-descripcion.ps1`. Ver
`scripts/dataverse/README.md` para la lista completa.

- `auth.ps1`: login por *device code* (la primera vez pide abrir una URL e introducir un
  código) y caché de token en `%TEMP%`.
- `lib.ps1`: helpers idempotentes (`New-DvTable`, `Add-DvTextColumn`, `Add-DvChoiceColumn`,
  `Add-DvLookup`, `New-DvRole`, `Grant-DvTablePrivileges`, `Ensure-DvRecord`...). Todos
  crean dentro de la solución `CRMFlotasB2B` (cabecera `MSCRM.SolutionUniqueName`).
- **Por defecto los scripts van contra DESARROLLO.** Para producción:

```powershell
$env:DV_ENTORNO = "prod"
.\scripts\dataverse\32-descuento-por-modelo.ps1
Remove-Item Env:\DV_ENTORNO      # no dejarlo puesto
```

  Con `DV_ENTORNO=prod`, `auth.ps1` usa el org de producción y otra caché de token, y
  `lib.ps1` la Business Unit raíz de producción. El script avisa en amarillo
  `>>> ENTORNO: PRODUCCION`.

Reglas para scripts nuevos:

1. Siguiente número libre (el último es `33`).
2. Idempotente: se puede ejecutar dos veces sin romper nada (comprobar si existe antes de
   crear). Si falla a mitad (p. ej. "conexión cerrada por el host"), se vuelve a lanzar.
3. Solo añadir. No borrar columnas ni bajar privilegios sin acordarlo.
4. Cabecera `<# ... #>` explicando qué hace y por qué.
5. Las opciones de choice usan el prefijo `101000000`, `101000001`...
6. **Si crea una tabla nueva que la app va a leer**: registrar la tabla como origen nativo
   (`pac code add-data-source -a dataverse -t fl_nuevatabla`), añadirla a `Tables` en
   `dataverseClient.ts` y hacer commit de los cambios en `power.config.json`,
   `.power/schemas/` y `src/generated/`.
7. **Columnas nuevas en tablas existentes no necesitan regenerar nada**: el código pide
   columnas por nombre (`$select`) y los archivos de `.power/schemas/dataverse` y
   `src/generated/` solo se usan para generar código.
8. Ejecutar en dev → probar la app → ejecutar en prod con `DV_ENTORNO=prod`.

**Datos reales que se cargan con scripts** (las soluciones solo llevan esquema, nunca filas):
`16-red-ebro-y-modelos.ps1` (zonas, concesionarios, sedes y modelos desde
`scripts/dataverse/datos/red-ebro.json`), `30-sin-concesionario.ps1`,
`31-cargar-usuarios.ps1` (usuarios desde el Excel de responsables) y
`33-importar-objetivos.ps1` (objetivos del mes desde la plantilla). Los scripts de demo
(`05`, `07`, `10`) **nunca** se ejecutan en producción.

## 7. Arquitectura del código

```
src/
  App.tsx                    rutas (HashRouter) y guardas por rol
  context/AuthContext.tsx    quién es el usuario, su rol, sus sedes; "Ver como rol"
  lib/
    dataverseClient.ts       ÚNICO punto de acceso a Dataverse (list/get/create/update/delete/relate)
    types.ts                 tipos de cada tabla y constantes de choices (Fase, RolApp...)
    leadsService.ts          oportunidades: alta, cambio de fase, edición, condiciones
    lineasService.ts         modelos de cada oportunidad (líneas) y su resumen en el lead
    descuento.ts             reglas del descuento (pendiente, medias, Sin concesionario)
    camposFase.ts            qué campos pide cada fase y cuáles son obligatorios (REQUISITOS)
    empresasService.ts       empresas (una por CIF y concesionario), duplicados
    asignacionesService.ts   qué sedes lleva cada usuario; compañeros de sede
    usuariosService.ts       guardar usuario: perfil, asignaciones, equipos y rol
    notificacionesService.ts campanita de ventas
    kpiService.ts, actividadService.ts   cálculos de los paneles
    objetivosExcel.ts        exportar/importar la plantilla de objetivos (exceljs)
    excelExport.ts           descargas de tablas a Excel (tabla HTML)
    filtrosLeads.ts, validators.ts, formato.ts, catalogosService.ts, tareasService.ts,
    notasService.ts, adjuntosService.ts
  components/                AppShell (barra lateral), Campanita, filtros, gráficos SVG, tareas, notas
  pages/                     una carpeta por pantalla (ver sección 12)
  styles/common.css          variables de color y tipografía
  generated/                 código generado por pac (no se usa directamente; no editar)
.power/schemas/              esquemas generados por pac (dataSourcesInfo.ts SÍ se usa)
demo/                        sustitutos de @microsoft/power-apps para "npm run demo"
scripts/publicar.ps1         publicar en dev/prod
scripts/dataverse/           esquema y cargas de datos
```

- Sin librería de componentes: CSS propio por pantalla.
- Gráficos hechos a mano en SVG (`components/charts/`), sin dependencias.
- Rutas con `HashRouter` (`#/lead/:id`), porque el reproductor de Power Apps sirve la app en
  un iframe.
- Imágenes incrustadas en base64 (`assetsInlineLimit` en `vite.config.ts`): el hosting de Code
  Apps no servía bien los binarios sueltos de `dist/assets`.
- `exceljs` para leer y escribir .xlsx. La librería `xlsx` (SheetJS) está **descartada** por
  vulnerabilidades sin parchear.

## 8. Conexión a Dataverse: orígenes nativos frente al conector

`dataverseClient.ts` tiene dos caminos, y elige solo según la tabla:

1. **Origen nativo de Dataverse** (`dataSourceType: 'Dataverse'` en
   `.power/schemas/appschemas/dataSourcesInfo.ts`): usa `dv.retrieveMultipleRecordsAsync`,
   `createRecordAsync`, etc. Va directo al Dataverse del entorno con la **sesión del
   reproductor de Power Apps**. **Es el que funciona con invitados B2B.** Están dadas de alta
   así todas las tablas `fl_*` y `annotation` (lista en `databaseReferences` de
   `power.config.json`).
2. **Conector `commondataserviceforapps`** (`...WithOrganization`): solo para `systemusers`,
   `teams`, `roles`, para relacionar o desrelacionar (equipos, roles) y para cualquier consulta
   con `$expand`. Lo usa la pantalla **Usuarios y accesos**, que solo usan personas internas de
   EBRO. Necesita el parámetro `organization` (sección 3); sin él falla con
   `Invalid organization URL 'null' provided`.

Detalles:

- `Tables` en `dataverseClient.ts` son los nombres de **colección** OData (`fl_leads`,
  `fl_ubicacions`, `fl_lineaoportunidads`...), no los nombres lógicos.
- Los lookups se escriben con `'fl_campo@odata.bind': '/fl_tablas(<id>)'` y se leen como
  `_fl_campo_value`. El nombre del registro relacionado sale de la anotación
  `_fl_campo_value@OData.Community.Display.V1.FormattedValue`.
- No hay transacciones: las operaciones de varios pasos (alta, cambio de fase) son llamadas
  secuenciales.
- Si añades una tabla y te olvidas del paso 6 de la sección 6, la app irá por el conector y
  **los concesionarios dejarán de poder usar esa parte**, sin que tú lo notes con tu cuenta
  interna.

## 9. Inicio de sesión, roles y "Ver como rol"

`AuthContext.tsx`, al arrancar:

1. `getContext()` da `userPrincipalName` y `systemUserId` del usuario conectado.
2. Busca su perfil en `fl_usuarioapp`, por orden:
   1. por `_fl_systemuserid_value = systemUserId` (la cuenta vinculada; es lo único fiable
      con invitados);
   2. por `fl_correo = userPrincipalName`;
   3. si el UPN es de invitado (`nombre_dominio.com#EXT#@ebroauto.onmicrosoft.com`), por el
      correo real deducido (`nombre@dominio.com`).
3. Si no lo encuentra: mensaje "Tu usuario no está registrado en Ebro Business". Si falla la
   conexión: mensaje de error **con un diagnóstico** (entorno, org, usuario, tenant), que
   ayuda mucho a ver problemas de invitados.
4. Carga sus asignaciones (`fl_asignacion`) → `sedes` y `concesionarios` que lleva; la sede
   principal es `fl_usuarioapp.fl_ubicacion`.

**Rol de la app** = `fl_usuarioapp.fl_rol`: Concesionario (101000000), Equipo de Ventas
(101000001) o Administrador (101000002). Lo que se ve en pantalla depende de este campo, no del
rol de seguridad de Dataverse. Lo que el usuario **puede leer o escribir de verdad** lo decide
el rol de seguridad (sección 11). Los dos tienen que cuadrar.

**"Ver como rol"** (solo administradores): selector al pie de la barra lateral que simula
Concesionario o Equipo de Ventas (`viewAsRole`, en `sessionStorage`). El resto de la app usa
`effectiveRol`. Ojo: los **permisos de Dataverse siguen siendo los de administrador**, así que
"Ver como rol" sirve para ver la interfaz, no para probar la seguridad. Para eso hace falta una
cuenta real con ese rol.

- `isAdmin && viewAsRole === null` = administrador viendo todo (en el código, `veComoVentas`
  incluye este caso).

## 10. Modelo de datos

Solución `CRMFlotasB2B`, prefijo `fl_`. 14 tablas propias más `annotation` (adjuntos). Valores
de choices en `src/lib/types.ts`.

### Red comercial y catálogo

- **`fl_zona`**: 7 zonas (`fl_nombre` "Zona N", `fl_numero`, `fl_areamanager`).
- **`fl_concesionario`**: grupo dealer (`fl_nombre`, `fl_cif`, `fl_activo`, `fl_equipo` →
  `team` propietario de sus empresas). 42 reales más "Sin concesionario".
- **`fl_ubicacion`** (sede): `fl_nombre` (p. ej. "Syrsa-Huelva", ya lleva el grupo),
  `fl_concesionario` (obligatorio), `fl_zona` (**la zona va en la sede**: un concesionario
  puede tener sedes en varias zonas), `fl_areamanager`, `fl_ciudad`, `fl_direccion`,
  `fl_activo`. 108 reales más "Sin sede".
- **`fl_modelo`**: catálogo (`fl_nombre` "S700 HEV LUXURY", `fl_familia`, `fl_motorizacion`,
  `fl_acabado`, `fl_orden`, `fl_activo`).
- **"Sin concesionario" / "Sin sede"** (`30-sin-concesionario.ps1`): comodín para la gente de
  EBRO que genera oportunidades sin ser de ningún concesionario. Se reconoce **por el nombre**
  "Sin concesionario" (`asegurarSinConcesionario` en `leadsService.ts`).

### Usuarios

- **`fl_usuarioapp`**: perfil. `fl_nombre`, `fl_correo`, `fl_rol`, `fl_ubicacion` (sede
  principal), `fl_telefono`, `fl_activo`, `fl_systemuserid` (→ `systemuser`, la cuenta real
  del entorno; se rellena cuando la cuenta existe).
- **`fl_asignacion`**: qué lleva cada usuario. Una fila por (usuario, concesionario, sede);
  **sede vacía = el concesionario entero**, incluidas las sedes futuras.
  `fl_objetivoleadsmes` existe pero no se usa.
- **Equipo por concesionario**: `team` "CRM Flotas - <nombre>" con el rol Concesionario. Es
  dueño de las empresas del concesionario. Sus miembros son los usuarios con alguna sede en él.
  Lo mantiene `guardarUsuario` (pantalla Usuarios y accesos) y `31-cargar-usuarios.ps1`.

### Empresa y oportunidad

- **`fl_empresa`**: el cliente, **una por CIF dentro de cada concesionario** (el mismo CIF
  puede existir en dos concesionarios como dos filas). `fl_razonsocial`, `fl_cif` (normalizado:
  sin espacios, guiones ni puntos, en mayúsculas), contactos (`fl_nombreresponsable`,
  `fl_telefonocorporativo`, `fl_emailcorporativo`), `fl_estado` (Cliente potencial / Cliente),
  `fl_oportunidadabierta` (→ la oportunidad en curso), `fl_concesionario`.
- **`fl_lead`** = la **oportunidad**. Número autonumérico `L{SEQNUM:5}`. Campos:
  - Estructura: `fl_empresa`, `fl_concesionario`, `fl_ubicacion`, `fl_comercial` (→
    `fl_usuarioapp`), `fl_comercialresponsable` (texto con el nombre, para listas),
    `fl_creadopor`, `ownerid` (el comercial: decide quién la ve).
  - Copiados de la empresa para filtrar y ordenar: `fl_razonsocial`, `fl_cif`, contactos.
  - Situación de flota: `fl_numvehiculosactuales`, `fl_marcasactuales`,
    `fl_actividadeconomica`, `fl_modofinanciacionactual` (choice),
    `fl_vencimientocontratosactuales`.
  - Necesidad: `fl_modelosinteres` y `fl_numvehiculosrenovarampliar` (**resumen automático
    de las líneas**), `fl_plazoestimadodecision` (choice), `fl_competidoresdetectados`,
    `fl_requisitos`.
  - Oferta: `fl_ofertacondiciones`, `fl_descuentoconcesionario` y `fl_descuentoventas`
    (**resumen**: media ponderada por unidades de las líneas), `fl_fechacondiciones` (cuándo
    cambió las condiciones el concesionario), `fl_condicionesrevisadas` (ventas ya las vio).
  - Seguimiento: `fl_fechaprimercontacto` (se pone sola al crear y no se edita),
    `fl_faseactual`, `fl_ultimaaccionrealizada`, `fl_proximaaccion`, `fl_fechaproximaaccion`,
    `fl_observaciones`, `fl_motivoperdida`, `fl_importeventa` (antiguo, ya no se pide).
  - **Eliminados de la app** (las columnas siguen en Dataverse, no usarlas):
    `fl_cuotasobjetivo`, `fl_kmtiempo`.
- **`fl_lineaoportunidad`**: un modelo de la oportunidad. `fl_lead`, `fl_modelo`,
  `fl_cantidad`, `fl_descuentoconcesionario`, `fl_descuentoventas` (% por modelo). Tras cada
  cambio, `guardarResumenLineas` / `guardarCambiosLineas` recalculan el resumen del lead.
- **`fl_fasehistorico`**: cuánto tiempo pasa cada oportunidad en cada fase. `fl_lead`,
  `fl_fase`, `fl_fechainicio`, `fl_fechafin` (vacío = abierta), `fl_esactual` (como mucho una
  `true` por oportunidad), `fl_diasenfase` (se calcula en el cliente al cerrar).

**Fases** (`fl_faseactual` / `fl_fase`): 1. Prospección (101000000) → 2. Primer Contacto → 3.
Cualificación → 4. Propuesta → 5. Negociación → 6. Cierre (101000005) → 7. Entrega
(101000006), y **Perdido** (101000008), al que se llega desde cualquier fase y que exige
motivo. La opción 101000007 "8. Fidelización" sigue en Dataverse pero la app no la usa.

### Actividad

- **`fl_tarea`**: tareas de una oportunidad (`fl_titulo`, `fl_tipo`, `fl_fecha`,
  `fl_estado`, `fl_notas`, `fl_enlace`, `fl_lead`; `fl_resultado` es antiguo).
- **`fl_nota`**: notas (`fl_texto`, `fl_lead`, `fl_tarea` opcional, `fl_autor`).
- **`annotation`**: adjuntos de tareas y notas (`documentbody`, máx. 5 MB). Al listar no se
  pide el contenido, solo al descargar.

### Objetivos y notificaciones

- **`fl_objetivo`**: oportunidades al mes (`fl_leadsmes`). Prioridad: **fila de la sede**
  (`fl_ubicacion`) → fila del concesionario → fila general (sin concesionario ni sede). Se
  editan en Configuración o se importan con la plantilla. `fl_nombre` = nombre de la sede.
- **`fl_notificacion`**: campanita de ventas. `fl_titulo`, `fl_tipo` (Descuento pendiente
  101000000 / Empresa duplicada 101000001 / Condiciones por revisar 101000002), `fl_lead`,
  `fl_empresa`, `fl_cif`. Ver sección 13.

## 11. Seguridad (roles de Dataverse)

Todos en la Business Unit raíz. El aislamiento entre concesionarios se hace con
**propiedad + profundidad Basic**, no con unidades de negocio.

| Tabla | CRM Flotas B2B - Concesionario | CRM Flotas B2B - Equipo de Ventas | CRM Flotas B2B - Administrador |
|---|---|---|---|
| `fl_lead`, `fl_fasehistorico`, `fl_tarea`, `fl_lineaoportunidad`, `fl_nota` | Crear/Leer/Escribir/Asignar **Basic** (solo lo suyo); borrar solo notas propias | Leer Global; **Escribir Global en `fl_lead` y `fl_lineaoportunidad`** (para el descuento de marca; la app solo le deja tocar eso) | Todo Global |
| `fl_empresa` | Crear/Leer/Escribir/Asignar **Basic**: las suyas y las del equipo de su concesionario. **No puede leer empresas de otros concesionarios** | Leer Global | Todo Global |
| `fl_concesionario`, `fl_ubicacion`, `fl_zona`, `fl_modelo`, `fl_usuarioapp`, `fl_asignacion`, `fl_objetivo` | Leer Global | Leer Global; Crear/Escribir `fl_usuarioapp`; CRUD `fl_asignacion` y `fl_objetivo` | Todo Global |
| `fl_notificacion` | **Ninguno** (las crea el navegador de ventas) | CRUD Global | Todo Global |
| `annotation` | CRUD Basic | Leer Global | Todo Global |

Además: Append/AppendTo Global en las tablas de la app (imprescindible para `@odata.bind`);
Concesionario lee `team`; Equipo de Ventas puede leer cuentas, equipos y roles, cambiar
miembros de equipos y asignar roles (`25-ventas-gestiona-usuarios.ps1`). Dataverse no deja dar
un rol con permisos que no tiene quien lo da, por eso Ventas tiene también los permisos Basic
del rol Concesionario.

**Consecuencias prácticas:**

- Cada comercial ve **solo sus oportunidades** (Basic sobre `ownerid`), aunque comparta sede.
  Al reasignar una oportunidad a otro comercial, las tareas, el histórico y las líneas se
  reasignan en cascada.
- Un concesionario **nunca** ve datos de otro concesionario, ni siquiera pidiéndolos a la API.
  La app añade además sus propias comprobaciones (p. ej. el aviso de empresa duplicada solo se
  calcula para ventas y administración).
- Por eso la regla "una oportunidad abierta por empresa" se apoya en
  `fl_empresa.fl_oportunidadabierta` y no en buscar oportunidades: el comercial no puede ver
  las de sus compañeros.

**Además del rol de la app, todo usuario necesita el rol de sistema "Usuario Basic"** (Basic
User). Ver sección 14.

## 12. Pantallas

Rutas en `src/App.tsx`; menú por rol en `src/components/layout/navConfig.ts`. `/` redirige a
`/panel-kpi` (ventas) o `/mi-actividad` (resto). El administrador ve todos los menús a la vez.

| Ruta | Rol | Qué hace |
|---|---|---|
| `/mi-actividad` (Inicio) | Concesionario | Cifras del mes o año (activadas, ventas, objetivo, conversión), últimas ventas, tareas con calendario y oportunidades por fase. Filtro de sede si lleva varias. |
| `/mis-leads` (Mis oportunidades) | Concesionario | Tabla o pipeline (arrastrar una tarjeta abre el cambio de fase). Filtros múltiples, buscador en todos los campos, tareas y notas. Acepta `?fase=`. |
| `/nuevo-lead` (Nueva oportunidad) | Concesionario | Alta en 2 pasos. Primero el CIF: si la empresa tiene una oportunidad abierta, no deja crear otra. Se elige la sede (si lleva varias) y el comercial (si la sede la llevan varios). Empieza en Prospección. |
| `/lead/:id` (ficha) | Todos | Datos en bloques editables con el lápiz; Oferta por modelo; Cierre de la operación (en Cierre y Entrega); historial de fases con sus tareas; notas y adjuntos; cambio de fase con diálogo. Ventas solo edita el descuento de marca. |
| `/empresas`, `/empresa/:id` | Concesionario (las suyas), Ventas (todas) | Empresas con estado y oportunidad en curso. La ficha de empresa, para ventas, muestra también las oportunidades del otro concesionario si hay duplicado. |
| `/panel-kpi` (Inicio de ventas) | Equipo de Ventas | Cifras de toda la red, tabla por fase agrupable (zona → concesionario → sede, ranking de modelos), vistas propias guardadas en el navegador, análisis del pipeline. Filtros en cascada Zona → Concesionario → Sede. Aviso de descuentos pendientes. |
| `/seguimiento` (Oportunidades) | Equipo de Ventas | Todas las oportunidades en tabla o pipeline (solo lectura), filtros, columnas configurables, `?descuento=pendiente`. |
| `/info` | Equipo de Ventas | Directorio: concesionario → sedes → usuarios. |
| `/configuracion` | Equipo de Ventas | Objetivo mensual por sede (el del concesionario es la suma). Filtros en cascada **Zona, Concesionario, Sede y Comercial** (bidireccionales). Exportar e importar Excel con el formato de la plantilla (hoja `PLANTILLA`, columnas `DEALER` y `OBJETIVO`). |
| `/usuarios` (Usuarios y accesos) | Equipo de Ventas y Administrador (no con "Ver como") | Alta y edición de usuarios: tipo, activo y "lo que lleva" (árbol concesionario → sedes). Al guardar sincroniza asignaciones, equipos y rol de seguridad. Ventas no ve ni crea administradores. |

La **campanita** (`Campanita.tsx`, en la barra superior) solo aparece para ventas y
administración.

## 13. Reglas de negocio

### Oportunidades y empresas

- **Una sola oportunidad abierta por empresa y concesionario.** Abierta = de Prospección a
  Negociación (`esFaseAbierta`). Al pasar a Cierre, Entrega o Perdido, la empresa queda libre y
  se puede abrir otra. Lo controla `fl_empresa.fl_oportunidadabierta`, que mantiene
  `cambiarFaseLead` → `sincronizarEmpresaConFase`. Otro concesionario sí puede tener su propia
  oportunidad para el mismo CIF.
- Al llegar a Cierre o Entrega la empresa pasa a "Cliente" automáticamente.
- **Cambio de fase** (`cambiarFaseLead`): cierra la fila abierta de `fl_fasehistorico`
  calculando los días, crea la nueva y actualiza `fl_faseactual` (y el motivo si es Perdido).
- **Campos por fase** (`src/lib/camposFase.ts`, objeto `REQUISITOS`). Son acumulativos:
  - Primer Contacto: siguiente paso (opcional).
  - Cualificación: obligatorios nº vehículos actuales, modo de financiación, vencimiento de
    contratos, **modelos**, plazo de decisión, próxima acción y su fecha.
  - Propuesta: obligatorio el **descuento del concesionario en cada modelo**; condiciones
    opcionales.
  - Cierre: obligatoria la tabla de **cierre** (unidades y descuentos finales por modelo).
- **El diálogo de cambio de fase NO deja guardar si faltan obligatorios** (o el motivo de
  pérdida): el botón se desactiva y los campos que faltan se marcan en rojo. "Completar datos"
  de la fase actual sí deja guardar parcialmente.
- Para cambiar qué pide cada fase basta con tocar `REQUISITOS`.

### Descuentos (por modelo)

- Cada modelo de la oportunidad tiene **descuento del concesionario** (lo pone el comercial)
  y **descuento de marca** (lo pone Equipo de Ventas). El total es la suma.
- **Sin modelos no hay oferta**: el bloque Oferta pide añadir antes los modelos.
- El lead guarda un resumen: media de cada descuento ponderada por unidades
  (`resumenDescuentos`). El de marca queda vacío mientras algún modelo no lo tenga.
- **Pendiente de marca** (`descuentoPendiente`): hay descuento del concesionario, falta el de
  marca y la fase no es Cierre, Entrega ni Perdido. Se marca en naranja y genera notificación.
- Si el comercial cambia su descuento de un modelo, el de marca de ese modelo se borra para que
  ventas lo revise.
- **Excepción "Sin concesionario"**: esas oportunidades las lleva gente de EBRO, que rellena
  **los dos** descuentos. Nunca están pendientes ni generan aviso.
- Validación: cada % entre 0 y 100, la suma de los dos ≤ 100, unidades enteras.

### Condiciones y notificaciones a ventas

- Cuando el concesionario cambia las condiciones de la oferta, `actualizarLead` pone
  `fl_fechacondiciones = ahora` y `fl_condicionesrevisadas = false`.
- La campanita de ventas crea una notificación "Condiciones pendientes de revisar" (una por
  cambio) que enlaza a la oportunidad. Cuando alguien de ventas abre la oportunidad, se marca
  como revisada.
- **Las notificaciones las crea el navegador de ventas o administración**
  (`sincronizarNotificaciones`, al cargar la campanita), no el del concesionario, que no tiene
  permiso sobre `fl_notificacion`. Consecuencia: aparecen cuando alguien de ventas abre la app.
- Tipos: descuento de marca pendiente, condiciones por revisar y empresa duplicada (mismo CIF
  en dos concesionarios). No se borran solas; ventas las puede quitar.
- El aviso "Esta empresa ya está siendo trabajada por otro concesionario" en la Oferta y en la
  ficha de empresa **solo lo ven ventas y administración**.

### Objetivos

- Objetivo de oportunidades al mes por sede; el del concesionario y el de la red son sumas.
- Plantilla Excel (`archivos/Plantilla para importar objetivos.xlsx` en la carpeta de trabajo,
  no en el repo): hoja `PLANTILLA` (la del archivo original tiene un espacio al final del
  nombre; el código lo tolera), columnas `DEALER` (sede, p. ej. "Syrsa-Huelva") y `OBJETIVO`.
  Las filas TOTAL se ignoran. La importación compara nombres sin acentos ni signos.
- Las sedes de "Sin concesionario" no tienen objetivo.

### KPIs

- Se calculan en el cliente a partir de `fl_lead` y `fl_fasehistorico` (`kpiService.ts`,
  `actividadService.ts`).
- Los periodos se filtran por **fecha de negocio** (`fl_fechaprimercontacto` o fechas del
  histórico), nunca por `createdon`.
- "Activada" = llegó a Primer Contacto o más. "Venta" = llegó a Cierre y no está Perdido.

## 14. Usuarios: alta, licencias e invitados externos

Para que una persona pueda usar la app tienen que cumplirse **todas** estas condiciones:

1. **Cuenta en el tenant de EBRO.** Internos: su cuenta `@ebroauto.com`. Concesionarios: se
   invitan como **invitados B2B** en Entra ID. Su UPN queda como
   `nombre_dominio.com#EXT#@ebroauto.onmicrosoft.com`.
2. **Licencia de Power Apps** que cubra apps con Dataverse (Premium): **Power Apps per app**
   (EBRO tiene cupo, se asigna al usuario desde el Centro de administración de Microsoft 365)
   o Premium. Sin licencia sale "necesitas una licencia".
3. **Usuario en el entorno de Dataverse** (aparece en `systemuser` cuando se le asigna un rol
   o entra por primera vez).
4. **Roles de seguridad**: **"Usuario Basic"** (Basic User, rol del sistema) **y** el de la
   app (CRM Flotas B2B - Concesionario / Equipo de Ventas / Administrador).
5. **App compartida** con el usuario (make.powerapps.com → app → Compartir) o con un grupo
   del que forme parte.
6. **Perfil en `fl_usuarioapp`** con su correo, tipo y sedes. Se hace en **Usuarios y
   accesos** (o en bloque con `31-cargar-usuarios.ps1`). Al guardar, si la cuenta ya existe
   en el entorno, se vincula (`fl_systemuserid`), se añade al equipo de su concesionario y se
   le pone el rol de la app. Si todavía no existe, queda el perfil y hay que **volver a
   guardarlo** (o relanzar el script 31) cuando la tenga.

**Carga masiva** (`31-cargar-usuarios.ps1 -Excel <Excel de responsables> [-SinConcesionario
correo1,correo2] [-Simular]`): lee la hoja "RESPONSABLE EBRO BUSINESS". Si un usuario aparece
en todas las sedes de su concesionario, lleva el concesionario entero. No quita accesos ni
cambia roles existentes. **El Excel tiene datos personales: no se sube al repositorio.**

## 15. Problemas ya resueltos (no repetirlos)

### 15.1 Invitados externos: "The user is not a member of the organization" (0x80072560)

- **Síntoma**: los usuarios `@ebroauto.com` entraban bien, pero **cualquier invitado B2B**
  (los concesionarios) recibía al abrir la app un error 403
  `0x80072560 The user is not a member of the organization`. Licencia, roles, usuario de
  Dataverse y app compartida estaban bien, y una consulta directa a la Web API con el token
  del invitado devolvía 200.
- **Causa**: la app hablaba con Dataverse a través del **conector**
  `commondataserviceforapps`. Para un invitado, el conector se presentaba con la identidad de
  **su propio tenant de origen** (p. ej. HUB TECH FACTORY) y el Dataverse de EBRO no lo
  reconocía.
- **Solución** (06/11/2026, commit `d9fe9ef`): todas las tablas de la app pasaron a ser
  **orígenes nativos de Dataverse** (`pac code add-data-source -a dataverse -t <tabla>`), que
  usan la sesión del reproductor de Power Apps. Solo las tablas de sistema de la pantalla de
  administración siguen por el conector.
- **Qué NO era** (ya se descartó, no volver a investigarlo): licencias, consentimiento en
  Entra ID, roles, el correo del perfil.
- **Prevención**: toda tabla nueva → origen nativo (sección 6, paso 6). Para probarlo de
  verdad hace falta una **cuenta de invitado real** (p. ej. `ext.allanos@ebrofactory.com`),
  porque con una cuenta interna nunca se reproduce.

### 15.2 Login de invitados: el UPN no coincide con el correo

El UPN de un invitado es `nombre_dominio.com#EXT#@ebroauto.onmicrosoft.com`, que nunca
coincide con `fl_correo`. `AuthContext` busca primero por la cuenta vinculada
(`fl_systemuserid`) y después por el correo real deducido del UPN (sección 9).

### 15.3 La app de producción leía los datos de desarrollo

El 03/11/2026 la app de producción mostraba los datos de demo de desarrollo **sin dar
ningún error**: la URL del org estaba fija en el código. Hoy no puede pasar: las tablas
nativas van al Dataverse del entorno de la app y el conector resuelve el org en tiempo real.
**Si añades un entorno, añádelo a `ORGANIZACION_POR_ENTORNO`**. Tras publicar en producción,
comprueba que no aparecen datos de demo.

### 15.4 Otros

- `ListRecords` sin organización falla con `Invalid organization URL 'null' provided`: en el
  conector hay que usar siempre las operaciones `...WithOrganization`.
- `pac code add-data-source` para el conector: `--apiId shared_commondataserviceforapps`
  (nombre corto, nunca la ruta `/providers/...`) y `--connectionId` explícito (sacarlo con
  `pac connection list --environment <id>`). En Git Bash las rutas con `/` se corrompen: usar
  PowerShell.
- Mover la app a otro entorno: el `appId` no se reutiliza (`InvalidEnvironmentName`) y el
  nombre puede chocar con la ficha vacía importada (`ApplicationDisplayNameIsInUse`). En un
  entorno nuevo hay que activar "Power Apps code apps" (Centro de administración → entorno →
  Configuración → Producto → Características), crear la app con `pac code init` y añadir los
  orígenes de datos.
- Las soluciones llevan esquema, no datos: en un entorno nuevo hay que cargar la red real
  (`16`), "Sin concesionario" (`30`), usuarios (`31`) y objetivos (`33`).
- `enum` de TypeScript no compila (`erasableSyntaxOnly`).
- Un `<select>` nativo con opciones de colores se ve mal: por eso `FaseSelect` es un
  componente propio.
- Logo roto al publicar: se incrusta en base64.
- La descarga "CSV" abría mal en Excel: se exporta como tabla HTML (`excelExport.ts`) y la
  plantilla de objetivos como .xlsx real (`objetivosExcel.ts`).
- Los archivos del proyecto usan **CRLF**. Al editarlos con scripts, respétalo.
- Si un script de Dataverse falla con "conexión cerrada por el host remoto", se relanza (son
  idempotentes).

## 16. Diseño

- Paleta EBRO en `src/styles/common.css`: blanco dominante, negro pizarra `#1d1d1b` como
  primario, marrón tierra como acento. **Nada de azul** (decisión del negocio).
- Fases con rampa ordinal de gris a negro (`FASE_COLORS` en `StatusBadge.tsx`). Perdido en rojo
  aparte. Pendiente de descuento en naranja (`--color-naranja*`).
- Tipografía Segoe UI. Barra lateral negra colapsable con la foto de la trasera de un EBRO.
- Textos formales y en español de España.

## 17. Pendientes conocidos (11/11/2026)

- **Usuarios de producción**: hay 49 perfiles cargados; **43 aún no tienen cuenta** en el
  entorno. Cuando la tengan, volver a guardar el usuario en Usuarios y accesos o relanzar
  `31-cargar-usuarios.ps1` con `DV_ENTORNO=prod`.
- **Rol "Usuario Basic"**: comprobar que todos los usuarios de producción lo tienen. Al menos
  Julio Andia, Jesús Ferrer, Cesar Val, Jose Carlos Morion y Daniel Rodríguez no lo tenían. El
  script 31 todavía no lo asigna.
- **Sede "Vian-Las Rozas"**: está en la plantilla de objetivos (objetivo 5) pero no existe en
  la app. Darla de alta si es real.
- La pantalla de error de inicio de sesión muestra datos de diagnóstico técnicos; valorar
  quitarlos cuando todos los concesionarios entren sin problemas.
- `fl_empresa` tiene columnas de flota y sector sin usar, y `fl_lead` tiene `fl_cuotasobjetivo`,
  `fl_kmtiempo` y `fl_importeventa` sin usar. Se podrían borrar.
