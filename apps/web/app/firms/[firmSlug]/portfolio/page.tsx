import { EngagementPortfolio } from '@/features/portfolio/EngagementPortfolio'

export default async function PortfolioPage({ params }: Readonly<{ params: Promise<{ firmSlug: string }> }>) {
  const { firmSlug } = await params
  return <EngagementPortfolio basePath={`/firms/${firmSlug}/portfolio`} />
}
