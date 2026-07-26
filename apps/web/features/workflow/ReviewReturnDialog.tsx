'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/app/LanguageProvider'
import styles from './ReviewReturnDialog.module.css'

export function ReviewReturnDialog({ onCancel, onConfirm }: Readonly<{ onCancel: () => void; onConfirm: (note: string) => void }>) {
  const { t } = useLanguage()
  const [note, setNote] = useState(''); const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null); const opener = useRef<HTMLElement | null>(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus(); return () => dialog.current?.close() }, [])
  const dismiss = () => { opener.current?.focus(); onCancel() }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="return-dialog-title" onCancel={(event) => { event.preventDefault(); dismiss() }}><form method="dialog" onSubmit={(event) => { event.preventDefault(); if (note.trim()) onConfirm(note.trim()) }}><h2 id="return-dialog-title">{t('workflow.returnForPreparation')}</h2><label>{t('workflow.reviewNote')}<textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} required maxLength={4000} /></label><div><button ref={cancel} type="button" onClick={dismiss}>{t('common.cancel')}</button><button type="submit" disabled={!note.trim()}>{t('workflow.returnWork')}</button></div></form></dialog>
}
