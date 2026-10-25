# Guía de arranque — CRM Flotas B2B (para quien se incorpora al proyecto)

Este documento es para que lo use tu asistente de IA (Claude, Copilot, etc.)
la primera vez que abras este proyecto. Dale este archivo entero como
contexto antes de pedirle que cambie nada.

## Qué es esto

Una app interna de EBRO para que los concesionarios registren y hagan
seguimiento de oportunidades de venta de flotas a empresas (B2B), y para que
el equipo de ventas central tenga visibilidad de todos los concesionarios a
la vez con un panel de KPIs. Sustituye un Excel compartido que se usaba antes.

Es un **Power Apps Code App**: una app web normal hecha en React + TypeScript
+ Vite, que usa **Dataverse** (la base de datos de Power Platform) como
backend, y se publica dentro de Power Apps con un comando de la CLI de Power
Platform (`pac`), no con un despliegue web tradicional.

## Repositorio

- https://github.com/sfzn7w4cm6-gif/crm-flotas-b2b
- Rama única: `main`. Trabaja siempre con `git pull` reciente antes de tocar
  nada — como `pac code push` sustituye la app entera de golpe, si dos
  personas publican a la vez desde versiones distintas del código, la última
  publicación "gana" y pisa los cambios de la otra persona sin avisar. Avisaos
  por chat antes de publicar si vais a tocar lo mismo el mismo día.

## El documento importante: `CLAUDE.md`

En la raíz del proyecto hay un archivo **`CLAUDE.md`** con la explicación
completa y técnica de todo: las 5 tablas de Dataverse campo por campo, los 3
roles de seguridad y qué puede hacer cada uno, las pantallas de la app, cómo
funciona el inicio de sesión y el cambio de rol para pruebas ("Ver como rol"),
la lógica de cálculo de los KPIs, el sistema de diseño/colores, y cómo migrar
el proyecto a otro entorno de Power Platform si hace falta.

**Léelo primero (o pide a tu IA que lo lea) antes de hacer cualquier cambio.**
Está pensado para que cualquiera —persona o IA— pueda retomar el proyecto sin
tener que adivinar nada sobre cómo está montado.

## Puesta en marcha en tu equipo

1. Clona el repo y entra en la carpeta:
   ```
   git clone https://github.com/sfzn7w4cm6-gif/crm-flotas-b2b.git
   cd crm-flotas-b2b
   npm install
   ```
2. Necesitas acceso al entorno de Power Platform `Ariadna Llanos`
   (`https://org642a1b00.crm4.dynamics.com`) con un rol que permita personalizar
   (System Customizer o similar) — pide que te lo den de alta si todavía no lo
   tienes.
3. Instala la CLI de Power Platform si no la tienes (`pac`), y autentícate
   contra ese entorno:
   ```
   pac auth create --environment 192d0a93-f34e-e64a-a9c3-6558e2f66156
   ```
4. Para probar cambios localmente antes de publicar: `npx power-apps run`
   (abre la app en local conectada a los datos reales de Dataverse — ten
   cuidado, no es un entorno de pruebas separado, es el mismo Dataverse que
   usan los concesionarios).
5. Para publicar tus cambios para que todo el mundo los vea en la app real:
   ```
   npm run build
   pac code push
   ```
   Hazlo solo cuando tu código esté probado y subido a `main` — esto reemplaza
   la app en producción al instante, no hay entorno de staging intermedio.

## Qué NO se toca desde aquí

El mismo entorno de Power Platform también tiene otras apps independientes
(una de RRHH llamada "PeopleFlow", prefijo de tablas `hr_`, y otra de
logística llamada "Tracking Vehículos"). No tienen ninguna relación con CRM
Flotas B2B — no edites sus tablas ni su código desde este proyecto.

## Si algo no está claro

Todo el detalle técnico fino (esquema de datos, seguridad, lógica de
negocio) está en `CLAUDE.md`, no repetido aquí para no desincronizarse con el
código real. Si `CLAUDE.md` no responde la duda, lo más fiable es revisar
directamente el esquema en Dataverse (`make.powerapps.com` → tablas con
prefijo `fl_`) o preguntar a Ariadna.
