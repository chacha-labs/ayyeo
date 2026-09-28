import { CodexConnectionStates, ProviderNames, describeError, validationError, type CodexConnectRequest, type CodexStatusDto, type ProviderAdapter } from '@ainyc/canonry-contracts'
import { CodexRuntime } from '@ainyc/canonry-provider-codex'
import type { CanonryConfig } from './config.js'
import { saveConfigPatch } from './config.js'
import type { ProviderRegistry } from './provider-registry.js'

export const CODEX_QUOTA = { maxConcurrency: 1, maxRequestsPerMinute: 6, maxRequestsPerDay: 100 }

export function createCodexConnection(config: CanonryConfig, registry: ProviderRegistry, adapter: ProviderAdapter, runtime: CodexRuntime,
  changed: (enabled: boolean, model?: string) => void, persist = saveConfigPatch) {
  let current: CodexStatusDto = {
    state: config.providers?.codex?.enabled ? CodexConnectionStates.connected : CodexConnectionStates.disconnected, enabled: config.providers?.codex?.enabled === true,
    message: config.providers?.codex?.enabled
      ? 'Configured to reuse the CLI subscription. Check again to verify the current account.'
      : 'Connect the existing Codex CLI subscription session. If signed out, run codex login on this machine.',
    model: config.providers?.codex?.model ?? null, runtimeVersion: null, checkedAt: null, models: [],
  }
  function register(): void {
    const entry = config.providers?.codex
    if (entry?.enabled && entry.codexAccountId && entry.model) {
      runtime.enable()
      registry.register(adapter, { provider: ProviderNames.codex, model: entry.model, codexAccountId: entry.codexAccountId, quotaPolicy: { ...(entry.quota ?? CODEX_QUOTA), maxConcurrency: 1 } })
    } else registry.unregister(ProviderNames.codex)
    changed(!!entry?.enabled, entry?.model)
  }
  async function refresh(): Promise<CodexStatusDto> {
    const entry = config.providers?.codex
    try {
      const inspection = await runtime.inspect()
      const changedAccount = entry?.enabled && entry.codexAccountId !== inspection.accountId
      current = {
        state: changedAccount ? CodexConnectionStates['account-changed'] : entry?.enabled ? CodexConnectionStates.connected : CodexConnectionStates.disconnected,
        enabled: entry?.enabled === true, model: entry?.model ?? null, runtimeVersion: inspection.runtimeVersion,
        models: inspection.models, checkedAt: new Date().toISOString(),
        message: changedAccount ? 'The CLI account changed. Reconnect before running queries.'
          : entry?.enabled ? 'Codex subscription connected. Queries use your subscription allowance.' : 'Codex CLI subscription is signed in. Connect it to Canonry to enable selection.',
      }
    } catch (error) {
      const message = describeError(error)
      const state = message.includes('signed out') ? CodexConnectionStates['signed-out']
        : message.includes('API-key') ? CodexConnectionStates['wrong-auth']
          : message.includes('unavailable') || message.includes('ENOENT') ? CodexConnectionStates.unavailable : CodexConnectionStates.error
      current = { ...current, state, message, enabled: entry?.enabled === true, checkedAt: new Date().toISOString() }
    }
    return current
  }
  return {
    status: (): CodexStatusDto => current,
    refresh,
    async connect(input: CodexConnectRequest): Promise<CodexStatusDto> {
      const inspection = await runtime.inspect()
      const model = input.model ?? config.providers?.codex?.model ?? inspection.defaultModel
      if (!inspection.models.some(item => item.id === model)) throw validationError('Choose a model returned by the Codex runtime.')
      const previous = config.providers?.codex
      config.providers ??= {}
      config.providers.codex = { enabled: true, model, codexAccountId: inspection.accountId, quota: { ...(previous?.quota ?? CODEX_QUOTA), maxConcurrency: 1 } }
      try { persist(config) } catch (error) {
        if (previous) config.providers.codex = previous
        else delete config.providers.codex
        throw error
      }
      register()
      return refresh()
    },
    async disconnect(): Promise<CodexStatusDto> {
      const previous = config.providers?.codex
      config.providers ??= {}
      config.providers.codex = { ...previous, enabled: false }
      try { persist(config) } catch (error) {
        if (previous) config.providers.codex = previous
        else delete config.providers.codex
        throw error
      }
      registry.unregister(ProviderNames.codex)
      await runtime.close()
      changed(false, previous?.model)
      current = { ...current, state: CodexConnectionStates.disconnected, enabled: false, message: 'Disconnected from Canonry. Your Codex CLI remains signed in.' }
      return current
    },
  }
}
