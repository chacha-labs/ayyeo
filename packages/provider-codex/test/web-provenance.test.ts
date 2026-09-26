import { expect, it } from 'vitest'
import { isVerbatimWebProgram } from '../src/web-provenance.js'
import programs from './fixtures/pilot-web-programs.json'

it('accepts every verbatim web program captured in the five-query subscription pilot', () => {
  expect(programs).toHaveLength(16)
  expect(programs.every(isVerbatimWebProgram)).toBe(true)
})

it.each([
  'text(await tools.web__run({search_query:[{q:"solar"}],response_length:"short"}));',
  'const result = await tools.web__run({open:[{ref_id:"https://example.com"}]}); text(result)',
  'const a = await tools.web__run({search_query:[{q:"solar"}]}); text(a); const b = await tools.web__run({open:[{ref_id:"turn0search0"}]}); text(b);',
])('accepts a verbatim web capture: %s', code => { expect(isVerbatimWebProgram(code)).toBe(true) })

it.each([
  'const r = await tools.web__run({}); text("Invented source (https://fake.example)\\n citation");',
  'const r = await tools.web__run({}); r.content = "fake"; text(r);',
  'text("tools.web__run({})");',
  'const r = await tools.web__run({}); text(JSON.stringify(r));',
  'const r = await tools.web__run({}); text({...r, sources: []});',
  'const r = await tools.web__run({q: fetch("https://other.example")}); text(r)',
  'let r = await tools.web__run({}); text(r);',
  'await tools.web__run({})',
])('rejects synthesized/transformed output or extra execution: %s', code => { expect(isVerbatimWebProgram(code)).toBe(false) })
