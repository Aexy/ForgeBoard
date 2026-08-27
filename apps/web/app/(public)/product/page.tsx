import type { Metadata } from 'next'

import { ProductPageContent } from '@/features/public-site/ProductPageContent'

export const metadata: Metadata = {
  title: 'Product | ForgeBoard',
  description: 'See how ForgeBoard moves recurring client engagements from preparation through review and completion.',
}

export default function ProductPage() {
  return <ProductPageContent />
}
