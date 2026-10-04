// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/app/LanguageProvider'
import { FirmContextProvider } from '@/store/firm-cache-boundary'
import { ClientImport } from './ClientImport'

const mocks = vi.hoisted(() => ({ importClients: vi.fn() }))
vi.mock('./clients-transport', () => ({ useImportClientsMutation: () => [mocks.importClients] }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const firm = { firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' as const }
const csv = 'legalName,displayName,primaryEmail\nNorthstar GmbH,Northstar,hello@northstar.test'
const valid = { dryRun: true, totalRows: 1, validRows: 1, importedRows: 0, rows: [{ rowNumber: 2, legalName: 'Northstar GmbH', displayName: 'Northstar', primaryEmail: 'hello@northstar.test', errors: [] }] }
const invalid = { ...valid, validRows: 0, rows: [{ ...valid.rows[0], errors: ['Duplicate legalName'] }] }
function setup(language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><FirmContextProvider firm={firm}><ClientImport /></FirmContextProvider></LanguageProvider>)
}
function selectFile(content = csv, size?: number) {
  const file = new File([content], 'clients.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockResolvedValue(new TextEncoder().encode(content).buffer) })
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } })
  return file
}
function preview() { fireEvent.submit(screen.getByRole('form', { name: 'Import clients from CSV' })) }

describe('Client CSV import', () => {
  beforeEach(() => mocks.importClients.mockReset())
  afterEach(cleanup)

  it('requires a valid preview and imports exactly its CSV, then removes the commit action', async () => {
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => valid }).mockReturnValueOnce({ unwrap: async () => ({ ...valid, dryRun: false, importedRows: 1 }) })
    setup()
    fireEvent.click(screen.getByText('Import clients from CSV'))
    expect(screen.getByRole('button', { name: 'Preview CSV' })).toBeDisabled()
    selectFile(); preview()
    expect(await screen.findByRole('button', { name: 'Import clients' })).toBeEnabled()
    expect(mocks.importClients).toHaveBeenCalledWith({ firm, csv, dryRun: true })
    fireEvent.click(screen.getByRole('button', { name: 'Import clients' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Clients imported: 1')
    expect(mocks.importClients).toHaveBeenLastCalledWith({ firm, csv, dryRun: false })
    expect(screen.queryByRole('button', { name: 'Import clients' })).not.toBeInTheDocument()
  })

  it('shows row errors, accepts a corrected file, and clears a valid preview when the file changes', async () => {
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => invalid }).mockReturnValueOnce({ unwrap: async () => valid })
    setup(); fireEvent.click(screen.getByText('Import clients from CSV'))
    selectFile(); preview()
    expect(await screen.findByText('Duplicate legalName')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Import clients' })).toBeDisabled()
    selectFile(csv.replaceAll('Northstar', 'Hearth')); preview()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Import clients' })).toBeEnabled())
    selectFile('different CSV')
    expect(screen.queryByRole('button', { name: 'Import clients' })).not.toBeInTheDocument()
  })

  it('shows commit-time validation errors without claiming success and allows a fresh preview', async () => {
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => valid }).mockReturnValueOnce({ unwrap: async () => ({ ...invalid, dryRun: false }) }).mockReturnValueOnce({ unwrap: async () => valid })
    setup(); fireEvent.click(screen.getByText('Import clients from CSV'))
    selectFile(); preview()
    fireEvent.click(await screen.findByRole('button', { name: 'Import clients' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No clients were imported')
    expect(screen.getByRole('button', { name: 'Import clients' })).toBeDisabled()
    selectFile(csv.replaceAll('Northstar', 'Hearth')); preview()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Import clients' })).toBeEnabled())
  })

  it('requires another preview after an uncertain commit and blocks interaction while awaiting a response', async () => {
    let rejectCommit!: (reason: unknown) => void
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => valid }).mockReturnValueOnce({ unwrap: () => new Promise((_resolve, reject) => { rejectCommit = reject }) })
    setup(); fireEvent.click(screen.getByText('Import clients from CSV'))
    selectFile(); preview()
    fireEvent.click(await screen.findByRole('button', { name: 'Import clients' }))
    expect(screen.getByLabelText('CSV file')).toBeDisabled()
    rejectCommit({ status: 'FETCH_ERROR' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview again before importing')
    expect(screen.queryByRole('button', { name: 'Import clients' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview CSV' })).toBeEnabled()
  })

  it('rejects oversized files before reading or sending them and renders parser errors', async () => {
    setup(); fireEvent.click(screen.getByText('Import clients from CSV'))
    const file = selectFile(csv, 1024 * 1024 + 1); preview()
    expect(await screen.findByRole('alert')).toHaveTextContent('no larger than 1 MiB')
    expect(file.arrayBuffer).not.toHaveBeenCalled()
    expect(mocks.importClients).not.toHaveBeenCalled()
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => { throw { data: { detail: 'CSV header is required' } } } })
    selectFile(''); preview()
    expect(await screen.findByRole('alert')).toHaveTextContent('CSV header is required')
  })

  it('does not enable a header-only import and supplies German labels', async () => {
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => ({ ...valid, totalRows: 0, validRows: 0, rows: [] }) })
    const view = setup(); fireEvent.click(screen.getByText('Import clients from CSV'))
    selectFile('legalName,displayName,primaryEmail'); preview()
    expect(await screen.findByRole('button', { name: 'Import clients' })).toBeDisabled()
    view.unmount(); setup('de')
    fireEvent.click(screen.getByText('Mandanten aus CSV importieren'))
    expect(screen.getByRole('button', { name: 'CSV-Vorschau' })).toBeDisabled()
    expect(screen.getByLabelText('CSV-Datei')).toBeVisible()
  })

  it('rejects invalid UTF-8 without sending corrupted names and preserves valid accented names', async () => {
    setup(); fireEvent.click(screen.getByText('Import clients from CSV'))
    const file = selectFile()
    vi.mocked(file.arrayBuffer).mockResolvedValue(new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]).buffer)
    preview()
    expect(await screen.findByRole('alert')).toHaveTextContent('Save it as CSV UTF-8')
    expect(mocks.importClients).not.toHaveBeenCalled()
    mocks.importClients.mockReturnValueOnce({ unwrap: async () => valid })
    const accented = csv.replaceAll('Northstar', 'Müller')
    selectFile(accented); preview()
    await screen.findByRole('button', { name: 'Import clients' })
    expect(mocks.importClients).toHaveBeenCalledWith({ firm, csv: accented, dryRun: true })
  })
})
