import { PublicSiteFrame } from './PublicSiteFrame'
import styles from './ContactPageContent.module.css'

export function ContactPageContent() {
  return <PublicSiteFrame activePath="/contact">
    <section className={styles.page} aria-labelledby="contact-heading">
      <p className={styles.eyebrow}>CONTACT</p>
      <h1 id="contact-heading">Let’s make client work easier to move forward.</h1>
      <p className={styles.intro}>Tell us how your firm currently manages recurring work, deadlines, and review handoffs.</p>
      <a className={styles.cta} href="mailto:ali.aikaraca@gmail.com" aria-label="Email ForgeBoard">Email ForgeBoard <span aria-hidden="true">→</span></a>
      <p className={styles.email}>ali.aikaraca@gmail.com</p>
    </section>
  </PublicSiteFrame>
}
