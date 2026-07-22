import { describe, expect, it } from 'vitest'

import { LANGUAGE_COOKIE, languageCookie, messages, readLanguage } from '@/lib/language'

describe('language preference contract', () => {
  it('accepts German and defaults missing or invalid preferences to English', () => {
    expect(readLanguage('de')).toBe('de')
    expect(readLanguage('en')).toBe('en')
    expect(readLanguage('fr')).toBe('en')
    expect(readLanguage()).toBe('en')
  })

  it('serializes the non-sensitive preference with first-party cookie protections', () => {
    expect(languageCookie('de')).toBe(`${LANGUAGE_COOKIE}=de; Path=/; SameSite=Lax`)
  })

  it('keeps both catalogues structurally identical', () => {
    expect(Object.keys(messages.de).sort()).toEqual(Object.keys(messages.en).sort())
  })
})
