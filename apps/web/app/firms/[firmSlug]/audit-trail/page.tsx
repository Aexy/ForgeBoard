import { AuditTrail } from '@/features/audit/AuditTrail'

export default async function AuditTrailPage({ params }: Readonly<{ params: Promise<{ firmSlug: string }> }>) {
  const { firmSlug } = await params
  return <AuditTrail basePath={`/firms/${firmSlug}/audit-trail`} />
}
