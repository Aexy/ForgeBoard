import Link from 'next/link'

import { PublicSiteFrame } from './PublicSiteFrame'
import { SlidingNumber } from './SlidingNumber'
import styles from './WhyForgeBoardPageContent.module.css'

const accountingReasons = [
  { title: 'Recurring by nature', description: 'Monthly, quarterly, and annual client work needs a dependable rhythm instead of another round of rebuilding the plan.' },
  { title: 'Deadlines matter', description: 'Hard filing and client-service deadlines make risk easier to act on when it is visible before it becomes urgent.' },
  { title: 'Ownership is explicit', description: 'Every handoff needs a clear next action and an owner, from preparation through review.' },
  { title: 'Client work has context', description: 'The work, its prerequisites, and the activity around it belong together so the team can move forward with confidence.' },
]

const comparisonPairs = [
  ['Work exists in separate places', 'Live workflow'],
  ['Email carries the context', 'Context stays with the work'],
  ['Deadlines are remembered', 'Deadline risk is visible'],
  ['Ownership lives in people’s heads', 'The next action has an owner'],
  ['Review is informal', 'Review follows the workflow'],
  ['History is scattered', 'Material activity is traceable'],
]

const attentionEngagements = [
  { client: 'Muster GmbH', engagement: 'VAT Q3', owner: 'Anna', status: 'Overdue', statusClass: 'overdue', progress: '82%' },
  { client: 'Nova GmbH', engagement: 'Monthly bookkeeping', owner: 'Markus', status: 'Awaiting review', statusClass: 'review', progress: '68%' },
  { client: 'Schmidt KG', engagement: 'Payroll August', owner: 'Anna', status: 'Waiting on client', statusClass: 'waiting', progress: '38%' },
]

const augustEngagements = [
  { client: 'Muster GmbH', work: 'August bookkeeping engagement' },
  { client: 'Nova GmbH', work: 'August bookkeeping engagement' },
  { client: 'Schmidt KG', work: 'August bookkeeping engagement' },
]

const reviewFlow = [
  { label: 'Anna preparing', kind: 'person' },
  { label: 'Submitted for review', kind: 'status' },
  { label: 'Markus reviewing', kind: 'person' },
  { label: 'Approved', kind: 'status' },
]

const clientWork = [
  { client: 'Muster GmbH', engagement: 'VAT Q3', context: 'Waiting for bank statements', status: 'Client action required', statusClass: 'clientAction' },
  { client: 'Schmidt KG', engagement: 'Payroll August', context: 'Preparation complete', status: 'Awaiting review', statusClass: 'awaitingReview' },
  { client: 'Nova GmbH', engagement: 'Monthly bookkeeping', context: 'Owner: Lukas', status: 'In progress', statusClass: 'inProgress', deadline: 'Due in 2 days', statusFirst: true },
]

const forgeBoardHandles = ['Recurring engagements', 'Workflow stages', 'Ownership and review handoffs', 'Deadlines and blockers', 'Client-work status', 'Activity history']
const forgeBoardDoesNotReplace = ['A general ledger', 'Tax calculation or filing', 'Payroll', 'A bookkeeping engine', 'Billing or payments', 'A document archive']

