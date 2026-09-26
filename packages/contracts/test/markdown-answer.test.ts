import { expect, it } from 'vitest'
import { readMarkdownAnswer } from '../src/markdown-answer.js'

it('keeps visible labels and formatting text while excluding hidden URLs and definitions', () => {
  expect(readMarkdownAnswer('Aurora **Solar** [source](https://example.com/a_(b)).\n\n[Other][ref]\n\n[ref]: https://other.example/')).toEqual({
    text: 'Aurora Solar source.\n\nOther',
    links: [{ uri: 'https://example.com/a_(b)', label: 'source' }, { uri: 'https://other.example/', label: 'Other' }],
  })
})

it('does not treat code or escaped Markdown as source links', () => {
  expect(readMarkdownAnswer('`[source](https://example.com/)`\n\n\\[source](https://other.example/)')).toEqual({
    text: '[source](https://example.com/)\n\n[source](https://other.example/)', links: [],
  })
})

it('preserves a domain when it is the visible link label', () => {
  expect(readMarkdownAnswer('<https://example.com/>')).toEqual({ text: 'https://example.com/', links: [{ uri: 'https://example.com/', label: 'https://example.com/' }] })
  expect(readMarkdownAnswer('')).toEqual({ text: '', links: [] })
})
