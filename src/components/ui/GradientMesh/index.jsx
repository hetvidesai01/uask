import styles from './GradientMesh.module.css'

// Reusable low-opacity "signal glow" backdrop — a red/pink gradient mesh for
// hero/CTA-style sections. Not mounted anywhere yet (that's page-level work
// for a later phase); render it as the first child of a `position: relative`
// container and it fills that container, sitting behind normal content.
export default function GradientMesh({ className = '' }) {
  return (
    <div className={[styles.mesh, className].filter(Boolean).join(' ')} aria-hidden="true">
      <div className={styles.blobRed} />
      <div className={styles.blobPink} />
    </div>
  )
}
