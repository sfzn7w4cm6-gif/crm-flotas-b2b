// Sustituye a '@microsoft/power-apps/app' en el modo demo: un usuario ficticio de concesionario.
import { DEMO } from './seed'

export async function getContext() {
  return {
    app: {
      appId: 'demo',
      environmentId: '192d0a93-f34e-e64a-a9c3-6558e2f66156',
      dataverseOrgUrl: 'https://demo.crm4.dynamics.com',
      queryParams: {},
    },
    user: {
      fullName: 'Carlos Martín',
      userPrincipalName: 'carlos.martin@automovilesmediterraneo.es',
      objectId: 'demo',
      tenantId: 'demo',
      systemUserId: DEMO.systemUser,
    },
    host: { sessionId: 'demo' },
  }
}

export type IContext = Awaited<ReturnType<typeof getContext>>
