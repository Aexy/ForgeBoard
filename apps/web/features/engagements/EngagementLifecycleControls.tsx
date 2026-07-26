'use client'

import { useState } from 'react'
import { useLanguage } from '@/app/LanguageProvider'
import { useFirmContext } from '@/store/firm-cache-boundary'
import type { Engagement } from './engagements-transport'
import { useChangeEngagementLifecycleMutation } from './engagements-transport'
import styles from './EngagementLifecycleControls.module.css'

export function EngagementLifecycleControls({ engagement }: Readonly<{ engagement: Engagement }>) {
  const firm = useFirmContext(); const { t } = useLanguage(); const [change, result] = useChangeEngagementLifecycleMutation(); const [error, setError] = useState('')
  if (firm.role !== 'OWNER' && firm.role !== 'MANAGER') return null
  const action = engagement.status === 'ARCHIVED' ? 'unarchive' : engagement.status === 'COMPLETE' || engagement.status === 'CANCELLED' ? 'archive' : 'cancel'
  const label = t(`engagements.${action}` as 'engagements.cancel' | 'engagements.archive' | 'engagements.unarchive')
  const execute = async (nextAction: 'cancel' | 'reopen' | 'archive' | 'unarchive', confirm = true) => { if (confirm && !window.confirm(t(`engagements.${nextAction}` as 'engagements.cancel' | 'engagements.reopen' | 'engagements.archive' | 'engagements.unarchive'))) return; setError(''); try { await change({ firm, engagementId: engagement.id, action: nextAction, expectedVersion: engagement.version, workflowId: engagement.workflowId, workItemId: engagement.workItemId }).unwrap() } catch { setError(t('engagements.lifecycleError')) } }
  return <div className={styles.controls}><button type="button" onClick={() => void execute(action)} disabled={result.isLoading}>{label}</button>{(engagement.status === 'COMPLETE' || engagement.status === 'CANCELLED') && <button type="button" disabled={result.isLoading} onClick={() => void execute('reopen')}>{t('engagements.reopen')}</button>}{error && <p role="alert">{error}</p>}</div>
}
