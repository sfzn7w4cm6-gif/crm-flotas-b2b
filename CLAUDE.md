# CRM Flotas B2B

CRM interno para la red de concesionarios EBRO. Sustituye el seguimiento manual
en Excel (`Plantilla Cliente - FORMS.xlsx`) de oportunidades de venta de flotas
a empresas. Es un **Power Apps Code App** (React + TypeScript + Vite), no un
Canvas App ni un Model-Driven App — toda la interfaz es código propio, y solo
se apoya en Dataverse como base de datos.

## Repositorio y despliegue

- **GitHub**: https://github.com/sfzn7w4cm6-gif/crm-flotas-b2b (privado). Rama
  única `main` — publicar solo desde `main` actualizado (`pac code push`
  reemplaza la app entera; si dos personas publican desde ramas distintas, el
  último que publique pisa al otro).
- **Entorno actual de Power Platform**: `Ariadna Llanos` (Developer),
  `https://org642a1b00.crm4.dynamics.com`, environment id
  `192d0a93-f34e-e64a-a9c3-6558e2f66156`. **Se prevé mover este proyecto a
  otro entorno** — ver la sección "Migrar a otro entorno" más abajo antes de
  tocar nada de eso.
- **App id** (en `power.config.json`): `033039d0-63b6-4df9-91a1-14fec80dffba`.
- **Despliegue**:
  ```powershell
  npm run build
  $env:NODE_EXTRA_CA_CERTS = "C:\Users\allanos\.pac-certs\corporate-ca-bundle.pem"
  $pac = "C:\Users\allanos\AppData\Local\Microsoft\PowerAppsCLI\Microsoft.PowerApps.CLI.2.11.2\tools\pac.exe"
  & $pac code push
  ```

## Este mismo entorno también aloja otras apps — no tocarlas

El entorno `Ariadna Llanos` también contiene **PeopleFlow** (RRHH, prefijo de
tabla `hr_`) y **Tracking Vehículos** (seguimiento de logística conectado a
otro CRM externo, `ebro360.crm16.dynamics.com`). Son proyectos totalmente
aparte, en sus propias carpetas y sin ninguna relación de datos con CRM Flotas
B2B. **Nunca editar sus tablas (`hr_*`) ni su código desde este proyecto.**

## Arquitectura

- `src/lib/dataverseClient.ts` — único punto de acceso a Dataverse. Expone
  `listRecords`/`getRecord`/`createRecord`/`updateRecord` genéricos sobre el
  conector `commondataserviceforapps` (una sola conexión multi-tabla; la tabla
  se indica por parámetro en cada llamada vía `Tables.X`). No usa el código
  autogenerado por tabla de Power Apps.
- `src/context/AuthContext.tsx` — al cargar, resuelve
  `getContext().user.userPrincipalName` → busca la fila en `fl_usuarioapp` con
  ese correo → de ahí saca `fl_rol`, sus asignaciones (`fl_asignacion`) y con ellas
  `sedes` y `concesionarios` (todo lo que lleva), además de la sede principal
  (`ubicacion`, de `fl_usuarioapp.fl_ubicacion`) y su `concesionario`. Si el
  usuario no está dado de alta en `fl_usuarioapp`, la app no le deja entrar
  (mensaje de error, no un crash). Los administradores pueden simular otro rol
  con "Ver como rol" (`viewAsRole`, guardado en `sessionStorage`,
  `effectiveRol` es el que de verdad usa el resto de la app).
- `src/components/layout/AppShell.tsx` + `navConfig.ts` — sidebar negra fija,
  colapsable, con los enlaces visibles según `effectiveRol` (ver tabla de
  pantallas más abajo).
- Sin librería de componentes — CSS propio con variables en
  `src/styles/common.css` (paleta EBRO: blanco dominante, negro pizarra
  `#1d1d1b` como color primario, marrón tierra como acento puntual, nunca
  azul).
