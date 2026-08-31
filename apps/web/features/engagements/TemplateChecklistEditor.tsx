'use client'

import type { TemplateChecklistItem } from './engagements-transport'
import styles from './TemplateChecklistEditor.module.css'

function normalize(items: TemplateChecklistItem[]): TemplateChecklistItem[] {
  return items.map((item, position) => ({ ...item, position }))
}

export function TemplateChecklistEditor({ items, onChange }: Readonly<{ items: TemplateChecklistItem[]; onChange: (items: TemplateChecklistItem[]) => void }>) {
  const update = (index: number, next: Partial<TemplateChecklistItem>) => onChange(normalize(items.map((item, current) => current === index ? { ...item, ...next } : item)))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(normalize(next))
  }

  return <fieldset className={styles.editor}>
    <legend>Checklist</legend>
    <p>Checklist items are copied to each engagement. Required items must be complete before review.</p>
    {items.length === 0 && <p className={styles.empty}>No checklist items yet.</p>}
    <ol>
      {items.map((item, index) => <li key={`${item.position}-${index}`}>
        <label className={styles.itemLabel}>Item
          <input aria-label={`Checklist item ${index + 1}`} value={item.label} maxLength={200} required onChange={(event) => update(index, { label: event.target.value })} />
        </label>
        <label className={styles.required}><input type="checkbox" checked={item.required} onChange={(event) => update(index, { required: event.target.checked })} /> Required</label>
        <div className={styles.itemActions} aria-label={`Checklist item ${index + 1} actions`}>
          <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>Move up</button>
          <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1}>Move down</button>
          <button type="button" onClick={() => onChange(normalize(items.filter((_item, current) => current !== index)))}>Remove</button>
        </div>
      </li>)}
    </ol>
    <button type="button" className={styles.add} onClick={() => onChange([...normalize(items), { label: '', required: true, position: items.length }])}>Add checklist item</button>
  </fieldset>
}
