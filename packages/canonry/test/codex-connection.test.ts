import { expect, it, vi } from 'vitest'
import { CodexRuntime, createCodexAdapter } from '@ainyc/canonry-provider-codex'
import type { CanonryConfig } from '../src/config.js'
import { createCodexConnection } from '../src/codex-connection.js'
import { ProviderRegistry } from '../src/provider-registry.js'

it('persists only non-secret configuration and never enrolls Codex implicitly', async () => {
  const runtime = new CodexRuntime()
  const inspect = vi.spyOn(runtime, 'inspect').mockResolvedValue({ accountId: 'fingerprint', runtimeVersion: '0.157.1', defaultModel: 'test-model', models: [{ id: 'test-model', displayName: 'Test', tier: 'standard' }] })
  const close = vi.spyOn(runtime, 'close').mockResolvedValue()
  const config: CanonryConfig = { apiUrl: 'http://localhost:4100', apiKey: 'cnry_test', database: ':memory:' }
  const registry = new ProviderRegistry()
  const persist = vi.fn()
  const connection = createCodexConnection(config, registry, createCodexAdapter(runtime), runtime, vi.fn(), persist)
  await connection.connect({})
  expect(config.providers?.codex).toEqual({ enabled: true, codexAccountId: 'fingerprint', model: 'test-model', quota: { maxConcurrency: 1, maxRequestsPerMinute: 6, maxRequestsPerDay: 100 } })
  expect(registry.getForProject([])).toEqual([])
  expect(registry.getForProject(['codex'])).toHaveLength(1)
  inspect.mockResolvedValue({ accountId: 'changed', runtimeVersion: '0.157.1', defaultModel: 'test-model', models: [] })
  expect(await connection.refresh()).toMatchObject({ state: 'account-changed' })
  expect(await connection.disconnect()).toMatchObject({ state: 'disconnected', enabled: false })
  expect(registry.get('codex')).toBeUndefined()
  expect(close).toHaveBeenCalledTimes(1)
  expect(persist).toHaveBeenCalledTimes(2)
})

it('does not register or change configuration if persistence fails', async () => {
  const runtime = new CodexRuntime()
  vi.spyOn(runtime, 'inspect').mockResolvedValue({ accountId: 'fingerprint', runtimeVersion: '0.157.1', defaultModel: 'test-model', models: [{ id: 'test-model', displayName: 'Test', tier: 'standard' }] })
  const config: CanonryConfig = { apiUrl: 'http://localhost:4100', apiKey: 'cnry_test', database: ':memory:' }
  const registry = new ProviderRegistry()
  const connection = createCodexConnection(config, registry, createCodexAdapter(runtime), runtime, vi.fn(), () => { throw new Error('Disk full') })
  await expect(connection.connect({})).rejects.toThrow('Disk full')
  expect(config.providers?.codex).toBeUndefined()
  expect(registry.get('codex')).toBeUndefined()
})


it('restores configured status after restart without claiming a fresh authentication check', () => {
  const runtime = new CodexRuntime()
  const inspect = vi.spyOn(runtime, 'inspect')
  const config: CanonryConfig = { apiUrl: 'http://localhost:4100', apiKey: 'cnry_test', database: ':memory:', providers: { codex: { enabled: true, model: 'pinned-model', codexAccountId: 'fingerprint' } } }
  const connection = createCodexConnection(config, new ProviderRegistry(), createCodexAdapter(runtime), runtime, vi.fn(), vi.fn())
  expect(connection.status()).toMatchObject({ enabled: true, state: 'connected', model: 'pinned-model', checkedAt: null })
  expect(connection.status().message).toContain('Check again')
  expect(inspect).not.toHaveBeenCalled()
})
