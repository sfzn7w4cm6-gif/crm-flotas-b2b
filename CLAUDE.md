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
  ese correo → de ahí saca `fl_rol`, `fl_ubicacion` y `fl_concesionario`. Si el
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

### `fl_lead` — la Ficha de Cliente (autonumérico `LEAD-{SEQNUM:5}`, UserOwned)

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
Negociación → 6. Cierre → 7. Entrega → 8. Fidelización**, más **Perdido**
(estado terminal alcanzable desde cualquier fase, excluido del embudo/gráficos
ordinales, exige rellenar `fl_motivoperdida`).

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

## Seguridad (roles reales, auditados en el entorno — no solo lo que dicen los scripts)

Todo en la Business Unit raíz (no hay BU por dealer; el aislamiento entre
concesionarios es por `Basic`/ownership, no por BU).

| Rol | `fl_lead` / `fl_fasehistorico` | `fl_concesionario`/`fl_ubicacion`/`fl_usuarioapp` |
|---|---|---|
| **CRM Flotas B2B - Concesionario** | Create/Read/Write, **Basic** (solo lo suyo) | Read, Global |
| **CRM Flotas B2B - Equipo de Ventas** | **Read-only**, Global (ve todo, no edita) | Read, Global |
| **CRM Flotas B2B - Administrador** | CRUD completo, Global, en las 5 tablas | — |

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
| `/nuevo-lead` | Concesionario | Wizard de 5 pasos calcado de las 5 secciones del Excel. Fase inicial fija en "1. Prospección". |
| `/mis-leads` | Concesionario | Lista filtrada por `ownerid` vía seguridad Basic (no hace falta filtrar en la query). |
| `/mis-leads/:id` (`DetalleLead`) | Concesionario (edición) / Equipo de Ventas (solo lectura) | Edición de secciones 3-5, cambio de fase (con color por fase), timeline de `fl_fasehistorico`. |
| `/mi-actividad` | Concesionario | Estadísticas propias: leads por fase, vehículos en pipeline, acciones pendientes esta semana. |
| `/seguimiento` (`SeguimientoLeads`) | Equipo de Ventas | Tabla de todos los leads, filtros Concesionario/Ubicación/Fase, columnas reordenables (drag & drop) y configurables ("Editar vista"), ordenable. |
| `/panel-kpi` | Equipo de Ventas | Las métricas del Excel "KPI Dashboard" (ver `kpiService.ts`), gráficos SVG propios (sin librería), filtro de periodo 30/90/todo sobre `fl_fechaprimercontacto` (no `createdon`). |
| `/info` | Equipo de Ventas | Árbol Concesionario → Ubicaciones → usuario asignado (directorio de solo lectura). |

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