export function WhyForgeBoardPageContent() {
  return <PublicSiteFrame activePath="/why-forgeboard">
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="why-heading">
        <p className={styles.eyebrow}>WHY FORGEBOARD</p>
        <h1 id="why-heading">Work should not disappear between a spreadsheet, inbox, and deadline.</h1>
        <p className={styles.intro}>ForgeBoard gives accounting firms one dependable place to coordinate recurring client work, ownership, reviews, blockers, and deadlines.</p>
        <p className={styles.proof}><SlidingNumber value={28} /> <span>accounting professionals use ForgeBoard.</span></p>
        <Link className={styles.textLink} href="/contact">Start a conversation <span aria-hidden="true">→</span></Link>
      </section>

      <section className={`${styles.section} ${styles.accountingFit}`} aria-labelledby="accounting-fit-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>ACCOUNTING FIRST</p>
          <h2 id="accounting-fit-heading">Built for the way accounting firms actually work.</h2>
        </div>
        <ul className={styles.reasonList}>
          {accountingReasons.map((reason) => <li key={reason.title}>
            <p className={styles.itemTitle}>{reason.title}</p>
            <p>{reason.description}</p>
          </li>)}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.problem}`} aria-labelledby="problem-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>THE COORDINATION GAP</p>
          <h2 id="problem-heading">The problem isn&apos;t another task list.</h2>
          <p>Accounting teams need the current state of client work to be clear without reconstructing it from spreadsheets, email threads, and memory.</p>
        </div>
        <div className={styles.comparison}>
          <ul className={styles.comparisonList} aria-label="Spreadsheet and inbox compared with ForgeBoard">
            {comparisonPairs.map(([spreadsheet, forgeBoard]) => <li className={styles.comparisonPair} key={spreadsheet}>
              <div className={`${styles.comparisonCell} ${styles.comparisonProblem}`}>
                <p className={styles.comparisonLabel}>Spreadsheet + inbox</p>
                <p>{spreadsheet}</p>
              </div>
              <div className={`${styles.comparisonCell} ${styles.comparisonForgeBoard}`}>
                <p className={styles.comparisonLabel}>ForgeBoard</p>
                <p>{forgeBoard}</p>
              </div>
            </li>)}
          </ul>
        </div>
      </section>

      <section className={`${styles.section} ${styles.firmVisibility}`} aria-labelledby="firm-visibility-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>FIRM VISIBILITY</p>
          <h2 id="firm-visibility-heading">Know where the firm needs attention.</h2>
          <p>Give managers a calm view of the client work that needs a decision, a review, or a follow-up before deadlines become surprises.</p>
        </div>
        <ul className={styles.attentionList} aria-label="Engagements needing attention">
          {attentionEngagements.map((engagement) => <li key={engagement.client}>
            <p className={styles.engagementClient}>{engagement.client}</p>
            <p className={`${styles.engagementState} ${styles[engagement.statusClass]}`}>{engagement.status}</p>
            <div className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressFill} style={{ width: engagement.progress }} />
            </div>
            <p className={styles.engagementContext}>{engagement.engagement} <span aria-hidden="true">·</span> Owner: {engagement.owner}</p>
          </li>)}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.repeatableWork}`} aria-labelledby="repeatable-work-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>REPEATABLE WORK</p>
          <h2 id="repeatable-work-heading">Stop rebuilding the same work every month.</h2>
          <p>Define the structure once, then reuse that structure for recurring client engagements while keeping each engagement&apos;s ownership and current state clear.</p>
        </div>
        <div className={styles.templateFlow}>
          <article className={styles.templateCard} aria-label="Monthly bookkeeping template">
            <p className={styles.templateLabel}>SOURCE TEMPLATE</p>
            <p className={styles.templateTitle}>Monthly bookkeeping template</p>
            <dl>
              <div><dt>Linked workflow</dt><dd>Prepare, reconcile, review</dd></div>
              <div><dt>Recurrence</dt><dd>Monthly</dd></div>
              <div><dt>Default work item</dt><dd>Prepare monthly bookkeeping</dd></div>
              <div><dt>Due day</dt><dd>10th of each month</dd></div>
            </dl>
          </article>
          <span className={styles.templateArrow} aria-hidden="true">→</span>
          <ul className={styles.generatedEngagements} aria-label="August client engagements">
            {augustEngagements.map((engagement) => <li key={engagement.client}>
              <strong>{engagement.client}</strong>
              <span>{engagement.work}</span>
            </li>)}
          </ul>
        </div>
      </section>

      <section className={`${styles.section} ${styles.reviewAccountability}`} aria-labelledby="review-accountability-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>REVIEW ACCOUNTABILITY</p>
          <h2 id="review-accountability-heading">Done isn&apos;t the same as reviewed.</h2>
          <p>ForgeBoard makes the handoff visible so the preparer, reviewer, and next action stay clear through a decision.</p>
        </div>
        <div className={styles.reviewIllustration}>
          <ol className={styles.reviewFlow} aria-label="Review accountability flow">
            {reviewFlow.map((step, index) => <li key={step.label}>
              <span className={styles.reviewStepNumber} aria-hidden="true">{index + 1}</span>
              <p className={step.kind === 'status' ? styles.reviewStatus : styles.reviewPerson}>{step.label}</p>
            </li>)}
          </ol>
          <p className={styles.correctionMessage}>
            <strong>Returned for correction</strong>
            <span>Missing supporting documentation for Q2.</span>
          </p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.clientBlockers}`} aria-labelledby="client-blockers-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>CLIENT DEPENDENCIES</p>
          <h2 id="client-blockers-heading">Sometimes your team isn&apos;t the blocker.</h2>
          <p>When a client needs to act, make that dependency clear so the team can follow up without losing the engagement&apos;s context.</p>
        </div>
        <ul className={styles.clientWorkList} aria-label="Client work status">
          {clientWork.map((work) => <li key={work.client}>
            <p className={styles.clientWorkClient}>{work.client}</p>
            <p className={styles.clientWorkEngagement}>{work.engagement}</p>
            {work.statusFirst ? <p className={`${styles.statusChip} ${styles[work.statusClass]}`}>{work.status}</p> : null}
            <p className={styles.clientWorkContext}>{work.context}</p>
            {work.deadline ? <p className={styles.clientWorkDeadline}>{work.deadline}</p> : null}
            {!work.statusFirst ? <p className={`${styles.statusChip} ${styles[work.statusClass]}`}>{work.status}</p> : null}
          </li>)}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.positioning}`} aria-labelledby="positioning-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>A COMPLEMENT, NOT A REPLACEMENT</p>
          <h2 id="positioning-heading">ForgeBoard coordinates the work around your accounting systems.</h2>
          <p>It complements the systems that handle accounting work itself, giving the firm one place to coordinate the client work around them.</p>
        </div>
        <div className={styles.scopeLists}>
          <section className={styles.scopeList} aria-label="ForgeBoard handles">
            <p className={styles.itemTitle}>ForgeBoard handles</p>
            <ul>{forgeBoardHandles.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className={styles.scopeList} aria-label="ForgeBoard does not replace">
            <p className={styles.itemTitle}>ForgeBoard does not replace</p>
            <ul>{forgeBoardDoesNotReplace.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-cta-heading">
        <div>
          <p className={styles.kicker}>ONE DEPENDABLE WORKFLOW</p>
          <h2 id="final-cta-heading">Run recurring client work with fewer blind spots.</h2>
        </div>
        <Link className={styles.textLink} href="/contact">Talk to ForgeBoard <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  </PublicSiteFrame>
}
