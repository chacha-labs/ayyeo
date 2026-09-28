import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexRuntime, type CodexRpc } from '../src/runtime.js'

class FakeRpc implements CodexRpc {
  calls: Array<{ method: string; params: Record<string, unknown> }> = []
  listeners = new Set<(method: string, params: unknown) => void>()
  closed = false
  auth: { type: string; email?: string } | null = { type: 'chatgpt', email: 'operator@example.com' }
  version = '0.157.1'
  outcome: 'unmatched-link' | 'complete' | 'hang' | 'quota' | 'crash' | 'missing-evidence' = 'complete'
  count = 0
  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ method, params })
    if (method === 'initialize') return Promise.resolve({ userAgent: `canonry/${this.version}` })
    if (method === 'account/read') return Promise.resolve({ account: this.auth })
    if (method === 'model/list') return Promise.resolve({ data: [{ model: 'test-model', displayName: 'Test model', isDefault: true }] })
    if (method === 'config/read') return Promise.resolve({ config: { mcp_servers: { personal: {} } } })
    if (method === 'skills/list') return Promise.resolve({ data: [{ skills: [{ path: '/tmp/skill/SKILL.md' }] }] })
    if (method === 'thread/start') return Promise.resolve({ thread: { id: `thread-${++this.count}` }, instructionSources: [] })
    if (method === 'turn/interrupt') return Promise.resolve({})
    if (method === 'turn/start') {
      const threadId = params.threadId
      const emit = (methodName: string, item: unknown) => this.emit(methodName, { threadId, item })
      queueMicrotask(() => {
        if (this.outcome === 'hang') return
        if (this.outcome === 'crash') { this.emit('runtime/closed', {}); return }
        if (this.outcome !== 'missing-evidence') {
          emit('rawResponseItem/completed', { type: 'custom_tool_call', call_id: 'call', name: 'exec', input: 'text(await tools.web__run({search_query: []}))' })
          emit('rawResponseItem/completed', { type: 'custom_tool_call_output', call_id: 'call', output: [{ type: 'input_text', text: 'Example (https://example.com/)\n\uE200cite\uE202turn0search0\uE201 [wordlim: 200]' }] })
        }
        emit('item/completed', { type: 'webSearch', query: 'query' })
        emit('item/completed', { type: 'agentMessage', id: 'answer', phase: 'final_answer', text: this.outcome === 'unmatched-link' ? '[Example](https://unmatched.example/)' : '[Example](https://example.com/)' })
        emit('item/completed', { type: 'agentMessage', id: 'answer', phase: 'final_answer', text: this.outcome === 'unmatched-link' ? '[Example](https://unmatched.example/)' : '[Example](https://example.com/)' })
        this.emit('turn/completed', { threadId, turn: { id: 'turn', status: this.outcome === 'quota' ? 'failed' : 'completed', error: this.outcome === 'quota' ? { code: 'UsageLimitExceeded' } : null } })
      })
      return Promise.resolve({ turn: { id: 'turn' } })
    }
    return Promise.reject(new Error(`Unexpected RPC ${method}`))
  }
  emit(method: string, params: unknown): void { for (const listener of this.listeners) listener(method, params) }
  subscribe(listener: (method: string, params: unknown) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  close(): Promise<void> { this.closed = true; return Promise.resolve() }
}

const accountId = createHash('sha256').update('operator@example.com').digest('hex')
const input = { query: 'query', canonicalDomains: ['example.com'], competitorDomains: [], runId: 'run' }
const runtimes: CodexRuntime[] = []
function setup() {
  const rpc = new FakeRpc()
  const runtime = new CodexRuntime(() => rpc, 25)
  runtime.enable()
  runtimes.push(runtime)
  return { rpc, runtime }
}
afterEach(async () => { await Promise.all(runtimes.splice(0).map(runtime => runtime.close())) })

