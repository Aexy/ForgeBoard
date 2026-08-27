import Link from 'next/link'

import { PublicSiteFrame } from './PublicSiteFrame'
import { WorkflowMark } from './WorkflowMark'
import styles from './ProductPageContent.module.css'

export function ProductPageContent() {
  return <PublicSiteFrame activePath="/product">
    <section className={styles.page} aria-labelledby="product-heading">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>THE FORGEBOARD WORKFLOW</p>
        <h1 id="product-heading">A dependable workflow for every client engagement.</h1>
        <p>Configure recurring work, give every handoff an owner, and see deadline risk before it becomes urgent.</p>
      </div>
      <div className={styles.illustration} data-testid="product-workflow-illustration">
        <WorkflowMark layout="embedded" />
      </div>
      <ol className={styles.steps} aria-label="ForgeBoard workflow">
        <li><h2>Prepare</h2><p>Gather work and client prerequisites in one accountable place.</p></li>
        <li><h2>Review</h2><p>Hand work to the right reviewer with the context they need.</p></li>
        <li><h2>Complete</h2><p>Close the engagement with a clear record of what happened.</p></li>
      </ol>
      <Link className={styles.cta} href="/contact">Talk to ForgeBoard <span aria-hidden="true">→</span></Link>
    </section>
  </PublicSiteFrame>
}
