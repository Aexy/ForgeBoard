import styles from './WorkflowMark.module.css'

const stages = [
  { label: 'PREPARE', cards: ['light', 'lime'] },
  { label: 'REVIEW', cards: ['light', 'light'] },
  { label: 'COMPLETE', cards: ['lime'] },
] as const

export function WorkflowMark({ layout = 'overlay' }: Readonly<{ layout?: 'overlay' | 'embedded' }>) {
  return <div className={`${styles.mark} ${layout === 'embedded' ? styles.embedded : ''}`} data-layout={layout} aria-hidden="true">
    <div className={styles.halo} />
    <div className={styles.openFrame} />
    <div className={styles.board}>
      {stages.map((stage) => <div className={styles.column} key={stage.label}>
        <span aria-hidden="true">{stage.label}</span>
        {stage.cards.map((tone, index) => <i className={tone === 'lime' ? styles.limeCard : styles.lightCard} key={index} />)}
      </div>)}
    </div>
  </div>
}
