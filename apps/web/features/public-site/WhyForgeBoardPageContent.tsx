import Link from 'next/link'

import { PublicSiteFrame } from './PublicSiteFrame'
import { SlidingNumber } from './SlidingNumber'
import styles from './WhyForgeBoardPageContent.module.css'

export function WhyForgeBoardPageContent() {
  return <PublicSiteFrame activePath="/why-forgeboard">
    <section className={styles.page} aria-labelledby="why-heading">
      <p className={styles.eyebrow}>WHY FORGEBOARD</p>
      <h1 id="why-heading">Work should not disappear between a spreadsheet, inbox, and deadline.</h1>
      <p className={styles.intro}>ForgeBoard gives accounting firms one dependable view of recurring client work, ownership, review, and risk.</p>
      <p className={styles.proof}><SlidingNumber value={28} /> <span>accounting professionals use ForgeBoard.</span></p>
      <Link className={styles.cta} href="/contact">Start a conversation <span aria-hidden="true">→</span></Link>
    </section>
  </PublicSiteFrame>
}