describe('Codex runtime', () => {
  it('uses fresh isolated threads, exact queries and location context, and deduplicates answer events', async () => {
    const { runtime, rpc } = setup()
    const result = await runtime.execute({ ...input, location: { label: 'us', city: 'Phoenix', region: 'Arizona', country: 'US' } }, 'test-model', accountId)
    expect(result.answerText).toBe('[Example](https://example.com/)')
    expect(result.sources).toEqual([{ uri: 'https://example.com/', title: 'Example', reference: 'turn0search0' }])
    expect(rpc.calls.find(call => call.method === 'turn/start')?.params.input).toEqual([{ type: 'text', text: 'query (searching from Phoenix, Arizona, US)' }])
    expect(rpc.calls.find(call => call.method === 'thread/start')?.params).toMatchObject({ ephemeral: true, approvalPolicy: 'never', sandbox: 'read-only', environments: [], selectedCapabilityRoots: [], config: { 'mcp_servers.personal.enabled': false, 'skills.config': [{ path: '/tmp/skill/SKILL.md', enabled: false }] } })
    await runtime.execute(input, 'test-model', accountId)
    expect(rpc.count).toBe(2)
    expect(rpc.calls.some(call => call.method.includes('login') || call.method.includes('logout'))).toBe(false)
  })

  it.each([null, { type: 'apiKey' }, { type: 'chatgpt', email: 'different@example.com' }])('rejects unavailable or changed subscription identity before dispatch', async auth => {
    const { runtime, rpc } = setup(); rpc.auth = auth
    await expect(runtime.execute(input, 'test-model', accountId)).rejects.toThrow()
    expect(rpc.calls.filter(call => call.method === 'turn/start')).toHaveLength(0)
  })

  it.each(['quota', 'crash', 'missing-evidence'] as const)('fails %s without replaying a paid query', async outcome => {
    const { runtime, rpc } = setup(); rpc.outcome = outcome
    await expect(runtime.execute(input, 'test-model', accountId)).rejects.toThrow()
    expect(rpc.calls.filter(call => call.method === 'turn/start')).toHaveLength(1)
  })

  it('times out and interrupts an active turn', async () => {
    const { runtime, rpc } = setup(); rpc.outcome = 'hang'
    await expect(runtime.execute(input, 'test-model', accountId)).rejects.toThrow('timed out')
    expect(rpc.calls.some(call => call.method === 'turn/interrupt')).toBe(true)
  })

  it('does not dispatch cancelled or disconnected work', async () => {
    const { runtime, rpc } = setup()
    runtime.cancelRun('run')
    await expect(runtime.execute(input, 'test-model', accountId)).rejects.toThrow('cancelled')
    await runtime.close()
    await expect(runtime.execute({ ...input, runId: 'other' }, 'test-model', accountId)).rejects.toThrow('disconnected')
    expect(rpc.calls.filter(call => call.method === 'turn/start')).toHaveLength(0)
  })
})


it('allows format-constrained text generation without claiming a citation measurement', async () => {
  const { runtime, rpc } = setup(); rpc.outcome = 'missing-evidence'
  const result = await runtime.execute(input, 'test-model', accountId, false)
  expect(result.answerText).toBe('[Example](https://example.com/)')
  expect(result.sources).toEqual([])
  expect(rpc.calls.find(call => call.method === 'thread/start')?.params.baseInstructions).toContain('exactly the requested format')
})


it.each(['0.157.1', '0.158.0'])('accepts verified runtime %s', async version => {
  const { runtime, rpc } = setup(); rpc.version = version
  expect((await runtime.inspect()).runtimeVersion).toBe(version)
})

it('rejects unknown runtimes before reading account or starting a turn', async () => {
  const { runtime, rpc } = setup(); rpc.version = '0.159.0'
  await expect(runtime.inspect()).rejects.toThrow('Unsupported')
  expect(rpc.calls.map(call => call.method)).toEqual(['initialize'])
  expect(rpc.closed).toBe(true)
})

it('retains the final answer and native source output when attribution fails', async () => {
  const rpc = new FakeRpc(); rpc.outcome = 'unmatched-link'
  const capture = vi.fn().mockResolvedValue(undefined)
  const runtime = new CodexRuntime(() => rpc, 100, capture); runtime.enable(); runtimes.push(runtime)
  await expect(runtime.execute(input, 'test-model', accountId)).rejects.toThrow('without captured attribution')
  expect(capture).toHaveBeenCalledTimes(1)
  const saved = capture.mock.calls[0]![0]
  expect(saved).toMatchObject({ query: 'query', runId: 'run', model: 'test-model', runtimeVersion: '0.157.1',
    evidence: { answerText: '[Example](https://unmatched.example/)', searchObserved: true, searchQueries: ['query'] } })
  expect(saved.evidence.webToolCalls[0].outputs[0]).toContain('https://example.com/')
  expect(JSON.stringify(saved)).not.toContain('operator@example.com')
  expect(JSON.stringify(saved)).not.toContain(accountId)
  expect(rpc.calls.filter(call => call.method === 'turn/start')).toHaveLength(1)
})

it('preserves the provider failure when diagnostic storage fails', async () => {
  const rpc = new FakeRpc(); rpc.outcome = 'quota'
  const runtime = new CodexRuntime(() => rpc, 100, async () => { throw new Error('Disk full') }); runtime.enable(); runtimes.push(runtime)
  await expect(runtime.execute(input, 'test-model', accountId)).rejects.toThrow('UsageLimitExceeded')
})
