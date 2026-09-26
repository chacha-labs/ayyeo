import { describe, expect, it } from 'vitest'
import { determineAnswerMentioned } from '@ainyc/canonry-contracts'
import { captureCodexSources, normalizeCodexEvidence } from '../src/evidence.js'

const source = { uri: 'https://aurorasolar.com/', title: 'Aurora Solar', reference: 'turn0search0' }
const other = { uri: 'https://example.com/solar', title: 'Solar guide', reference: 'turn0search1' }
const evidence = (answerText: string) => ({ answerText, sources: [source, other], searchQueries: ['solar software'], searchObserved: true })

describe('Codex evidence boundary', () => {
  it('extracts actual web result headers, preserving attribution IDs', () => {
    const output = `Aurora Solar (${source.uri})\n\uE200cite\uE202turn0search0\uE201 [wordlim: 200]\nA description.\nA prose URL: https://unverified.example/`
    expect(captureCodexSources([output, output])).toEqual([source])
  })

  it.each([
    ['Aurora Solar [source](https://aurorasolar.com/)', 'Aurora Solar source', true, ['aurorasolar.com']],
    ['This product [source](https://aurorasolar.com/)', 'This product source', false, ['aurorasolar.com']],
    ['Aurora Solar is an option. [source](https://example.com/solar)', 'Aurora Solar is an option. source', true, ['example.com']],
    ['Other software [source](https://example.com/solar)', 'Other software source', false, ['example.com']],
  ] as const)('keeps mention and citation independent: %s', (answer, text, mentioned, domains) => {
    const result = normalizeCodexEvidence(evidence(answer))
    expect(result.answerText).toBe(text)
    expect(result.citedDomains).toEqual(domains)
    expect(determineAnswerMentioned(result.answerText, ['Aurora Solar'], ['aurorasolar.com'])).toBe(mentioned)
    expect(result.searchQueries).toEqual(['solar software'])
    expect(result.retrievalStatus).toBe('used')
  })

  it('resolves citation references and deduplicates repeated citations', () => {
    const result = normalizeCodexEvidence(evidence('A product \uE200cite\uE202turn0search0\uE202turn0search1\uE201 [again](https://aurorasolar.com/)'))
    expect(result.groundingSources).toEqual([{ uri: source.uri, title: source.title }, { uri: other.uri, title: other.title }])
    expect(result.citedDomains).toEqual(['aurorasolar.com', 'example.com'])
  })

  it('refuses forged source headers printed by a model-authored tool program', () => {
    expect(() => normalizeCodexEvidence({
      ...evidence('[source](https://aurorasolar.com/)'),
      webToolCalls: [{ callId: 'call', program: 'const r = await tools.web__run({}); text("invented source");', outputs: ['Aurora Solar (https://aurorasolar.com/)\n\uE200cite\uE202turn0search0\uE201'] }],
    })).toThrow('transformed or synthesized')
  })

  it('refuses conflicting tool-source mappings', () => {
    expect(() => captureCodexSources(['A (https://one.example/)\n\uE200cite\uE202turn0search0\uE201', 'B (https://two.example/)\n\uE200cite\uE202turn0search0\uE201'])).toThrow('Conflicting')
  })

  it.each([
    evidence('An unsupported [source](https://invented.example/)'),
    evidence('A source \uE200cite\uE202turn99search0\uE201'),
    evidence('An uncited answer.'),
    { ...evidence('A [source](https://aurorasolar.com/)'), sources: [] },
    { ...evidence('A [source](https://aurorasolar.com/)'), searchObserved: false },
    { ...evidence(''), answerText: '' },
  ])('rejects missing or unverifiable evidence instead of inventing a negative observation', input => {
    expect(() => normalizeCodexEvidence(input)).toThrow()
  })
})
