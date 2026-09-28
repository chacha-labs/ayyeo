import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import type { CodexFailureCapture } from '@ainyc/canonry-provider-codex'

/** Host-only failure evidence, separate from observations and API-visible errors. */
export function createCodexFailureStore(directory: string, maxFiles = 100, maxBytes = 100 * 1024 * 1024) {
  let queue: Promise<unknown> = Promise.resolve()
  let lastTimestamp = 0
  return (capture: CodexFailureCapture): Promise<void> => {
    const work = queue.then(async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      lastTimestamp = Math.max(Date.now(), lastTimestamp + 1)
      const name = `${lastTimestamp}-${randomUUID()}.json.gz`
      const destination = path.join(directory, name)
      const temporary = `${destination}.tmp`
      const data = gzipSync(JSON.stringify({ schemaVersion: 1, ...capture }))
      if (data.length > maxBytes) throw new Error('Codex failure capture exceeds the diagnostic storage limit.')
      try {
        await writeFile(temporary, data, { mode: 0o600, flag: 'wx' })
        await rename(temporary, destination)
      } finally { await rm(temporary, { force: true }) }
      const files = await Promise.all((await readdir(directory)).filter(file => /^\d+-[a-f0-9-]+\.json\.gz$/.test(file)).map(async file => ({ file, size: (await stat(path.join(directory, file))).size })))
      files.sort((a, b) => a.file === name ? -1 : b.file === name ? 1 : b.file.localeCompare(a.file))
      let bytes = 0
      for (const [index, file] of files.entries()) {
        bytes += file.size
        if (index >= maxFiles || bytes > maxBytes) await rm(path.join(directory, file.file), { force: true })
      }
    })
    queue = work.catch(() => undefined)
    return work
  }
}
