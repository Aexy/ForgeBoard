import type { Metadata } from 'next'

import { WhyForgeBoardPageContent } from '@/features/public-site/WhyForgeBoardPageContent'

export const metadata: Metadata = {
  title: 'Why ForgeBoard | ForgeBoard',
  description: 'Learn why accounting firms use ForgeBoard to keep recurring work, ownership, review, and risk in one dependable view.',
}

export default function WhyForgeBoardPage() {
  return <WhyForgeBoardPageContent />
}
