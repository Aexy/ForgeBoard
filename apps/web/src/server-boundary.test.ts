import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execute = promisify(execFile)
const webRoot = fileURLToPath(new URL('../', import.meta.url))
const fixtureRoot = fileURLToPath(new URL('../test/fixtures/client-import-server/', import.meta.url))
const nextBinary = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))

describe('Next server boundary', () => {
  it('rejects a client component importing the bearer-capable server transport', async () => {
    const build = execute(process.execPath, [nextBinary, 'build', fixtureRoot], {
      cwd: webRoot,
      env: process.env,
    })

    await expect(build).rejects.toMatchObject({
      stderr: expect.stringContaining('server-only'),
    })
  })
})
