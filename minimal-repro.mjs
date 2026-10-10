import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openLazyFile } from 'remix/fs'

let directory = mkdtempSync(join(tmpdir(), 'remix-empty-slice-'))

try {
  let filename = join(directory, 'example.txt')
  writeFileSync(filename, 'hello world')
  let expected = await new Blob(['hello world']).slice(0, 0).text()
  console.log('Native Blob empty slice:', JSON.stringify(expected))

  let slice = openLazyFile(filename).slice(0, 0)
  console.log('Filesystem slice size:', slice.size)
  let actual = await slice.text()
  console.log('Filesystem empty slice:', JSON.stringify(actual))
  assert.equal(actual, expected)
} finally {
  rmSync(directory, { recursive: true, force: true })
}