- `scripts/dataverse/` — scripts PowerShell idempotentes que crean/actualizan
  el esquema (no existe comando `pac` para esto). `lib.ps1` tiene los helpers
  genéricos (`New-DvTable`, `Add-DvChoiceColumn`, `Grant-DvTablePrivileges`,
  etc.), `auth.ps1` el login por device-code (comparte caché de token en
  `$env:TEMP\dv-token-cache.json` con otros proyectos del mismo tenant).
  Numerados en orden de ejecución (`00-solution.ps1` → `01-tables.ps1` →
  ... → el último, `14-dar-roles-entorno.ps1`, es de otro proyecto que
  reutilizó el mismo `lib.ps1`, ignorar).

## Modelo de datos (Dataverse, prefijo de publisher `fl`, solución `CRMFlotasB2B`)

Auditado directamente contra el entorno real (no son solo los scripts de
creación): la solución contiene **5 tablas + 3 roles de seguridad + la propia
app** (10 componentes en total). Las relaciones (lookups) no aparecen como
componentes aparte porque en Dataverse viajan automáticamente con la tabla
que las contiene — no hay que añadirlas a mano.

**Corrección hecha durante esta auditoría**: la app (registro `canvasapp`,
nombre interno `crda2_crmflotasb2b_19a41`, id
`033039d0-63b6-4df9-91a1-14fec80dffba`, el mismo que el "App id" de
`power.config.json`) ya existía en Dataverse, pero **no estaba incluida en la
solución `CRMFlotasB2B`** — vivía solo en la solución por defecto y en una
solución de pruebas antigua y sin relación con este proyecto (`crmprueba`,
ignorar). Se añadió explícitamente a `CRMFlotasB2B` con
`AddSolutionComponent` (`ComponentType=300`) para que ahora viaje junto con
las tablas al exportar. Si en el futuro se publica una nueva versión con
`pac code push`, comprobar tras el siguiente export que la app sigue
apareciendo como componente (debería, pero conviene verificarlo una vez).

### `fl_concesionario` — el grupo/marca del dealer (padre)

| Campo | Tipo | Notas |
|---|---|---|
| `fl_nombre` | Texto | Nombre comercial |
| `fl_cif` | Texto | |
| `fl_activo` | Sí/No | |

### `fl_ubicacion` — una sede/sucursal concreta de un concesionario (hijo)

| Campo | Tipo | Notas |
|---|---|---|
| `fl_nombre` | Texto | Ej. "M Automoción Barcelona" |
| `fl_ciudad`, `fl_direccion` | Texto | |
| `fl_activo` | Sí/No | |
| `fl_concesionario` | Lookup → `fl_concesionario` | Requerido |

### `fl_usuarioapp` — perfil de la app para cada usuario conectado

Es la tabla que resuelve "quién eres y qué ves" — no se usa el rol de
seguridad de Dataverse del usuario para eso, se usa esta fila.

| Campo | Tipo | Notas |
|---|---|---|
| `fl_nombre` | Texto | |
| `fl_correo` | Texto | Debe coincidir con `userPrincipalName` de quien entra |
| `fl_rol` | Choice | `Concesionario` (101000000) / `Equipo de Ventas` (101000001) / `Administrador` (101000002) |
| `fl_ubicacion` | Lookup → `fl_ubicacion` | Obligatorio solo si `fl_rol = Concesionario` |
| `fl_telefono` | Texto | |
| `fl_activo` | Sí/No | |
| `fl_systemuserid` | Lookup → `systemuser` | Enlaza con el usuario real de Entra/Dynamics |

### `fl_lead` — la Ficha de Cliente (autonumérico `L{SEQNUM:5}`, antes `LEAD-{SEQNUM:5}` — ver `20-numero-lead-L.ps1`; UserOwned)

Secciones calcadas de la plantilla Excel original, más los campos
estructurales:

