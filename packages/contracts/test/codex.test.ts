import { expect, it } from 'vitest'
import { codexConnectRequestSchema, codexStatusDtoSchema, isImplicitProvider } from '../src/codex.js'

it('preserves existing implicit API providers while requiring explicit Codex selection', () => {
  expect(['gemini', 'claude', 'openai', 'local', 'cdp:chatgpt', 'codex'].filter(isImplicitProvider)).toEqual(['gemini', 'claude', 'openai', 'local', 'cdp:chatgpt'])
})

it('connection inputs cannot carry credentials or executable paths', () => {
  expect(codexConnectRequestSchema.parse({ model: ' model ' })).toEqual({ model: 'model' })
  for (const key of ['apiKey', 'accessToken', 'executable', 'baseUrl']) expect(codexConnectRequestSchema.safeParse({ [key]: 'value' }).success).toBe(false)
  expect(codexStatusDtoSchema.safeParse({ state: 'unknown' }).success).toBe(false)
})
