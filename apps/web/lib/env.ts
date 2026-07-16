const requiredKeys = [
  'AUTH_SECRET',
  'AUTH_URL',
  'FORGEBOARD_API_BASE_URL',
  'FORGEBOARD_TOKEN_ISSUER',
  'FORGEBOARD_PUBLIC_ORIGIN',
] as const

export interface ServerEnvironment {
  AUTH_SECRET: string
  AUTH_URL: string
  FORGEBOARD_API_BASE_URL: string
  FORGEBOARD_TOKEN_ISSUER: string
  FORGEBOARD_PUBLIC_ORIGIN: string
  FORGEBOARD_PREVIEW_FIRM_SLUGS?: string
}

export function serverEnvironment(source: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const missing = requiredKeys.filter((key) => !source[key]?.trim())
  if (missing.length > 0) throw new Error(`Missing required server environment: ${missing.join(', ')}`)
  if (source.NODE_ENV === 'production' && !source.FORGEBOARD_PREVIEW_FIRM_SLUGS?.trim()) {
    throw new Error('Missing required server environment: FORGEBOARD_PREVIEW_FIRM_SLUGS')
  }

  return {
    ...Object.fromEntries(requiredKeys.map((key) => [key, source[key]!])),
    ...(source.FORGEBOARD_PREVIEW_FIRM_SLUGS?.trim()
      ? { FORGEBOARD_PREVIEW_FIRM_SLUGS: source.FORGEBOARD_PREVIEW_FIRM_SLUGS }
      : {}),
  } as ServerEnvironment
}