| Sección | Campos |
|---|---|
| Estructural | `fl_ubicacion`, `fl_concesionario` (se copia del padre de la ubicación al crear, no la edita el usuario), `fl_creadopor` (→ `fl_usuarioapp`), `ownerid` (nativo, filtra "Mis Leads") |
| 1. Datos empresa | `fl_razonsocial`, `fl_cif` |
| 2. Contactos | `fl_nombreresponsable`, `fl_telefonocorporativo`, `fl_emailcorporativo` |
| 3. Situación flota | `fl_numvehiculosactuales`, `fl_marcasactuales`, `fl_actividadeconomica`, `fl_modofinanciacionactual` (choice), `fl_vencimientocontratosactuales` (fecha) |
| 4. Necesidad | `fl_cuotasobjetivo` (money), `fl_modelosinteres`, `fl_numvehiculosrenovarampliar`, `fl_plazoestimadodecision` (choice), `fl_competidoresdetectados`, `fl_requisitos`, `fl_kmtiempo` |
| 5. Histórico | `fl_fechaprimercontacto`, `fl_faseactual` (choice, no editable directamente — ver más abajo), `fl_ofertacondiciones` (texto largo, añadido cuando se actualizó la plantilla Excel), `fl_ultimaaccionrealizada`, `fl_proximaaccion`, `fl_fechaproximaaccion`, `fl_comercialresponsable`, `fl_observaciones`, `fl_motivoperdida` (solo si fase = Perdido) |

`fl_faseactual` / `fl_fasehistorico.fl_fase` comparten el mismo choice: **1.
Prospección → 2. Primer Contacto → 3. Cualificación → 4. Propuesta → 5.
Negociación → 6. Cierre → 7. Entrega**, más **Perdido**
(estado terminal alcanzable desde cualquier fase, excluido del embudo/gráficos
ordinales, exige rellenar `fl_motivoperdida`). "8. Fidelización" (101000007) se
quitó el 28/10/2026 (`19-quitar-fase-fidelizacion.ps1`): la opción sigue en
Dataverse pero la app ya no la tiene. El KPI "Renovaciones gestionadas" pasó a
ser ventas cerradas a empresas que ya tenían otra venta en el periodo.

### `fl_fasehistorico` — registro de cuánto tiempo pasa un lead en cada fase

| Campo | Tipo | Notas |
|---|---|---|
| `fl_titulo` | Texto | `"{numero} — {fase}"` |
| `fl_lead` | Lookup → `fl_lead` | |
| `fl_fase` | Choice | mismo choice que `fl_faseactual` |
| `fl_fechainicio` / `fl_fechafin` | Fecha | `fl_fechafin` vacío = fila abierta |
| `fl_esactual` | Sí/No | `true` = la fila abierta de ese lead (debe haber como mucho una) |
| `fl_diasenfase` | Entero | se calcula en el cliente al cerrar la fila, no hay plugin servidor |

**Mecanismo de cambio de fase** (`cambiarFaseLead` en `leadsService.ts`, 2-3
llamadas secuenciales porque no hay endpoint de transacción): cierra la fila
abierta (`fl_fechafin=ahora`, `fl_esactual=false`,
`fl_diasenfase=diffDays(...)`) → crea una fila nueva abierta para la fase
destino → actualiza `fl_lead.fl_faseactual` (y `fl_motivoperdida` si aplica).
Al crear un lead (`crearLeadBase`) pasa lo mismo: crea el lead en fase
Prospección y su primera fila de histórico.

### `fl_tarea` — tareas de seguimiento de un lead (UserOwned)

Creada con `scripts/dataverse/15-tareas-objetivos.ps1`. Se crean desde la ficha
del lead y se ven en la pantalla de inicio del concesionario (lista + calendario).

| Campo | Tipo | Notas |
|---|---|---|
| `fl_titulo` | Texto | Qué hay que hacer |
| `fl_tipo` | Choice | Llamada / Correo / Reunión / Visita / Otro |
| `fl_fecha` | Fecha y hora | |
| `fl_estado` | Choice | Pendiente / En curso / Completada / Cancelada |
| `fl_notas` | Texto largo | |
| `fl_lead` | Lookup → `fl_lead` | Requerido |

### `fl_nota` y `fl_tarea.fl_resultado` — notas y resultado de tareas

Creados con `scripts/dataverse/21-notas-y-resultado-tareas.ps1`.

- `fl_nota`: nota libre sobre una oportunidad (`fl_texto`, `fl_lead`, `fl_autor` →
  `fl_usuarioapp`; la fecha es `createdon`). UserOwned, cascada de asignación desde
  `fl_lead`. Concesionario CRUD Basic (solo borra las suyas), Equipo de Ventas Read
  Global. Se muestran en la ficha del lead (`NotasLead.tsx`); el nombre del autor sale
  de la anotación `FormattedValue` del lookup.
