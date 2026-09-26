import type { FastifyInstance } from 'fastify'
import { codexConnectRequestSchema, CodexConnectionStates, notImplemented, validationError, type CodexConnectRequest, type CodexStatusDto } from '@ainyc/canonry-contracts'
import { requireInstanceAdministrator } from './auth.js'
import { writeAuditLog } from './helpers.js'

export interface CodexRoutesOptions {
  codexConnection?: {
    status(): CodexStatusDto
    connect(input: CodexConnectRequest): Promise<CodexStatusDto>
    refresh(): Promise<CodexStatusDto>
    disconnect(): Promise<CodexStatusDto>
  }
}

export async function codexRoutes(app: FastifyInstance, opts: CodexRoutesOptions): Promise<void> {
  app.get('/settings/providers/codex/status', async request => {
    requireInstanceAdministrator(request)
    return opts.codexConnection?.status() ?? {
      state: CodexConnectionStates.unavailable, enabled: false,
      message: 'Codex subscription access is available only in local Canonry.',
      model: null, runtimeVersion: null, checkedAt: null, models: [],
    } satisfies CodexStatusDto
  })
  for (const action of ['connect', 'refresh', 'disconnect'] as const) {
    app.post(`/settings/providers/codex/${action}`, async request => {
      requireInstanceAdministrator(request)
      const connection = opts.codexConnection
      if (!connection) throw notImplemented('Codex subscription access is available only in local Canonry.')
      const parsed = codexConnectRequestSchema.safeParse(request.body ?? {})
      if (!parsed.success || (action !== 'connect' && parsed.data.model !== undefined)) throw validationError('Invalid Codex connection request.')
      const result = action === 'connect' ? await connection.connect(parsed.data)
        : action === 'refresh' ? await connection.refresh() : await connection.disconnect()
      if (action !== 'refresh') writeAuditLog(app.db, { actor: 'api', action: `codex.${action}`, entityType: 'provider', entityId: 'codex' })
      return result
    })
  }
}
