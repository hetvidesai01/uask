import { useEffect } from 'react'
import styles from './Legal.module.css'

export default function LegalPage({ title, badge, intro, sections }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className={styles.page}>
      <article className={styles.content}>
        <p className={styles.badge}>{badge}</p>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        {sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.h2}>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  )
}
