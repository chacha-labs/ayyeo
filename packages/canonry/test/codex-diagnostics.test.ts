import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { afterEach, expect, it, vi } from 'vitest'
import type { CodexFailureCapture } from '@ainyc/canonry-provider-codex'
import { createCodexFailureStore } from '../src/codex-diagnostics.js'

const directories: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function directory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'canonry-failure-test-')); directories.push(root)
  return path.join(root, 'diagnostics')
}
const capture: CodexFailureCapture = {
  capturedAt: '2026-09-28T00:00:00Z', query: 'a query', runId: '../../not-a-filename', model: 'model', runtimeVersion: '0.158.0', error: 'Unmatched source',
  evidence: { answerText: '[source](https://unmatched.example/)', sources: [], searchObserved: true, searchQueries: ['a query'],
    webToolCalls: [{ callId: 'call', program: 'text(await tools.web__run({}))', outputs: ['Original native output'] }] },
}

it('stores complete failure evidence privately without using query or run IDs as paths', async () => {
  const dir = await directory(); await createCodexFailureStore(dir)(capture)
  const files = await readdir(dir); expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/^\d+-[a-f0-9-]+\.json\.gz$/)
  const file = path.join(dir, files[0]!)
  expect(JSON.parse(gunzipSync(await readFile(file)).toString())).toEqual({ schemaVersion: 1, ...capture })
  if (process.platform !== 'win32') {
    expect((await stat(file)).mode & 0o777).toBe(0o600)
    expect((await stat(dir)).mode & 0o777).toBe(0o700)
  }
})

it('serializes concurrent writes and bounds retention without removing unrelated files', async () => {
  const dir = await directory(); const save = createCodexFailureStore(dir, 2)
  await save(capture); await writeFile(path.join(dir, 'keep.txt'), 'unrelated')
  await Promise.all([save(capture), save(capture), save(capture)])
  const files = await readdir(dir)
  expect(files.filter(file => file.endsWith('.json.gz'))).toHaveLength(2)
  expect(files).toContain('keep.txt')
  expect(files.some(file => file.endsWith('.tmp'))).toBe(false)
})

it('rejects an oversized capture without leaving an incomplete artifact', async () => {
  const dir = await directory()
  await expect(createCodexFailureStore(dir, 100, 1)(capture)).rejects.toThrow('storage limit')
  expect(await readdir(dir)).toEqual([])
})

it('prunes oldest captures by bytes even when writes share a clock tick', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  const dir = await directory()
  const captures = ['one', 'two', 'new'].map(query => ({ ...capture, query }))
  const maxBytes = captures.slice(1).reduce((sum, item) => sum + gzipSync(JSON.stringify({ schemaVersion: 1, ...item })).length, 0)
  const save = createCodexFailureStore(dir, 100, maxBytes)
  await Promise.all(captures.map(save))
  const files = await readdir(dir)
  const saved = await Promise.all(files.map(async file => JSON.parse(gunzipSync(await readFile(path.join(dir, file))).toString())))
  expect(saved.map(item => item.query).sort()).toEqual(['new', 'two'])
  const bytes = (await Promise.all(files.map(file => stat(path.join(dir, file))))).reduce((sum, item) => sum + item.size, 0)
  expect(bytes).toBe(maxBytes)
})
