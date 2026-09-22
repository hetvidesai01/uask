import styles from './GrainOverlay.module.css'

// Ambient film-grain texture mounted once at the app root (see App.jsx).
// Static — no animation — so it needs no reduced-motion handling.
export default function GrainOverlay() {
  return <div className={styles.grain} aria-hidden="true" />
}
