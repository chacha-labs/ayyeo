import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, expect, it, vi } from 'vitest'
import { apiRoutes, hashApiKey, createUserSession, USER_SESSION_COOKIE_NAME } from '@ainyc/canonry-api-routes'
import { apiKeys, createClient, migrate, projects, users } from '@ainyc/canonry-db'
import { CodexConnectionStates, type CodexStatusDto } from '@ainyc/canonry-contracts'
import { createApiClient } from '../src/client.js'
import { codexConnectionCommand } from '../src/commands/settings.js'
import { createCanonryMcpServer } from '../src/mcp/server.js'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function harness(hosted = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canonry-codex-surfaces-'))
  const db = createClient(path.join(directory, 'test.db')); migrate(db)
  const now = new Date().toISOString()
  db.insert(projects).values({ id: 'project', name: 'project', displayName: 'Project', canonicalDomain: 'example.com', country: 'US', language: 'en', createdAt: now, updatedAt: now }).run()
  for (const [name, scopes, projectId] of [['root', ['*'], null], ['read', ['read'], null], ['settings', ['settings.write'], null], ['project', ['*'], 'project']] as const) {
    db.insert(apiKeys).values({ id: crypto.randomUUID(), name, keyHash: hashApiKey(`cnry_${name}`), keyPrefix: 'cnry_test', scopes: [...scopes], projectId, createdAt: now }).run()
  }
  db.insert(users).values({ id: 'viewer', name: 'Viewer', nameKey: 'viewer', role: 'viewer', passwordHash: 'unused', createdAt: now }).run()
  const viewerCookie = createUserSession(db, 'viewer')
  let status: CodexStatusDto = { state: CodexConnectionStates.disconnected, enabled: false, message: 'Disconnected', model: null, runtimeVersion: '0.157.1', checkedAt: null, models: [] }
  const connect = vi.fn(async (input: { model?: string }) => { status = { ...status, state: CodexConnectionStates.connected, enabled: true, model: input.model ?? 'test-model' }; return status })
  const refresh = vi.fn(async () => status)
  const disconnect = vi.fn(async () => { status = { ...status, state: CodexConnectionStates.disconnected, enabled: false }; return status })
  const app = Fastify()
  await app.register(apiRoutes, { db, routePrefix: '/canonry/api/v1', ...(!hosted ? { codexConnection: { status: () => status, connect, refresh, disconnect } } : {}) })
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test address')
  const apiUrl = `http://127.0.0.1:${address.port}/canonry`
  vi.stubEnv('CANONRY_CONFIG_DIR', directory)
  vi.stubEnv('CANONRY_BASE_PATH', '/canonry/')
  vi.stubEnv('CANONRY_PORT', '')
  const useKey = (name: string) => fs.writeFileSync(path.join(directory, 'config.yaml'), JSON.stringify({ apiUrl, apiKey: `cnry_${name}`, database: path.join(directory, 'test.db'), basePath: '/canonry/' }))
  useKey('root')
  cleanups.push(async () => { await app.close(); db.$client.close(); fs.rmSync(directory, { recursive: true, force: true }) })
  return { app, useKey, connect, refresh, disconnect, viewerCookie }
}

it('keeps API, CLI JSON, and actual MCP calls equivalent over an authenticated base-path server', async () => {
  const { connect, refresh, disconnect } = await harness()
  const api = createApiClient()
  const expected = await api.codexConnect({ model: 'chosen-model' })
  const output = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  await codexConnectionCommand('status', { format: 'json' })
  expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toEqual(expected)
  const server = createCanonryMcpServer({ eager: true, credentialScopes: ['*'], clientFactory: () => createApiClient() })
  const client = new Client({ name: 'codex-connection-test', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport); await client.connect(clientTransport)
  cleanups.push(async () => { await client.close(); await server.close() })
  const read = await client.callTool({ name: 'canonry_codex_status', arguments: {} })
  expect(read.isError).not.toBe(true)
  expect(read.structuredContent).toEqual(expected)
  const reconnected = await client.callTool({ name: 'canonry_codex_connect', arguments: { model: 'chosen-model' } })
  expect(reconnected.structuredContent).toEqual(expected)
  const refreshed = await client.callTool({ name: 'canonry_codex_refresh', arguments: {} })
  expect(refreshed.structuredContent).toEqual(expected)
  expect(refresh).toHaveBeenCalledTimes(1)
  const disconnected = await client.callTool({ name: 'canonry_codex_disconnect', arguments: {} })
  expect(disconnected.isError).not.toBe(true)
  expect(disconnected.structuredContent).toMatchObject({ enabled: false, state: 'disconnected' })
  expect(connect).toHaveBeenCalledTimes(2)
  expect(connect).toHaveBeenLastCalledWith({ model: 'chosen-model' })
  expect(disconnect).toHaveBeenCalledTimes(1)
})

it.each(['read', 'settings', 'project'])('rejects %s credentials before invoking the host', async credential => {
  const { useKey, connect, refresh, disconnect } = await harness()
  useKey(credential)
  const api = createApiClient()
  for (const call of [() => api.codexStatus(), () => api.codexConnect(), () => api.codexRefresh(), () => api.codexDisconnect()]) await expect(call()).rejects.toThrow()
  expect(connect).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(disconnect).not.toHaveBeenCalled()
})

it('reports hosted deployment unavailability and refuses credentials in connection requests', async () => {
  const { app } = await harness(true)
  expect(await createApiClient().codexStatus()).toMatchObject({ state: 'unavailable', enabled: false })
  await expect(createApiClient().codexConnect()).rejects.toThrow('local Canonry')
  const result = await app.inject({ method: 'POST', url: '/canonry/api/v1/settings/providers/codex/connect', headers: { authorization: 'Bearer cnry_root' }, payload: { apiKey: 'test' } })
  expect(result.statusCode).toBe(501)
})


it('refuses viewer sessions and credential-bearing connect payloads before the host callback', async () => {
  const { app, viewerCookie, connect, refresh, disconnect } = await harness()
  for (const action of ['status', 'connect', 'refresh', 'disconnect']) {
    const response = await app.inject({ method: action === 'status' ? 'GET' : 'POST', url: `/canonry/api/v1/settings/providers/codex/${action}`, headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${viewerCookie}` } })
    expect(response.statusCode).toBe(403)
  }
  for (const key of ['apiKey', 'accessToken', 'executable', 'baseUrl']) {
    const response = await app.inject({ method: 'POST', url: '/canonry/api/v1/settings/providers/codex/connect', headers: { authorization: 'Bearer cnry_root' }, payload: { [key]: 'not-accepted' } })
    expect(response.statusCode).toBe(400)
  }
  expect(connect).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(disconnect).not.toHaveBeenCalled()
})
