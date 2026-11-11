# Scripts de Dataverse

Scripts PowerShell que crean y cambian el esquema de Dataverse (tablas, columnas, relaciones,
roles) y cargan los datos de referencia. No hay comando `pac` para esto, así que llaman a la
Web API de Dataverse directamente. Contexto general: [CLAUDE.md](../../CLAUDE.md), sección 6.

## Cómo se ejecutan

Desde la raíz del proyecto, en PowerShell:

```powershell
# DESARROLLO (por defecto)
.\scripts\dataverse\32-descuento-por-modelo.ps1

# PRODUCCION
$env:DV_ENTORNO = "prod"
.\scripts\dataverse\32-descuento-por-modelo.ps1
Remove-Item Env:\DV_ENTORNO
```

- La primera vez en cada entorno pide iniciar sesión con un código (*device code*): abre la
  URL que muestra e introduce el código. El token se guarda en `%TEMP%\dv-token-cache.json`
  (desarrollo) o `%TEMP%\dv-token-cache-prod.json` (producción).
- Con `DV_ENTORNO=prod` sale en amarillo `>>> ENTORNO: PRODUCCION`. Si no lo ves, estás en
  desarrollo.
- Son **idempotentes**: si algo ya existe se salta. Si uno falla a mitad (p. ej. "conexión
  cerrada por el host remoto"), vuelve a lanzarlo.
- Siempre primero en desarrollo, probar la app y después producción.

## Archivos base

| Archivo | Qué es |
|---|---|
| `auth.ps1` | Login y token. Org de cada entorno (`DV_ENTORNO`). |
| `lib.ps1` | Helpers: `New-DvTable`, `Add-Dv*Column`, `Add-DvLookup`, `New-DvRole`, `Grant-DvTablePrivileges`, `Ensure-DvRecord`... Todo se crea dentro de la solución `CRMFlotasB2B`. Business Unit raíz de cada entorno. |
| `datos/red-ebro.json` | Red comercial real (zonas, concesionarios, sedes) y modelos, exportados del Excel "BBDD FLOTAS". |

## Lista de scripts

Tipo: **E** = esquema o permisos (necesario en cualquier entorno nuevo, en orden), **D** =
carga de datos reales, **demo** = datos ficticios (nunca en producción), **L** = solo lectura
o ayuda puntual, **H** = histórico (ya aplicado, se conserva como registro).

| Script | Tipo | Qué hace |
|---|---|---|
| `00-solution.ps1` | E | Publisher `fl` y solución `CRMFlotasB2B`. |
| `01-tables.ps1` | E | Tablas iniciales: concesionario, ubicación, usuario de la app, lead e histórico de fase. |
| `02-relationships.ps1` | E | Lookups entre esas tablas. |
| `03-security-roles.ps1` | E | Los 3 roles (Concesionario, Equipo de Ventas, Administrador). |
| `04-assign-admin.ps1` | L | Da el rol Administrador a la cuenta conectada (desarrollo). |
| `05-seed-data.ps1` | demo | Concesionarios de ejemplo y perfil del administrador. |
| `06-fix-admin-ubicacion.ps1` | demo | Sede para el perfil del administrador. |
| `07-seed-leads-demo.ps1` | demo | Oportunidades de ejemplo (no idempotente). |
| `08-add-oferta-column.ps1` | E | `fl_lead.fl_ofertacondiciones`. |
| `09-add-areamanager-column.ps1` | E | `fl_ubicacion.fl_areamanager`. |
| `10-seed-areamanager.ps1` | demo | Area manager en las sedes de ejemplo. |
| `11-buscar-usuario.ps1`, `11b-...` | L | Buscar una cuenta de usuario por correo o texto. |
| `12-ver-canvasapp.ps1`, `12b-...` | L | Buscar el registro de la app en Dataverse. |
| `13-dar-acceso-total.ps1` | H | Acceso de administradora a una cuenta concreta (desarrollo). |
| `14-dar-roles-entorno.ps1` | H | Roles de entorno para poder publicar (desarrollo). |
| `15-tareas-objetivos.ps1` | E | `fl_tarea`, `fl_objetivo`, `fl_importeventa`. |
| `16-red-ebro-y-modelos.ps1` | E + D | `fl_zona`, `fl_modelo`, zona en la sede, y carga la red real y el catálogo. |
| `17-empresa-oportunidad.ps1` | E | `fl_empresa`, `fl_lineaoportunidad`, empresa y comercial en el lead. |
| `18-migrar-empresas.ps1` | H | Pasó los leads antiguos al modelo empresa/oportunidad. |
| `19-quitar-fase-fidelizacion.ps1` | H | Quitó la fase 8. Fidelización. |
| `20-numero-lead-L.ps1` | E | Formato del número: `L{SEQNUM:5}`. |
| `21-notas-y-resultado-tareas.ps1` | E | `fl_nota`, `fl_tarea.fl_resultado`. |
| `22-adjuntos-enlace-notas-tarea.ps1` | E | Adjuntos (`annotation`), `fl_tarea.fl_enlace`, `fl_nota.fl_tarea`. |
| `23-editar-objetivos-ventas.ps1` | E | Ventas puede editar objetivos. |
| `24-asignaciones-y-equipos.ps1` | E | `fl_asignacion`, equipo por concesionario, empresas protegidas (Basic). |
| `25-ventas-gestiona-usuarios.ps1` | E | Permisos de ventas para Usuarios y accesos. |
| `26-descuentos-oferta.ps1` | E | Descuentos en el lead; ventas escribe en `fl_lead`. |
| `27-auditoria-migracion.ps1` | L | Comprueba que todas las tablas `fl_*` están en la solución. |
| `28-notificaciones.ps1` | E | `fl_notificacion` (campanita de ventas). |
| `29-objetivos-por-sede.ps1` | E | `fl_objetivo.fl_ubicacion`. |
| `30-sin-concesionario.ps1` | D | Concesionario "Sin concesionario" y sede "Sin sede". |
| `31-cargar-usuarios.ps1` | D | Carga de usuarios desde el Excel de responsables. `-Excel <ruta> [-SinConcesionario a@x.com,...] [-Simular]`. |
| `32-descuento-por-modelo.ps1` | E | Descuentos por modelo, aviso de condiciones, permisos de ventas en las líneas. |
| `33-importar-objetivos.ps1` | D | Objetivos del mes desde la plantilla (`PLANTILLA`: `DEALER` / `OBJETIVO`). `-Excel <ruta> [-Simular]`. |

`-Simular` enseña lo que haría sin escribir nada. Úsalo siempre primero en los scripts de
carga.

## Escribir un script nuevo

1. Siguiente número libre. Cabecera `<# ... #>` con qué hace y por qué.
2. `. "$PSScriptRoot\lib.ps1"` al principio. No pongas URLs de org fijas: usa
   `$script:DvOrgUrl`.
3. Idempotente: comprueba antes de crear (`Test-DvColumnExists`, `Ensure-DvRecord`...).
4. Solo añadir. No borrar columnas ni quitar permisos sin acordarlo.
5. Si creas una **tabla nueva que la app va a leer**, después:
   `pac code add-data-source -a dataverse -t fl_nuevatabla`, añádela a `Tables` en
   `src/lib/dataverseClient.ts` y haz commit de `power.config.json`, `.power/` y
   `src/generated/`. **Sin esto, los concesionarios (invitados externos) no podrán usarla.**
6. Los Excel con datos personales se pasan por parámetro; nunca se copian al repositorio.
7. Añádelo a esta tabla y, si cambia el modelo de datos, a `CLAUDE.md`.
