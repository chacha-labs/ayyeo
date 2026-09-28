import { isVerbatimWebProgram } from './web-provenance.js'
import { z } from 'zod'
import { hostOf, registrableDomain, readMarkdownAnswer, ProviderNames, RetrievalStatuses, providerError, type NormalizedQueryResult } from '@ainyc/canonry-contracts'

const evidenceSchema = z.object({
  answerText: z.string().min(1),
  sources: z.array(z.object({ uri: z.string().url(), title: z.string(), reference: z.string(), redirectedUri: z.string().url().optional() })),
  searchQueries: z.array(z.string()),
  searchObserved: z.boolean(),
  webToolOutputs: z.array(z.string()).optional(),
  webToolCalls: z.array(z.object({ callId: z.string(), program: z.string(), outputs: z.array(z.string()) })).optional(),
})
export type CodexEvidence = z.infer<typeof evidenceSchema>

/** Parse only actual web-tool result headers, never prose in the answer. */
export function captureCodexSources(outputs: readonly string[]): CodexEvidence['sources'] {
  const sources = new Map<string, CodexEvidence['sources'][number]>()
  for (const output of outputs) {
    const pattern = /^([^\n]+) \((https?:\/\/\S+)\)\r?\n\uE200cite\uE202([^\uE201]+)\uE201([^\r\n]*)/gm
    for (const match of output.matchAll(pattern)) {
      const [, title, uri, reference] = match
      if (!uri || !reference || !title) continue
      // Only a redirect in the native attribution line is authoritative. Page
      // body links, prose, and guessed URL variants are not aliases.
      const redirectedUri = match[4]?.match(/; Redirected to URL: (https?:\/\/[^\s;]+); Total lines: \d+\s*$/)?.[1]
      try {
        const parsed = new URL(uri)
        if (parsed.username || parsed.password) continue
        if (redirectedUri) {
          const redirected = new URL(redirectedUri)
          if (redirected.username || redirected.password) continue
        }
      } catch { continue }
      const existing = sources.get(reference)
      if (existing && (existing.uri !== uri || (existing.redirectedUri && redirectedUri && existing.redirectedUri !== redirectedUri))) throw providerError('Conflicting Codex source attribution.')
      sources.set(reference, { uri, title, reference, ...(redirectedUri ? { redirectedUri } : existing?.redirectedUri ? { redirectedUri: existing.redirectedUri } : {}) })
    }
  }
  return [...sources.values()]
}

export function normalizeCodexEvidence(value: unknown): NormalizedQueryResult {
  const parsed = evidenceSchema.safeParse(value)
  if (!parsed.success) throw providerError('Codex source evidence is missing or incompatible. No observation was recorded.')
  const evidence = parsed.data
  if (evidence.webToolCalls) {
    if (!evidence.webToolCalls.every(call => isVerbatimWebProgram(call.program))) throw providerError('Codex web evidence was transformed or synthesized by the model.')
    evidence.sources = captureCodexSources(evidence.webToolCalls.flatMap(call => call.outputs))
  } else if (evidence.webToolOutputs) evidence.sources = captureCodexSources(evidence.webToolOutputs)
  if (!evidence.searchObserved || !evidence.sources.length) throw providerError('Codex did not expose usable web-source evidence. No observation was recorded.')
  const sourcesByUrl = new Map(evidence.sources.flatMap(source => [source.uri, ...(source.redirectedUri ? [source.redirectedUri] : [])].map(uri => [new URL(uri).href, source] as const)))
  const sourcesByReference = new Map(evidence.sources.map(source => [source.reference, source]))
  const cited = new Map<string, CodexEvidence['sources'][number]>()
  const rendered = readMarkdownAnswer(evidence.answerText.replace(/\uE200cite\uE202[^\uE201]+\uE201/g, ''))
  for (const { uri } of rendered.links) {
    const source = sourcesByUrl.get(new URL(uri).href)
    if (!source) throw providerError('Codex returned a source link without captured attribution. No observation was recorded.')
    const citedUri = source.redirectedUri && new URL(uri).href === new URL(source.redirectedUri).href ? source.redirectedUri : source.uri
    cited.set(citedUri, { ...source, uri: citedUri })
  }
  for (const match of evidence.answerText.matchAll(/\uE200cite\uE202([^\uE201]+)\uE201/g)) {
    for (const reference of match[1]!.split('\uE202')) {
      const source = sourcesByReference.get(reference)
      if (!source) throw providerError('Codex returned an unresolved citation reference. No observation was recorded.')
      cited.set(source.uri, source)
    }
  }
  // A bare/model-written URL is not a verified citation. Fail closed when the
  // response has no supported source attribution, including formatting changes.
  if (!cited.size) throw providerError('Codex returned no verifiable final-answer citations. No observation was recorded.')
  const groundingSources = [...cited.values()].map(({ uri, title }) => ({ uri, title }))
  return {
    provider: ProviderNames.codex,
    answerText: rendered.text,
    citedDomains: [...new Set(groundingSources.map(source => registrableDomain(hostOf(source.uri))))].filter(Boolean),
    groundingSources,
    searchQueries: evidence.searchQueries,
    retrievalStatus: RetrievalStatuses.used,
  }
}
