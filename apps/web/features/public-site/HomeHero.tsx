import Link from 'next/link'

import { PublicSiteFrame } from './PublicSiteFrame'
import { WorkflowMark } from './WorkflowMark'
import styles from './HomeHero.module.css'

export function HomeHero() {
  return <PublicSiteFrame activePath="/">
    <section className={styles.hero} aria-labelledby="home-heading">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>FROM DEADLINE TO DONE</p>
        <h1 id="home-heading">The calm, accountable way to run client work.</h1>
        <p>See every engagement’s next action, owner, and deadline—before it becomes a problem.</p>
        <Link className={styles.cta} href="/product">Learn more <span aria-hidden="true">↓</span></Link>
      </div>
      <WorkflowMark />
      <p className={styles.scrollCue}><span aria-hidden="true" />Scroll to explore</p>
    </section>
  </PublicSiteFrame>
}
