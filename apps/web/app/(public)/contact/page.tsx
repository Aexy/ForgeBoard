import type { Metadata } from 'next'

import { ContactPageContent } from '@/features/public-site/ContactPageContent'

export const metadata: Metadata = {
  title: 'Contact | ForgeBoard',
  description: 'Contact ForgeBoard to discuss recurring client work, deadlines, and review handoffs at your accounting firm.',
}

export default function ContactPage() {
  return <ContactPageContent />
}
