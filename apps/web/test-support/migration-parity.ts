import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isAbsolute, relative, resolve } from 'node:path'

import { migrationParityMatrix } from '@/test-support/migration-parity-matrix'

const requiredJourneyIds = [
  'access-onboarding',
  'language-selection',
  'workflow-task-create-link-unlink',
  'my-work',
  'clients',
  'engagements-document-requests',
  'employees',
  'audit',
  'protected-direct-routes',
  'tenant-negative-paths',
  'canonical-urls-route-state',
  'css-modules',
] as const

const allowedStatuses = new Set(['parity', 'approved replacement', 'not in scope'])
const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))

function matrixRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.includes('|'))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim())
      if (line.trimStart().startsWith('|')) cells.shift()
      if (line.trimEnd().endsWith('|')) cells.pop()
      return cells
    })
    .filter((cells) => cells[0] !== 'Journey ID' && !cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
}

export function validateParityMatrix(markdown = migrationParityMatrix): string[] {
  const errors: string[] = []
  const rows = matrixRows(markdown)
  const ids = rows.map(([id]) => id)

  for (const id of requiredJourneyIds) {
    if (!ids.includes(id)) errors.push(`missing required journey ID: ${id}`)
    if (ids.filter((candidate) => candidate === id).length > 1) errors.push(`duplicate journey ID: ${id}`)
  }
  for (const id of ids.filter((id) => !requiredJourneyIds.includes(id as typeof requiredJourneyIds[number]))) {
    errors.push(`unexpected journey ID: ${id}`)
  }

  for (const row of rows) {
    const [id, , , , , evidence, status, replacementReason] = row
    if (row.length !== 8) {
      errors.push(`invalid row shape: ${id || 'unknown'}`)
      continue
    }
    if (!allowedStatuses.has(status)) errors.push('invalid status')
    if (status !== 'parity' && !replacementReason) errors.push(`missing replacement reason: ${id}`)

    const [path, name] = evidence.split(' :: ').map((part) => part.trim())
    if (!path || !name) {
      errors.push(`missing test path/name: ${id}`)
      continue
    }
    const fullPath = resolve(workspaceRoot, path)
    const workspaceRelativePath = relative(workspaceRoot, fullPath)
    const isWorkspaceTestPath = !isAbsolute(path)
      && !workspaceRelativePath.startsWith('..')
      && (path.startsWith('apps/web/test/unit/') || path.startsWith('apps/web/e2e/'))
      && /\.spec\.ts$|\.test\.tsx?$/.test(path)
    if (!isWorkspaceTestPath) {
      errors.push(`invalid test path: ${id}`)
    } else if (!existsSync(fullPath)) {
      errors.push(`missing test path: ${id}`)
    } else if (!readFileSync(fullPath, 'utf8').includes(name)) {
      errors.push(`missing test name: ${id}`)
    }
  }

  return errors
}
