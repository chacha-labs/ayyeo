import { ProviderNames, RetrievalContracts, RetrievalStatuses, describeError, providerAuthError, type ProviderAdapter } from '@ainyc/canonry-contracts'
import { normalizeCodexEvidence } from './evidence.js'
import { CodexRuntime } from './runtime.js'

export function createCodexAdapter(runtime: CodexRuntime): ProviderAdapter {
  return {
    name: ProviderNames.codex,
    displayName: 'Codex (subscription)',
    mode: 'api',
    supportsLocationContext: true,
    modelRegistry: { defaultModel: '', validationPattern: /^\S+$/, validationHint: 'a model returned by the connected Codex runtime', knownModels: [] },
    validateConfig(config) {
      return { ok: !!config.codexAccountId && !!config.model, provider: ProviderNames.codex, message: config.codexAccountId && config.model ? 'Subscription connected' : 'Connect the existing Codex CLI subscription session.', model: config.model }
    },
    async healthcheck(config) {
      try {
        const account = await runtime.inspect()
        if (account.accountId !== config.codexAccountId) throw providerAuthError('The Codex CLI account changed; reconnect in Canonry.')
        return { ok: true, provider: ProviderNames.codex, message: 'Codex subscription connected', model: config.model }
      } catch (error) { return { ok: false, provider: ProviderNames.codex, message: describeError(error), model: config.model } }
    },
    async listModels() { return runtime.cachedModels() },
    async executeTrackedQuery(input, config) {
      if (!config.model || !config.codexAccountId) throw providerAuthError('Connect Codex before running queries.')
      const evidence = await runtime.execute(input, config.model, config.codexAccountId)
      const normalized = normalizeCodexEvidence(evidence)
      return { provider: ProviderNames.codex, model: config.model, rawResponse: evidence,
        groundingSources: normalized.groundingSources, searchQueries: evidence.searchQueries,
        retrievalStatus: RetrievalStatuses.used, retrievalContract: RetrievalContracts['codex-web-search-v1'] }
    },
    normalizeResult(raw) { return normalizeCodexEvidence(raw.rawResponse) },
    async generateText(prompt, config) {
      if (!config.model || !config.codexAccountId) throw providerAuthError('Connect Codex before running queries.')
      return (await runtime.execute({ query: prompt, canonicalDomains: [], competitorDomains: [] }, config.model, config.codexAccountId, false)).answerText
    },
  }
}
