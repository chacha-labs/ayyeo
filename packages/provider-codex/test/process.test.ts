import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { CodexProcess } from '../src/runtime.js'

const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn() })

function fakeProcess() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rpc-test-'))
  const executable = path.join(dir, 'fake-codex')
  fs.writeFileSync(executable, `#!/usr/bin/env node
const readline = require('node:readline');
readline.createInterface({input:process.stdin}).on('line', line => {
  const request = JSON.parse(line);
  if (request.method === 'invalid') { process.stdout.write('not-json\\n'); return; }
  if (request.method === 'crash') { process.exit(1); return; }
  if (request.id !== undefined) process.stdout.write(JSON.stringify({id: request.id, result: {method: request.method}}) + '\\n');
});
`, { mode: 0o700 })
  const rpc = new CodexProcess(dir, executable)
  cleanup.push(async () => { await rpc.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  return rpc
}

it('matches concurrent JSON-RPC replies to the correct caller', async () => {
  const rpc = fakeProcess()
  expect(await Promise.all([rpc.request('first', {}), rpc.request('second', {})])).toEqual([{ method: 'first' }, { method: 'second' }])
  await rpc.close()
  await expect(rpc.request('after-close', {})).rejects.toThrow('not running')
})

it.each(['invalid', 'crash'])('rejects pending callers when the subprocess emits %s', async method => {
  await expect(fakeProcess().request(method, {})).rejects.toThrow()
})

it('fails a missing executable and closes without hanging', async () => {
  const rpc = new CodexProcess(os.tmpdir(), '/does-not-exist/codex')
  await expect(rpc.request('initialize', {})).rejects.toThrow('unavailable')
  await rpc.close()
})