- `fl_tarea.fl_resultado`: cómo fue la tarea. Al marcarla Completada (`FilaTarea` con
  `onGuardarResultado`) se pregunta según el tipo ("¿Cómo fue la visita?"); se puede
  saltar y añadir o editar después.

### Adjuntos, enlace de llamada y notas de tarea (29/10/2026)

Creados con `scripts/dataverse/22-adjuntos-enlace-notas-tarea.ps1`.

- **Adjuntos**: notas nativas de Dataverse (`annotation`, archivo en `documentbody`)
  colgadas de `fl_tarea` (los que se suben al crear la tarea) o de `fl_nota` (los de
  cada nota). Se activó `HasNotes` en las dos tablas (irreversible). Código en
  `src/lib/adjuntosService.ts`: al listar no se pide el contenido, solo al descargar.
  Límite de 5 MB por archivo (el de subida por defecto de Dataverse). Privilegios sobre
  `Note`: Concesionario Create/Read/Write/Delete/Assign Basic, Ventas Read Global,
  Append/AppendTo Global para los dos, Administrador todo Global.
- **`fl_tarea.fl_enlace`**: enlace de la llamada o reunión (solo se pide en esos dos tipos).
- **`fl_nota.fl_tarea`**: una nota con tarea es una nota de esa tarea; sin tarea, nota
  general de la oportunidad. Al completar o cancelar una tarea se pregunta cómo fue y se
  guarda como nota de la tarea. `fl_tarea.fl_resultado` ya no se escribe; si tiene texto
  antiguo se muestra como "Resultado" dentro de la tarea.
- La fase de cada tarea no se guarda: es la fase en la que estaba la oportunidad cuando
  se creó (`createdon` frente a `fl_fasehistorico`), ver `HistorialTareas.tsx`.

### `fl_objetivo` — objetivo de leads al mes por concesionario

Una fila sin `fl_concesionario` = objetivo general; una fila con concesionario lo
sustituye solo para ese. `fl_leadsmes` (entero). Lo edita el equipo de ventas en
`/configuracion` (`guardarObjetivo`). El objetivo de un Inicio es la suma del de
cada concesionario que mira (`objetivoDeRed`): toda la red, los concesionarios del
comercial, o solo los de las sedes que haya filtrado.

### `fl_asignacion` — qué sedes lleva cada usuario (30/10/2026)

Creada con `scripts/dataverse/24-asignaciones-y-equipos.ps1`. Una fila por
(usuario, concesionario, sede): `fl_usuarioapp`, `fl_concesionario` (obligatorios),
`fl_ubicacion` (vacío = **el concesionario entero**, incluidas las sedes que se abran
después). La columna `fl_objetivoleadsmes` existe pero **no se usa** (el objetivo va
por concesionario, ver `fl_objetivo`). Se gestiona en
`/usuarios`; `src/lib/asignacionesService.ts` tiene la lógica.

- `fl_usuarioapp.fl_ubicacion` sigue existiendo como **sede principal** (la que sale
  por defecto en el alta); al guardar en `/usuarios` se corrige si deja de ser suya.
- **Compañeros de una sede** (`fetchComercialesDeSede`): usuarios activos con una
  asignación a esa sede o a su concesionario entero. Se usa en el alta y al cambiar
  el comercial de una oportunidad.
- **Equipo por concesionario**: cada `fl_concesionario` tiene un equipo propietario
  (`fl_concesionario.fl_equipo` → `team`, "CRM Flotas - <nombre>", con el rol
  Concesionario). Es el **dueño de las empresas** de ese concesionario; sus miembros son
  los usuarios con alguna sede en él. `/usuarios` los mete y saca del equipo
  (`teammembership_association`, vía `relateRecords`/`unrelateRecords` de
  `dataverseClient.ts`) y les pone el rol de seguridad de su tipo
  (`systemuserroles_association`), salvo a los administradores, que se gestionan a mano.
  Solo funciona si el usuario ya tiene cuenta en el entorno (`fl_systemuserid`); si no,
  se avisa y se completa al volver a guardarlo cuando la tenga.

