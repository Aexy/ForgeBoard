export interface NextAuthConfig {
  providers: unknown[]
  session?: { strategy: string }
  pages?: { signIn: string }
  callbacks: Record<string, (...args: never[]) => unknown>
  events?: Record<string, (...args: never[]) => unknown>
}

export default function NextAuth(config: NextAuthConfig) {
  return {
    handlers: { GET: async () => new Response(), POST: async () => new Response() },
    auth: async () => null,
    signIn: async () => undefined,
    signOut: async () => undefined,
    config,
  }
}
