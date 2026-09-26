import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { isDeepStrictEqual } from 'node:util'
import { geminiAdapter } from '../packages/provider-gemini/src/adapter.ts'
import { claudeAdapter } from '../packages/provider-claude/src/adapter.ts'
import { normalizeCodexEvidence } from '../packages/provider-codex/src/evidence.ts'
import { effectiveBrandNames, effectiveDomains, determineAnswerMentioned, describeError } from '../packages/contracts/src/index.ts'
import { determineCitationState } from '../packages/canonry/src/citation-utils.ts'

// Offline replay only. No credentials, server, provider calls, or file mutations.
globalThis.fetch = () => { throw new Error('Network calls are prohibited during evaluation replay.') }
const root = process.argv[2] ?? fileURLToPath(new URL('../docs/evaluations/codex-subscription/', import.meta.url))
function read(relative) {
  const plain = path.join(root, relative)
  const compressed = `${plain}.gz`
  const bytes = fs.existsSync(plain) ? fs.readFileSync(plain) : gunzipSync(fs.readFileSync(compressed))
  return JSON.parse(bytes.toString('utf8'))
}

try {
  const mismatches = []
  const counts = {}
  for (const dataset of ['before', 'after', 'final-smoke']) {
    const project = read(`${dataset === 'final-smoke' ? 'after' : dataset}/project.json`)
    const rows = read(`${dataset}/stored-snapshots.json`)
    counts[dataset] = rows.length
    for (const row of rows) {
      if (![0, 1, true, false].includes(row.answer_mentioned)) throw new Error(`Unexpected mention encoding in ${row.id}`)
      const envelope = row.raw_response
      const adapter = { gemini: geminiAdapter, claude: claudeAdapter }[row.provider]
      if (row.provider !== 'codex' && !adapter) throw new Error(`Unsupported replay provider ${row.provider}`)
      const normalized = row.provider === 'codex' ? normalizeCodexEvidence(envelope.apiResponse) : adapter.normalizeResult({
        provider: row.provider, rawResponse: envelope.apiResponse, model: row.model,
        groundingSources: envelope.groundingSources, searchQueries: envelope.searchQueries,
        retrievalStatus: row.retrieval_status, retrievalContract: row.retrieval_contract,
      })
      const actual = {
        answerText: normalized.answerText, citedDomains: normalized.citedDomains, groundingSources: normalized.groundingSources,
        searchQueries: normalized.searchQueries, answerMentioned: determineAnswerMentioned(normalized.answerText, effectiveBrandNames(project), effectiveDomains(project)),
        citationState: determineCitationState(normalized, effectiveDomains(project)),
      }
      const expected = { answerText: row.answer_text, citedDomains: JSON.parse(row.cited_domains), groundingSources: envelope.groundingSources,
        searchQueries: envelope.searchQueries, answerMentioned: Boolean(row.answer_mentioned), citationState: row.citation_state }
      for (const key of Object.keys(expected)) if (!isDeepStrictEqual(actual[key], expected[key])) mismatches.push({ dataset, snapshotId: row.id, field: key })
    }
  }
  console.log(JSON.stringify({ datasets: counts, mismatches, passed: mismatches.length === 0 }, null, 2))
  if (mismatches.length) process.exitCode = 1
} catch (error) {
  console.error(JSON.stringify({ error: describeError(error) }))
  process.exitCode = 2
}
