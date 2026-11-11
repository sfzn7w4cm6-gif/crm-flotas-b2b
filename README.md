# Ebro Business (CRM Flotas B2B)

App interna de EBRO para que la **red de concesionarios** registre y siga sus oportunidades de
venta de flotas a empresas, y para que el **Equipo de Ventas** vea toda la red, ponga el
descuento de marca y siga los objetivos. Sustituye al Excel compartido que se usaba antes.

Es un **Power Apps Code App**: una web en React + TypeScript + Vite que se publica dentro de
Power Apps y guarda los datos en **Dataverse**.

> **Documentación técnica completa: [CLAUDE.md](CLAUDE.md).** Explica entornos, arquitectura,
> modelo de datos, seguridad, reglas de negocio y problemas ya resueltos. Léelo (o dáselo a tu
> asistente de IA) antes de cambiar nada.

## Entornos

| | Desarrollo | Producción |
|---|---|---|
| App | "Ebro Business" | "Ebro Business App" |
| Entorno de Power Platform | Ariadna Llanos (`192d0a93-f34e-e64a-a9c3-6558e2f66156`) | Entorno - Equipo de Ventas (`6adf3534-66c7-e4a1-95c7-045d1b228f44`) |
| Dataverse | `https://org642a1b00.crm4.dynamics.com` | `https://org9d11094c.crm4.dynamics.com` |
| Abrir | [desarrollo](https://apps.powerapps.com/play/e/192d0a93-f34e-e64a-a9c3-6558e2f66156/app/033039d0-63b6-4df9-91a1-14fec80dffba) | [producción](https://apps.powerapps.com/play/e/6adf3534-66c7-e4a1-95c7-045d1b228f44/app/b9bfcd40-fbb7-4e29-88a8-7275312e769f) |

`power.config.json` apunta siempre a **desarrollo**. Producción se publica con el script de
abajo, que hace el cambio y lo deshace.

## Puesta en marcha

Requisitos: Node 20 o superior, [Power Platform CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction)
(`pac`) y acceso al entorno de desarrollo con rol de personalizador.

```powershell
git clone https://github.com/sfzn7w4cm6-gif/crm-flotas-b2b.git
cd crm-flotas-b2b
npm install
pac auth create --environment 192d0a93-f34e-e64a-a9c3-6558e2f66156

# Solo en la red de EBRO (proxy corporativo):
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.pac-certs\corporate-ca-bundle.pem"
```

| Comando | Para qué |
|---|---|
| `npm run dev` y `pac code run` | Probar en local con los **datos reales de desarrollo** (lo que guardes se guarda de verdad). |
| `npm run demo` | Probar o enseñar la app con **datos ficticios**, sin conexión (`http://localhost:3100`). |
| `npm run build` | Compilar. Tiene que terminar sin errores. |
| `.\scripts\publicar.ps1 -Entorno dev` | Publicar en desarrollo. |
| `.\scripts\publicar.ps1 -Entorno prod` | Publicar en producción (pide confirmación). |

## Cómo se trabaja

1. `git pull` antes de empezar: `pac code push` reemplaza la app entera, así que si dos
   personas publican desde versiones distintas, la última pisa a la otra.
2. Hacer el cambio y comprobar que `npm run build` compila.
3. Si hace falta cambiar tablas o columnas: script nuevo en `scripts/dataverse/` (ver
   [su README](scripts/dataverse/README.md)), primero en desarrollo.
4. Commit en `main` y publicar en **desarrollo**. Probar.
5. Con el visto bueno, publicar en **producción** (scripts de esquema con `DV_ENTORNO=prod` y
   después la app). Comprobar.
6. Actualizar `CLAUDE.md` si cambia algo importante.

## Lo más importante que no hay que romper

- **Toda tabla que use la app debe darse de alta como origen nativo de Dataverse**
  (`pac code add-data-source -a dataverse -t <tabla>`). Si no, los concesionarios, que son
  invitados externos, no pueden entrar (error `0x80072560 The user is not a member of the
  organization`). Está explicado en CLAUDE.md, sección 15.1.
- No hacer commit de `power.config.json` con los valores de producción.
- No subir Excel ni datos personales reales al repositorio.
- El entorno de desarrollo también tiene otras apps (PeopleFlow, Tracking Vehículos): no
  tocar sus tablas.

## Estructura

```
src/                 código de la app (pantallas en src/pages, lógica en src/lib)
demo/                datos ficticios para "npm run demo"
scripts/publicar.ps1 publicar en desarrollo o producción
scripts/dataverse/   scripts que crean el esquema y cargan datos en Dataverse
.power/, src/generated/  generados por pac (no editar a mano)
CLAUDE.md            documentación técnica completa
AGENTS.md            indicaciones para asistentes de IA
```

## Contacto

Responsable del proyecto: Ariadna Llanos (EBRO).