`fl_lead.fl_importeventa` (moneda): precio final de la venta; se pide al pasar
a Cierre y suma en "Facturado". Se lee aparte de `LEAD_SELECT`
(`fetchImportesVenta`) para que nada falle en un entorno sin esa columna.

### `fl_zona` y `fl_modelo` — red comercial real y catálogo

Cargados con `scripts/dataverse/16-red-ebro-y-modelos.ps1` desde
`scripts/dataverse/datos/red-ebro.json` (exportado del Excel "BBDD FLOTAS",
pestañas RESPONSABLE EBRO BUSINESS y MODELOS DE INTERES). Lectura vía
`src/lib/catalogosService.ts` (`fetchZonas`, `fetchModelos`).

- **7 zonas** (`fl_nombre` "Zona N", `fl_numero`, `fl_areamanager` texto), 42
  concesionarios, 108 sedes.
- **La zona va en la sede** (`fl_ubicacion.fl_zona`), no en el concesionario:
  M AUTOMOCION tiene sedes en la Zona 2 (Barcelona) y en la Zona 4 (Madrid).
  `fl_ubicacion.fl_areamanager` se rellena también como "Nombre (Zona N)".
- Las sedes de demo "M Automocion Barcelona/Madrid" se reutilizaron (renombradas
  a las del Excel), así que sus leads y usuarios de demo siguen enlazados. Los
  concesionarios de demo **Norte Motor** y **Auto Zaragoza** no están en el
  Excel: siguen ahí, sin zona.
- `fl_modelo`: 13 modelos (`fl_nombre` "S700 HEV LUXURY", `fl_familia` S700,
  `fl_motorizacion`, `fl_acabado`, `fl_orden`, `fl_activo`). Son los que deben
  salir en los desplegables; `fl_lead.fl_modelosinteres` sigue siendo texto
  libre hasta la reestructuración de abajo.

## Empresa / Oportunidad (implantado el 28/10/2026)

Esquema en `scripts/dataverse/17-empresa-oportunidad.ps1`; los 46 leads que
había se pasaron con `18-migrar-empresas.ps1` (46 empresas, ningún CIF
repetido dentro de un concesionario).

- **`fl_empresa`** — el cliente, **una por CIF dentro de cada concesionario**
  (`fl_cif` normalizado sin espacios/guiones/puntos y en mayúsculas,
  `fl_concesionario`). Guarda las secciones 1 y 2 de la ficha: razón social,
  CIF y contactos. Las secciones 3-5 (flota, necesidad, seguimiento) son de
  cada oportunidad. Sus columnas de flota y sector existen pero no se usan
  (la migración las rellenó; se pueden borrar). Además guarda
  `fl_estado` (Cliente potencial / Cliente / Fidelización) y
  `fl_oportunidadabierta` (lookup a la oportunidad en curso).
- **`fl_lead` es la Oportunidad**: nuevos lookups `fl_empresa` y
  `fl_comercial` (→ `fl_usuarioapp`). `fl_comercialresponsable` (texto) se
  sigue rellenando con el nombre para las listas. Razón social y CIF se copian
  en el lead porque las listas filtran por ellos; los contactos se leen de
  la empresa: `conDatosDeEmpresa` (leadsService.ts)
  los copia sobre cada lead al leerlo, así listas, KPIs y Excel no cambian.
  Al editar el detalle, los contactos se guardan en la empresa
  (`CAMPOS_EMPRESA`).
- **`fl_lineaoportunidad`** — modelo de `fl_modelo` + cantidad. Tras cada
  cambio, `fl_modelosinteres` y `fl_numvehiculosrenovarampliar` del lead se
  recalculan como resumen (`guardarResumenLineas`). Los leads migrados
  conservan su texto libre (eran familias, "S700", sin modelo exacto).
