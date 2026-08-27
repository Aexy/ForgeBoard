import { describe, expect, it } from 'vitest'

import { metadata as contactMetadata } from '@/app/(public)/contact/page'
import { metadata as productMetadata } from '@/app/(public)/product/page'
import { metadata as whyMetadata } from '@/app/(public)/why-forgeboard/page'

describe('public route metadata', () => {
  it.each([
    [productMetadata, 'Product | ForgeBoard'],
    [whyMetadata, 'Why ForgeBoard | ForgeBoard'],
    [contactMetadata, 'Contact | ForgeBoard'],
  ])('exports a route-specific title and description', (metadata, title) => {
    expect(metadata.title).toBe(title)
    expect(metadata.description).toEqual(expect.any(String))
    expect(metadata.description).not.toHaveLength(0)
  })
})
