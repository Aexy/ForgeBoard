'use client'

import type { EngagementDetail } from './engagements-transport'
import { useLanguage } from '@/app/LanguageProvider'

export function EngagementHistory({ detail }: Readonly<{ detail: EngagementDetail }>) {
  const { t, language } = useLanguage()
  const history = detail.history.reviewDecisions
  if (!history.length) return <p>{t('engagements.noReviewDecisions')}</p>
  return <ol>{history.map((entry) => <li key={entry.id}><strong>{entry.decision === 'RETURNED' ? t('engagements.returned') : t('engagements.approved')}</strong> <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}</time>{entry.note && <p>{entry.note}</p>}</li>)}</ol>
}