- **Duplicados**: una oportunidad está abierta de Prospección a Negociación
  (`esFaseAbierta`). Solo una abierta por empresa: el alta pide primero el CIF
  y, si la empresa tiene `fl_oportunidadabierta`, no deja continuar. Se usa
  el lookup de la empresa y no una consulta de leads porque con seguridad
  Basic no se ven los de los compañeros; su número sale de la anotación
  `FormattedValue` del lookup. `cambiarFaseLead` lo mantiene
  (`sincronizarEmpresaConFase`) y pasa la empresa a Cliente al llegar a
  Cierre/Entrega.
- **Sede**: quien lleva varias elige primero en cuál da de alta (por defecto su sede
  principal); el CIF se busca en el concesionario de esa sede y la empresa nueva se crea
  a nombre del equipo de ese concesionario (si no se puede, a nombre de quien la crea).
- **Comercial**: en el alta, si la sede tiene varios usuarios activos sale un
  desplegable (por defecto el conectado). Si se elige a otro y tiene
  `fl_systemuserid`, la oportunidad se le reasigna (`ownerid`) al final del
  alta; las relaciones de `fl_lead` con `fl_fasehistorico`, `fl_tarea` y
  `fl_lineaoportunidad` cascadean la asignación. Si no tiene usuario
  vinculado, queda a nombre de quien la crea.
- Ficha de empresa en `/empresa/:id` con todas sus oportunidades visibles.

Decisiones tomadas sin validar aún con Ventas:

- Empresa por concesionario, no global de la red: cada concesionario tiene su
  propia ficha del cliente y no se avisa si otro concesionario trabaja el
  mismo CIF (sería revelar clientes entre concesionarios).
- Importe facturado como total (`fl_importeventa`, se pide al pasar a
  Cierre); las líneas llevan modelo y cantidad, sin precio.
- Estado de la empresa automático, solo Cliente potencial / Cliente (la
  opción Fidelización sigue en Dataverse sin usarse).

## Seguridad (roles reales, auditados en el entorno — no solo lo que dicen los scripts)

Todo en la Business Unit raíz (no hay BU por dealer; el aislamiento entre
concesionarios es por `Basic`/ownership, no por BU).

| Rol | `fl_lead` / `fl_fasehistorico` | `fl_concesionario`/`fl_ubicacion`/`fl_usuarioapp` |
|---|---|---|
| **CRM Flotas B2B - Concesionario** | Create/Read/Write, **Basic** (solo lo suyo) | Read, Global |
| **CRM Flotas B2B - Equipo de Ventas** | **Read-only**, Global (ve todo, no edita) | Read, Global |
| **CRM Flotas B2B - Administrador** | CRUD completo, Global, en las 5 tablas | — |

`fl_tarea`: Concesionario CRUD Basic, Equipo de Ventas Read Global, Administrador
todo Global. `fl_empresa`: Concesionario Create/Read/Write/Assign **Basic** desde el
30/10/2026 (antes Global): ve las suyas y las de los equipos de sus concesionarios,
y ninguna de otros concesionarios aunque las pida directamente (protección real, no
solo un filtro de la app). Equipo de Ventas Read Global. `fl_asignacion`: Read Global
para Concesionario y Equipo de Ventas, Administrador todo Global. Concesionario tiene
además Read Global en `Team`. `fl_lineaoportunidad`: Concesionario CRUD Basic, Equipo de Ventas
Read Global. Concesionario tiene además `Assign` Basic en `fl_lead`,
`fl_fasehistorico`, `fl_tarea` y `fl_lineaoportunidad` para reasignar al
comercial elegido. `fl_objetivo`: Read Global para Concesionario, Equipo de Ventas
Create/Read/Write/Delete Global (`23-editar-objetivos-ventas.ps1`, para
`/configuracion`), Administrador todo Global.

`Append`/`AppendTo` concedido Global en las 5 tablas a los roles no-admin
(imprescindible para los `@odata.bind` al crear/vincular registros). Sin
`Delete` salvo para Administrador — un lead no se borra nunca, se marca
Perdido.

El admin real (`allanos@ebroauto.com`) tiene asignado el rol Administrador y
su propia fila en `fl_usuarioapp`, lo que le permite usar "Ver como rol" para
probar la vista de Concesionario/Equipo de Ventas sin otra cuenta.

