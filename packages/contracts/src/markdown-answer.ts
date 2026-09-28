import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes } from 'mdast'

/** Rendered text and HTTP links, keeping hidden destinations out of mention text. */
export function readMarkdownAnswer(markdown: string): { text: string; links: Array<{ uri: string; label: string }> } {
  const tree = fromMarkdown(markdown)
  const definitions = new Map<string, string>()
  const links: Array<{ uri: string; label: string }> = []
  function collect(node: Nodes): void {
    if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node.url)
    if ('children' in node) for (const child of node.children) collect(child)
  }
  collect(tree)
  function render(node: Nodes): string {
    if (node.type === 'definition' || node.type === 'html') return ''
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') return node.value
    if (node.type === 'break') return '\n'
    if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? ''
    if (!('children' in node)) return ''
    const separator = ['root', 'list', 'listItem', 'blockquote'].includes(node.type) ? '\n\n' : ''
    const text = node.children.map(render).filter(Boolean).join(separator)
    const uri = node.type === 'link' ? node.url : node.type === 'linkReference' ? definitions.get(node.identifier.toLowerCase()) : undefined
    if (uri && /^https?:\/\//i.test(uri)) links.push({ uri, label: text })
    return text
  }
  return { text: render(tree), links }
}
