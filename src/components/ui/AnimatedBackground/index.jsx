import styles from './AnimatedBackground.module.css'

// Reusable ambient backdrop for the "Open Call" light system — floating
// blush/red blobs, faint SignalMark-style rings, sparse drifting nodes, and
// the occasional connecting line. Purely decorative: aria-hidden,
// pointer-events: none, and always painted behind page content.
//
// Mount it as the FIRST child of a container that has both
// `position: relative` and `isolation: isolate` — isolation confines this
// component's `z-index: -1` layer to that container, so it can only ever
// sit behind that container's own children and never affects stacking
// elsewhere in the app shell (sidebar, top bar, drawers, etc).
//
// All motion here is plain CSS (`@keyframes`, gated behind
// `prefers-reduced-motion: no-preference`) rather than Framer Motion —
// these are ambient infinite loops with nothing to communicate, so a
// motion-value/JS-driven approach would be pure overhead. This is the one
// other sanctioned exception (alongside Spinner's loading rotation) to the
// "no infinite/looping animation" rule, scoped strictly to this component.
// Under reduced motion the elements still render, just frozen at rest.
//
// `variant` picks a preset intensity so each page reaches for a named level
// instead of hand-tuning element counts:
//   - 'expressive' — Landing: moving blush forms + signal rings + sparse nodes + lines
//   - 'rich'       — Premium: slightly richer blush/red movement
//   - 'quiet'      — default logged-in screens (Discover, Profile): one or two subtle elements
//   - 'restrained' — Dashboard: extremely restrained, a single faint shape
//   - 'minimal'    — forms (Create ASK): barely-there movement so it never competes with input focus
const VARIANTS = {
  expressive: {
    shapes: [
      { top: '-10%', left: '-8%', size: '48%', color: 'var(--blush)', opacity: 0.55, duration: 18, delay: 0 },
      { top: '52%', right: '-12%', size: '38%', color: 'var(--pink)', opacity: 0.42, duration: 22, delay: 2 },
      { top: '18%', right: '12%', size: '22%', color: 'var(--red)', opacity: 0.1, duration: 16, delay: 1 },
    ],
    rings: [
      { top: '14%', left: '62%', size: '520px', opacity: 0.1, duration: 20 },
      { top: '68%', left: '10%', size: '380px', opacity: 0.08, duration: 17 },
    ],
    nodes: [
      { top: '20%', left: '32%', duration: 12 },
      { top: '38%', left: '86%', duration: 15 },
      { top: '74%', left: '48%', duration: 11 },
      { top: '84%', left: '22%', duration: 14 },
      { top: '10%', left: '92%', duration: 13 },
    ],
    connections: [
      { d: 'M 15,22 Q 40,8 66,34', duration: 20 },
      { d: 'M 28,76 Q 54,58 82,80', duration: 24 },
    ],
  },
  rich: {
    shapes: [
      { top: '-12%', right: '-10%', size: '42%', color: 'var(--blush)', opacity: 0.5, duration: 19, delay: 0 },
      { top: '62%', left: '-12%', size: '30%', color: 'var(--red)', opacity: 0.14, duration: 21, delay: 3 },
    ],
    rings: [{ top: '22%', left: '70%', size: '360px', opacity: 0.1, duration: 18 }],
    nodes: [
      { top: '26%', left: '14%', duration: 13 },
      { top: '70%', left: '84%', duration: 15 },
    ],
    connections: [],
  },
  quiet: {
    shapes: [{ top: '-8%', right: '-12%', size: '32%', color: 'var(--blush)', opacity: 0.35, duration: 20, delay: 0 }],
    rings: [{ top: '72%', left: '88%', size: '280px', opacity: 0.06, duration: 19 }],
    nodes: [{ top: '30%', left: '94%', duration: 14 }],
    connections: [],
  },
  restrained: {
    shapes: [{ top: '-10%', right: '-10%', size: '26%', color: 'var(--blush)', opacity: 0.26, duration: 22, delay: 0 }],
    rings: [],
    nodes: [],
    connections: [],
  },
  minimal: {
    shapes: [{ top: '-12%', left: '-10%', size: '22%', color: 'var(--blush)', opacity: 0.2, duration: 26, delay: 0 }],
    rings: [],
    nodes: [],
    connections: [],
  },
}

export default function AnimatedBackground({ variant = 'quiet', className = '' }) {
  const config = VARIANTS[variant] || VARIANTS.quiet

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} aria-hidden="true">
      {config.shapes.map((shape, index) => (
        <span
          key={`shape-${index}`}
          className={styles.shape}
          style={{
            top: shape.top,
            left: shape.left,
            right: shape.right,
            width: shape.size,
            '--shape-color': shape.color,
            '--shape-opacity': shape.opacity,
            '--drift-duration': `${shape.duration}s`,
            '--drift-delay': `${shape.delay || 0}s`,
          }}
        />
      ))}

      {config.rings.map((ring, index) => (
        <span
          key={`ring-${index}`}
          className={styles.ring}
          style={{
            top: ring.top,
            left: ring.left,
            width: ring.size,
            height: ring.size,
            '--ring-opacity': ring.opacity,
            '--ring-duration': `${ring.duration}s`,
          }}
        />
      ))}

      {config.nodes.map((node, index) => (
        <span
          key={`node-${index}`}
          className={styles.node}
          style={{ top: node.top, left: node.left, '--node-duration': `${node.duration}s` }}
        />
      ))}

      {config.connections.length > 0 && (
        <svg className={styles.connections} viewBox="0 0 100 100" preserveAspectRatio="none">
          {config.connections.map((line, index) => (
            <path
              key={`line-${index}`}
              d={line.d}
              className={styles.connectionPath}
              style={{ '--line-duration': `${line.duration}s` }}
            />
          ))}
        </svg>
      )}
    </div>
  )
}
