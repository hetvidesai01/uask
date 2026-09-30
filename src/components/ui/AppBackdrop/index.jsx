import { useLocation } from 'react-router-dom'
import AnimatedBackground from '../AnimatedBackground'
import styles from './AppBackdrop.module.css'

// One shared, fixed ambient layer for every logged-in screen (mounted once
// in AppLayout, so it persists across navigation instead of restarting).
// Intensity follows the screen: a bit more on Discover/Profile, barely-there
// on form and settings screens so nothing moves behind inputs.
function variantForPath(pathname) {
  if (
    pathname.startsWith('/app/asks/new') ||
    pathname.endsWith('/respond') ||
    pathname.startsWith('/app/settings')
  ) {
    return 'minimal'
  }
  if (pathname.endsWith('/contract')) return 'restrained'
  return 'shell'
}

export default function AppBackdrop() {
  const { pathname } = useLocation()
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <AnimatedBackground variant={variantForPath(pathname)} />
    </div>
  )
}