## Pantallas

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/nuevo-lead` | Concesionario | Alta en 2 pasos (secciones 1 y 2 del Excel). Pide primero el CIF y comprueba empresa existente / oportunidad en curso. Quien lleva varias sedes elige la instalación (agrupadas por concesionario si lleva varios); concesionario y area manager salen de esa sede; comercial con desplegable si la sede la llevan varios. Fase inicial fija en "1. Prospección". |
| `/mis-leads` | Concesionario | Lista filtrada por `ownerid` vía seguridad Basic (no hace falta filtrar en la query): cada comercial ve **solo las suyas**, aunque comparta sede. Quien lleva varias sedes tiene además filtro de Sede y la columna Concesionario (con la sede). Vista Tabla o Pipeline. Filtros de varias opciones (fase, modelo del catálogo, empresa) y buscador que busca en todos los campos, tareas y notas (`src/lib/filtrosLeads.ts`). En el pipeline las tarjetas se arrastran a otra fase y se abre `CambioFaseDialog` con esa fase; los campos de las tarjetas los elige cada usuario ("Campos de tarjeta", guardado en su navegador, `camposTarjeta.ts`). Acepta `?fase=` en el enlace (lo usa el gráfico de Inicio). |
| `/lead/:id` (`DetalleLead`) | Concesionario (edición) / Equipo de Ventas (solo lectura) | Izquierda: datos en bloques compactos (`DatosLead.tsx`), todos editables en cualquier fase con el lápiz, salvo la fecha de primer contacto y lo que viene de la sede; razón social, CIF y contactos se guardan en `fl_empresa` (el CIF se comprueba contra las otras empresas del concesionario); el comercial se cambia entre los usuarios de la sede y la oportunidad se le reasigna. Derecha: historial de fases con las tareas de cada fase debajo (cada tarea se despliega con descripción, enlace, adjuntos y notas) y notas generales con adjuntos. Cambio de fase con ventana (`CambioFaseDialog`) que pide los datos de la fase destino, y aviso arriba de lo que falta en la fase actual con botón "Completar". Qué pide cada fase y qué es obligatorio está en `src/lib/camposFase.ts` (`REQUISITOS`). |
| `/empresas` (`Empresas`) | Concesionario (las de sus concesionarios, con filtro y columna de concesionario si lleva varios) / Equipo de Ventas (toda la red) | Lista de empresas con estado, oportunidad en curso, nº de oportunidades y ventas; filtros por texto, estado, concesionario y "con oportunidad en curso". |
| `/empresa/:id` (`DetalleEmpresa`) | Todos | Datos de la empresa, estado (automático, solo lectura) y sus oportunidades; "Nueva oportunidad" si no tiene una en curso. |
| `/mi-actividad` ("Inicio") | Concesionario | Pantalla de entrada del dealer. Tarjetas con filtro mes/año: leads activados (llegaron a Primer Contacto o más), ventas cerradas (llegaron a Cierre y no están Perdido), objetivo de leads (creados frente a la suma del objetivo de sus concesionarios, ver `fl_objetivo`) y tasa de conversión (la misma tarjeta que en el Inicio de ventas). Quien lleva varias sedes tiene filtro de Sede (filtra todas las cifras, el objetivo y las tareas). Últimas ventas (con el número de vehículos, no el importe), Tareas (cambio de estado, número de oportunidad y botón para abrirla; al cerrarla se pide una nota que no se muestra aquí; "Ver todas" con desplazamiento; calendario) y oportunidades por fase en columnas (`FaseColumnas`, cada columna abre Mis leads filtrado). Es `InicioPanel` en modo `concesionario`. Fechas de hito sacadas de `fl_fasehistorico` (`actividadService.ts`). |
| `/seguimiento` (`SeguimientoLeads`) | Equipo de Ventas | Todos los leads en Tabla o Pipeline (de solo lectura, sin arrastrar). Filtros de varias opciones: concesionario, sede, fase, modelo, empresa; buscador en todo. Columnas reordenables y configurables, ordenable. |
| `/panel-kpi` ("Inicio" del equipo de ventas) | Equipo de Ventas | Pantalla de entrada de ventas: `InicioPanel` en modo `red`, siempre de toda la red. Tarjetas: oportunidades activadas, ventas, objetivo (suma del de todos los concesionarios) y tasa de conversión (contactados que acaban en venta). Tabla de oportunidades por fase con dos niveles y subtotal (Vista: zona → concesionario, concesionario → sede, etc., o ranking de modelos) y periodo propio. Debajo, "Análisis del pipeline": indicadores del Excel "KPI Dashboard" (`kpiService.ts`), tiempo medio por fase, conversión y oportunidades por concesionario. |
| `/info` | Equipo de Ventas | Árbol Concesionario → Ubicaciones → usuarios que la llevan (cada usuario sale en todas sus sedes; directorio de solo lectura). |
| `/usuarios` ("Usuarios y accesos") | Administrador (no con "Ver como rol") | Lista de usuarios y editor: datos, tipo, activo, y "Lo que lleva" — árbol concesionario → sedes con casilla de concesionario entero, buscador y filtro de zona. Al guardar sincroniza equipos y rol de seguridad (`guardarUsuario`). Los objetivos no van aquí, sino en `/configuracion`. |
| `/configuracion` ("Configuración") | Equipo de Ventas | Objetivo de oportunidades al mes por concesionario (o el general), buscable y filtrable por zona, con el trimestre y el año calculados. |

## Diseño

Paleta en `src/styles/common.css` (`--color-primary: #1d1d1b`, blanco
dominante, nada de azul — decisión explícita del negocio). Fases con rampa
ordinal gris frío → negro (`FASE_COLORS` en `src/components/StatusBadge.tsx`),
"Perdido" con token crítico rojo aparte, nunca dentro de la rampa. El
desplegable de fase (`FaseSelect`, mismo archivo) es un componente propio con
punto de color por opción — un `<select>` nativo con `<option>` de fondo
coloreado se renderiza mal en el navegador, por eso no se usa.

