import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { validateParityMatrix } from '@/test-support/migration-parity'
import { migrationParityMatrix } from '@/test-support/migration-parity-matrix'

describe('Next migration parity matrix', () => {
  it('accepts the recorded migration evidence', () => {
    expect(validateParityMatrix(migrationParityMatrix)).toEqual([])
  })

  it('also validates the human-readable documentation matrix when present', () => {
    const documentationMatrix = resolve(fileURLToPath(new URL('../../../../../', import.meta.url)), 'docs/superpowers/next-migration-parity.md')

    if (existsSync(documentationMatrix)) expect(validateParityMatrix(readFileSync(documentationMatrix, 'utf8'))).toEqual([])
  })

  it('rejects an invalid status', () => {
    expect(validateParityMatrix('workflow-task-create-link-unlink | legacy | next | OWNER | evidence | apps/web/e2e/workflow-routes.spec.ts :: uses shareable workflow routes, task workspace, moves, and saved views | unresolved | reason')).toContain('invalid status')
  })

  it('rejects duplicate or missing journeys and incomplete evidence', () => {
    const errors = validateParityMatrix([
      '| Journey ID | Legacy behavior | Next behavior/route | Roles | Tenant/deep-link evidence | Test | Status | Replacement reason |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| access-onboarding | legacy | next | public | direct |  | parity | |',
      '| access-onboarding | legacy | next | public | direct | apps/web/e2e/missing.spec.ts :: absent test | parity | |',
    ].join('\n'))

    expect(errors).toContain('duplicate journey ID: access-onboarding')
    expect(errors).toContain('missing required journey ID: css-modules')
    expect(errors).toContain('missing test path/name: access-onboarding')
    expect(errors).toContain('missing test path: access-onboarding')
  })

  it('requires a workspace test path and a reason for an approved replacement', () => {
    const errors = validateParityMatrix('| css-modules | legacy | next | all | direct | ../outside.test.ts :: evidence | approved replacement | |')

    expect(errors).toContain('invalid test path: css-modules')
    expect(errors).toContain('missing replacement reason: css-modules')
  })
})
