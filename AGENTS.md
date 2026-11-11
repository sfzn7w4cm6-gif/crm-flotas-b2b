# Instrucciones para asistentes de IA

Este proyecto se documenta en **[CLAUDE.md](CLAUDE.md)**. Léelo entero antes de proponer o
hacer cambios: es válido para cualquier asistente (Claude, Copilot, Codex, Cursor...).

Resumen de lo imprescindible:

- Power Apps Code App (React 19 + TypeScript + Vite) sobre Dataverse. Todo en español.
- Dos entornos: **desarrollo** (por defecto en todo) y **producción**. Publicar con
  `scripts/publicar.ps1 -Entorno dev|prod`. A producción solo con permiso explícito de la
  responsable.
- `power.config.json` siempre con los valores de desarrollo.
- Acceso a datos solo por `src/lib/dataverseClient.ts`. Toda tabla nueva debe ser **origen
  nativo de Dataverse** (`pac code add-data-source -a dataverse -t <tabla>`); si no, los
  invitados externos no pueden entrar.
- Esquema solo con scripts idempotentes en `scripts/dataverse/` (`DV_ENTORNO=prod` para
  producción).
- No usar `enum` de TypeScript; usar `const X = {...} as const`.
- No subir datos personales reales. No tocar tablas `hr_*` (otra app).
- Comprobar `npm run build` antes de publicar. Mantener CLAUDE.md al día.