## Migrar a otro entorno

Dos cosas viajan por caminos **distintos** — no asumir que una trae la otra:

1. **Esquema (tablas, columnas, relaciones, roles de seguridad, y el registro
   de la app)**: exportar la solución `CRMFlotasB2B` como solución no
   administrada e importarla en el entorno nuevo. Ya está completa (5 tablas +
   3 roles + la app; las relaciones viajan solas). Tras importar, hay que
   volver a asignar los roles a los usuarios reales del entorno nuevo (los
   scripts `04-assign-admin.ps1`/`05-seed-data.ps1` sirven de referencia, pero
   los IDs de usuario son distintos en cada entorno).
2. **La conexión a Dataverse de la app**: aunque el registro de la app ahora
   viaja con la solución, su conexión a Dataverse (`commondataserviceforapps`)
   es específica del entorno de origen y no se reconecta sola. Tras importar,
   hay que volver a hacer `pac code push` apuntando al `environmentId` nuevo
   (actualizar `power.config.json`) y crear/asociar una conexión Dataverse
   nueva en ese entorno (`pac code add-data-source` con el `--connection-id`
   de la conexión del entorno nuevo) para que la app importada quede
   funcional.
3. **Los datos de demo** (concesionarios/ubicaciones de ejemplo, los ~42 leads
   de prueba de `07-seed-leads-demo.ps1`): tampoco viajan con la solución — una
   solución lleva esquema, no filas. Si se quieren en el entorno nuevo, hay
   que re-ejecutar los scripts de seed ahí, o hacer una exportación/importación
   de datos aparte.

## Errores ya resueltos (para no repetirlos)

- TypeScript real `enum` no compila (`tsconfig.app.json` tiene
  `erasableSyntaxOnly`) — usar el patrón `const X = {...} as const` +
  `type X = (typeof X)[keyof typeof X]`, ver `RolApp`/`Fase`/etc. en `types.ts`.
- Filtrar KPIs/periodos por `fl_fechaprimercontacto` (fecha de negocio), nunca
  por `createdon` (fecha técnica del registro — con datos de demo creados el
  mismo día, no distingue nada entre periodos).
- `pac code add-data-source` necesita `--connection-id` explícito; sacarlo con
  `pac connection list --environment <id>`.
