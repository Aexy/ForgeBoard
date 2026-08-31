import type { Metadata } from 'next'

import { WhyForgeBoardPageContent } from '@/features/public-site/WhyForgeBoardPageContent'

export const metadata: Metadata = {
  title: 'Why ForgeBoard | ForgeBoard',
  description: 'See why accounting firms use ForgeBoard to coordinate recurring client work, ownership, review, blockers, and deadline risk in one dependable workflow.',
}

export default function WhyForgeBoardPage() {
  return <WhyForgeBoardPageContent />
}
